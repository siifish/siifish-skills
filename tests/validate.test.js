import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { validateRepository } from '../src/validate.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('repository inventory and skill metadata validate', async () => {
  assert.deepEqual(await validateRepository(REPO_ROOT), []);
});
