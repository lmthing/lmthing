/**
 * Unit tests for utility-ledger's pure functions — no network, no LLM, no clock.
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

// ---------- discoverAmountColumns ----------

test('discoverAmountColumns: binds an amount column with its date and category siblings', async () => {
  const discover = await importFn('discoverAmountColumns');
  const tables = [
    { name: 'expenses', columns: ['id', 'amount', 'spent_on', 'category', 'createdAt'] },
    { name: 'notes', columns: ['id', 'body'] },
  ];
  const samples = {
    expenses: [
      { id: 1, amount: '12.50', spent_on: '2026-06-03', category: 'food', createdAt: '2026-06-03T09:00:00Z' },
      { id: 2, amount: '9', spent_on: '2026-06-11', category: 'travel', createdAt: '2026-06-11T09:00:00Z' },
    ],
    notes: [{ id: 1, body: 'hello' }],
  };
  const out = discover(tables, samples);
  assert.equal(out.length, 1, `expected exactly one candidate, got ${JSON.stringify(out)}`);
  const c = out[0];
  assert.equal(c.table, 'expenses');
  assert.equal(c.amountColumn, 'amount');
  assert.equal(c.dateColumn, 'spent_on');
  assert.equal(c.categoryColumn, 'category');
  assert.equal(c.direction, 'unknown');
  assert.ok(c.confidence >= 0.8, `name+values+date should be high confidence, got ${c.confidence}`);
});

test('discoverAmountColumns: excludes ids, counters and calendar parts even when the name hints money', async () => {
  const discover = await importFn('discoverAmountColumns');
  const out = discover(
    [{ name: 't', columns: ['id', 'invoice_id', 'total_count', 'total_qty', 'item_quantity', 'budget_year', 'budget_month', 'budget_day', 'total'] }],
    {
      t: [
        { id: 1, invoice_id: 7, total_count: 3, total_qty: 4, item_quantity: 5, budget_year: 2026, budget_month: 6, budget_day: 3, total: 40 },
        { id: 2, invoice_id: 8, total_count: 1, total_qty: 2, item_quantity: 6, budget_year: 2026, budget_month: 7, budget_day: 4, total: 12 },
      ],
    },
  );
  const cols = out.map((c) => c.amountColumn);
  assert.deepEqual(cols, ['total'], `only the real money column may bind, got ${cols}`);
});

test('discoverAmountColumns: direction is read off the amount column name', async () => {
  const discover = await importFn('discoverAmountColumns');
  const out = discover(
    [
      { name: 'a', columns: ['id', 'cost', 'date'] },
      { name: 'b', columns: ['id', 'income', 'date'] },
      { name: 'c', columns: ['id', 'balance', 'date'] },
    ],
    {
      a: [{ id: 1, cost: 5, date: '2026-06-01' }],
      b: [{ id: 1, income: 5, date: '2026-06-01' }],
      c: [{ id: 1, balance: 5, date: '2026-06-01' }],
    },
  );
  const dir = Object.fromEntries(out.map((c) => [c.amountColumn, c.direction]));
  assert.equal(dir.cost, 'expense');
  assert.equal(dir.income, 'income');
  assert.equal(dir.balance, 'unknown');
});

test('discoverAmountColumns: money-ish name with non-numeric values is rejected; no date sibling lowers confidence', async () => {
  const discover = await importFn('discoverAmountColumns');
  const out = discover(
    [
      { name: 'a', columns: ['id', 'price'] }, // money name, prose values
      { name: 'b', columns: ['id', 'price'] }, // money values, but no date column anywhere
    ],
    {
      a: [{ id: 1, price: 'ask us' }, { id: 2, price: 'negotiable' }],
      b: [{ id: 1, price: '10.00' }, { id: 2, price: '20.00' }],
    },
  );
  assert.ok(!out.some((c) => c.table === 'a'), 'never-parsing values must disqualify');
  const b = out.find((c) => c.table === 'b');
  assert.ok(b, 'a dateless money column is still a candidate');
  assert.equal(b.dateColumn, null);
  assert.ok(b.confidence < 0.8 && b.confidence >= 0.3, `dateless must land in the proposed band, got ${b.confidence}`);
});

test('discoverAmountColumns: malformed input degrades to []', async () => {
  const discover = await importFn('discoverAmountColumns');
  assert.deepEqual(discover(null, null), []);
  assert.deepEqual(discover('nope', undefined), []);
  assert.deepEqual(discover([{ bogus: true }, 42], {}), []);
});

// ---------- summarizePeriod ----------

const START = '2026-06-01';
const END = '2026-07-01';

test('summarizePeriod: [start, end) calendar-day window, totals and category buckets', async () => {
  const summarize = await importFn('summarizePeriod');
  const rows = [
    { id: 1, amount: 10, d: '2026-06-01', cat: 'food' }, // start inclusive
    { id: 2, amount: 5.5, d: '2026-06-30T23:30:00Z', cat: 'food' }, // last day, late
    { id: 3, amount: 100, d: '2026-07-01', cat: 'food' }, // end EXCLUSIVE
    { id: 4, amount: 100, d: '2026-05-31', cat: 'food' }, // before start
    { id: 5, amount: 4, d: '2026-06-15', cat: 'travel' },
    { id: 6, amount: 'nope', d: '2026-06-15', cat: 'travel' }, // unparseable amount
    { id: 7, amount: 3, d: 'TBD', cat: 'travel' }, // unparseable date
  ];
  const out = summarize(rows, 'amount', 'd', 'cat', START, END);
  assert.equal(out.total, 19.5);
  assert.equal(out.count, 3);
  assert.equal(out.undated, false);
  assert.deepEqual(out.byCategory, { food: { total: 15.5, count: 2 }, travel: { total: 4, count: 1 } });
});

test('summarizePeriod: parses both number locales by the LAST separator', async () => {
  const summarize = await importFn('summarizePeriod');
  const us = summarize([{ amount: '1,234.5', d: '2026-06-02' }], 'amount', 'd', null, START, END);
  const eu = summarize([{ amount: '1.234,5', d: '2026-06-02' }], 'amount', 'd', null, START, END);
  assert.equal(us.total, 1234.5);
  assert.equal(eu.total, 1234.5);
  // Thousands grouping (a single kind of separator with exactly three digits after it).
  assert.equal(summarize([{ amount: '1,234', d: '2026-06-02' }], 'amount', 'd', null, START, END).total, 1234);
  assert.equal(summarize([{ amount: '1.234', d: '2026-06-02' }], 'amount', 'd', null, START, END).total, 1234);
  assert.equal(summarize([{ amount: '1,234,567', d: '2026-06-02' }], 'amount', 'd', null, START, END).total, 1234567);
  // Currency symbols, spaces and accounting negatives.
  assert.equal(summarize([{ amount: '€ 1 200,75', d: '2026-06-02' }], 'amount', 'd', null, START, END).total, 1200.75);
  assert.equal(summarize([{ amount: '(12.50)', d: '2026-06-02' }], 'amount', 'd', null, START, END).total, -12.5);
  assert.equal(summarize([{ amount: '-$3.25', d: '2026-06-02' }], 'amount', 'd', null, START, END).total, -3.25);
});

test('summarizePeriod: a null dateColumn includes every row and reports undated', async () => {
  const summarize = await importFn('summarizePeriod');
  const rows = [
    { amount: 1, d: '2020-01-01' },
    { amount: 2, d: '2030-01-01' },
    { amount: 3 },
  ];
  const out = summarize(rows, 'amount', null, null, START, END);
  assert.equal(out.undated, true);
  assert.equal(out.count, 3);
  assert.equal(out.total, 6);
  assert.deepEqual(out.byCategory, { uncategorized: { total: 6, count: 3 } });
});

test('summarizePeriod: missing/blank categories fall back to uncategorized', async () => {
  const summarize = await importFn('summarizePeriod');
  const out = summarize(
    [
      { amount: 1, d: '2026-06-02', cat: 'food' },
      { amount: 2, d: '2026-06-03', cat: '   ' },
      { amount: 4, d: '2026-06-04' },
      { amount: 8, d: '2026-06-05', cat: null },
    ],
    'amount', 'd', 'cat', START, END,
  );
  assert.deepEqual(out.byCategory, { food: { total: 1, count: 1 }, uncategorized: { total: 14, count: 3 } });
});

test('summarizePeriod: malformed input degrades without throwing', async () => {
  const summarize = await importFn('summarizePeriod');
  const EMPTY = { total: 0, count: 0, undated: false, byCategory: {} };
  assert.deepEqual(summarize(null, 'amount', 'd', null, START, END), EMPTY);
  assert.deepEqual(summarize([{ amount: 1, d: '2026-06-02' }], '', 'd', null, START, END), EMPTY);
  assert.deepEqual(summarize([{ amount: 1, d: '2026-06-02' }], 'amount', 'd', null, 'not a date', END), EMPTY);
  assert.deepEqual(summarize([null, 42, 'x'], 'amount', 'd', null, START, END), EMPTY);
});

// ---------- previousMonthRange ----------

test('previousMonthRange: half-open UTC month, including the January → December rollover', async () => {
  const prev = await importFn('previousMonthRange');
  assert.deepEqual(prev('2026-07-01T07:30:00.000Z'), {
    periodStart: '2026-06-01', periodEnd: '2026-07-01', label: '2026-06',
  });
  assert.deepEqual(prev('2026-01-01T00:00:00.000Z'), {
    periodStart: '2025-12-01', periodEnd: '2026-01-01', label: '2025-12',
  });
  assert.deepEqual(prev('2026-03-01T23:59:59.999Z'), {
    periodStart: '2026-02-01', periodEnd: '2026-03-01', label: '2026-02',
  });
  // Mid-month reference instants resolve the same previous month (a manual re-run is safe).
  assert.deepEqual(prev('2026-07-19T12:00:00.000Z').label, '2026-06');
  assert.deepEqual(prev('2026-11-01').label, '2026-10');
});

test('previousMonthRange: invalid input returns null, never throws', async () => {
  const prev = await importFn('previousMonthRange');
  for (const bad of [null, undefined, '', '   ', 'yesterday', 42, {}, [], NaN, true]) {
    assert.equal(prev(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

// ---------- computeReportKey ----------

test('computeReportKey: stable, period-keyed, sanitized', async () => {
  const key = await importFn('computeReportKey');
  assert.equal(key('7', '2026-06-01'), '7:2026-06-01');
  // Same period, richer timestamp → same key (a re-run never duplicates).
  assert.equal(key('7', '2026-06-01T00:00:00.000Z'), key('7', '2026-06-01'));
  // Different period → different key.
  assert.notEqual(key('7', '2026-07-01'), key('7', '2026-06-01'));
  // Different binding → different key.
  assert.notEqual(key('8', '2026-06-01'), key('7', '2026-06-01'));
  // Hostile inputs sanitize instead of throwing.
  assert.equal(typeof key(null, undefined), 'string');
  assert.equal(key('a: b', '2026-06-01'), 'a_b:2026-06-01'); // colons/whitespace collapse to one _
});
