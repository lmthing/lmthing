/**
 * Structural guard for utility-enricher: it ships NO hooks on purpose (every research pass spends
 * real search and model budget, so it must be user- or THING-initiated), and its catalog metadata
 * must stay valid for the store manifest generator.
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

test('ships no hooks — research must never run on a silent schedule', () => {
  assert.equal(
    existsSync(join(SPACE, 'hooks')),
    false,
    'utility-enricher must not ship a hooks/ dir: every pass spends web-search and model budget, so it stays user-initiated',
  );
});

test('the lmthing manifest block is well formed', async () => {
  const pkg = JSON.parse(await readFile(join(SPACE, 'package.json'), 'utf8'));
  const m = pkg.lmthing;
  assert.ok(m, 'package.json needs an lmthing block or the catalog generator skips the space');
  assert.equal(m.kind, 'utility');
  assert.ok(Array.isArray(m.tags) && m.tags.includes('utility'));
  assert.ok(m.tags.includes('research'));
  for (const field of ['title', 'icon', 'description']) {
    assert.equal(typeof m[field], 'string', `lmthing.${field} must be a string`);
    assert.ok(m[field].length > 0, `lmthing.${field} must not be empty`);
  }
});

test('webSearch/webFetch are granted on exactly one node — the research fan-out', async () => {
  // Per the utility-space contract, a per-node `functions:` allowlist that omits webSearch/webFetch
  // strips them. Only the research step may hold them; if a second node picks them up, budget can
  // be spent from a step nobody expects it in.
  const nodes = [
    ['research/01-load.md', false],
    ['research/02-research.md', true],
    ['research/03-record.md', false],
    ['research/04-report.md', false],
    ['apply/01-load.md', false],
    ['apply/02-apply.md', false],
    ['apply/03-mark.md', false],
    ['apply/04-report.md', false],
  ];
  for (const [rel, shouldHave] of nodes) {
    const src = await readFile(join(SPACE, 'tasklists', rel), 'utf8');
    const frontmatter = src.split('---')[1] ?? '';
    const has = /^\s*-\s*webSearch\s*$/m.test(frontmatter) && /^\s*-\s*webFetch\s*$/m.test(frontmatter);
    assert.equal(has, shouldHave, `${rel}: webSearch/webFetch presence must be ${shouldHave}`);
    assert.ok(/^functions:/m.test(frontmatter), `${rel}: every node must carry an explicit functions: allowlist`);
  }
});
