import { lstat, readFile, readdir } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REPO_ROOT,
  isSafeRelativePath,
  parseFrontmatter,
  readJson,
} from './library.js';

const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TEXT_EXTENSIONS = new Set(['.js', '.json', '.md', '.yaml', '.yml']);

async function walk(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const path = join(current, entry.name);
    if (entry.isDirectory()) files.push(...await walk(root, path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function add(errors, condition, message) {
  if (!condition) errors.push(message);
}

function validateOpenAiYaml(content, skillName, path, errors) {
  add(errors, /^interface:\s*$/m.test(content), `${path}: missing interface section`);
  add(errors, /^\s+display_name:\s+"[^"]+"\s*$/m.test(content), `${path}: display_name must be quoted`);
  const short = content.match(/^\s+short_description:\s+"([^"]+)"\s*$/m)?.[1];
  add(errors, Boolean(short), `${path}: short_description must be quoted`);
  if (short) add(errors, [...short].length >= 25 && [...short].length <= 64, `${path}: short_description must contain 25-64 characters`);
  const prompt = content.match(/^\s+default_prompt:\s+"([^"]+)"\s*$/m)?.[1];
  add(errors, Boolean(prompt), `${path}: default_prompt must be quoted`);
  if (prompt) add(errors, prompt.includes(`$${skillName}`), `${path}: default_prompt must mention $${skillName}`);
}

async function validateMarkdownLinks(markdown, markdownPath, errors) {
  const pattern = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of markdown.matchAll(pattern)) {
    const destination = match[1].trim().split('#')[0];
    if (!destination || /^[a-z][a-z0-9+.-]*:/i.test(destination)) continue;
    const target = resolve(dirname(markdownPath), destination);
    try {
      await lstat(target);
    } catch (error) {
      if (error.code === 'ENOENT') errors.push(`${markdownPath}: missing linked file ${destination}`);
      else throw error;
    }
  }
}

export async function validateRepository(repoRoot = REPO_ROOT) {
  const errors = [];
  const [catalog, agentConfig, packageInfo] = await Promise.all([
    readJson(join(repoRoot, 'catalog.json')),
    readJson(join(repoRoot, 'config', 'agents.json')),
    readJson(join(repoRoot, 'package.json')),
  ]);

  add(errors, catalog.schemaVersion === 1, 'catalog.json: schemaVersion must be 1');
  add(errors, Array.isArray(catalog.skills), 'catalog.json: skills must be an array');
  add(errors, agentConfig.schemaVersion === 1, 'config/agents.json: schemaVersion must be 1');
  add(errors, Array.isArray(agentConfig.agents), 'config/agents.json: agents must be an array');
  add(errors, packageInfo.engines?.node === '>=20', 'package.json: Node engine must be >=20');

  const agentIds = new Set();
  for (const agent of agentConfig.agents || []) {
    add(errors, NAME_PATTERN.test(agent.id || ''), `config/agents.json: invalid agent id ${agent.id}`);
    add(errors, !agentIds.has(agent.id), `config/agents.json: duplicate agent id ${agent.id}`);
    agentIds.add(agent.id);
    add(errors, isSafeRelativePath(agent.configDir), `config/agents.json: unsafe configDir for ${agent.id}`);
    add(errors, isSafeRelativePath(agent.skillsDir), `config/agents.json: unsafe skillsDir for ${agent.id}`);
  }

  const skillsRoot = join(repoRoot, 'skills');
  const skillDirectories = (await readdir(skillsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const catalogNames = (catalog.skills || []).map((skill) => skill.name).sort();
  add(
    errors,
    JSON.stringify(skillDirectories) === JSON.stringify(catalogNames),
    `catalog.json inventory mismatch: disk=${skillDirectories.join(',')} catalog=${catalogNames.join(',')}`,
  );

  const seenNames = new Set();
  for (const entry of catalog.skills || []) {
    add(errors, NAME_PATTERN.test(entry.name || ''), `catalog.json: invalid skill name ${entry.name}`);
    add(errors, !seenNames.has(entry.name), `catalog.json: duplicate skill name ${entry.name}`);
    seenNames.add(entry.name);
    add(errors, entry.path === `skills/${entry.name}`, `catalog.json: ${entry.name} must use path skills/${entry.name}`);
    add(errors, Array.isArray(entry.platforms) && entry.platforms.length > 0, `catalog.json: ${entry.name} needs platforms`);

    const skillDirectory = resolve(repoRoot, entry.path);
    add(errors, basename(skillDirectory) === entry.name, `${entry.path}: directory must match skill name`);
    const skillPath = join(skillDirectory, 'SKILL.md');
    let markdown;
    try {
      markdown = await readFile(skillPath, 'utf8');
    } catch (error) {
      errors.push(`${skillPath}: ${error.message}`);
      continue;
    }

    try {
      const frontmatter = parseFrontmatter(markdown, skillPath);
      add(errors, JSON.stringify(frontmatter.keys.sort()) === JSON.stringify(['description', 'name']), `${skillPath}: frontmatter must contain only name and description`);
      add(errors, frontmatter.values.name === entry.name, `${skillPath}: name must match catalog and directory`);
      add(errors, Boolean(frontmatter.values.description), `${skillPath}: description must not be empty`);
    } catch (error) {
      errors.push(error.message);
    }
    add(errors, markdown.split(/\r?\n/).length <= 500, `${skillPath}: SKILL.md exceeds 500 lines`);
    await validateMarkdownLinks(markdown, skillPath, errors);

    const openAiPath = join(skillDirectory, 'agents', 'openai.yaml');
    try {
      validateOpenAiYaml(await readFile(openAiPath, 'utf8'), entry.name, openAiPath, errors);
    } catch (error) {
      errors.push(`${openAiPath}: ${error.message}`);
    }
  }

  const credentialPatterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*["'][^"']{8,}["']/i,
  ];
  for (const file of await walk(repoRoot)) {
    if (!TEXT_EXTENSIONS.has(extname(file))) continue;
    const content = await readFile(file, 'utf8');
    const display = relative(repoRoot, file);
    add(errors, !/\/Users\/[A-Za-z0-9._-]+\//.test(content), `${display}: contains a personal /Users path`);
    for (const pattern of credentialPatterns) {
      add(errors, !pattern.test(content), `${display}: contains a possible credential`);
    }
    if (extname(file) === '.md') await validateMarkdownLinks(content, file, errors);
  }

  return errors;
}

async function main() {
  const errors = await validateRepository(REPO_ROOT);
  if (errors.length > 0) {
    for (const error of errors) console.error(`error: ${error}`);
    process.exitCode = 1;
  } else {
    console.log('Repository validation passed.');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(`error: ${error.message}`);
    process.exitCode = 1;
  });
}
