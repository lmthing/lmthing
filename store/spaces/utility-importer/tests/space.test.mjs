/**
 * Structural guard for utility-importer: it ships NO hooks on purpose (an import is a decision,
 * never a schedule), and its catalog metadata must stay valid for the store manifest generator.
 *
 * Run: pnpm -C store test:spaces
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const SPACE = join(dirname(fileURLToPath(import.meta.url)), '..');

test('ships no hooks — nothing here may run unattended', () => {
  assert.equal(
    existsSync(join(SPACE, 'hooks')),
    false,
    'utility-importer must not ship a hooks/ dir: every path through it inserts rows into a user-chosen table',
  );
});

test('the lmthing manifest block is well formed', async () => {
  const pkg = JSON.parse(await readFile(join(SPACE, 'package.json'), 'utf8'));
  const m = pkg.lmthing;
  assert.ok(m, 'package.json needs an lmthing block or the catalog generator skips the space');
  assert.equal(m.kind, 'utility');
  assert.ok(Array.isArray(m.tags) && m.tags.includes('utility'));
  for (const field of ['title', 'icon', 'description']) {
    assert.equal(typeof m[field], 'string', `lmthing.${field} must be a string`);
    assert.ok(m[field].length > 0, `lmthing.${field} must not be empty`);
  }
});
