/**
 * Unit tests for utility-planner's pure functions — no network, no LLM, no clock.
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

// ---------- discoverScheduleColumns ----------

test('discoverScheduleColumns: keeps start/end, excludes bookkeeping and its own table, sorts by confidence', async () => {
  const discover = await importFn('discoverScheduleColumns');
  const tables = [
    { name: 'trips', columns: ['id', 'title', 'start_date', 'end_date', 'createdAt'] },
    { name: 'invoices', columns: ['id', 'name', 'due_date', 'valid_until', 'amount'] },
    { name: 'logs', columns: ['id', 'happened', 'note'] },
    { name: 'planner_bindings', columns: ['id', 'targetTable', 'createdAt'] },
  ];
  const samples = {
    trips: [{ id: 1, title: 'a', start_date: '2026-07-01', end_date: '2026-07-05', createdAt: '2026-01-01' }],
    invoices: [{ id: 1, name: 'x', due_date: '2026-08-01', valid_until: '2026-09-01', amount: 10 }],
    logs: [{ id: 1, happened: '2026-07-01', note: 'hi' }, { id: 2, happened: '2026-07-02', note: 'yo' }],
    planner_bindings: [{ id: 1, targetTable: 'trips', createdAt: '2026-01-01' }],
  };
  const out = discover(tables, samples);

  assert.deepEqual(
    out.map((c) => `${c.table}.${c.column}`),
    ['invoices.due_date', 'invoices.valid_until', 'trips.end_date', 'trips.start_date', 'logs.happened'],
    'confidence desc, then table, then column',
  );
  assert.ok(!out.some((c) => c.table === 'planner_bindings'), 'the planner never binds itself');
  assert.ok(!out.some((c) => c.column === 'createdAt'), 'bookkeeping columns must be excluded');
  assert.ok(!out.some((c) => c.column === 'amount' || c.column === 'title'), 'non-date columns must be excluded');

  const happened = out.find((c) => c.column === 'happened');
  assert.equal(happened.nameSignal, false);
  assert.equal(happened.parseRate, 1);
  assert.equal(happened.confidence, 0.5, 'value-only evidence is half confidence');
  assert.equal(happened.sampleSize, 2);
});

test('discoverScheduleColumns: kind is derived from the (snake-cased) column name', async () => {
  const discover = await importFn('discoverScheduleColumns');
  const out = discover(
    [{ name: 't', columns: ['startsAt', 'eventEndAt', 'expires_on', 'when'] }],
    { t: [{ startsAt: '2026-01-01', eventEndAt: '2026-01-02', expires_on: '2026-02-01', when: '2026-03-01' }] },
  );
  const kind = (col) => out.find((c) => c.column === col)?.kind;
  assert.equal(kind('startsAt'), 'range-start');
  assert.equal(kind('eventEndAt'), 'range-end', 'camelCase must classify like snake_case');
  assert.equal(kind('expires_on'), 'deadline');
  assert.equal(kind('when'), 'event', 'anything unclassified is a plain event');
});

test('discoverScheduleColumns: date-ish name with never-parsing values is rejected; empty table with a hint stays', async () => {
  const discover = await importFn('discoverScheduleColumns');
  const out = discover(
    [{ name: 'a', columns: ['start_label'] }, { name: 'b', columns: ['due_date'] }],
    { a: [{ start_label: 'soonish' }, { start_label: 'whenever' }], b: [] },
  );
  assert.ok(!out.some((c) => c.table === 'a'), 'never-parsing values must disqualify');
  assert.ok(out.some((c) => c.table === 'b' && c.kind === 'deadline'), 'empty table with a name hint stays a candidate');
});

test('discoverScheduleColumns: malformed input degrades to []', async () => {
  const discover = await importFn('discoverScheduleColumns');
  assert.deepEqual(discover(null, null), []);
  assert.deepEqual(discover('nope', undefined), []);
  assert.deepEqual(discover([{ bogus: true }, 42], {}), []);
});

// ---------- buildAgendaEntries ----------

const FROM = '2026-07-26T12:00:00.000Z';
const BINDING = { targetTable: 'trips', targetColumn: 'd', labelColumn: 'title', kind: 'event' };

test('buildAgendaEntries: the window is calendar-day, half-open, against the injected from', async () => {
  const build = await importFn('buildAgendaEntries');
  const rowsByTable = {
    trips: [
      { id: 1, title: 'yesterday', d: '2026-07-25' },
      { id: 2, title: 'today', d: '2026-07-26' },
      { id: 3, title: 'last day in range', d: '2026-07-28' },
      { id: 4, title: 'one day past', d: '2026-07-29' },
      { id: 5, title: 'unparseable', d: 'TBD' },
      { id: 6, title: 'empty', d: '' },
      { title: 'no id', d: '2026-07-27' },
    ],
  };
  const out = build([BINDING], rowsByTable, FROM, 3);
  assert.deepEqual(out.map((e) => e.rowId), ['2', '3'], 'from-day included, from-day+days excluded');
  assert.deepEqual(out[0], { date: '2026-07-26', table: 'trips', rowId: '2', label: 'today', kind: 'event' });
  assert.ok(!out.some((e) => e.label === 'no id'), 'a row without an id is skipped');
});

test('buildAgendaEntries: days defaults to 14 when missing or not positive', async () => {
  const build = await importFn('buildAgendaEntries');
  const rowsByTable = {
    trips: [
      { id: 1, title: 'day 13', d: '2026-08-08' },
      { id: 2, title: 'day 14', d: '2026-08-09' },
    ],
  };
  for (const days of [undefined, 0, -5, NaN]) {
    const out = build([BINDING], rowsByTable, FROM, days);
    assert.deepEqual(out.map((e) => e.rowId), ['1'], `days=${days} must fall back to a 14-day window`);
  }
});

test('buildAgendaEntries: entries sort by date, then table, then rowId; kind and label degrade sensibly', async () => {
  const build = await importFn('buildAgendaEntries');
  const bindings = [
    { targetTable: 'zulu', targetColumn: 'd' }, // no kind, no labelColumn
    { targetTable: 'alpha', targetColumn: 'd', labelColumn: '', kind: 'deadline' },
  ];
  const rowsByTable = {
    zulu: [{ id: 10, name: 'named row', d: '2026-07-27' }, { id: 2, d: '2026-07-26' }],
    alpha: [{ id: 1, title: 'alpha row', d: '2026-07-27' }],
  };
  const out = build(bindings, rowsByTable, FROM, 14);
  assert.deepEqual(
    out.map((e) => `${e.date}/${e.table}/${e.rowId}`),
    ['2026-07-26/zulu/2', '2026-07-27/alpha/1', '2026-07-27/zulu/10'],
  );
  assert.equal(out[0].kind, 'event', 'a binding without a kind defaults to event');
  assert.equal(out[0].label, '2', 'no label column and no name/title/label → the row id');
  assert.equal(out[2].label, 'named row', 'falls back to the row name');
  assert.equal(out[1].kind, 'deadline');
});

test('buildAgendaEntries: malformed input degrades to []', async () => {
  const build = await importFn('buildAgendaEntries');
  const rows = { trips: [{ id: 1, title: 't', d: '2026-07-27' }] };
  assert.deepEqual(build(null, rows, FROM, 14), []);
  assert.deepEqual(build('nope', rows, FROM, 14), []);
  assert.deepEqual(build([BINDING], null, FROM, 14), []);
  assert.deepEqual(build([BINDING], rows, 'not a date', 14), []);
  assert.deepEqual(build([{}, 42, null], rows, FROM, 14), []);
});

// ---------- groupEntriesByDay ----------

test('groupEntriesByDay: groups in encounter order, preserving the computed sort', async () => {
  const build = await importFn('buildAgendaEntries');
  const group = await importFn('groupEntriesByDay');
  const entries = build(
    [BINDING],
    { trips: [{ id: 3, title: 'c', d: '2026-07-28' }, { id: 1, title: 'a', d: '2026-07-26' }, { id: 2, title: 'b', d: '2026-07-26' }] },
    FROM,
    14,
  );
  const out = group(entries);
  assert.deepEqual(out.days.map((d) => d.date), ['2026-07-26', '2026-07-28'], 'empty days are absent');
  assert.deepEqual(out.days[0].entries.map((e) => e.rowId), ['1', '2']);
  assert.deepEqual(out.days[1].entries.map((e) => e.label), ['c']);
});

test('groupEntriesByDay: malformed input degrades to { days: [] }', async () => {
  const group = await importFn('groupEntriesByDay');
  assert.deepEqual(group(null), { days: [] });
  assert.deepEqual(group('nope'), { days: [] });
  assert.deepEqual(group([{}, 'x', null, { date: '' }, { date: 42 }]), { days: [] });
});
