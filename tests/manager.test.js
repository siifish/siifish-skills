import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { detectAgents, managedRoot } from '../src/library.js';
import { getStatus, installSkills, uninstallSkills } from '../src/manager.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function temporaryHome(agentDirs = ['.claude']) {
  const home = await mkdtemp(join(tmpdir(), 'siifish-skills-test-'));
  for (const directory of agentDirs) await mkdir(join(home, directory), { recursive: true });
  return home;
}

async function removeHome(home) {
  await rm(home, { recursive: true, force: true });
}

test('detects only existing Agent config directories', async () => {
  const home = await temporaryHome(['.claude', '.codex', '.config/opencode']);
  try {
    const agents = await detectAgents({ home, repoRoot: REPO_ROOT });
    assert.deepEqual(agents.map((agent) => agent.id), ['claude', 'codex', 'opencode']);
  } finally {
    await removeHome(home);
  }
});

test('managed install copies once, links all detected Agents, and is idempotent', async () => {
  const home = await temporaryHome(['.claude', '.codex']);
  try {
    const first = await installSkills({
      home,
      repoRoot: REPO_ROOT,
      platform: 'darwin',
      pathValue: '',
    });
    assert.equal(first.conflicts.length, 0);
    assert.ok(first.warnings.some((warning) => warning.includes('bearcli')));

    const canonical = join(managedRoot(home), 'skills', 'bear-notes');
    assert.equal(await readFile(join(canonical, 'SKILL.md'), 'utf8').then((value) => value.includes('name: bear-notes')), true);
    for (const agentDir of ['.claude', '.codex']) {
      const target = join(home, agentDir, 'skills', 'bear-notes');
      assert.equal((await lstat(target)).isSymbolicLink(), true);
      assert.equal(resolve(dirname(target), await readlink(target)), canonical);
    }

    const second = await installSkills({
      home,
      repoRoot: REPO_ROOT,
      platform: 'darwin',
      pathValue: '',
    });
    assert.equal(second.conflicts.length, 0);
    assert.equal(second.actions.filter((action) => action.type === 'noop').length, 2);

    const status = await getStatus({ home, repoRoot: REPO_ROOT, platform: 'darwin' });
    assert.deepEqual(status.entries.map((entry) => entry.status), ['installed', 'installed']);
  } finally {
    await removeHome(home);
  }
});

test('dry-run reports work without creating managed files or links', async () => {
  const home = await temporaryHome(['.claude']);
  try {
    const result = await installSkills({
      home,
      repoRoot: REPO_ROOT,
      platform: 'darwin',
      dryRun: true,
    });
    assert.equal(result.actions.some((action) => action.type === 'copy'), true);
    assert.equal(result.actions.some((action) => action.type === 'link'), true);
    await assert.rejects(lstat(join(home, '.siifish-skills')), { code: 'ENOENT' });
    await assert.rejects(lstat(join(home, '.claude', 'skills', 'bear-notes')), { code: 'ENOENT' });
  } finally {
    await removeHome(home);
  }
});

test('development install links the Git source and uninstall is idempotent', async () => {
  const home = await temporaryHome(['.claude']);
  const target = join(home, '.claude', 'skills', 'bear-notes');
  try {
    await installSkills({ home, repoRoot: REPO_ROOT, platform: 'darwin', dev: true });
    assert.equal(resolve(dirname(target), await readlink(target)), join(REPO_ROOT, 'skills', 'bear-notes'));

    const first = await uninstallSkills({ home, repoRoot: REPO_ROOT, platform: 'darwin' });
    assert.equal(first.actions[0].type, 'unlink');
    await assert.rejects(lstat(target), { code: 'ENOENT' });

    const second = await uninstallSkills({ home, repoRoot: REPO_ROOT, platform: 'darwin' });
    assert.equal(second.actions[0].type, 'noop');
  } finally {
    await removeHome(home);
  }
});

test('agent filter installs only the requested detected Agent', async () => {
  const home = await temporaryHome(['.claude', '.codex']);
  try {
    await installSkills({
      home,
      repoRoot: REPO_ROOT,
      platform: 'darwin',
      requestedAgents: ['codex'],
    });
    await assert.rejects(lstat(join(home, '.claude', 'skills', 'bear-notes')), { code: 'ENOENT' });
    assert.equal((await lstat(join(home, '.codex', 'skills', 'bear-notes'))).isSymbolicLink(), true);
  } finally {
    await removeHome(home);
  }
});

test('platform-incompatible skills are skipped', async () => {
  const home = await temporaryHome(['.claude']);
  try {
    const result = await installSkills({ home, repoRoot: REPO_ROOT, platform: 'linux' });
    assert.deepEqual(result.skipped, [{ skill: 'bear-notes', reason: 'unsupported on linux' }]);
    await assert.rejects(lstat(join(home, '.claude', 'skills', 'bear-notes')), { code: 'ENOENT' });
  } finally {
    await removeHome(home);
  }
});

test('preserves a conflicting real directory', async () => {
  const home = await temporaryHome(['.claude']);
  const target = join(home, '.claude', 'skills', 'bear-notes');
  try {
    await mkdir(target, { recursive: true });
    await writeFile(join(target, 'sentinel.txt'), 'keep me', 'utf8');
    const result = await installSkills({ home, repoRoot: REPO_ROOT, platform: 'darwin' });
    assert.equal(result.conflicts.length, 1);
    assert.equal(await readFile(join(target, 'sentinel.txt'), 'utf8'), 'keep me');
  } finally {
    await removeHome(home);
  }
});

test('preserves a link to an external source', async () => {
  const home = await temporaryHome(['.claude']);
  const external = await mkdtemp(join(tmpdir(), 'siifish-skills-external-'));
  const target = join(home, '.claude', 'skills', 'bear-notes');
  try {
    await mkdir(dirname(target), { recursive: true });
    await symlink(external, target, process.platform === 'win32' ? 'junction' : 'dir');
    const result = await installSkills({ home, repoRoot: REPO_ROOT, platform: 'darwin' });
    assert.equal(result.conflicts.length, 1);
    assert.equal(resolve(dirname(target), await readlink(target)), external);
  } finally {
    await removeHome(home);
    await rm(external, { recursive: true, force: true });
  }
});

test('preserves a broken external link', { skip: process.platform === 'win32' }, async () => {
  const home = await temporaryHome(['.claude']);
  const target = join(home, '.claude', 'skills', 'bear-notes');
  const missing = join(home, 'missing-source');
  try {
    await mkdir(dirname(target), { recursive: true });
    await symlink(missing, target, 'dir');
    const result = await installSkills({ home, repoRoot: REPO_ROOT, platform: 'darwin' });
    assert.equal(result.conflicts.length, 1);
    assert.match(result.conflicts[0].reason, /broken link/);
    assert.equal(resolve(dirname(target), await readlink(target)), missing);
  } finally {
    await removeHome(home);
  }
});
