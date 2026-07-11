/**
 * Self-contained tests for the `homes` project-application (round 1 — core build).
 *
 * Run:  node --test store/projects/homes/tests/homes.test.mjs
 *
 * - **Schemas** validate with the REAL engine validator (`validateSchemaSet` from
 *   the built `@lmthing/core`) — the same fail-loud check the runtime loader runs.
 * - **Functions** are unit-tested by importing the actual `.ts` files (Node 24
 *   native type-stripping) — the deterministic math/parsing the agents depend on.
 * - **API / hooks / agents / spaces** are asserted structurally (files are TS/MD).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..'); // store/projects/homes
const REPO = join(APP, '..', '..', '..'); // monorepo root
const CORE = join(REPO, 'sdk', 'org', 'libs', 'core', 'dist', 'index.js');

// ── Schemas — real engine validation ────────────────────────────────────────
const EXPECTED_TABLES = [
  'searches', 'sources', 'raw_captures', 'listings', 'listing_analyses',
  'location_guesses', 'commutes', 'taste_signals', 'taste_notes', 'alerts',
];

test('all 10 database schemas pass the engine validateSchemaSet (fail-loud)', async () => {
  assert.ok(existsSync(CORE), `built @lmthing/core not found at ${CORE} — run \`pnpm --filter @lmthing/core build\` in sdk/org`);
  const { validateSchemaSet } = await import(CORE);
  const dbDir = join(APP, 'database');
  const tables = readdirSync(dbDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ name: f.slice(0, -5), schema: JSON.parse(readFileSync(join(dbDir, f), 'utf8')) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  assert.deepEqual([...tables.map((t) => t.name)].sort(), [...EXPECTED_TABLES].sort());
  assert.doesNotThrow(() => validateSchemaSet(tables));
});

test('every table/column/relation carries a description + exactly one PK', () => {
  const dbDir = join(APP, 'database');
  for (const f of readdirSync(dbDir).filter((f) => f.endsWith('.json'))) {
    const s = JSON.parse(readFileSync(join(dbDir, f), 'utf8'));
    assert.ok(s.description, `${f}: table description missing`);
    const pks = Object.entries(s.columns).filter(([, c]) => c.primaryKey);
    assert.equal(pks.length, 1, `${f}: expected exactly one primary key`);
    for (const [name, col] of Object.entries(s.columns)) {
      assert.ok(col.description, `${f}.${name}: column description missing`);
    }
    for (const [rname, rel] of Object.entries(s.relations ?? {})) {
      assert.ok(rel.description, `${f}.${rname}: relation description missing`);
    }
  }
});

test('listings.dedupeKey is unique (backs the merge-not-double-insert promise)', () => {
  const s = JSON.parse(readFileSync(join(APP, 'database', 'listings.json'), 'utf8'));
  assert.equal(s.columns.dedupeKey.unique, true, 'listings.dedupeKey must be unique');
});

test('onDelete semantics: search cascades; signals/alerts setNull on listing removal', () => {
  const signals = JSON.parse(readFileSync(join(APP, 'database', 'taste_signals.json'), 'utf8'));
  assert.equal(signals.columns.listingId.references.onDelete, 'setNull');
  const alerts = JSON.parse(readFileSync(join(APP, 'database', 'alerts.json'), 'utf8'));
  assert.equal(alerts.columns.listingId.references.onDelete, 'setNull');
  const listings = JSON.parse(readFileSync(join(APP, 'database', 'listings.json'), 'utf8'));
  assert.equal(listings.columns.searchId.references.onDelete, 'cascade');
});

// ── Function unit tests — the deterministic core ─────────────────────────────
const intakeFn = (n) => import(join(APP, 'spaces', 'intake', 'functions', `${n}.ts`));
const scoutFn = (n) => import(join(APP, 'spaces', 'scout', 'functions', `${n}.ts`));

test('dedupeKey: same unit across portals → same key; different unit → different', async () => {
  const { dedupeKey } = await intakeFn('dedupeKey');
  const a = dedupeKey({ address: 'Rua das Flores 12', rooms: 3, areaSqm: 84, priceAmount: 1600 });
  const b = dedupeKey({ address: '12, R. Flores', rooms: 3, areaSqm: 86, priceAmount: 1600 });
  const c = dedupeKey({ address: 'Avenida Roma 40', rooms: 2, areaSqm: 60, priceAmount: 1200 });
  assert.equal(a, b, 'same unit cross-posted must collapse to one key');
  assert.notEqual(a, c, 'a genuinely different unit must not collide');
});

test('parseMoney: EU and US idioms normalize correctly, currency detected', async () => {
  const { parseMoney } = await intakeFn('parseMoney');
  assert.deepEqual(parseMoney('€1.600/mês'), { amount: 1600, currency: 'EUR' });
  assert.deepEqual(parseMoney('1,600.50 USD'), { amount: 1600.5, currency: 'USD' });
  assert.equal(parseMoney('450.000 €').amount, 450000);
});

test('trueCost: rent + buy paths compute, every line labelled stated|estimated', async () => {
  const { trueCost } = await intakeFn('trueCost');
  const rent = trueCost({ mode: 'rent', priceAmount: 1600, currency: 'EUR', areaSqm: 84, statedFees: [{ label: 'Condo', amount: 40 }] });
  assert.ok(rent.trueCostMonthly > 1600, 'rent true cost includes fees + utilities');
  assert.ok(rent.breakdown.every((l) => l.basis === 'stated' || l.basis === 'estimated'));
  assert.ok(rent.breakdown.some((l) => l.basis === 'estimated'), 'utilities is an estimate');
  const buy = trueCost({ mode: 'buy', priceAmount: 450000, currency: 'EUR', annualRatePct: 3.5, rateSource: 'ECB', downPaymentPct: 20, termYears: 30 });
  assert.ok(buy.trueCostMonthly > 1000 && buy.trueCostMonthly < 3000, 'buy monthly is a sane mortgage estimate');
  assert.ok(buy.breakdown.every((l) => l.basis === 'stated' || l.basis === 'estimated'));
});

test('blendScore: dealbreaker caps score ≤45; commute-over-max penalizes', async () => {
  const { blendScore } = await scoutFn('blendScore');
  const capped = blendScore({ trueCostMonthly: 1500, budgetMax: 1600, noteMatches: [{ weight: 1, match: 1, dimension: 'light' }], commuteOverBy: [0], flags: [], violatesHardConstraint: true });
  assert.ok(capped.score <= 45, 'a violated hard constraint caps the score');
  const within = blendScore({ trueCostMonthly: 1500, budgetMax: 1600, noteMatches: [], commuteOverBy: [0], flags: [], violatesHardConstraint: false });
  const over = blendScore({ trueCostMonthly: 1500, budgetMax: 1600, noteMatches: [], commuteOverBy: [15], flags: [], violatesHardConstraint: false });
  assert.ok(over.score < within.score, 'commute over max lowers the score');
});

test('sumRoomAreas: sums per-room dimensions + direct areas', async () => {
  const { sumRoomAreas } = await scoutFn('sumRoomAreas');
  const r = sumRoomAreas('Sala 18 m². Quarto 3.4 x 4.1. Kitchen 12,5 m2');
  assert.ok(r.totalSqm > 40, 'derived size sums the rooms');
  assert.ok(r.rooms.length >= 3);
});

test('haversine + intersectClues: distance is positive; more clues → a guess', async () => {
  const { haversine } = await scoutFn('haversine');
  const { intersectClues } = await scoutFn('intersectClues');
  assert.ok(haversine({ lat: 38.72, lng: -9.13 }, { lat: 38.73, lng: -9.14 }) > 100);
  const g = intersectClues([{ lat: 38.72, lng: -9.13, radiusM: 120 }, { lat: 38.721, lng: -9.131, radiusM: 100 }]);
  assert.ok(g && g.confidence > 0 && g.radiusM > 0);
  assert.equal(intersectClues([]), null);
});

test('parseAlertEmail → extractListingFields: 3-listing digest → 3 aligned candidates', async () => {
  const { parseAlertEmail } = await intakeFn('parseAlertEmail');
  const { extractListingFields } = await intakeFn('extractListingFields');
  const email = 'New matches\n\nBright T2 in Arroios, renovated\n€1,600/month\nhttps://idealista.pt/1\n\nSunny T2 near the park\n€1,550 per month\nhttps://idealista.pt/2\n\nCosy T1 with balcony 55 m²\n€1,200/mês\nhttps://idealista.pt/3\n\nUnsubscribe here';
  const blocks = parseAlertEmail(email);
  assert.equal(blocks.length, 3, 'three cards segmented');
  const f0 = extractListingFields(blocks[0]);
  assert.equal(f0.priceAmount, 1600, 'price parsed from the currency-anchored token, not the T2 digit');
  assert.equal(f0.bedrooms, 2);
  assert.match(f0.title, /Arroios/);
});

test('parseAlertEmail: drops the digest subject/summary line (budget figure ≠ a listing)', async () => {
  const { parseAlertEmail } = await intakeFn('parseAlertEmail');
  // The subject line carries a BUDGET figure ("under €1,600") that trips the price
  // anchor, but it is not a listing card — it has no link, size, or room spec.
  const email =
    'New match for your saved search — Lisbon rentals under €1,600\n\n' +
    'Bright 2-bedroom apartment in Estrela\n€1,450/month\n78 m²\nhttps://idealista.pt/1\n\n' +
    'Also new:\nT2 near Marquês de Pombal, €1,590/month, 65 m²\nhttps://idealista.pt/2';
  const blocks = parseAlertEmail(email);
  assert.equal(blocks.length, 2, 'the summary/subject header is dropped; two real cards remain');
  assert.ok(!blocks.some((b) => /saved search/i.test(b)), 'no phantom card from the subject line');
});

test('extractListingFields.title: real title beats a connective header; run-on blob is trimmed', async () => {
  const { extractListingFields } = await intakeFn('extractListingFields');
  // A connective header ("Also new:") must not win over the listing line beneath it.
  const withHeader = extractListingFields('Also new:\nT2 near Marquês de Pombal, €1,590/month, 65 m²');
  assert.match(withHeader.title, /Marqu.s de Pombal/, 'picks the property line, not "Also new:"');
  assert.doesNotMatch(withHeader.title, /^Also new/i);
  // A single-line pasted blob must not become a 140-char run-on title.
  const blob = extractListingFields(
    'Apartamento T2 para arrendar em Campo de Ourique, Lisboa. 1.500 EUR por mês. 80 m2, 2 quartos, muito luminoso.',
  );
  assert.equal(blob.title, 'Apartamento T2 para arrendar em Campo de Ourique, Lisboa', 'trimmed to the first sentence');
  assert.ok(blob.title.length <= 90);
});

test('parsePortalHtml: JSON-LD wins over scraped fields', async () => {
  const { parsePortalHtml } = await intakeFn('parsePortalHtml');
  const html = '<html><head><meta property="og:title" content="WRONG"></head><script type="application/ld+json">{"@type":"Residence","name":"T2 Arroios","numberOfBedrooms":2,"floorSize":{"value":84},"offers":{"price":"1600","priceCurrency":"EUR"},"image":["https://x/1.jpg"]}</script></html>';
  const r = parsePortalHtml(html);
  assert.equal(r.fromJsonLd, true, 'JSON-LD is the highest-fidelity source');
  assert.equal(r.title, 'T2 Arroios');
  assert.equal(r.priceAmount, 1600);
  assert.equal(r.areaSqm, 84);
});

test('paginateSavedSearch: bounded cards + finds detail links', async () => {
  const { paginateSavedSearch } = await intakeFn('paginateSavedSearch');
  const html = '<a href="/imovel/1">T2</a> €1600 <a href="/imovel/2">T3</a> €1900 <link rel="next" href="?page=2">';
  const r = paginateSavedSearch(html, { maxCards: 40 });
  assert.equal(r.cards.length, 2);
  assert.equal(r.nextPageUrl, '?page=2');
});

test('robotsAllowed: disallow rule blocks; unrelated path allowed', async () => {
  const { robotsAllowed } = await intakeFn('robotsAllowed');
  assert.equal(robotsAllowed('User-agent: *\nDisallow: /imovel', '/imovel/123').allowed, false);
  assert.equal(robotsAllowed('User-agent: *\nDisallow: /private', '/imovel/123').allowed, true);
  assert.equal(robotsAllowed('', '/anything').allowed, true);
});

test('politeFetchPlan: only due+enabled sources; interval floored at 6h', async () => {
  const { politeFetchPlan } = await intakeFn('politeFetchPlan');
  const now = Date.now();
  const plan = politeFetchPlan([
    { id: 's1', url: 'https://idealista.pt/s', pollEnabled: true, pollIntervalHours: 12, lastPolledAt: null },
    { id: 's2', url: 'https://x.com/s', pollEnabled: false },
    { id: 's3', url: 'https://y.com/s', pollEnabled: true, blockedReason: 'robots' },
    { id: 's4', url: 'https://z.com/s', pollEnabled: true, pollIntervalHours: 12, lastPolledAt: new Date(now - 3600_000).toISOString() },
  ], now);
  const ids = plan.map((p) => p.sourceId);
  assert.ok(ids.includes('s1'), 'never-polled enabled source is due');
  assert.ok(!ids.includes('s2'), 'disabled source skipped');
  assert.ok(!ids.includes('s3'), 'blocked source skipped');
  assert.ok(!ids.includes('s4'), 'recently-polled source not yet due');
});

test('politeFetchPlan: a pending "Check now" is polled once even when disabled / not yet due', async () => {
  const { politeFetchPlan } = await intakeFn('politeFetchPlan');
  const now = Date.now();
  const plan = politeFetchPlan([
    // Disabled recurring polling, but an explicit manual request after the last poll → due once.
    { id: 'm1', url: 'https://idealista.pt/m', pollEnabled: false, lastPolledAt: new Date(now - 600_000).toISOString(), pollRequestedAt: new Date(now - 1_000).toISOString() },
    // Manual request already serviced (lastPolledAt after pollRequestedAt) → NOT re-polled (loop-safe).
    { id: 'm2', url: 'https://x.com/m', pollEnabled: false, pollRequestedAt: new Date(now - 60_000).toISOString(), lastPolledAt: new Date(now - 1_000).toISOString() },
    // Manual request but robots-blocked → still skipped.
    { id: 'm3', url: 'https://y.com/m', pollEnabled: true, blockedReason: 'robots', pollRequestedAt: new Date(now).toISOString() },
  ], now);
  const ids = plan.map((p) => p.sourceId);
  assert.ok(ids.includes('m1'), 'a fresh manual request bypasses the pollEnabled opt-in and interval');
  assert.ok(!ids.includes('m2'), 'a serviced manual request does not re-poll (no loop)');
  assert.ok(!ids.includes('m3'), 'a blocked source is never polled, even on manual request');
});

// ── API handlers — the 19 named, typed endpoints ─────────────────────────────
const EXPECTED_ENDPOINTS = [
  ['searches/GET.ts', 'searchList'],
  ['searches/POST.ts', 'createSearch'],
  ['searches/[id]/GET.ts', 'getSearch'],
  ['searches/[id]/PATCH.ts', 'updateSearch'],
  ['searches/[id]/DELETE.ts', 'deleteSearch'],
  ['searches/[id]/sources/POST.ts', 'addSource'],
  ['searches/[id]/captures/POST.ts', 'ingestCapture'],
  ['searches/[id]/captures/GET.ts', 'listCaptures'],
  ['searches/[id]/listings/GET.ts', 'listingFeed'],
  ['searches/[id]/compare/GET.ts', 'compareListings'],
  ['searches/[id]/taste/GET.ts', 'tasteProfile'],
  ['searches/[id]/alerts/GET.ts', 'listAlerts'],
  ['listings/[id]/GET.ts', 'getListing'],
  ['listings/[id]/PATCH.ts', 'updateListing'],
  ['listings/[id]/save/POST.ts', 'saveListing'],
  ['listings/[id]/dismiss/POST.ts', 'dismissListing'],
  ['alerts/[id]/PATCH.ts', 'markAlertRead'],
  ['sources/[id]/PATCH.ts', 'updateSource'],
  ['sources/[id]/poll/POST.ts', 'pollSource'],
];

test('all 19 api handlers exist and export name / Input / Output / default handler', () => {
  for (const [rel, name] of EXPECTED_ENDPOINTS) {
    const p = join(APP, 'api', rel);
    assert.ok(existsSync(p), `missing handler ${rel}`);
    const src = readFileSync(p, 'utf8');
    assert.match(src, new RegExp(`export const name = ['"]${name}['"]`), `${rel}: name must be '${name}'`);
    assert.match(src, /export (interface|type) Input\b/, `${rel}: must export Input`);
    assert.match(src, /export (interface|type) Output\b/, `${rel}: must export Output`);
    assert.match(src, /export default async function handler/, `${rel}: must default-export an async handler`);
  }
});

test('ingestCapture inserts a raw_capture and does NOT spawn (the hook drives it)', () => {
  const src = readFileSync(join(APP, 'api', 'searches', '[id]', 'captures', 'POST.ts'), 'utf8');
  assert.match(src, /db\.insert\(\s*['"]raw_captures['"]/, 'ingestCapture must insert raw_captures');
  assert.doesNotMatch(src, /ctx\.spawn\(/, 'ingestCapture returns immediately — the parse hook fires on insert');
});

test('pollSource stamps a manual request and does NOT spawn (the poll-source-now hook drives it)', () => {
  const src = readFileSync(join(APP, 'api', 'sources', '[id]', 'poll', 'POST.ts'), 'utf8');
  // pollSource deliberately drives the poll through the poll-source-now db-hook (a
  // `sources` UPDATE) rather than `ctx.spawn` — the reliably-routed, per-source-gated path.
  assert.doesNotMatch(src, /ctx\.spawn\(/, 'pollSource drives the poll via the db-hook, not ctx.spawn');
  assert.match(src, /pollRequestedAt/, 'pollSource stamps a manual-poll request');
  assert.match(src, /db\.update\(\s*['"]sources['"]/, 'the request is a sources update the hook fires on');
});

test('poll-source-now: event on project/db.sources.update → intake/clipper#poll trigger', () => {
  const src = readFileSync(join(APP, 'hooks', 'poll-source-now.ts'), 'utf8');
  assert.match(src, /type:\s*['"]event['"]/);
  assert.match(src, /event:\s*['"]project\/db\.sources\.update['"]/);
  // Declarative trigger (not the terse handler-delegate) so the clipper reliably routes to
  // its `poll` action; the pending-request eligibility gate lives in politeFetchPlan.
  assert.match(src, /trigger:\s*['"]intake\/clipper#poll['"]/);
});

test('saveListing / dismissListing write the taste signal', () => {
  const save = readFileSync(join(APP, 'api', 'listings', '[id]', 'save', 'POST.ts'), 'utf8');
  assert.match(save, /taste_signals/);
  assert.match(save, /['"]save['"]/);
  const dismiss = readFileSync(join(APP, 'api', 'listings', '[id]', 'dismiss', 'POST.ts'), 'utf8');
  assert.match(dismiss, /taste_signals/);
  assert.match(dismiss, /['"]dismiss['"]/);
});

// ── Hooks — the ingest→enrich→learn pipeline + crons ─────────────────────────
test('parse-new-capture: event on project/db.raw_captures.insert → clipper#parse, guarded', () => {
  const src = readFileSync(join(APP, 'hooks', 'parse-new-capture.ts'), 'utf8');
  assert.match(src, /type:\s*['"]event['"]/);
  assert.match(src, /event:\s*['"]project\/db\.raw_captures\.insert['"]/);
  assert.match(src, /delegate\(\s*['"]intake\/clipper['"]/);
  assert.match(src, /status/, 'must guard on status === pending');
});

test('enrich-new-listing: one event hook running all four scout delegates sequentially', () => {
  const src = readFileSync(join(APP, 'hooks', 'enrich-new-listing.ts'), 'utf8');
  assert.match(src, /type:\s*['"]event['"]/);
  assert.match(src, /event:\s*['"]project\/db\.listings\.insert['"]/);
  assert.match(src, /listing_analyses/, 'idempotence guard on listing_analyses');
  for (const ref of ['intake/surveyor', 'scout/analyst', 'scout/locator', 'scout/ranker']) {
    assert.match(src, new RegExp(ref.replace('/', '\\/')), `enrich must delegate ${ref}`);
  }
});

test('learn-from-signal: event on project/db.taste_signals.insert → ranker#learn, folded guard', () => {
  const src = readFileSync(join(APP, 'hooks', 'learn-from-signal.ts'), 'utf8');
  assert.match(src, /event:\s*['"]project\/db\.taste_signals\.insert['"]/);
  assert.match(src, /delegate\(\s*['"]scout\/ranker['"]/);
  assert.match(src, /folded/);
});

test('refresh + poll are cron hooks with imperative (no-LLM) handlers', () => {
  const refresh = readFileSync(join(APP, 'hooks', 'refresh-tracked-listings.ts'), 'utf8');
  assert.match(refresh, /type:\s*['"]cron['"]/);
  assert.match(refresh, /every:\s*['"]6h['"]/);
  assert.match(refresh, /handler:\s*async/, 'refresh must be an imperative handler, not a trigger');
  assert.doesNotMatch(refresh, /trigger:/, 'refresh must not declare a trigger');
  assert.doesNotMatch(refresh, /delegate\(/, 'refresh must never call delegate() — no LLM');
  const poll = readFileSync(join(APP, 'hooks', 'poll-saved-searches.ts'), 'utf8');
  assert.match(poll, /type:\s*['"]cron['"]/);
  assert.match(poll, /every:\s*['"]6h['"]/);
  assert.match(poll, /handler:\s*async/, 'poll must be an imperative handler, not a trigger');
  assert.doesNotMatch(poll, /trigger:/, 'poll must not declare a trigger');
  assert.doesNotMatch(poll, /delegate\(/, 'poll must never call delegate() — no LLM');
});

// ── Spaces — least-privilege + FULL space format ─────────────────────────────
const frontmatterOf = (src) => {
  const m = src.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : '';
};

test('three project-scoped spaces present: concierge + intake + scout', () => {
  const spacesDir = join(APP, 'spaces');
  const spaces = readdirSync(spacesDir).filter((d) => statSync(join(spacesDir, d)).isDirectory()).sort();
  assert.deepEqual(spaces, ['concierge', 'intake', 'scout']);
});

test('concierge: single least-privilege app-driver agent (read-all, api:call, no authoring)', () => {
  const instructP = join(APP, 'spaces', 'concierge', 'agents', 'concierge', 'instruct.md');
  assert.ok(existsSync(instructP), 'concierge/concierge instruct.md missing');
  assert.ok(existsSync(join(APP, 'spaces', 'concierge', 'agents', 'concierge', 'charter.md')), 'concierge charter.md missing');
  const fm = frontmatterOf(readFileSync(instructP, 'utf8'));
  assert.match(fm, /api:call/, 'concierge acts through typed handlers');
  assert.doesNotMatch(fm, /deleteSearch/, 'destructive deleteSearch must NOT be in the allow-list');
  for (const forbidden of ['db:schema', 'pages:write', 'api:write', 'hooks:write', 'project:manage']) {
    assert.doesNotMatch(fm, new RegExp(forbidden), `concierge must NOT hold ${forbidden} — it uses the app, it can't rewrite it`);
  }
});

// Every real api endpoint name (`export const name = '...'`) by walking api/.
function collectEndpointNames() {
  const names = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/^(GET|POST|PATCH|PUT|DELETE)\.ts$/.test(e)) {
        const m = readFileSync(p, 'utf8').match(/export const name = ['"]([^'"]+)['"]/);
        if (m) names.push(m[1]);
      }
    }
  };
  walk(join(APP, 'api'));
  return names;
}

// The concierge's `api:call` allow-list, parsed from its instruct.md frontmatter.
function conciergeAllowList() {
  const fm = frontmatterOf(readFileSync(join(APP, 'spaces', 'concierge', 'agents', 'concierge', 'instruct.md'), 'utf8'));
  const m = fm.match(/api:call:\s*\{\s*allow:\s*\[([^\]]*)\]/);
  assert.ok(m, 'concierge api:call allow-list must be present in frontmatter');
  return m[1].split(',').map((s) => s.trim()).filter(Boolean);
}

test('concierge api:call allow-list: every entry resolves to a real endpoint; deleteSearch excluded; act endpoints granted', () => {
  const endpoints = new Set(collectEndpointNames());
  // Sanity: the walker found the endpoints (matches the count the structural test asserts).
  assert.ok(endpoints.size >= EXPECTED_ENDPOINTS.length, `expected ≥${EXPECTED_ENDPOINTS.length} endpoints, found ${endpoints.size}`);
  const allow = conciergeAllowList();
  assert.ok(allow.length > 0, 'allow-list must be non-empty (there is no "call anything")');
  // Every allowed name must map to an actual `api/` handler — no phantom/typo names the
  // typed apiCall DTS could never surface (which would silently strand the concierge).
  for (const name of allow) {
    assert.ok(endpoints.has(name), `concierge allows "${name}" which is not a real api/ endpoint name`);
  }
  // The one destructive, cascading endpoint stays OUT of the allow-list (safety contract).
  assert.ok(!allow.includes('deleteSearch'), 'destructive deleteSearch must NEVER be in the allow-list');
  // The reversible/act endpoints the concierge is designed to drive must be granted, or it
  // could read but never act through the app's typed handlers.
  for (const need of ['saveListing', 'dismissListing', 'updateSearch', 'updateListing', 'createSearch', 'addSource', 'pollSource']) {
    assert.ok(allow.includes(need), `concierge must be allowed to call ${need} (it acts through typed handlers)`);
  }
});

test('daily-digest + notify-on-alert hooks are wired', () => {
  const digest = readFileSync(join(APP, 'hooks', 'daily-digest.ts'), 'utf8');
  assert.match(digest, /type:\s*['"]cron['"]/);
  assert.match(digest, /trigger:\s*['"]scout\/ranker#digest['"]/);
  const notify = readFileSync(join(APP, 'hooks', 'notify-on-alert.ts'), 'utf8');
  assert.match(notify, /type:\s*['"]event['"]/);
  assert.match(notify, /event:\s*['"]project\/db\.alerts\.insert['"]/);
});

const AGENTS = {
  intake: ['clipper', 'surveyor'],
  scout: ['analyst', 'locator', 'ranker'],
};

for (const [space, agents] of Object.entries(AGENTS)) {
  const SP = join(APP, 'spaces', space);

  test(`${space}: agents ${agents.join('+')} — charter+instruct, least-privilege caps`, () => {
    const agentsDir = join(SP, 'agents');
    assert.deepEqual(readdirSync(agentsDir).sort(), [...agents].sort());
    for (const a of agents) {
      assert.ok(existsSync(join(agentsDir, a, 'charter.md')), `${space}/${a}: missing charter.md`);
      const instructP = join(agentsDir, a, 'instruct.md');
      assert.ok(existsSync(instructP), `${space}/${a}: missing instruct.md`);
      const fm = frontmatterOf(readFileSync(instructP, 'utf8'));
      assert.match(fm, /capabilities:/, `${space}/${a}: must declare capabilities`);
      for (const forbidden of ['db:schema', 'pages:write', 'api:write', 'hooks:write']) {
        assert.doesNotMatch(fm, new RegExp(forbidden), `${space}/${a}: must NOT hold ${forbidden}`);
      }
    }
  });

  test(`${space}: FULL format — tasklists/, functions/ (≥2), components/view/*.tsx`, () => {
    const tlDir = join(SP, 'tasklists');
    assert.ok(existsSync(tlDir), `${space}: missing tasklists/`);
    const tasklists = readdirSync(tlDir).filter((d) => statSync(join(tlDir, d)).isDirectory());
    assert.ok(tasklists.length >= 1, `${space}: expected ≥1 tasklist`);
    for (const tl of tasklists) {
      assert.ok(existsSync(join(tlDir, tl, 'index.md')), `${space}/tasklists/${tl}: missing index.md`);
      const tasks = readdirSync(join(tlDir, tl)).filter((f) => f.endsWith('.md') && f !== 'index.md');
      assert.ok(tasks.length >= 2, `${space}/tasklists/${tl}: expected ≥2 task files`);
    }
    const fns = readdirSync(join(SP, 'functions')).filter((f) => f.endsWith('.ts'));
    assert.ok(fns.length >= 2, `${space}: expected ≥2 space functions, found ${fns.length}`);
    const viewDir = join(SP, 'components', 'view');
    assert.ok(existsSync(viewDir) && readdirSync(viewDir).some((f) => f.endsWith('.tsx')), `${space}: expected components/view/*.tsx`);
  });

  test(`${space}: extensive knowledge — ≥2 fields, each index.md + ≥2 aspect files`, () => {
    const kDir = join(SP, 'knowledge');
    let fieldCount = 0;
    for (const domain of readdirSync(kDir)) {
      const dPath = join(kDir, domain);
      if (!statSync(dPath).isDirectory()) continue;
      for (const field of readdirSync(dPath)) {
        const fPath = join(dPath, field);
        if (!statSync(fPath).isDirectory()) continue;
        fieldCount++;
        assert.ok(existsSync(join(fPath, 'index.md')), `${space}: ${domain}/${field} missing index.md`);
        const aspects = readdirSync(fPath).filter((f) => f.endsWith('.md') && f !== 'index.md');
        assert.ok(aspects.length >= 2, `${space}: ${domain}/${field} needs ≥2 aspects, found ${aspects.length}`);
      }
    }
    assert.ok(fieldCount >= 2, `${space}: expected ≥2 knowledge fields, found ${fieldCount}`);
  });
}

test('intake has ≥3 knowledge fields; scout has ≥5 (the intelligence layer)', () => {
  const countFields = (space) => {
    const kDir = join(APP, 'spaces', space, 'knowledge');
    let n = 0;
    for (const domain of readdirSync(kDir)) {
      const dPath = join(kDir, domain);
      if (!statSync(dPath).isDirectory()) continue;
      for (const field of readdirSync(dPath)) if (statSync(join(dPath, field)).isDirectory()) n++;
    }
    return n;
  };
  assert.ok(countFields('intake') >= 3, 'intake needs ≥3 knowledge fields');
  assert.ok(countFields('scout') >= 5, 'scout needs ≥5 knowledge fields');
});

test('locator writes ONLY location_guesses (round-1 least privilege)', () => {
  const fm = frontmatterOf(readFileSync(join(APP, 'spaces', 'scout', 'agents', 'locator', 'instruct.md'), 'utf8'));
  assert.match(fm, /db:write/, 'locator must write its guesses');
  assert.match(fm, /location_guesses/);
  assert.doesNotMatch(fm, /db:write:\s*\{\s*tables:\s*\[[^\]]*\b(listings|listing_analyses|alerts|taste_)/, 'locator writes only location_guesses');
});

test('ranker holds the taste-model write grant + defaultAction rank', () => {
  const fm = frontmatterOf(readFileSync(join(APP, 'spaces', 'scout', 'agents', 'ranker', 'instruct.md'), 'utf8'));
  assert.match(fm, /taste_notes/, 'ranker writes taste_notes');
  assert.match(fm, /alerts/, 'ranker writes the new_match alert itself');
  assert.match(fm, /defaultAction:\s*rank/);
});

test('deep-sweep tasklist has a real forEach fan-out task', () => {
  const tl = join(APP, 'spaces', 'scout', 'tasklists', 'deep-sweep');
  assert.ok(existsSync(tl), 'scout/tasklists/deep-sweep missing');
  const anyForEach = readdirSync(tl)
    .filter((f) => f.endsWith('.md'))
    .some((f) => /forEach:/.test(readFileSync(join(tl, f), 'utf8')));
  assert.ok(anyForEach, 'deep-sweep must include a forEach fan-out task');
});

test('both ask components exist (chat-only surfaces)', () => {
  assert.ok(existsSync(join(APP, 'spaces', 'intake', 'components', 'ask', 'ConfirmMerge.tsx')), 'intake ConfirmMerge missing');
  assert.ok(existsSync(join(APP, 'spaces', 'scout', 'components', 'ask', 'TasteQuiz.tsx')), 'scout TasteQuiz missing');
});
