import { cp, lstat, mkdir, readFile, readlink, rename, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import {
  REPO_ROOT,
  commandExists,
  compatibleWithPlatform,
  isGitCheckout,
  loadRepository,
  managedRoot,
  pathExists,
  selectAgents,
} from './library.js';

const STATE_SCHEMA_VERSION = 1;

function normalized(path) {
  const result = resolve(path);
  return process.platform === 'win32' ? result.toLowerCase() : result;
}

function samePath(left, right) {
  return normalized(left) === normalized(right);
}

async function inspectTarget(target, acceptedSources) {
  let stats;
  try {
    stats = await lstat(target);
  } catch (error) {
    if (error.code === 'ENOENT') return { status: 'missing' };
    throw error;
  }

  if (!stats.isSymbolicLink()) {
    return { status: 'conflict', reason: 'an existing non-link entry is present' };
  }

  const rawSource = await readlink(target);
  const actualSource = resolve(dirname(target), rawSource);
  if (acceptedSources.some((source) => samePath(source, actualSource))) {
    return { status: 'managed', actualSource };
  }
  return {
    status: 'conflict',
    reason: (await pathExists(actualSource))
      ? `link points outside managed sources: ${actualSource}`
      : `broken link points to: ${actualSource}`,
    actualSource,
  };
}

async function readState(home) {
  const path = join(managedRoot(home), 'state.json');
  try {
    const state = JSON.parse(await readFile(path, 'utf8'));
    return state.schemaVersion === STATE_SCHEMA_VERSION
      ? state
      : { schemaVersion: STATE_SCHEMA_VERSION, links: [] };
  } catch (error) {
    if (error.code === 'ENOENT') return { schemaVersion: STATE_SCHEMA_VERSION, links: [] };
    throw new Error(`Cannot read managed state ${path}: ${error.message}`);
  }
}

async function writeState(home, state) {
  const root = managedRoot(home);
  const statePath = join(root, 'state.json');
  const temporary = join(root, `.state-${process.pid}-${Date.now()}.json`);
  await mkdir(root, { recursive: true });
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await rename(temporary, statePath);
}

async function atomicReplaceDirectory(source, target) {
  const parent = dirname(target);
  const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const staging = `${target}.staging-${suffix}`;
  const backup = `${target}.backup-${suffix}`;
  await mkdir(parent, { recursive: true });
  await cp(source, staging, { recursive: true, force: false, errorOnExist: true });

  const hadTarget = await pathExists(target);
  if (hadTarget) await rename(target, backup);
  try {
    await rename(staging, target);
    if (hadTarget) await rm(backup, { recursive: true, force: true });
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    if (hadTarget && !(await pathExists(target))) await rename(backup, target);
    throw error;
  }
}

function stateSource(state, agentId, skillName) {
  return state.links.find((link) => link.agent === agentId && link.skill === skillName)?.source;
}

function updateStateLink(links, record) {
  return [
    ...links.filter((link) => !(link.agent === record.agent && link.skill === record.skill)),
    record,
  ];
}

export async function installSkills({
  home,
  repoRoot = REPO_ROOT,
  platform = process.platform,
  requestedAgents = [],
  dryRun = false,
  dev = false,
  pathValue = process.env.PATH || '',
} = {}) {
  if (dev && !isGitCheckout(repoRoot)) {
    throw new Error('--dev requires a local Git checkout; do not use it from an npx cache');
  }

  const [{ skills, packageInfo }, agents, state] = await Promise.all([
    loadRepository(repoRoot),
    selectAgents({ home, repoRoot, requested: requestedAgents }),
    readState(home),
  ]);
  if (agents.length === 0) {
    throw new Error('No supported Agent configuration directories were detected');
  }

  const compatible = skills.filter((skill) => compatibleWithPlatform(skill, platform));
  const skipped = skills
    .filter((skill) => !compatibleWithPlatform(skill, platform))
    .map((skill) => ({ skill: skill.name, reason: `unsupported on ${platform}` }));
  const warnings = [];
  for (const skill of compatible) {
    for (const command of skill.requires?.commands || []) {
      if (!(await commandExists(command, pathValue))) {
        warnings.push(`${skill.name}: required command "${command}" was not found in PATH`);
      }
    }
  }

  const root = managedRoot(home);
  const plans = [];
  const conflicts = [];
  for (const agent of agents) {
    for (const skill of compatible) {
      const desiredSource = dev
        ? skill.absolutePath
        : join(root, 'skills', skill.name);
      const target = join(agent.skillsPath, skill.name);
      const previousSource = stateSource(state, agent.id, skill.name);
      const acceptedSources = [desiredSource, previousSource].filter(Boolean);
      const inspection = await inspectTarget(target, acceptedSources);
      if (inspection.status === 'conflict') {
        conflicts.push({ agent: agent.id, skill: skill.name, target, reason: inspection.reason });
      } else {
        plans.push({ agent, skill, target, desiredSource, inspection });
      }
    }
  }

  const actions = [];
  if (!dev) {
    for (const skill of compatible) {
      const target = join(root, 'skills', skill.name);
      actions.push({ type: 'copy', skill: skill.name, source: skill.absolutePath, target });
      if (!dryRun) await atomicReplaceDirectory(skill.absolutePath, target);
    }
  }

  let links = [...state.links];
  for (const plan of plans) {
    const { agent, skill, target, desiredSource, inspection } = plan;
    if (inspection.status === 'managed' && samePath(inspection.actualSource, desiredSource)) {
      actions.push({ type: 'noop', agent: agent.id, skill: skill.name, target });
    } else {
      actions.push({ type: 'link', agent: agent.id, skill: skill.name, source: desiredSource, target });
      if (!dryRun) {
        await mkdir(agent.skillsPath, { recursive: true });
        if (inspection.status === 'managed') await unlink(target);
        await symlink(desiredSource, target, process.platform === 'win32' ? 'junction' : 'dir');
      }
    }
    links = updateStateLink(links, {
      agent: agent.id,
      skill: skill.name,
      target,
      source: desiredSource,
      mode: dev ? 'dev' : 'managed',
    });
  }

  if (!dryRun) {
    await writeState(home, {
      schemaVersion: STATE_SCHEMA_VERSION,
      packageVersion: packageInfo.version,
      source: dev ? repoRoot : 'github:siifish/siifish-skills',
      updatedAt: new Date().toISOString(),
      links,
    });
  }

  return { agents, actions, conflicts, skipped, warnings, dryRun, dev };
}

export async function getStatus({
  home,
  repoRoot = REPO_ROOT,
  platform = process.platform,
  requestedAgents = [],
} = {}) {
  const [{ skills }, agents, state] = await Promise.all([
    loadRepository(repoRoot),
    selectAgents({ home, repoRoot, requested: requestedAgents }),
    readState(home),
  ]);
  const entries = [];
  for (const agent of agents) {
    for (const skill of skills) {
      const target = join(agent.skillsPath, skill.name);
      if (!compatibleWithPlatform(skill, platform)) {
        entries.push({ agent: agent.id, skill: skill.name, target, status: 'unsupported' });
        continue;
      }
      const recordedSource = stateSource(state, agent.id, skill.name);
      const managedSource = join(managedRoot(home), 'skills', skill.name);
      const inspection = await inspectTarget(target, [recordedSource, managedSource, skill.absolutePath].filter(Boolean));
      entries.push({
        agent: agent.id,
        skill: skill.name,
        target,
        status: inspection.status === 'managed' ? 'installed' : inspection.status,
        reason: inspection.reason,
      });
    }
  }
  return { agents, entries };
}

export async function uninstallSkills({
  home,
  repoRoot = REPO_ROOT,
  requestedAgents = [],
  platform = process.platform,
} = {}) {
  const [{ skills }, agents, state] = await Promise.all([
    loadRepository(repoRoot),
    selectAgents({ home, repoRoot, requested: requestedAgents }),
    readState(home),
  ]);
  if (agents.length === 0) {
    throw new Error('No supported Agent configuration directories were detected');
  }

  const actions = [];
  const conflicts = [];
  let links = [...state.links];
  for (const agent of agents) {
    for (const skill of skills) {
      const target = join(agent.skillsPath, skill.name);
      const recordedSource = stateSource(state, agent.id, skill.name);
      const acceptedSources = [
        recordedSource,
        join(managedRoot(home), 'skills', skill.name),
        skill.absolutePath,
      ].filter(Boolean);
      const inspection = await inspectTarget(target, acceptedSources);
      if (inspection.status === 'managed') {
        await unlink(target);
        actions.push({ type: 'unlink', agent: agent.id, skill: skill.name, target });
        links = links.filter((link) => !(link.agent === agent.id && link.skill === skill.name));
      } else if (inspection.status === 'missing') {
        actions.push({ type: 'noop', agent: agent.id, skill: skill.name, target });
        links = links.filter((link) => !(link.agent === agent.id && link.skill === skill.name));
      } else {
        conflicts.push({ agent: agent.id, skill: skill.name, target, reason: inspection.reason });
      }
    }
  }

  await writeState(home, {
    ...state,
    schemaVersion: STATE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    links,
  });
  return { agents, actions, conflicts, platform };
}

export function displayPath(path, home) {
  const fromHome = relative(home, path);
  return fromHome && !fromHome.startsWith('..') ? `~/${fromHome}` : path;
}
