/**
 * Unit tests for utility-importer's pure functions — no network, no LLM, no clock.
 * Functions are transpiled standalone, exactly the way the runtime injects them.
 *
 * These are the tier's most edge-heavy tests on purpose: everything here parses hostile
 * real-world text, and a silent coercion bug corrupts a table the importer cannot undo.
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

// ---------- parseCsvRows ----------

test('parseCsvRows: quoted fields with embedded delimiters, newlines and escaped quotes', async () => {
  const parse = await importFn('parseCsvRows');
  const csv = 'name,note\n"Lovelace, Ada","said ""hello""\nover two lines"\nBabbage,plain';
  const out = parse(csv);
  assert.deepEqual(out.headers, ['name', 'note']);
  assert.equal(out.rows.length, 2);
  assert.equal(out.rows[0].name, 'Lovelace, Ada');
  assert.equal(out.rows[0].note, 'said "hello"\nover two lines');
  assert.equal(out.rows[1].name, 'Babbage');
  assert.equal(out.raggedRows, 0);
});

test('parseCsvRows: detects semicolon and tab delimiters', async () => {
  const parse = await importFn('parseCsvRows');
  const semi = parse('a;b;c\n1;2;3\n4;5;6');
  assert.equal(semi.delimiter, ';');
  assert.deepEqual(semi.headers, ['a', 'b', 'c']);
  assert.equal(semi.rows[1].c, '6');

  const tab = parse('a\tb\n1\t2');
  assert.equal(tab.delimiter, '\t');
  assert.equal(tab.rows[0].b, '2');
});

test('parseCsvRows: a comma-heavy quoted column does not outvote the real delimiter', async () => {
  const parse = await importFn('parseCsvRows');
  const out = parse('id;description\n1;"apples, pears, plums"\n2;"a, b, c, d"');
  assert.equal(out.delimiter, ';');
  assert.equal(out.rows[0].description, 'apples, pears, plums');
});

test('parseCsvRows: BOM, CRLF, blank lines and a trailing newline are tolerated', async () => {
  const parse = await importFn('parseCsvRows');
  const out = parse('﻿a,b\r\n1,2\r\n\r\n3,4\r\n');
  assert.deepEqual(out.headers, ['a', 'b']);
  assert.equal(out.rows.length, 2);
  assert.equal(out.rows[1].a, '3');
});

test('parseCsvRows: ragged rows are padded/truncated and counted', async () => {
  const parse = await importFn('parseCsvRows');
  const out = parse('a,b,c\n1,2\n1,2,3,4\n1,2,3');
  assert.equal(out.raggedRows, 2);
  assert.equal(out.rows[0].c, '', 'a short row pads');
  assert.equal(out.rows[1].c, '3', 'a long row truncates to the header width');
});

test('parseCsvRows: malformed input degrades to an empty result', async () => {
  const parse = await importFn('parseCsvRows');
  for (const bad of [null, undefined, 42, {}, '', '   ']) {
    const out = parse(bad);
    assert.deepEqual(out.rows, [], `expected no rows for ${JSON.stringify(bad)}`);
    assert.deepEqual(out.headers, []);
  }
});

// ---------- parseJsonRows ----------

test('parseJsonRows: bare array, wrapped forms, and preference order', async () => {
  const parse = await importFn('parseJsonRows');
  assert.equal(parse('[{"a":1},{"a":2}]').rows.length, 2);
  assert.equal(parse('[{"a":1}]').shape, 'array');
  assert.equal(parse('{"items":[{"a":1}]}').shape, 'wrapped:items');
  assert.equal(parse('{"payload":{"x":1},"results":[{"a":1}]}').shape, 'wrapped:results');
  assert.equal(parse('{"custom":[{"a":1}]}').shape, 'wrapped:custom', 'falls back to the first array-of-objects');
});

test('parseJsonRows: non-object entries are skipped and counted, not coerced', async () => {
  const parse = await importFn('parseJsonRows');
  const out = parse('[{"a":1},5,"x",null,[1,2],{"b":2}]');
  assert.equal(out.rows.length, 2);
  assert.equal(out.skipped, 4);
});

test('parseJsonRows: garbage degrades to an empty result', async () => {
  const parse = await importFn('parseJsonRows');
  for (const bad of ['not json', '', '{"a":1}', '[]', null, 42]) {
    assert.deepEqual(parse(bad).rows, [], `expected no rows for ${JSON.stringify(bad)}`);
  }
});

// ---------- proposeColumnMapping ----------

test('proposeColumnMapping: exact, normalized and singularized tiers', async () => {
  const propose = await importFn('proposeColumnMapping');
  const out = propose(['Name', 'first_name', 'tags'], ['name', 'firstName', 'tag']);
  const bySource = Object.fromEntries(out.map((p) => [p.source, p]));
  assert.equal(bySource['Name'].target, 'name');
  assert.equal(bySource['Name'].confidence, 1);
  assert.equal(bySource['first_name'].target, 'firstName');
  assert.equal(bySource['first_name'].confidence, 0.8);
  assert.equal(bySource['tags'].target, 'tag');
  assert.equal(bySource['tags'].confidence, 0.6);
});

test('proposeColumnMapping: unmatched sources are null, and a target is claimed once', async () => {
  const propose = await importFn('proposeColumnMapping');
  const out = propose(['nothing_like_it', 'name', 'names'], ['name']);
  const bySource = Object.fromEntries(out.map((p) => [p.source, p]));
  assert.equal(bySource['nothing_like_it'].target, null);
  assert.equal(bySource['nothing_like_it'].confidence, 0);
  assert.equal(bySource['name'].target, 'name', 'the exact match wins the column');
  assert.equal(bySource['names'].target, null, 'a weaker match cannot steal a claimed column');
});

test('proposeColumnMapping: preserves source order and degrades to []', async () => {
  const propose = await importFn('proposeColumnMapping');
  assert.deepEqual(propose(['b', 'a'], ['a', 'b']).map((p) => p.source), ['b', 'a']);
  assert.deepEqual(propose(null, ['a']), []);
  assert.deepEqual(propose([1, 2], ['a']), []);
  assert.deepEqual(propose(['a'], null).map((p) => p.target), [null]);
});

// ---------- coerceRowToTarget ----------

const MAP = [
  { source: 'amount', target: 'total' },
  { source: 'when', target: 'occurredAt' },
  { source: 'active', target: 'isActive' },
  { source: 'label', target: 'name' },
  { source: 'ignored', target: null },
];
const HINTS = { total: 'number', occurredAt: 'date', isActive: 'boolean', name: 'string' };

test('coerceRowToTarget: number locales — the LAST separator decides the decimal point', async () => {
  const coerce = await importFn('coerceRowToTarget');
  assert.equal(coerce({ amount: '1,234.50' }, MAP, HINTS).row.total, 1234.5);
  assert.equal(coerce({ amount: '1.234,50' }, MAP, HINTS).row.total, 1234.5);
  assert.equal(coerce({ amount: '1,234' }, MAP, HINTS).row.total, 1234);
  assert.equal(coerce({ amount: '12.5' }, MAP, HINTS).row.total, 12.5);
  assert.equal(coerce({ amount: '-7' }, MAP, HINTS).row.total, -7);
  // Single separator + exactly three digits = a thousands group, either way round.
  assert.equal(coerce({ amount: '1.234' }, MAP, HINTS).row.total, 1234);
  assert.equal(coerce({ amount: '1.234.567' }, MAP, HINTS).row.total, 1234567);
  assert.equal(coerce({ amount: '1,23' }, MAP, HINTS).row.total, 1.23);
});

test('coerceRowToTarget: booleans, dates, and unmapped sources', async () => {
  const coerce = await importFn('coerceRowToTarget');
  const out = coerce({ active: 'YES', when: '2026/07/26', label: '  spaced  ', ignored: 'dropped' }, MAP, HINTS);
  assert.equal(out.row.isActive, true);
  assert.equal(out.row.occurredAt, '2026-07-26');
  assert.equal(out.row.name, 'spaced');
  assert.ok(!('ignored' in out.row), 'a null-target source is intentionally dropped');
  assert.equal(out.ok, true);
});

test('coerceRowToTarget: a value failing its hint is reported, never guessed', async () => {
  const coerce = await importFn('coerceRowToTarget');
  const out = coerce({ amount: 'n/a', when: '03/04/2026', active: 'maybe' }, MAP, HINTS);
  assert.equal(out.ok, false);
  assert.equal(out.issues.length, 3);
  assert.ok(!('total' in out.row), 'a failed cell is omitted, not defaulted');
  assert.ok(out.issues.some((i) => i.target === 'total' && i.problem === 'not a number'));
  assert.ok(out.issues.some((i) => i.target === 'occurredAt' && i.problem === 'not a date'),
    'ambiguous DD/MM vs MM/DD is refused rather than guessed');
  assert.ok(out.issues.some((i) => i.target === 'isActive' && i.problem === 'not a boolean'));
});

test('coerceRowToTarget: empty cells leave the column unset without an issue', async () => {
  const coerce = await importFn('coerceRowToTarget');
  const out = coerce({ amount: '   ', label: '' }, MAP, HINTS);
  assert.deepEqual(out.row, {});
  assert.equal(out.ok, true, 'an empty source cell is not an error');
});

test('coerceRowToTarget: unhinted columns pass through as trimmed text; malformed input is safe', async () => {
  const coerce = await importFn('coerceRowToTarget');
  assert.equal(coerce({ label: ' hi ' }, [{ source: 'label', target: 'name' }], null).row.name, 'hi');
  assert.deepEqual(coerce(null, MAP, HINTS).row, {});
  assert.deepEqual(coerce({ a: 1 }, null, HINTS).row, {});
});

// ---------- computeImportRowKey ----------

test('computeImportRowKey: normalizes case and whitespace, stable across re-imports', async () => {
  const key = await importFn('computeImportRowKey');
  assert.equal(
    key('people', { email: 'Ada@Example.com', name: '  Ada Lovelace ' }, ['email', 'name']),
    key('people', { email: 'ada@example.com', name: 'ada lovelace' }, ['email', 'name']),
  );
  assert.equal(key('people', { email: 'a@b.c' }, ['email']), 'people:a@b.c');
});

test('computeImportRowKey: fixed shape — a missing value is an empty segment, not a shift', async () => {
  const key = await importFn('computeImportRowKey');
  const withBoth = key('t', { a: 'x', b: 'y' }, ['a', 'b']);
  const missingFirst = key('t', { b: 'y' }, ['a', 'b']);
  assert.equal(withBoth, 't:x|y');
  assert.equal(missingFirst, 't:|y');
  assert.notEqual(missingFirst, key('t', { a: 'y' }, ['a', 'b']));
});

test('computeImportRowKey: distinct per table and key set; hostile input is safe', async () => {
  const key = await importFn('computeImportRowKey');
  assert.notEqual(key('people', { a: '1' }, ['a']), key('orders', { a: '1' }, ['a']));
  assert.equal(key('t', {}, []), 't:');
  assert.equal(typeof key(null, null, null), 'string');
  assert.ok(!key('t', { a: 'x|y' }, ['a']).endsWith('x|y'), 'a literal pipe cannot forge a segment boundary');
});
