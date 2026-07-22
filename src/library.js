import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function parseFrontmatter(markdown, source = 'SKILL.md') {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error(`${source}: missing YAML frontmatter`);

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
