import { lstat, readFile, readdir } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, REPO_ROOT } from './library.js';

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
  if (short) {
    add(errors, [...short].length >= 25 && [...short].length <= 64, `${path}: short_description must contain 25-64 characters`);
  }
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
  const skillsRoot = join(repoRoot, 'skills');
  const skillDirectories = (await readdir(skillsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();

  add(errors, skillDirectories.length > 0, 'skills: repository must contain at least one skill');

  const seenNames = new Set();
  for (const directoryName of skillDirectories) {
    const skillDirectory = join(skillsRoot, directoryName);
    const skillPath = join(skillDirectory, 'SKILL.md');
    add(errors, NAME_PATTERN.test(directoryName), `${skillDirectory}: invalid skill directory name`);

    let markdown;
    try {
      markdown = await readFile(skillPath, 'utf8');
    } catch (error) {
      errors.push(`${skillPath}: ${error.message}`);
      continue;
    }

    try {
      const frontmatter = parseFrontmatter(markdown, skillPath);
      add(
        errors,
        JSON.stringify(frontmatter.keys.sort()) === JSON.stringify(['description', 'name']),
        `${skillPath}: frontmatter must contain only name and description`,
      );
      const skillName = frontmatter.values.name;
      add(errors, NAME_PATTERN.test(skillName || ''), `${skillPath}: invalid skill name ${skillName}`);
      add(errors, skillName === basename(skillDirectory), `${skillPath}: name must match its directory`);
      add(errors, !seenNames.has(skillName), `${skillPath}: duplicate skill name ${skillName}`);
      seenNames.add(skillName);
      add(errors, Boolean(frontmatter.values.description), `${skillPath}: description must not be empty`);
      add(errors, [...(frontmatter.values.description || '')].length <= 1024, `${skillPath}: description exceeds 1024 characters`);
    } catch (error) {
      errors.push(error.message);
    }

    add(errors, markdown.split(/\r?\n/).length <= 500, `${skillPath}: SKILL.md exceeds 500 lines`);
    await validateMarkdownLinks(markdown, skillPath, errors);

    const openAiPath = join(skillDirectory, 'agents', 'openai.yaml');
    try {
      validateOpenAiYaml(await readFile(openAiPath, 'utf8'), directoryName, openAiPath, errors);
    } catch (error) {
      if (error.code !== 'ENOENT') errors.push(`${openAiPath}: ${error.message}`);
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
