/**
 * Unit tests for utility-intake's pure functions — no network, no LLM, no clock.
 * Functions are transpiled standalone, exactly the way the runtime injects them.
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

const rule = (matcher, extra = {}) => ({ status: 'active', matcherJson: JSON.stringify(matcher), ...extra });

// ---------- matchIntakeRule ----------

test('matchIntakeRule: equals/contains/exists clauses are AND-ed over dot paths', async () => {
  const match = await importFn('matchIntakeRule');
  const payload = { type: 'invoice.paid', account: { currency: 'EUR' }, subject: 'Your RECEIPT is ready', customer: { email: 'a@b.c' } };

  assert.equal(match([rule({ equals: { type: 'invoice.paid' } })], payload).matched, true);
  assert.equal(match([rule({ equals: { 'account.currency': 'EUR' } })], payload).matched, true);
  assert.equal(match([rule({ contains: { subject: 'receipt' } })], payload).matched, true, 'contains is case-insensitive');
  assert.equal(match([rule({ exists: ['customer.email'] })], payload).matched, true);

  // AND: one failing clause fails the rule.
  assert.equal(match([rule({ equals: { type: 'invoice.paid' }, contains: { subject: 'refund' } })], payload).matched, false);
  assert.equal(match([rule({ exists: ['customer.phone'] })], payload).matched, false);
});

test('matchIntakeRule: equals compares as strings so JSON round-trips agree', async () => {
  const match = await importFn('matchIntakeRule');
  assert.equal(match([rule({ equals: { n: 1 } })], { n: '1' }).matched, true);
  assert.equal(match([rule({ equals: { n: '1' } })], { n: 1 }).matched, true);
  assert.equal(match([rule({ equals: { n: 2 } })], { n: 1 }).matched, false);
});

test('matchIntakeRule: first match wins in the order given', async () => {
  const match = await importFn('matchIntakeRule');
  const rules = [
    rule({ equals: { kind: 'a' } }, { id: 'first' }),
    rule({ exists: ['kind'] }, { id: 'second' }),
  ];
  assert.equal(match(rules, { kind: 'a' }).rule.id, 'first');
  assert.equal(match(rules, { kind: 'z' }).rule.id, 'second', 'the broad rule catches what the narrow one missed');
});

test('matchIntakeRule: inactive, malformed, and empty matchers never match', async () => {
  const match = await importFn('matchIntakeRule');
  const payload = { a: 1 };
  assert.equal(match([{ status: 'disabled', matcherJson: JSON.stringify({ exists: ['a'] }) }], payload).matched, false);
  assert.equal(match([{ status: 'active', matcherJson: '{not json' }], payload).matched, false);
  assert.equal(match([rule({})], payload).matched, false, 'an empty matcher would capture everything — refused');
  assert.equal(match([rule([])], payload).matched, false);
  assert.equal(match(null, payload).matched, false);
  assert.equal(match([null, 42], payload).matched, false);
});

test('matchIntakeRule: a path through a non-object resolves to undefined, not a throw', async () => {
  const match = await importFn('matchIntakeRule');
  assert.equal(match([rule({ equals: { 'a.b.c': 'x' } })], { a: 5 }).matched, false);
  assert.equal(match([rule({ exists: ['a.b'] })], null).matched, false);
});

// ---------- applyIntakeMapping ----------

test('applyIntakeMapping: string paths, object specs, and fallbacks', async () => {
  const apply = await importFn('applyIntakeMapping');
  const out = apply(
    { amount: 'data.total', customer: { path: 'customer.name', fallback: 'unknown' }, note: 'missing.path' },
    { data: { total: 42 }, customer: {} },
  );
  assert.equal(out.row.amount, 42);
  assert.equal(out.row.customer, 'unknown');
  assert.ok(!('note' in out.row), 'a path with no value and no fallback is OMITTED');
  assert.deepEqual(out.missing, ['note']);
});

test('applyIntakeMapping: objects and arrays are stringified, primitives preserved', async () => {
  const apply = await importFn('applyIntakeMapping');
  const out = apply({ blob: 'nested', list: 'arr', flag: 'ok', n: 'num' }, { nested: { a: 1 }, arr: [1, 2], ok: false, num: 7 });
  assert.equal(out.row.blob, '{"a":1}');
  assert.equal(out.row.list, '[1,2]');
  assert.equal(out.row.flag, false);
  assert.equal(out.row.n, 7);
});

test('applyIntakeMapping: malformed input degrades to an empty projection', async () => {
  const apply = await importFn('applyIntakeMapping');
  assert.deepEqual(apply(null, {}), { row: {}, missing: [] });
  assert.deepEqual(apply('nope', {}), { row: {}, missing: [] });
  assert.deepEqual(apply([], {}), { row: {}, missing: [] });
  const bad = apply({ col: 42 }, {});
  assert.deepEqual(bad.row, {});
  assert.deepEqual(bad.missing, ['col'], 'an unusable spec is reported, not guessed');
});

// ---------- computeIntakeKey ----------

test('computeIntakeKey: deterministic, payload-sensitive, source-scoped', async () => {
  const key = await importFn('computeIntakeKey');
  const a = key('slack', '{"a":1}');
  assert.equal(a, key('slack', '{"a":1}'), 'same input → same key');
  assert.notEqual(a, key('slack', '{"a":2}'), 'different payload → different key');
  assert.notEqual(a, key('telegram', '{"a":1}'), 'different source → different key');
  assert.match(a, /^slack:[0-9a-f]{8}$/);
  assert.equal(typeof key(null, undefined), 'string');
  assert.match(key(null, undefined), /^unknown:/);
  assert.equal(key('web hook', '{}'), key('web:hook', '{}'), 'source separators are normalized');
});
