/**
 * Unit tests for utility-auditor's pure functions — no network, no LLM, no clock.
 *
 * Functions are transpiled standalone (same pattern as store/spaces/tests/catalog-emitters.test.mjs)
 * exactly the way the runtime injects them, so a cross-file import would fail here first.
 *
 * Run: pnpm -C store test:spaces
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

async function importFn(name) {
  const ts = (await import('typescript')).default;
  const src = await readFile(join(HERE, '..', 'functions', `${name}.ts`), 'utf8');
  const { outputText } = ts.transpileModule(src, {
    fileName: `${name}.ts`,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, isolatedModules: true },
  });
  const tmp = join(tmpdir(), `lmthing-fn-${randomUUID()}.mjs`);
  await writeFile(tmp, outputText, 'utf8');
  try {
    return (await import(pathToFileURL(tmp).href))[name];
  } finally {
    await rm(tmp, { force: true });
  }
}

// ---------- stableStringify ----------

test('stableStringify: key order never matters, array order always does', async () => {
  const s = await importFn('stableStringify');
  assert.equal(s({ b: 1, a: 2 }), s({ a: 2, b: 1 }));
  assert.equal(s({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.notEqual(s([1, 2]), s([2, 1]));
  assert.equal(s([1, 2]), '[1,2]');
});

test('stableStringify: sorts keys recursively, at every depth', async () => {
  const s = await importFn('stableStringify');
  const left = { z: { y: 1, x: [{ b: 1, a: 2 }] }, a: 3 };
  const right = { a: 3, z: { x: [{ a: 2, b: 1 }], y: 1 } };
  assert.equal(s(left), s(right));
  assert.equal(s(left), '{"a":3,"z":{"x":[{"a":2,"b":1}],"y":1}}');
});

test('stableStringify: cycles collapse instead of throwing', async () => {
  const s = await importFn('stableStringify');
  const a = { name: 'a' };
  a.self = a;
  assert.equal(s(a), '{"name":"a","self":"[cycle]"}');
  const list = [1];
  list.push(list);
  assert.equal(s(list), '[1,"[cycle]"]');
  // Repetition inside a DAG is not a cycle — the same node serialized twice is fine.
  const shared = { k: 1 };
  assert.equal(s({ one: shared, two: shared }), '{"one":{"k":1},"two":{"k":1}}');
});

test('stableStringify: every input has an output, and undefined is null', async () => {
  const s = await importFn('stableStringify');
  assert.equal(s(undefined), 'null');
  assert.equal(s(null), 'null');
  assert.equal(s({ a: undefined, b: 1 }), '{"a":null,"b":1}');
  assert.equal(s(NaN), 'null');
  assert.equal(s(Infinity), 'null');
  assert.equal(s(() => 1), 'null');
  assert.equal(s(10n), '"10"');
  assert.equal(s(new Date('2026-07-26T00:00:00Z')), '"2026-07-26T00:00:00.000Z"');
  assert.equal(s('hi'), '"hi"');
  assert.equal(s(true), 'true');
});

// ---------- hashRow ----------

test('hashRow: deterministic and insensitive to key order', async () => {
  const hash = await importFn('hashRow');
  const a = hash({ id: 1, name: 'x', tags: ['p', 'q'] });
  const b = hash({ tags: ['p', 'q'], name: 'x', id: 1 });
  assert.equal(a, b);
  assert.equal(a, hash({ id: 1, name: 'x', tags: ['p', 'q'] }));
  assert.match(a, /^[0-9a-f]{8}$/);
});

test('hashRow: sensitive to any value, type or shape change', async () => {
  const hash = await importFn('hashRow');
  const base = { id: 1, name: 'x', n: 10, nested: { a: 1 } };
  assert.notEqual(hash(base), hash({ ...base, name: 'y' }));
  assert.notEqual(hash(base), hash({ ...base, n: '10' })); // 10 vs "10"
  assert.notEqual(hash(base), hash({ ...base, nested: { a: 2 } }));
  assert.notEqual(hash(base), hash({ ...base, extra: null })); // a new column is a change
  assert.notEqual(hash(['p', 'q']), hash(['q', 'p'])); // array order is data
});

test('hashRow: malformed input still hashes, never throws', async () => {
  const hash = await importFn('hashRow');
  for (const bad of [null, undefined, 42, 'str', [], true]) {
    assert.match(hash(bad), /^[0-9a-f]{8}$/, `expected a hash for ${JSON.stringify(bad)}`);
  }
  const cyclic = { a: 1 };
  cyclic.self = cyclic;
  assert.match(hash(cyclic), /^[0-9a-f]{8}$/);
});

// ---------- diffRows ----------

test('diffRows: reports the union of keys, verbatim, sorted', async () => {
  const diff = await importFn('diffRows');
  const out = diff(
    { id: 1, name: 'old', price: '10.00', gone: 'yes' },
    { id: 1, name: 'new', price: '10.00', appeared: 7 },
  );
  assert.deepEqual(out.changedColumns, ['appeared', 'gone', 'name']);
  assert.deepEqual(out.details.name, { before: 'old', after: 'new' });
  assert.deepEqual(out.details.gone, { before: 'yes', after: null }); // removed column
  assert.deepEqual(out.details.appeared, { before: null, after: 7 }); // added column
  assert.equal(out.details.price, undefined); // unchanged columns are absent
});

test('diffRows: nested values compare by value, not by key order', async () => {
  const diff = await importFn('diffRows');
  const same = diff({ meta: { a: 1, b: 2 }, tags: ['x'] }, { meta: { b: 2, a: 1 }, tags: ['x'] });
  assert.deepEqual(same.changedColumns, []);
  assert.deepEqual(same.details, {});
  const changed = diff({ meta: { a: 1, list: [1, 2] } }, { meta: { a: 1, list: [2, 1] } });
  assert.deepEqual(changed.changedColumns, ['meta']);
  assert.deepEqual(changed.details.meta.after, { a: 1, list: [2, 1] });
});

test('diffRows: malformed input degrades to an empty diff', async () => {
  const diff = await importFn('diffRows');
  const EMPTY = { changedColumns: [], details: {} };
  assert.deepEqual(diff(null, { a: 1 }), EMPTY);
  assert.deepEqual(diff({ a: 1 }, undefined), EMPTY);
  assert.deepEqual(diff('x', 'y'), EMPTY);
  assert.deepEqual(diff([1], [2]), EMPTY); // an array is not a row
});

// ---------- computeChangeKey ----------

test('computeChangeKey: truncates the sweep instant to the day', async () => {
  const key = await importFn('computeChangeKey');
  assert.equal(key('invoices', 42, 'changed', '2026-07-26T05:45:00.000Z'), 'invoices:42:changed:2026-07-26');
  // Same day, different time → same key (a retried sweep records nothing twice).
  assert.equal(
    key('invoices', 42, 'changed', '2026-07-26T23:59:59.999Z'),
    key('invoices', 42, 'changed', '2026-07-26T00:00:00.000Z'),
  );
  // A later day is a new entry.
  assert.notEqual(
    key('invoices', 42, 'changed', '2026-07-27T05:45:00.000Z'),
    key('invoices', 42, 'changed', '2026-07-26T05:45:00.000Z'),
  );
  // The change kind is part of the identity: add + remove on one day are two entries.
  assert.notEqual(
    key('invoices', 42, 'added', '2026-07-26'),
    key('invoices', 42, 'removed', '2026-07-26'),
  );
});

test('computeChangeKey: hostile inputs sanitize instead of throwing', async () => {
  const key = await importFn('computeChangeKey');
  assert.equal(typeof key(null, undefined, '', ''), 'string');
  assert.equal(key('a b', 'x:y', 'changed', '2026-07-26T00:00:00Z'), 'a_b:x_y:changed:2026-07-26');
});
