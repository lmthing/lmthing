/**
 * Structural guards for utility-planner: the space is deliberately hook-free, and its catalog
 * metadata must stay well-formed (the manifest generator silently SKIPS a dir with no `lmthing`
 * block, so a typo here would quietly delist the space).
 *
 * Run: pnpm -C store test:spaces
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SPACE = join(HERE, '..');

test('utility-planner ships NO hooks — it is an on-demand space', () => {
  assert.equal(
    existsSync(join(SPACE, 'hooks')),
    false,
    'the planner has nothing to sweep and nothing to notify: every run is user-initiated (bind once, ' +
      'agenda on request). Adding a hooks/ dir means adding background writes — reconsider first.',
  );
});

test('the lmthing catalog block is complete and well-formed', async () => {
  const pkg = JSON.parse(await readFile(join(SPACE, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'utility-planner');
  assert.equal(pkg.private, true);

  const meta = pkg.lmthing;
  assert.ok(meta && typeof meta === 'object', 'a dir with no lmthing block is skipped by the manifest generator');
  assert.equal(meta.kind, 'utility');
  assert.equal(meta.title, 'Planner');
  assert.equal(typeof meta.icon, 'string');
  assert.ok(meta.icon.length > 0 && meta.icon.length <= 4, 'icon must be a single emoji');
  assert.equal(typeof meta.description, 'string');
  assert.ok(meta.description.length > 0, 'the catalog card needs a user-facing sentence');
  assert.ok(Array.isArray(meta.tags), 'tags must be an array');
  assert.ok(meta.tags.includes('utility'), 'a utility space must be tagged utility');
  assert.ok(meta.tags.includes('planning'));
  assert.equal(meta.settings, undefined, 'this space needs no env config — omit settings entirely');
});

test('the agent, its tasklist and its knowledge are all present on disk', () => {
  for (const rel of [
    'agents/scheduler/charter.md',
    'agents/scheduler/instruct.md',
    'functions/discoverScheduleColumns.ts',
    'functions/buildAgendaEntries.ts',
    'functions/groupEntriesByDay.ts',
    'knowledge/planner/binding.md',
    'knowledge/planner/agenda.md',
    'tasklists/bind/index.md',
    'tasklists/bind/01-inventory.md',
    'tasklists/bind/02-propose.md',
    'tasklists/bind/03-persist.md',
    'tasklists/bind/04-report.md',
  ]) {
    assert.ok(existsSync(join(SPACE, rel)), `missing ${rel}`);
  }
});
