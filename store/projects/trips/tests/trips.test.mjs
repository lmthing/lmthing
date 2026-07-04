/**
 * Self-contained tests for the `trips` project-application.
 *
 * Runs dependency-free with Node's built-in runner:
 *   node --test store/projects/trips/tests/
 *
 * - **Schemas** are validated with the REAL engine validator (`validateSchemaSet`
 *   from the built `@lmthing/core` in the sdk/org submodule) — the same fail-loud
 *   check the runtime loader (`libs/cli/src/app/loader.ts`) applies at boot.
 * - **API handlers / hooks / agents / space** are asserted structurally (the files
 *   are TS/MD, not importable here without a transpile) — a green here means the
 *   contract the runtime relies on holds, including the FULL space format.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..'); // store/projects/trips
const REPO = join(APP, '..', '..', '..'); // monorepo root
const CORE = join(REPO, 'sdk', 'org', 'libs', 'core', 'dist', 'index.js');

// ── Schemas — real engine validation ────────────────────────────────────────
test('all 5 database schemas pass the engine validateSchemaSet (fail-loud)', async () => {
  assert.ok(existsSync(CORE), `built @lmthing/core not found at ${CORE} — run \`pnpm --filter @lmthing/core build\` in sdk/org`);
  const { validateSchemaSet } = await import(CORE);
  const dbDir = join(APP, 'database');
  const tables = readdirSync(dbDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ name: f.slice(0, -5), schema: JSON.parse(readFileSync(join(dbDir, f), 'utf8')) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  assert.deepEqual(
    tables.map((t) => t.name),
    ['bookings', 'destinations', 'itinerary_items', 'research', 'trips'],
  );
  // Throws (fail-loud) on a missing description, dup/absent PK, or a dangling FK/relation.
  assert.doesNotThrow(() => validateSchemaSet(tables));
});

test('every table, column, and relation carries a required description + exactly one PK', () => {
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

test('itinerary_items carries the budget columns (round-1 promotion)', () => {
  const s = JSON.parse(readFileSync(join(APP, 'database', 'itinerary_items.json'), 'utf8'));
  assert.ok(s.columns.estimatedCost, 'itinerary_items.estimatedCost missing');
  assert.ok(s.columns.currency, 'itinerary_items.currency missing');
});

// ── API handlers — the named, typed endpoints ───────────────────────────────
const EXPECTED_ENDPOINTS = [
  ['trips/GET.ts', 'tripList'],
  ['trips/POST.ts', 'createTrip'],
  ['trips/[id]/GET.ts', 'getTrip'],
  ['trips/[id]/PATCH.ts', 'updateTrip'],
  ['trips/[id]/DELETE.ts', 'deleteTrip'],
  ['trips/[id]/budget/GET.ts', 'tripBudget'],
  ['trips/[id]/destinations/POST.ts', 'addDestination'],
  ['items/[id]/PATCH.ts', 'updateItem'],
  ['items/[id]/DELETE.ts', 'removeItem'],
  ['bookings/POST.ts', 'addBooking'],
  ['bookings/[id]/DELETE.ts', 'removeBooking'],
  ['research/[destId]/GET.ts', 'getResearch'],
];

test('all api handlers exist and export name / Input / Output / default handler', () => {
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

test('createTrip inserts a trip and spawns the planner fire-and-forget', () => {
  const src = readFileSync(join(APP, 'api', 'trips', 'POST.ts'), 'utf8');
  assert.match(src, /db\.insert\(\s*['"]trips['"]/, 'createTrip must insert a trip');
  assert.match(src, /ctx\.spawn\(/, 'createTrip must spawn the planner (fire-and-forget, no ctx.delegate)');
  assert.match(src, /concierge\/planner/, 'createTrip must target the concierge planner');
});

// ── Hooks — database:insert + cron ──────────────────────────────────────────
test('research-new-destination is a database:insert hook with idempotence + delegate', () => {
  const src = readFileSync(join(APP, 'hooks', 'research-new-destination.ts'), 'utf8');
  assert.match(src, /type:\s*['"]database['"]/);
  assert.match(src, /table:\s*['"]destinations['"]/);
  assert.match(src, /event:\s*['"]insert['"]/);
  assert.match(src, /delegate\(\s*['"]concierge\/researcher['"]/, 'must delegate to the researcher');
});

test('watch-booking-prices is a cron hook targeting the researcher', () => {
  const src = readFileSync(join(APP, 'hooks', 'watch-booking-prices.ts'), 'utf8');
  assert.match(src, /type:\s*['"]cron['"]/);
  assert.match(src, /concierge\/researcher#price-check/);
});

// ── Concierge space — least-privilege + FULL space format ────────────────────
const SPACE = join(APP, 'spaces', 'concierge');

test('concierge has 3 agents, each least-privilege (no authoring caps), planner has no db:write', () => {
  const agentsDir = join(SPACE, 'agents');
  const agents = readdirSync(agentsDir).sort();
  assert.deepEqual(agents, ['planner', 'researcher', 'scheduler']);
  // Assert against the frontmatter block only (prose may mention a capability by name).
  const frontmatter = (src) => {
    const m = src.match(/^---\n([\s\S]*?)\n---/);
    return m ? m[1] : '';
  };
  for (const a of agents) {
    const fm = frontmatter(readFileSync(join(agentsDir, a, 'instruct.md'), 'utf8'));
    assert.match(fm, /capabilities:/, `${a}: must declare capabilities`);
    for (const forbidden of ['db:schema', 'pages:write', 'api:write', 'hooks:write']) {
      assert.doesNotMatch(fm, new RegExp(forbidden), `${a}: must NOT hold ${forbidden}`);
    }
  }
  const plannerFm = frontmatter(readFileSync(join(agentsDir, 'planner', 'instruct.md'), 'utf8'));
  assert.doesNotMatch(plannerFm, /db:write/, 'planner is an orchestrator — no db:write in its capabilities');
});

test('FULL space format: every agent has charter.md + instruct.md', () => {
  for (const a of ['planner', 'researcher', 'scheduler']) {
    assert.ok(existsSync(join(SPACE, 'agents', a, 'charter.md')), `${a}: missing charter.md`);
    assert.ok(existsSync(join(SPACE, 'agents', a, 'instruct.md')), `${a}: missing instruct.md`);
  }
});

test('FULL space format: plan-trip tasklist has index.md + the forEach fan-out task', () => {
  const tl = join(SPACE, 'tasklists', 'plan-trip');
  assert.ok(existsSync(join(tl, 'index.md')), 'plan-trip/index.md missing');
  const files = readdirSync(tl).filter((f) => f.endsWith('.md') && f !== 'index.md');
  assert.ok(files.length >= 3, 'plan-trip must decompose into ≥3 task files');
  const anyForEach = files.some((f) => /forEach:/.test(readFileSync(join(tl, f), 'utf8')));
  assert.ok(anyForEach, 'plan-trip must include a forEach fan-out task (research_each)');
});

test('FULL space format: functions/ and components/ present', () => {
  const fns = readdirSync(join(SPACE, 'functions')).filter((f) => f.endsWith('.ts'));
  assert.ok(fns.length >= 3, 'expected ≥3 space functions');
  const viewDir = join(SPACE, 'components', 'view');
  assert.ok(existsSync(viewDir) && readdirSync(viewDir).some((f) => f.endsWith('.tsx')), 'expected a components/view/*.tsx');
});

test('FULL space format: knowledge has ≥3 fields, each index.md + ≥2 aspect files', () => {
  const kDir = join(SPACE, 'knowledge');
  let fieldCount = 0;
  for (const domain of readdirSync(kDir)) {
    const dPath = join(kDir, domain);
    if (!statSync(dPath).isDirectory()) continue;
    for (const field of readdirSync(dPath)) {
      const fPath = join(dPath, field);
      if (!statSync(fPath).isDirectory()) continue;
      fieldCount++;
      assert.ok(existsSync(join(fPath, 'index.md')), `${domain}/${field}: missing index.md`);
      const aspects = readdirSync(fPath).filter((f) => f.endsWith('.md') && f !== 'index.md');
      assert.ok(aspects.length >= 2, `${domain}/${field}: needs ≥2 aspect files, found ${aspects.length}`);
    }
  }
  assert.ok(fieldCount >= 3, `expected ≥3 knowledge fields, found ${fieldCount}`);
});
