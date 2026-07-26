/**
 * Unit tests for utility-enricher's pure functions — no network, no LLM, no clock.
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

// ---------- findEmptyCells ----------

test('findEmptyCells: null, undefined, missing, empty and whitespace are empty — 0/false are not', async () => {
  const find = await importFn('findEmptyCells');
  const rows = [
    { id: 1, a: null, b: 'x', c: 0 },
    { id: 2, a: '', b: '   ', c: false },
    { id: 3, b: 'y', c: 'z' }, // `a` missing entirely
  ];
  const out = find(rows, ['a', 'b', 'c']);
  assert.deepEqual(out, [
    { rowId: '1', column: 'a' },
    { rowId: '2', column: 'a' },
    { rowId: '2', column: 'b' },
    { rowId: '3', column: 'a' },
  ]);
});

test('findEmptyCells: rows without a usable id are skipped', async () => {
  const find = await importFn('findEmptyCells');
  const out = find([{ a: null }, { id: '', a: null }, { id: 7, a: null }], ['a']);
  assert.deepEqual(out, [{ rowId: '7', column: 'a' }]);
});

test('findEmptyCells: malformed input degrades to []', async () => {
  const find = await importFn('findEmptyCells');
  assert.deepEqual(find(null, ['a']), []);
  assert.deepEqual(find([{ id: 1 }], null), []);
  assert.deepEqual(find([{ id: 1 }], []), []);
  assert.deepEqual(find([{ id: 1 }], ['', '  ']), []);
  assert.deepEqual(find(['nope', 42, null, { id: 1, a: null }], ['a']), [{ rowId: '1', column: 'a' }]);
});

// ---------- buildResearchQuery ----------

test('buildResearchQuery: humanizes snake_case and camelCase, singularizes the table', async () => {
  const build = await importFn('buildResearchQuery');
  assert.equal(
    build('landmarks', { id: 1, name: 'Eiffel Tower' }, 'height_meters', ['name']),
    'Eiffel Tower landmark height meters',
  );
  assert.equal(
    build('BookPublishers', { id: 1, title: 'Penguin' }, 'foundedYear', null),
    'Penguin book publisher founded year',
  );
  // Naive singularization only strips a trailing `s` from tokens longer than 3 chars.
  assert.equal(build('gas', { id: 1, name: 'Neon' }, 'density', null), 'Neon gas density');
  // The column is never singularized — it names a property, not an instance.
  assert.equal(build('cars', { id: 1, name: 'Model T' }, 'doors', null), 'Model T car doors');
});

test('buildResearchQuery: label falls back through labelColumns → name/title/label → id', async () => {
  const build = await importFn('buildResearchQuery');
  assert.equal(build('items', { id: 3, sku: 'A-9', name: 'Widget' }, 'weight', ['sku']), 'A-9 item weight');
  // Empty/whitespace label columns are skipped, not used.
  assert.equal(build('items', { id: 3, sku: '  ', name: 'Widget' }, 'weight', ['sku']), 'Widget item weight');
  assert.equal(build('items', { id: 3, label: 'Boxed' }, 'weight', null), 'Boxed item weight');
  assert.equal(build('items', { id: 3 }, 'weight', null), 'id 3 item weight');
  // No id and no label: still a usable query, just without the entity.
  assert.equal(build('items', {}, 'weight', null), 'item weight');
});

test('buildResearchQuery: collapses whitespace and never stringifies nested objects', async () => {
  const build = await importFn('buildResearchQuery');
  assert.equal(build('  space_stations ', { id: 1, name: '  ISS   Alpha ' }, ' orbit_altitude ', null),
    'ISS Alpha space station orbit altitude');
  assert.equal(build('items', { id: 4, name: { deep: 'nope' } }, 'weight', null), 'id 4 item weight');
});

test('buildResearchQuery: malformed input degrades to ""', async () => {
  const build = await importFn('buildResearchQuery');
  assert.equal(build(null, null, null, null), '');
  assert.equal(build('items', { id: 1 }, '', null), '');
  assert.equal(build('', { id: 1 }, 'weight', null), '');
  assert.equal(build(42, 'nope', 'weight', 'nope'), '');
});

// ---------- validateProposedValue ----------

test('validateProposedValue: number hint parses locale-tolerantly', async () => {
  const v = await importFn('validateProposedValue');
  assert.deepEqual(v('whatever', '1,234.50', 'number'), { ok: true, normalized: 1234.5, reason: '' });
  assert.deepEqual(v('whatever', '1.234,50', 'number'), { ok: true, normalized: 1234.5, reason: '' });
  assert.equal(v('whatever', '1,234', 'number').normalized, 1234); // single sep + exactly 3 digits = thousands
  assert.equal(v('whatever', '1.234', 'number').normalized, 1234);
  assert.equal(v('whatever', '12.5', 'number').normalized, 12.5);
  assert.equal(v('whatever', '1.234.567', 'number').normalized, 1234567);
  assert.equal(v('whatever', '€ 42', 'number').normalized, 42);
  assert.equal(v('whatever', '-7', 'number').normalized, -7);
  assert.equal(v('whatever', 330, 'number').normalized, 330);
});

test('validateProposedValue: bad numbers fail with a reason instead of throwing', async () => {
  const v = await importFn('validateProposedValue');
  const bad = v('whatever', 'about three hundred', 'number');
  assert.equal(bad.ok, false);
  assert.equal(bad.normalized, null);
  assert.ok(bad.reason.length > 0);
});

test('validateProposedValue: date hint normalizes the lenient shapes to YYYY-MM-DD', async () => {
  const v = await importFn('validateProposedValue');
  assert.equal(v('x', '2026-07-26', 'date').normalized, '2026-07-26');
  assert.equal(v('x', '2026/07/26', 'date').normalized, '2026-07-26');
  assert.equal(v('x', '2026-07-26T14:30:00Z', 'date').normalized, '2026-07-26');
  assert.equal(v('x', '2026-07-26 14:30', 'date').normalized, '2026-07-26');
  assert.equal(v('x', '1753500000000', 'date').normalized, new Date(1753500000000).toISOString().slice(0, 10));
  assert.equal(v('x', '1753500000', 'date').normalized, new Date(1753500000000).toISOString().slice(0, 10));
  assert.equal(v('x', 'sometime in July', 'date').ok, false);
  assert.equal(v('x', '26/07/2026', 'date').ok, false); // ambiguous day-first is refused, not guessed
});

test('validateProposedValue: url hint requires a real http(s) url', async () => {
  const v = await importFn('validateProposedValue');
  assert.equal(v('x', '  https://en.wikipedia.org/wiki/Eiffel_Tower ', 'url').normalized,
    'https://en.wikipedia.org/wiki/Eiffel_Tower');
  assert.equal(v('x', 'http://example.com', 'url').ok, true);
  for (const bad of ['example.com', 'ftp://example.com/x', 'https://', 'https://localhost', 'not a url', 'https://a b.com']) {
    assert.equal(v('x', bad, 'url').ok, false, `expected ${bad} to be rejected`);
  }
});

test('validateProposedValue: text collapses long newline runs and caps at 500 chars', async () => {
  const v = await importFn('validateProposedValue');
  const collapsed = v('x', 'a\n\n\n\n\nb', 'text');
  assert.equal(collapsed.ok, true);
  assert.equal(collapsed.normalized, 'a\n\nb');
  // Exactly two newlines are a paragraph break and survive untouched.
  assert.equal(v('x', 'a\n\nb', 'text').normalized, 'a\n\nb');
  assert.equal(v('x', 'x'.repeat(500), 'text').ok, true);
  const tooLong = v('x', 'x'.repeat(501), 'text');
  assert.equal(tooLong.ok, false);
  assert.ok(/500/.test(tooLong.reason));
});

test('validateProposedValue: infers the type from the column name when no hint is given', async () => {
  const v = await importFn('validateProposedValue');
  assert.equal(v('price_eur', '1.234,50').normalized, 1234.5);
  assert.equal(v('unit_cost', '9.99').normalized, 9.99);
  assert.equal(v('founded_year', '1889').normalized, 1889);
  assert.equal(v('room_count', '12').normalized, 12);
  assert.equal(v('release_date', '2026/07/26').normalized, '2026-07-26');
  assert.equal(v('published_at', '2026-07-26').normalized, '2026-07-26');
  assert.equal(v('renewed_on', '2026-07-26').normalized, '2026-07-26');
  assert.equal(v('website', 'https://example.com').normalized, 'https://example.com');
  assert.equal(v('source_url', 'https://example.com').normalized, 'https://example.com');
  assert.equal(v('homepage_link', 'nope').ok, false);
  assert.equal(v('description', 'a plain sentence').normalized, 'a plain sentence');
  // An empty hint is treated as absent, not as an unknown type.
  assert.equal(v('price_eur', '42', '').normalized, 42);
  assert.equal(v('price_eur', '42', 'text').normalized, '42'); // an explicit hint always wins
});

test('validateProposedValue: empty and non-scalar values fail without throwing', async () => {
  const v = await importFn('validateProposedValue');
  for (const bad of [null, undefined, '', '   ']) {
    const r = v('description', bad);
    assert.equal(r.ok, false, `expected ${JSON.stringify(bad)} to fail`);
    assert.equal(r.normalized, null);
    assert.ok(r.reason.length > 0);
  }
  assert.equal(v('description', { a: 1 }).ok, false);
  assert.equal(v('description', ['a']).ok, false);
  assert.equal(v(null, 'text with no column').ok, true); // no column name → text
});

// ---------- computeEnrichKey ----------

test('computeEnrichKey: stable, sanitized, and date-free', async () => {
  const key = await importFn('computeEnrichKey');
  assert.equal(key('landmarks', 42, 'height_meters'), 'landmarks:42:height_meters');
  // Same cell → same key, every run, forever (no clock in the key).
  assert.equal(key('landmarks', '42', 'height_meters'), key('landmarks', 42, 'height_meters'));
  assert.notEqual(key('landmarks', 42, 'height_meters'), key('landmarks', 43, 'height_meters'));
  assert.notEqual(key('landmarks', 42, 'height_meters'), key('landmarks', 42, 'width_meters'));
  // Hostile inputs sanitize instead of throwing.
  assert.equal(typeof key(null, undefined, 'a:b c'), 'string');
  assert.equal(key('a b', 'c:d', 'e f'), 'a_b:c_d:e_f');
});
