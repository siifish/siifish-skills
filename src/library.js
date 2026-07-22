import { access, lstat, readFile } from 'node:fs/promises';
import { constants as fsConstants, existsSync } from 'node:fs';
import { delimiter, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export function parseFrontmatter(markdown, source = 'SKILL.md') {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    throw new Error(`${source}: missing YAML frontmatter`);
  }

  const values = {};
  const keys = [];
  for (const [index, rawLine] of match[1].split(/\r?\n/).entries()) {
    if (!rawLine.trim()) continue;
    if (/^\s/.test(rawLine)) {
      throw new Error(`${source}: unsupported nested frontmatter on line ${index + 2}`);
    }
    const separator = rawLine.indexOf(':');
    if (separator < 1) {
      throw new Error(`${source}: invalid frontmatter on line ${index + 2}`);
    }
    const key = rawLine.slice(0, separator).trim();
    let value = rawLine.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (Object.hasOwn(values, key)) {
      throw new Error(`${source}: duplicate frontmatter key ${key}`);
    }
    keys.push(key);
    values[key] = value;
  }

  return { values, keys, body: markdown.slice(match[0].length) };
}

export async function loadRepository(repoRoot = REPO_ROOT) {
  const [catalog, agentConfig, packageInfo] = await Promise.all([
    readJson(join(repoRoot, 'catalog.json')),
    readJson(join(repoRoot, 'config', 'agents.json')),
    readJson(join(repoRoot, 'package.json')),
  ]);

  const skills = await Promise.all(catalog.skills.map(async (entry) => {
    const absolutePath = resolve(repoRoot, entry.path);
    const skillFile = join(absolutePath, 'SKILL.md');
    const markdown = await readFile(skillFile, 'utf8');
    const frontmatter = parseFrontmatter(markdown, skillFile);
    return {
      ...entry,
      absolutePath,
      description: frontmatter.values.description,
    };
  }));

  return { catalog, agentConfig, packageInfo, skills };
}

export async function detectAgents({ home, repoRoot = REPO_ROOT } = {}) {
  const { agentConfig } = await loadRepository(repoRoot);
  const detected = [];
  for (const agent of agentConfig.agents) {
    const configPath = join(home, agent.configDir);
    if (await pathExists(configPath)) {
      detected.push({
        ...agent,
        configPath,
        skillsPath: join(configPath, agent.skillsDir),
      });
    }
  }
  return detected;
}

export async function selectAgents({ home, repoRoot = REPO_ROOT, requested = [] }) {
  const { agentConfig } = await loadRepository(repoRoot);
  const known = new Map(agentConfig.agents.map((agent) => [agent.id, agent]));
  for (const id of requested) {
    if (!known.has(id)) {
      throw new Error(`Unknown agent "${id}". Valid IDs: ${[...known.keys()].join(', ')}`);
    }
  }

  const detected = await detectAgents({ home, repoRoot });
  if (requested.length === 0) return detected;

  const detectedById = new Map(detected.map((agent) => [agent.id, agent]));
  const missing = requested.filter((id) => !detectedById.has(id));
  if (missing.length > 0) {
    throw new Error(`Agent config not detected: ${missing.join(', ')}`);
  }
  return requested.map((id) => detectedById.get(id));
}

export function managedRoot(home) {
  return join(home, '.siifish-skills');
}

export function compatibleWithPlatform(skill, platform) {
  return !skill.platforms || skill.platforms.length === 0 || skill.platforms.includes(platform);
}

export async function commandExists(command, pathValue = process.env.PATH || '') {
  const extensions = process.platform === 'win32'
    ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';')
    : [''];
  for (const directory of pathValue.split(delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = join(directory, `${command}${extension}`);
      try {
        await access(candidate, process.platform === 'win32' ? fsConstants.F_OK : fsConstants.X_OK);
        return true;
      } catch {
        // Continue searching PATH.
      }
    }
  }
  return false;
}

export async function pathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export function isSafeRelativePath(path) {
  return typeof path === 'string' && path.length > 0 && !isAbsolute(path) &&
    !path.split(/[\\/]/).includes('..');
}

export function isGitCheckout(repoRoot = REPO_ROOT) {
  return existsSync(join(repoRoot, '.git'));
}
