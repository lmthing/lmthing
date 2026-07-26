/**
 * Unit tests for utility-validator's pure functions — no network, no LLM, no clock.
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

// A table of `rowCount` rows, so suggestRules' >= 10 evidence threshold is met.
function rows(n, make) {
  return Array.from({ length: n }, (_, i) => make(i));
}

// ---------- checkRule: required ----------

test('checkRule required: empty is a violation, present is not', async () => {
  const check = await importFn('checkRule');
  const rule = { column: 'name', kind: 'required', config: {} };
  assert.equal(check(rule, { name: 'Ada' }).ok, true);
  for (const v of ['', '   ', null, undefined]) {
    const r = check(rule, { name: v });
    assert.equal(r.ok, false, `expected violation for ${JSON.stringify(v)}`);
    assert.ok(typeof r.reason === 'string' && r.reason.includes('name'));
  }
  assert.equal(check(rule, {}).ok, false, 'a missing column is empty');
});

// ---------- checkRule: range ----------

test('checkRule range: bounds, unbounded sides, non-numeric is a violation', async () => {
  const check = await importFn('checkRule');
  const rule = { column: 'qty', kind: 'range', config: { min: 1, max: 10 } };
  assert.equal(check(rule, { qty: 1 }).ok, true);
  assert.equal(check(rule, { qty: 10 }).ok, true);
  assert.equal(check(rule, { qty: '5' }).ok, true, 'numeric strings count');
  assert.equal(check(rule, { qty: 0 }).ok, false);
  assert.equal(check(rule, { qty: 11 }).ok, false);
  assert.equal(check(rule, { qty: 'n/a' }).ok, false, 'a non-numeric value in a range column IS the problem');
  // A missing bound is unbounded.
  assert.equal(check({ column: 'qty', kind: 'range', config: { min: 1 } }, { qty: 1e9 }).ok, true);
  assert.equal(check({ column: 'qty', kind: 'range', config: { max: 10 } }, { qty: -1e9 }).ok, true);
  assert.equal(check({ column: 'qty', kind: 'range', config: {} }, { qty: 42 }).ok, true);
});

// ---------- checkRule: regex (the safety-critical branch) ----------

test('checkRule regex: matches, fails, and NEVER fails a row on an invalid pattern', async () => {
  const check = await importFn('checkRule');
  const ok = { column: 'code', kind: 'regex', config: { pattern: '^[A-Z]{3}$' } };
  assert.equal(check(ok, { code: 'ABC' }).ok, true);
  assert.equal(check(ok, { code: 'abc' }).ok, false);
  assert.equal(check({ ...ok, config: { pattern: '^abc$', flags: 'i' } }, { code: 'ABC' }).ok, true);

  // An unrunnable rule is a broken RULE, not a broken row.
  for (const pattern of ['[unclosed', '(', '*', '\\', '']) {
    const r = check({ column: 'code', kind: 'regex', config: { pattern } }, { code: 'anything' });
    assert.equal(r.ok, true, `invalid pattern ${JSON.stringify(pattern)} must not fail a row`);
    assert.equal(r.skipped, 'invalid-pattern');
  }
  // A bogus flags string must not throw either.
  const bad = check({ column: 'code', kind: 'regex', config: { pattern: 'a', flags: 'zzz' } }, { code: 'a' });
  assert.equal(bad.ok, true);
  assert.equal(bad.skipped, 'invalid-pattern');
});

// ---------- checkRule: enum / reference ----------

test('checkRule enum: membership is string-compared; an empty values list is skipped', async () => {
  const check = await importFn('checkRule');
  const rule = { column: 'status', kind: 'enum', config: { values: ['open', 'closed'] } };
  assert.equal(check(rule, { status: 'open' }).ok, true);
  const bad = check(rule, { status: 'pending' });
  assert.equal(bad.ok, false);
  assert.ok(bad.reason.includes('open, closed'));
  assert.equal(check({ column: 'n', kind: 'enum', config: { values: [1, 2] } }, { n: '1' }).ok, true);
  assert.equal(check({ column: 'status', kind: 'enum', config: { values: [] } }, { status: 'x' }).skipped, 'no-values');
});

test('checkRule reference: membership against caller-supplied ids, no I/O', async () => {
  const check = await importFn('checkRule');
  const rule = { column: 'customer_id', kind: 'reference', config: { table: 'customers' } };
  assert.equal(check(rule, { customer_id: 7 }, ['7', 8]).ok, true);
  const bad = check(rule, { customer_id: 99 }, [7, 8]);
  assert.equal(bad.ok, false);
  assert.ok(bad.reason.includes('customers'));
  assert.equal(check(rule, { customer_id: 99 }, null).skipped, 'no-ref-ids', 'no ids loaded ⇒ cannot judge');
});

// ---------- checkRule: skip semantics ----------

test('checkRule: no row, no rule, unknown kind and empty values are skipped, never violations', async () => {
  const check = await importFn('checkRule');
  const rule = { column: 'x', kind: 'enum', config: { values: ['a'] } };
  for (const row of [null, undefined, 'not-a-row', 42]) {
    const r = check(rule, row);
    assert.equal(r.ok, true);
    assert.equal(r.skipped, 'no-row');
  }
  // Presence is `required`'s job alone — one blank cell must not fail five rules.
  for (const kind of ['range', 'regex', 'enum', 'reference']) {
    const r = check({ column: 'x', kind, config: { pattern: '^a$', values: ['a'], min: 1 } }, { x: '  ' }, []);
    assert.equal(r.ok, true, `${kind} must skip an empty value`);
    assert.equal(r.skipped, 'empty');
  }
  assert.equal(check({ column: 'x', kind: 'telepathy', config: {} }, { x: 'v' }).skipped, 'unknown-kind');
  for (const bogus of [null, undefined, {}, { kind: 'required' }, { column: 'x' }, 'nope']) {
    const r = check(bogus, { x: 'v' });
    assert.equal(r.ok, true, `malformed rule ${JSON.stringify(bogus)} must not accuse a row`);
    assert.equal(r.skipped, 'no-rule');
  }
});

// ---------- suggestRules ----------

test('suggestRules: fewer than 10 sampled rows proposes nothing at all', async () => {
  const suggest = await importFn('suggestRules');
  const tables = [{ name: 'orders', columns: ['id', 'status'] }];
  const nine = { orders: rows(9, (i) => ({ id: i + 1, status: 'open' })) };
  assert.deepEqual(suggest(tables, nine), []);
  // The very same shape at 10 rows does produce suggestions — the threshold is the only difference.
  const ten = { orders: rows(10, (i) => ({ id: i + 1, status: 'open' })) };
  assert.ok(suggest(tables, ten).length > 0);
});

test('suggestRules: required only for 100%-filled columns, never for id', async () => {
  const suggest = await importFn('suggestRules');
  const out = suggest(
    [{ name: 'orders', columns: ['id', 'note', 'ref'] }],
    { orders: rows(12, (i) => ({ id: i + 1, note: 'n', ref: i === 3 ? '' : 'r' })) },
  );
  const req = out.filter((r) => r.kind === 'required').map((r) => r.column);
  assert.ok(req.includes('note'), 'always filled ⇒ required');
  assert.ok(!req.includes('ref'), 'one blank ⇒ no required rule');
  assert.ok(!req.includes('id'), 'the primary key is not a contract worth queueing');
  assert.ok(out.every((r) => typeof r.evidence === 'string' && r.evidence.length > 0), 'every suggestion carries evidence');
});

test('suggestRules: enum cardinality boundary at 6 distinct values', async () => {
  const suggest = await importFn('suggestRules');
  const six = ['a', 'b', 'c', 'd', 'e', 'f'];
  const seven = [...six, 'g'];
  const atBoundary = suggest(
    [{ name: 't', columns: ['id', 'k'] }],
    { t: rows(12, (i) => ({ id: i + 1, k: six[i % six.length] })) },
  );
  const overBoundary = suggest(
    [{ name: 't', columns: ['id', 'k'] }],
    { t: rows(14, (i) => ({ id: i + 1, k: seven[i % seven.length] })) },
  );
  const enumAt = atBoundary.find((r) => r.kind === 'enum' && r.column === 'k');
  assert.ok(enumAt, '6 distinct values is still an enum');
  assert.deepEqual(enumAt.config.values, six, 'values are sorted and complete');
  assert.ok(!overBoundary.some((r) => r.kind === 'enum'), '7 distinct values is not an enum');
});

test('suggestRules: range widens the observed span by 50% on each side', async () => {
  const suggest = await importFn('suggestRules');
  const out = suggest(
    [{ name: 'orders', columns: ['id', 'total'] }],
    { orders: rows(10, (i) => ({ id: i + 1, total: 10 + i })) }, // 10..19, span 9 → margin 4.5
  );
  const range = out.find((r) => r.kind === 'range' && r.column === 'total');
  assert.ok(range, 'a numeric column gets a range rule');
  assert.equal(range.config.min, 5.5);
  assert.equal(range.config.max, 23.5);
  // A flat column widens by 50% of the value instead of collapsing to a point.
  const flat = suggest(
    [{ name: 'orders', columns: ['id', 'total'] }],
    { orders: rows(10, (i) => ({ id: i + 1, total: 100 })) },
  ).find((r) => r.kind === 'range');
  assert.equal(flat.config.min, 50);
  assert.equal(flat.config.max, 150);
});

test('suggestRules: reference only where a matching parent table exists', async () => {
  const suggest = await importFn('suggestRules');
  const out = suggest(
    [{ name: 'orders', columns: ['id', 'customer_id', 'legacyId'] }, { name: 'customers', columns: ['id'] }],
    {
      orders: rows(10, (i) => ({ id: i + 1, customer_id: 1, legacyId: 5 })),
      customers: rows(10, (i) => ({ id: i + 1 })),
    },
  );
  const refs = out.filter((r) => r.kind === 'reference');
  assert.equal(refs.length, 1);
  assert.equal(refs[0].column, 'customer_id');
  assert.equal(refs[0].config.table, 'customers');
  assert.ok(!out.some((r) => r.column === 'legacyId' && r.kind === 'reference'), 'no legacy table ⇒ no reference rule');
});

test('suggestRules: deterministic ordering and malformed input degrade to []', async () => {
  const suggest = await importFn('suggestRules');
  const args = [
    [{ name: 'b', columns: ['id', 'x'] }, { name: 'a', columns: ['id', 'y'] }],
    {
      b: rows(10, (i) => ({ id: i + 1, x: 'v' })),
      a: rows(10, (i) => ({ id: i + 1, y: 'v' })),
    },
  ];
  const once = suggest(...args);
  const twice = suggest(...args);
  assert.deepEqual(once, twice, 'same input ⇒ identical output');
  const keys = once.map((r) => `${r.targetTable}.${r.column}.${r.kind}`);
  assert.deepEqual(keys, [...keys].sort(), 'sorted by (table, column, kind)');

  assert.deepEqual(suggest(null, null), []);
  assert.deepEqual(suggest('nope', undefined), []);
  assert.deepEqual(suggest([{ bogus: true }, 42], {}), []);
  assert.deepEqual(suggest([{ name: 't', columns: ['id'] }], { t: 'not-rows' }), []);
});

// ---------- computeViolationKey ----------

test('computeViolationKey: stable, sanitized, and discriminating', async () => {
  const key = await importFn('computeViolationKey');
  assert.equal(key(7, 'orders', 42), '7:orders:42');
  assert.equal(key('7', ' Orders ', '42'), key(7, 'orders', 42), 'equivalent input ⇒ identical key');
  assert.notEqual(key(7, 'orders', 43), key(7, 'orders', 42));
  assert.notEqual(key(8, 'orders', 42), key(7, 'orders', 42));
  assert.equal(typeof key(null, undefined, 'a:b c'), 'string', 'hostile input sanitizes instead of throwing');
});
