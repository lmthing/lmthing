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
const EXPECTED_TABLES = [
  // round 1
  'trips', 'destinations', 'itinerary_items', 'bookings', 'research',
  // round 2
  'documents', 'document_extractions', 'knowledge_notes', 'packing_items', 'transit_legs',
  // round 3 — Money & People
  'travelers', 'traveler_preferences', 'expenses', 'expense_shares', 'deals', 'currency_rates',
  // round 4 — live agent activity (RunStrip)
  'agent_runs',
];

test('all database schemas pass the engine validateSchemaSet (fail-loud)', async () => {
  assert.ok(existsSync(CORE), `built @lmthing/core not found at ${CORE} — run \`pnpm --filter @lmthing/core build\` in sdk/org`);
  const { validateSchemaSet } = await import(CORE);
  const dbDir = join(APP, 'database');
  const tables = readdirSync(dbDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ name: f.slice(0, -5), schema: JSON.parse(readFileSync(join(dbDir, f), 'utf8')) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  // Compare as sets (order-independent) so a locale/underscore sort quirk can't break it.
  assert.deepEqual([...tables.map((t) => t.name)].sort(), [...EXPECTED_TABLES].sort());
  // Throws (fail-loud) on a missing description, dup/absent PK, or a dangling FK/relation.
  assert.doesNotThrow(() => validateSchemaSet(tables));
});

test('trips carries the round-3 finance columns (homeCurrency, partySize) + travelers/expenses relations', () => {
  const s = JSON.parse(readFileSync(join(APP, 'database', 'trips.json'), 'utf8'));
  assert.ok(s.columns.homeCurrency, 'trips.homeCurrency missing');
  assert.ok(s.columns.partySize, 'trips.partySize missing');
  assert.ok(s.relations.travelers && s.relations.expenses, 'trips travelers/expenses relations missing');
});

test('round-3 tables exist with the expected key columns + relations', () => {
  const load = (t) => JSON.parse(readFileSync(join(APP, 'database', `${t}.json`), 'utf8'));
  const travelers = load('travelers');
  assert.ok(travelers.columns.role && travelers.relations.preferences && travelers.relations.shares, 'travelers columns/relations missing');
  const prefs = load('traveler_preferences');
  assert.ok(prefs.columns.category && prefs.columns.value && prefs.columns.weight, 'traveler_preferences columns missing');
  const expenses = load('expenses');
  assert.ok(expenses.columns.amount && expenses.columns.category && expenses.relations.shares, 'expenses columns/relations missing');
  const shares = load('expense_shares');
  assert.ok(shares.columns.shareAmount && shares.columns.settled && shares.columns.expenseId, 'expense_shares columns missing');
  const deals = load('deals');
  assert.ok(deals.columns.estimatedSavings && deals.columns.status && deals.columns.kind, 'deals columns missing');
  const rates = load('currency_rates');
  assert.ok(rates.columns.base && rates.columns.quote && rates.columns.rate, 'currency_rates columns missing');
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

test('itinerary_items carries the round-2 to-book columns', () => {
  const s = JSON.parse(readFileSync(join(APP, 'database', 'itinerary_items.json'), 'utf8'));
  for (const c of ['needsBooking', 'bookByDate', 'weatherNote']) {
    assert.ok(s.columns[c], `itinerary_items.${c} missing`);
  }
});

test('round-2 tables exist with the expected key columns + relations', () => {
  const load = (t) => JSON.parse(readFileSync(join(APP, 'database', `${t}.json`), 'utf8'));
  const documents = load('documents');
  assert.ok(documents.columns.content, 'documents.content (pasted text) missing');
  assert.ok(documents.columns.kind, 'documents.kind missing');
  assert.ok(documents.relations.extractions, 'documents.extractions relation missing');
  const extractions = load('document_extractions');
  assert.ok(extractions.columns.table && extractions.columns.rowId, 'document_extractions provenance columns missing');
  const notes = load('knowledge_notes');
  assert.ok(notes.columns.sourceKind, 'knowledge_notes.sourceKind missing');
  const packing = load('packing_items');
  assert.ok(packing.columns.packed && packing.columns.category, 'packing_items columns missing');
  const legs = load('transit_legs');
  assert.ok(legs.columns.mode && legs.columns.toDestinationId, 'transit_legs columns missing');
  assert.ok(legs.relations.from && legs.relations.to, 'transit_legs from/to relations missing');
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
  // ── round-2 endpoints ──
  ['trips/[id]/documents/POST.ts', 'uploadDocument'],
  ['trips/[id]/documents/GET.ts', 'listDocuments'],
  ['documents/[id]/GET.ts', 'getDocument'],
  ['trips/[id]/packing/GET.ts', 'packingList'],
  ['trips/[id]/packing/generate/POST.ts', 'generatePacking'],
  ['packing/POST.ts', 'addPackingItem'],
  ['packing/[id]/PATCH.ts', 'togglePacked'],
  ['packing/[id]/DELETE.ts', 'removePackingItem'],
  ['trips/[id]/transit/GET.ts', 'transitLegs'],
  ['trips/[id]/transit/plan/POST.ts', 'planTransit'],
  ['trips/[id]/reminders/GET.ts', 'tripReminders'],
  ['trips/[id]/notes/GET.ts', 'tripNotes'],
  // ── round-3 endpoints (Money & People) ──
  ['trips/[id]/expenses/GET.ts', 'listExpenses'],
  ['trips/[id]/expenses/POST.ts', 'addExpense'],
  ['expenses/[id]/PATCH.ts', 'updateExpense'],
  ['expenses/[id]/DELETE.ts', 'removeExpense'],
  ['trips/[id]/settlement/GET.ts', 'settlement'],
  ['expense-shares/[id]/PATCH.ts', 'settleShare'],
  ['trips/[id]/finances/GET.ts', 'tripFinances'],
  ['trips/[id]/travelers/GET.ts', 'listTravelers'],
  ['trips/[id]/travelers/POST.ts', 'addTraveler'],
  ['travelers/[id]/GET.ts', 'getTraveler'],
  ['travelers/[id]/PATCH.ts', 'updateTraveler'],
  ['travelers/[id]/DELETE.ts', 'removeTraveler'],
  ['travelers/[id]/preferences/POST.ts', 'setPreference'],
  ['preferences/[id]/DELETE.ts', 'removePreference'],
  ['trips/[id]/deals/GET.ts', 'listDeals'],
  ['trips/[id]/deals/find/POST.ts', 'findDeals'],
  ['deals/[id]/PATCH.ts', 'updateDeal'],
  // ── round-4 endpoints (live activity, NL capture, integrations, settlement edge) ──
  ['trips/[id]/activity/GET.ts', 'getTripActivity'],
  ['trips/[id]/expenses/parse/POST.ts', 'parseExpense'],
  ['trips/[id]/settle-between/POST.ts', 'settleBetween'],
  ['trips/[id]/rates/POST.ts', 'refreshRates'],
  ['trips/[id]/weather/POST.ts', 'refreshWeather'],
  ['trips/[id]/calendar/GET.ts', 'tripCalendar'],
  ['geocode/GET.ts', 'geocode'],
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

test('createTrip inserts a trip + a pending plan agent_runs row (no ctx.spawn — it is a pod no-op stub)', () => {
  const src = readFileSync(join(APP, 'api', 'trips', 'POST.ts'), 'utf8');
  assert.match(src, /db\.insert\(\s*['"]trips['"]/, 'createTrip must insert a trip');
  assert.match(src, /db\.insert\(\s*['"]agent_runs['"]/, 'createTrip must seed a pending agent_runs row');
  assert.match(src, /kind:\s*['"]plan['"]/, 'the seeded run must be kind "plan"');
  // ctx.spawn is a permanent no-op in the pod runtime, so planning must NOT rely on it — the
  // dispatch-agent-run hook (agent_runs insert) is what actually runs the planner.
  assert.doesNotMatch(src, /ctx\.spawn\(/, 'createTrip must not rely on ctx.spawn (no-op stub); the dispatch hook runs the planner');
});

test('dispatch-agent-run is a database:insert hook on agent_runs that delegates by kind (the working ctx.spawn replacement)', () => {
  const src = readFileSync(join(APP, 'hooks', 'dispatch-agent-run.ts'), 'utf8');
  assert.match(src, /type:\s*['"]database['"]/);
  assert.match(src, /table:\s*['"]agent_runs['"]/);
  assert.match(src, /event:\s*['"]insert['"]/);
  // maps each kind to its specialist agent#action
  assert.match(src, /concierge\/planner/, 'kind "plan" → concierge/planner');
  assert.match(src, /finance\/deal-hunter/, 'kind "deals" → finance/deal-hunter');
  assert.match(src, /logistics\/packer/, 'kind "packing" → logistics/packer');
  assert.match(src, /logistics\/navigator/, 'kind "transit" → logistics/navigator');
  assert.match(src, /delegate\(/, 'must delegate to the specialist');
  assert.match(src, /status\s*!==\s*['"]running['"]/, 'must guard on a fresh running row (idempotence)');
});

test('spawn-backed endpoints seed a pending agent_runs row and do NOT use ctx.spawn (pod no-op stub)', () => {
  for (const rel of [
    ['api', 'trips', '[id]', 'deals', 'find', 'POST.ts'],
    ['api', 'trips', '[id]', 'packing', 'generate', 'POST.ts'],
    ['api', 'trips', '[id]', 'transit', 'plan', 'POST.ts'],
  ]) {
    const src = readFileSync(join(APP, ...rel), 'utf8');
    assert.match(src, /db\.insert\(\s*['"]agent_runs['"]/, `${rel.join('/')}: must seed an agent_runs row`);
    assert.doesNotMatch(src, /ctx\.spawn\(/, `${rel.join('/')}: must not use ctx.spawn (no-op); the dispatch hook runs the agent`);
  }
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

test('analyze-document is a database:insert hook on documents → records/analyst (idempotent)', () => {
  const src = readFileSync(join(APP, 'hooks', 'analyze-document.ts'), 'utf8');
  assert.match(src, /type:\s*['"]database['"]/);
  assert.match(src, /table:\s*['"]documents['"]/);
  assert.match(src, /event:\s*['"]insert['"]/);
  assert.match(src, /delegate\(\s*['"]records\/analyst['"]/, 'must delegate to the analyst');
  assert.match(src, /document_extractions|status/, 'must have an idempotence guard');
});

test('plan-transit-on-destination is a database:insert hook on destinations → logistics/navigator', () => {
  const src = readFileSync(join(APP, 'hooks', 'plan-transit-on-destination.ts'), 'utf8');
  assert.match(src, /type:\s*['"]database['"]/);
  assert.match(src, /table:\s*['"]destinations['"]/);
  assert.match(src, /delegate\(\s*['"]logistics\/navigator['"]/, 'must delegate to the navigator');
  assert.match(src, /transit_legs/, 'must have an idempotence guard on transit_legs');
});

test('regenerate-packing is a cron hook triggering logistics/packer#pack-due', () => {
  const src = readFileSync(join(APP, 'hooks', 'regenerate-packing.ts'), 'utf8');
  assert.match(src, /type:\s*['"]cron['"]/);
  // Cron hooks support a declarative `trigger` only (imperative handlers are for database hooks).
  assert.match(src, /trigger:\s*['"]logistics\/packer#pack-due['"]/);
});

test('to-book-reminders is an imperative (no-LLM) cron handler writing knowledge_notes reminders', () => {
  const src = readFileSync(join(APP, 'hooks', 'to-book-reminders.ts'), 'utf8');
  assert.match(src, /type:\s*['"]cron['"]/);
  assert.match(src, /handler:\s*async/, 'must be an imperative handler, not a trigger');
  assert.doesNotMatch(src, /trigger:\s*['"]/, 'must not delegate to an agent — no LLM tokens for this housekeeping cron');
  assert.match(src, /needsBooking/, 'must scan itinerary_items.needsBooking');
  assert.match(src, /bookByDate/, 'must scan bookByDate deadlines');
  assert.match(src, /db\.insert\(\s*['"]knowledge_notes['"]/, 'must write knowledge_notes reminders');
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

// ── Round-2 spaces — ≥2 project-scoped spaces, each FULL format, least-privilege ──
const frontmatterOf = (src) => {
  const m = src.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : '';
};

test('project has ≥2 project-scoped spaces (concierge + records + logistics + finance + companions + copilot)', () => {
  const spacesDir = join(APP, 'spaces');
  const spaces = readdirSync(spacesDir).filter((d) => statSync(join(spacesDir, d)).isDirectory()).sort();
  assert.deepEqual(spaces, ['companions', 'concierge', 'copilot', 'finance', 'logistics', 'records']);
});

test('copilot/assistant is the write-capable orchestrator: db:read + db:write + api:call + delegation, no authoring caps', () => {
  const instructP = join(APP, 'spaces', 'copilot', 'agents', 'assistant', 'instruct.md');
  assert.ok(existsSync(instructP), 'copilot/assistant instruct.md missing');
  assert.ok(existsSync(join(APP, 'spaces', 'copilot', 'agents', 'assistant', 'charter.md')), 'copilot/assistant charter.md missing');
  const fm = frontmatterOf(readFileSync(instructP, 'utf8'));
  assert.match(fm, /db:read/, 'copilot must read to ground itself');
  assert.match(fm, /db:write/, 'copilot must make low-risk direct edits');
  assert.match(fm, /api:call/, 'copilot must call typed endpoints (so hooks fire)');
  assert.match(fm, /canDelegateTo/, 'copilot must delegate to the specialists');
  for (const forbidden of ['db:schema', 'pages:write', 'api:write', 'hooks:write']) {
    assert.doesNotMatch(fm, new RegExp(forbidden), `copilot must NOT hold authoring cap ${forbidden}`);
  }
});

test('copilot api:call allow-list only references REAL endpoint names, and covers the actions it drives', () => {
  const instructP = join(APP, 'spaces', 'copilot', 'agents', 'assistant', 'instruct.md');
  const fm = frontmatterOf(readFileSync(instructP, 'utf8'));
  // Extract the api:call allow list (spans multiple lines).
  const m = fm.match(/api:call:\s*\{\s*allow:\s*\[([\s\S]*?)\]\s*\}/);
  assert.ok(m, 'copilot must declare api:call: { allow: [...] }');
  const allow = m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  assert.ok(allow.length >= 20, `expected a rich allow-list, found ${allow.length}`);
  // Every allowed name must be a real endpoint `name` in api/.
  const realNames = new Set(EXPECTED_ENDPOINTS.map(([, name]) => name));
  for (const name of allow) {
    assert.ok(realNames.has(name), `api:call allow references unknown endpoint "${name}"`);
  }
  // Must cover the core write actions the copilot legitimately drives via apiCall.
  for (const required of [
    'addExpense', 'settleBetween', 'addTraveler', 'setPreference', 'addDestination',
    'updateTrip', 'createTrip', 'findDeals', 'generatePacking', 'planTransit',
    'refreshRates', 'refreshWeather',
  ]) {
    assert.ok(allow.includes(required), `api:call allow must include "${required}"`);
  }
  // Guardrail: no delete/destructive endpoint is in the allow-list (confirm-in-UI only).
  for (const forbidden of ['deleteTrip', 'removeExpense', 'removeTraveler', 'removeItem', 'removeBooking', 'removePackingItem', 'removePreference']) {
    assert.ok(!allow.includes(forbidden), `api:call allow must NOT include destructive "${forbidden}"`);
  }
});

test('copilot instruct now PREFERS apiCall for actions (the old "apiCall is not injected — do NOT call it" workaround is gone)', () => {
  const src = readFileSync(join(APP, 'spaces', 'copilot', 'agents', 'assistant', 'instruct.md'), 'utf8');
  assert.match(src, /apiCall\(/, 'instruct must show apiCall(...) usage');
  // The previous round explicitly forbade apiCall; that instruction must be removed.
  assert.doesNotMatch(src, /apiCall`?\s+is not\s+(injected|defined)/i, 'must not tell the agent apiCall is unavailable');
  assert.doesNotMatch(src, /do NOT call it/i, 'must not forbid apiCall');
  // Still keeps the non-negotiable rules.
  assert.match(src, /[Nn]ever fabricate a booking/, 'must keep the never-fabricate-a-booking rule');
  assert.match(src, /[Cc]onfirm before destructive/, 'must keep confirm-before-destructive');
  assert.match(src, /delegate\(/, 'must keep delegate for the specialists');
  assert.match(src, /db\.query\(/, 'must keep db.query for reads');
});

test('agent_runs carries the RunStrip columns', () => {
  const s = JSON.parse(readFileSync(join(APP, 'database', 'agent_runs.json'), 'utf8'));
  for (const c of ['tripId', 'kind', 'status', 'startedAt']) {
    assert.ok(s.columns[c], `agent_runs.${c} missing`);
  }
});

test('destinations carries additive lat/lng columns (geocoding + weather + map)', () => {
  const s = JSON.parse(readFileSync(join(APP, 'database', 'destinations.json'), 'utf8'));
  assert.ok(s.columns.lat && s.columns.lng, 'destinations.lat/lng missing');
});

// Generic FULL-space-format checker applied to each round-2 AND round-3 space.
const NEW_SPACES = {
  records: ['analyst'],
  logistics: ['navigator', 'packer'],
  finance: ['deal-hunter', 'treasurer'],
  companions: ['host'],
};

for (const [space, agents] of Object.entries(NEW_SPACES)) {
  const SP = join(APP, 'spaces', space);

  test(`${space}: agents ${agents.join('+')} each have charter.md + instruct.md, least-privilege caps`, () => {
    const agentsDir = join(SP, 'agents');
    assert.deepEqual(readdirSync(agentsDir).sort(), [...agents].sort());
    for (const a of agents) {
      assert.ok(existsSync(join(agentsDir, a, 'charter.md')), `${space}/${a}: missing charter.md`);
      const instructP = join(agentsDir, a, 'instruct.md');
      assert.ok(existsSync(instructP), `${space}/${a}: missing instruct.md`);
      const fm = frontmatterOf(readFileSync(instructP, 'utf8'));
      assert.match(fm, /capabilities:/, `${space}/${a}: must declare capabilities`);
      for (const forbidden of ['db:schema', 'pages:write', 'api:write', 'hooks:write']) {
        assert.doesNotMatch(fm, new RegExp(forbidden), `${space}/${a}: must NOT hold authoring cap ${forbidden}`);
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

test('analyst is least-privilege but can write the document/domain tables + delegate to the researcher', () => {
  const fm = frontmatterOf(readFileSync(join(APP, 'spaces', 'records', 'agents', 'analyst', 'instruct.md'), 'utf8'));
  assert.match(fm, /db:write/, 'analyst must be able to write extracted rows');
  assert.match(fm, /concierge\/researcher/, 'analyst delegates research follow-up to the concierge researcher');
});

// ── Round-3 finance/companions capability checks ─────────────────────────────
test('treasurer writes expenses/expense_shares/currency_rates but holds no authoring caps', () => {
  const fm = frontmatterOf(readFileSync(join(APP, 'spaces', 'finance', 'agents', 'treasurer', 'instruct.md'), 'utf8'));
  assert.match(fm, /db:write/, 'treasurer must write shares/rates');
  assert.match(fm, /expense_shares/, 'treasurer must scope to expense_shares');
});

test('deal-hunter writes deals/knowledge_notes only (advisory — no bookings write)', () => {
  const fm = frontmatterOf(readFileSync(join(APP, 'spaces', 'finance', 'agents', 'deal-hunter', 'instruct.md'), 'utf8'));
  assert.match(fm, /db:write/, 'deal-hunter must write deals');
  assert.doesNotMatch(fm, /db:write:\s*\{\s*tables:\s*\[[^\]]*\bbookings\b/, 'deal-hunter must NOT write bookings (advisory only)');
});

test('companions host writes traveler_preferences/knowledge_notes only', () => {
  const fm = frontmatterOf(readFileSync(join(APP, 'spaces', 'companions', 'agents', 'host', 'instruct.md'), 'utf8'));
  assert.match(fm, /db:write/, 'host must write preferences/notes');
  assert.match(fm, /traveler_preferences|knowledge_notes/, 'host writes prefs/notes');
});

// ── Round-3 hooks ────────────────────────────────────────────────────────────
test('split-new-expense is a database:insert hook on expenses → finance/treasurer#split (idempotent)', () => {
  const src = readFileSync(join(APP, 'hooks', 'split-new-expense.ts'), 'utf8');
  assert.match(src, /type:\s*['"]database['"]/);
  assert.match(src, /table:\s*['"]expenses['"]/);
  assert.match(src, /event:\s*['"]insert['"]/);
  assert.match(src, /delegate\(\s*['"]finance\/treasurer['"]/, 'must delegate to the treasurer');
  assert.match(src, /expense_shares/, 'must have an idempotence guard on expense_shares');
});

test('reconcile-traveler is a database:insert hook on travelers → companions/host#reconcile', () => {
  const src = readFileSync(join(APP, 'hooks', 'reconcile-traveler.ts'), 'utf8');
  assert.match(src, /type:\s*['"]database['"]/);
  assert.match(src, /table:\s*['"]travelers['"]/);
  assert.match(src, /delegate\(\s*['"]companions\/host['"]/, 'must delegate to the host');
});

test('hunt-deals is a cron hook triggering finance/deal-hunter#hunt', () => {
  const src = readFileSync(join(APP, 'hooks', 'hunt-deals.ts'), 'utf8');
  assert.match(src, /type:\s*['"]cron['"]/);
  assert.match(src, /trigger:\s*['"]finance\/deal-hunter#hunt['"]/);
});

test('refresh-currency-rates is an imperative (no-LLM) cron handler fetching FX from open.er-api.com', () => {
  const src = readFileSync(join(APP, 'hooks', 'refresh-currency-rates.ts'), 'utf8');
  assert.match(src, /type:\s*['"]cron['"]/);
  assert.match(src, /handler:\s*async/, 'must be an imperative handler, not a trigger');
  assert.doesNotMatch(src, /trigger:\s*['"]/, 'must not delegate to an agent — no LLM tokens for this housekeeping cron');
  assert.match(src, /open\.er-api\.com/, 'must fetch FX rates directly, not via webSearch');
  assert.match(src, /db\.insert\(\s*['"]currency_rates['"]|db\.update\(\s*['"]currency_rates['"]/, 'must upsert currency_rates');
});
