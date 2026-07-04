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
test('all 10 database schemas pass the engine validateSchemaSet (fail-loud)', async () => {
  assert.ok(existsSync(CORE), `built @lmthing/core not found at ${CORE} — run \`pnpm --filter @lmthing/core build\` in sdk/org`);
  const { validateSchemaSet } = await import(CORE);
  const dbDir = join(APP, 'database');
  const tables = readdirSync(dbDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ name: f.slice(0, -5), schema: JSON.parse(readFileSync(join(dbDir, f), 'utf8')) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  assert.deepEqual(
    tables.map((t) => t.name),
    [
      'bookings', 'destinations', 'document_extractions', 'documents',
      'itinerary_items', 'knowledge_notes', 'packing_items', 'research',
      'transit_legs', 'trips',
    ],
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

test('to-book-reminders is a cron hook triggering logistics/navigator#booking-windows', () => {
  const src = readFileSync(join(APP, 'hooks', 'to-book-reminders.ts'), 'utf8');
  assert.match(src, /type:\s*['"]cron['"]/);
  assert.match(src, /trigger:\s*['"]logistics\/navigator#booking-windows['"]/);
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

test('project has ≥2 project-scoped spaces (concierge + records + logistics)', () => {
  const spacesDir = join(APP, 'spaces');
  const spaces = readdirSync(spacesDir).filter((d) => statSync(join(spacesDir, d)).isDirectory()).sort();
  assert.deepEqual(spaces, ['concierge', 'logistics', 'records']);
});

// Generic FULL-space-format checker applied to each round-2 space.
const NEW_SPACES = {
  records: ['analyst'],
  logistics: ['navigator', 'packer'],
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
