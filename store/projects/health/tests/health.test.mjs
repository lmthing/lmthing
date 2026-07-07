/**
 * Self-contained tests for the `health` project-application (round 2 — feature expansion).
 *
 * Runs dependency-free with Node's built-in runner:
 *   node --test store/projects/health/tests/health.test.mjs
 *
 * - **Schemas** are validated with the REAL engine validator (`validateSchemaSet`
 *   from the built `@lmthing/core` in the sdk/org submodule) — the same fail-loud
 *   check the runtime loader (`libs/cli/src/app/loader.ts`) applies at boot.
 * - **API handlers / hooks / agents / spaces** are asserted structurally (the files are
 *   TS/MD, not importable here without a transpile, so we check required exports / shape
 *   by source) — a green here means the contract the runtime relies on holds.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..'); // store/projects/health
const REPO = join(APP, '..', '..', '..'); // monorepo root
const CORE = join(REPO, 'sdk', 'org', 'libs', 'core', 'dist', 'index.js');

// ── Schemas — real engine validation ────────────────────────────────────────
const EXPECTED_TABLES = [
  'adherence_logs',
  'appointments',
  'care_contacts',
  'care_shares',
  'document_extractions',
  'documents',
  'followups',
  'goals',
  'insights',
  'integrations',
  'interactions',
  'knowledge_notes',
  'lab_results',
  'medications',
  'metrics',
  'quicklog_drafts',
  'research',
  'settings',
  'sources',
  'symptoms',
  'triage_assessments',
  'visit_briefs',
];

test('all 22 database schemas pass the engine validateSchemaSet (fail-loud)', async () => {
  assert.ok(
    existsSync(CORE),
    `built @lmthing/core not found at ${CORE} — run \`pnpm --filter @lmthing/core build\` in sdk/org`,
  );
  const { validateSchemaSet } = await import(CORE);
  const dbDir = join(APP, 'database');
  const tables = readdirSync(dbDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ name: f.slice(0, -5), schema: JSON.parse(readFileSync(join(dbDir, f), 'utf8')) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  assert.deepEqual(tables.map((t) => t.name), EXPECTED_TABLES);
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

test("research's two optional FKs resolve to real tables", () => {
  const dbDir = join(APP, 'database');
  const load = (n) => JSON.parse(readFileSync(join(dbDir, `${n}.json`), 'utf8'));
  const research = load('research');
  assert.equal(research.columns.labResultId.references.table, 'lab_results');
  assert.equal(research.columns.labResultId.references.onDelete, 'cascade');
  assert.equal(research.columns.symptomId.references.table, 'symptoms');
  assert.equal(research.columns.symptomId.references.onDelete, 'cascade');
});

test('round-2 provenance + note FKs resolve, and lab_results gains personal-baseline columns', () => {
  const dbDir = join(APP, 'database');
  const load = (n) => JSON.parse(readFileSync(join(dbDir, `${n}.json`), 'utf8'));
  const ext = load('document_extractions');
  assert.equal(ext.columns.documentId.references.table, 'documents');
  assert.equal(ext.columns.documentId.references.onDelete, 'cascade');
  const notes = load('knowledge_notes');
  assert.equal(notes.columns.documentId.references.table, 'documents');
  const followups = load('followups');
  assert.equal(followups.columns.labResultId.references.table, 'lab_results');
  const labs = load('lab_results');
  assert.ok(labs.columns.personalLow, 'lab_results must gain personalLow');
  assert.ok(labs.columns.personalHigh, 'lab_results must gain personalHigh');
});

test('round-3 FKs + relations + new medication columns resolve', () => {
  const dbDir = join(APP, 'database');
  const load = (n) => JSON.parse(readFileSync(join(dbDir, `${n}.json`), 'utf8'));
  // adherence_logs + interactions belong to medications (cascade)
  const doses = load('adherence_logs');
  assert.equal(doses.columns.medicationId.references.table, 'medications');
  assert.equal(doses.columns.medicationId.references.onDelete, 'cascade');
  const interactions = load('interactions');
  assert.equal(interactions.columns.medicationId.references.table, 'medications');
  // appointments prep brief FK (setNull), triage symptom FK (setNull)
  assert.equal(load('appointments').columns.prepBriefId.references.table, 'visit_briefs');
  assert.equal(load('appointments').columns.prepBriefId.references.onDelete, 'setNull');
  assert.equal(load('triage_assessments').columns.symptomId.references.table, 'symptoms');
  // medications gains two columns + doses/interactions relations
  const meds = load('medications');
  assert.ok(meds.columns.refillsRemaining, 'medications must gain refillsRemaining');
  assert.ok(meds.columns.reminderTime, 'medications must gain reminderTime');
  assert.equal(meds.relations.doses.hasMany, 'adherence_logs');
  assert.equal(meds.relations.interactions.hasMany, 'interactions');
  // symptoms gains a triage relation (additive alongside research)
  assert.equal(load('symptoms').relations.triage.hasMany, 'triage_assessments');
});

// ── API handlers — 28 named, typed endpoints (12 round-1 + 16 round-2) ───────
const EXPECTED_ENDPOINTS = [
  // round 1
  ['metrics/GET.ts', 'listMetrics'],
  ['metrics/POST.ts', 'logMetric'],
  ['labs/GET.ts', 'listLabs'],
  ['labs/POST.ts', 'addLab'],
  ['labs/[id]/GET.ts', 'getLab'],
  ['symptoms/GET.ts', 'listSymptoms'],
  ['symptoms/POST.ts', 'logSymptom'],
  ['research/POST.ts', 'requestResearch'],
  ['research/[id]/GET.ts', 'getResearch'],
  ['settings/GET.ts', 'getSettings'],
  ['settings/disclaimer/POST.ts', 'acceptDisclaimer'],
  ['stats/GET.ts', 'healthStats'],
  // round 2
  ['documents/POST.ts', 'uploadDocument'],
  ['documents/GET.ts', 'listDocuments'],
  ['documents/[id]/GET.ts', 'getDocument'],
  ['visit-brief/POST.ts', 'prepareVisit'],
  ['visit-brief/GET.ts', 'listVisitBriefs'],
  ['visit-brief/[id]/GET.ts', 'getVisitBrief'],
  ['insights/GET.ts', 'listInsights'],
  ['followups/GET.ts', 'listFollowups'],
  ['followups/[id]/complete/POST.ts', 'completeFollowup'],
  ['goals/GET.ts', 'listGoals'],
  ['goals/POST.ts', 'createGoal'],
  ['goals/[id]/PATCH.ts', 'updateGoal'],
  ['metrics/import/POST.ts', 'importMetrics'],
  ['medications/GET.ts', 'listMedications'],
  ['medications/POST.ts', 'addMedication'],
  ['knowledge/GET.ts', 'listKnowledgeNotes'],
  // round 3 — pharmacy (adherence + interactions)
  ['doses/POST.ts', 'logDose'],
  ['doses/GET.ts', 'listDoses'],
  ['medications/[id]/GET.ts', 'getMedication'],
  ['interactions/POST.ts', 'checkInteractions'],
  ['interactions/GET.ts', 'listInteractions'],
  // round 3 — care (appointments + contacts + shares + triage)
  ['appointments/GET.ts', 'listAppointments'],
  ['appointments/POST.ts', 'addAppointment'],
  ['appointments/[id]/PATCH.ts', 'updateAppointment'],
  ['contacts/GET.ts', 'listContacts'],
  ['contacts/POST.ts', 'addContact'],
  ['shares/POST.ts', 'createShare'],
  ['shares/GET.ts', 'listShares'],
  ['shares/[id]/GET.ts', 'getShare'],
  ['triage/POST.ts', 'requestTriage'],
  ['triage/GET.ts', 'listTriage'],
  ['triage/[id]/GET.ts', 'getTriage'],
  // round 4 — dashboard, quick-log, integrations, notifications, settings
  ['attention/GET.ts', 'getAttention'],
  ['quick-log/POST.ts', 'quickLog'],
  ['quick-log/[id]/GET.ts', 'getQuickLogDraft'],
  ['quick-log/commit/POST.ts', 'commitQuickLog'],
  ['settings/PATCH.ts', 'updateSettings'],
  ['notify/POST.ts', 'sendNotification'],
  ['integrations/GET.ts', 'listIntegrations'],
  ['integrations/connect/POST.ts', 'connectIntegration'],
  ['documents/ingest/POST.ts', 'ingestDocumentFile'],
];

test('all 53 api handlers exist and export name / Input / Output / default handler', () => {
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

test('requestResearch gates deep research behind the subscription tier (402)', () => {
  const src = readFileSync(join(APP, 'api', 'research', 'POST.ts'), 'utf8');
  assert.match(src, /402/, 'requestResearch must return a 402 for non-subscribers');
  assert.match(src, /subscription/i, 'requestResearch must reference the subscription tier');
});

test('checkInteractions is subscription-gated (402) but requestTriage is free (no gate)', () => {
  const interactions = readFileSync(join(APP, 'api', 'interactions', 'POST.ts'), 'utf8');
  assert.match(interactions, /402/, 'checkInteractions must gate on subscription');
  assert.match(interactions, /subscription/i);
  const triage = readFileSync(join(APP, 'api', 'triage', 'POST.ts'), 'utf8');
  assert.doesNotMatch(triage, /402/, 'requestTriage must be free (safety) — no 402 gate');
  assert.match(triage, /insert\(\s*['"]triage_assessments['"]/);
});

test('getLab, getDocument, and getMedication use include to hydrate their relations', () => {
  assert.match(readFileSync(join(APP, 'api', 'labs', '[id]', 'GET.ts'), 'utf8'), /include/);
  assert.match(readFileSync(join(APP, 'api', 'documents', '[id]', 'GET.ts'), 'utf8'), /include/);
  assert.match(readFileSync(join(APP, 'api', 'medications', '[id]', 'GET.ts'), 'utf8'), /include/);
});

test('uploadDocument inserts a pending document and rejects empty content', () => {
  const src = readFileSync(join(APP, 'api', 'documents', 'POST.ts'), 'utf8');
  assert.match(src, /insert\(\s*['"]documents['"]/);
  assert.match(src, /pending/);
  assert.match(src, /400/, 'must reject bad input with a 400');
});

// ── Hooks — 7 total (5 database/cron round-1 + round-2) ──────────────────────
const EXPECTED_HOOKS = [
  ['interpret-new-lab.ts', /table:\s*['"]lab_results['"]/, /clinic\/interpreter#interpret/],
  ['research-deep-dive.ts', /table:\s*['"]research['"]/, /clinic\/researcher#deep-dive/],
  ['daily-digest.ts', /type:\s*['"]cron['"]/, /clinic\/interpreter#digest/],
  ['analyze-document.ts', /table:\s*['"]documents['"]/, /records\/analyst#analyze/],
  ['prepare-visit-brief.ts', /table:\s*['"]visit_briefs['"]/, /clinic\/interpreter#prep/],
  ['followup-reminders.ts', /type:\s*['"]cron['"]/, /coaching\/coach#reminders/],
  ['goal-checkin.ts', /type:\s*['"]cron['"]/, /coaching\/coach#checkin/],
  // round 3
  ['check-interactions.ts', /table:\s*['"]interactions['"]/, /pharmacy\/pharmacist#review/],
  ['compile-care-share.ts', /table:\s*['"]care_shares['"]/, /care\/coordinator#compile/],
  ['triage-symptom.ts', /table:\s*['"]triage_assessments['"]/, /care\/triage-nurse#assess/],
  ['dose-reminders.ts', /type:\s*['"]cron['"]/, /pharmacy\/pharmacist#reminders/],
  ['appointment-reminders.ts', /type:\s*['"]cron['"]/, /care\/coordinator#reminders/],
  // round 4 — natural-language quick-log parse (declarative → logger draft action)
  ['parse-quicklog.ts', /table:\s*['"]quicklog_drafts['"]/, /clinic\/logger#draft/],
  ['weekly-digest.ts', /type:\s*['"]cron['"]/, /clinic\/interpreter#weekly/],
];

test('all 14 declarative/cron hooks exist with the right table/type and trigger target', () => {
  for (const [file, shape, target] of EXPECTED_HOOKS) {
    const src = readFileSync(join(APP, 'hooks', file), 'utf8');
    assert.match(src, shape, `${file}: wrong shape`);
    assert.match(src, target, `${file}: wrong trigger target`);
  }
});

test('sync-wearables is an imperative database hook with a graceful no-op handler', () => {
  // The runtime hook-loader only supports imperative handlers on `database` hooks —
  // a `cron` hook is declarative agent-trigger only (needs a `trigger`). A pure-Node
  // wearable pull therefore fires on the `integrations` write that connects a provider,
  // not on a cron tick.
  const src = readFileSync(join(APP, 'hooks', 'sync-wearables.ts'), 'utf8');
  assert.match(src, /type:\s*['"]database['"]/);
  assert.match(src, /table:\s*['"]integrations['"]/);
  assert.match(src, /handler:/, 'sync-wearables must use an imperative handler');
  assert.doesNotMatch(src, /trigger:/, 'an imperative database hook must not carry a declarative trigger');
  assert.match(src, /status:\s*['"]connected['"]/, 'must only sync connected integrations');
});

test('parse-quicklog is an insert-triggered declarative hook to the logger', () => {
  const src = readFileSync(join(APP, 'hooks', 'parse-quicklog.ts'), 'utf8');
  assert.match(src, /type:\s*['"]database['"]/);
  assert.match(src, /event:\s*['"]insert['"]/);
  assert.match(src, /trigger:\s*['"]clinic\/logger#draft['"]/);
});

test('the two round-2 database hooks are declarative triggers (self-query pattern)', () => {
  for (const file of ['analyze-document.ts', 'prepare-visit-brief.ts']) {
    const src = readFileSync(join(APP, 'hooks', file), 'utf8');
    assert.match(src, /type:\s*['"]database['"]/);
    assert.match(src, /event:\s*['"]insert['"]/);
    assert.match(src, /trigger:/, `${file}: must use a declarative trigger`);
  }
});

// ── Spaces — three project-scoped spaces, each in full format ────────────────
const SPACES = {
  clinic: ['interpreter', 'logger', 'researcher'],
  records: ['analyst', 'librarian'],
  coaching: ['coach'],
  pharmacy: ['pharmacist'],
  care: ['assistant', 'coordinator', 'triage-nurse'],
};

test('five project-scoped spaces exist, each with the expected agents (charter + instruct)', () => {
  for (const [space, agents] of Object.entries(SPACES)) {
    const agentsDir = join(APP, 'spaces', space, 'agents');
    assert.ok(existsSync(agentsDir), `space ${space} missing agents/`);
    assert.deepEqual(readdirSync(agentsDir).sort(), [...agents].sort(), `${space}: agent set`);
    for (const a of agents) {
      assert.ok(existsSync(join(agentsDir, a, 'charter.md')), `${space}/${a}: charter.md required`);
      assert.ok(existsSync(join(agentsDir, a, 'instruct.md')), `${space}/${a}: instruct.md required`);
    }
  }
});

test('every space is FULL format — functions/, components/, and extensive knowledge/ (index + aspects)', () => {
  for (const space of Object.keys(SPACES)) {
    const root = join(APP, 'spaces', space);
    for (const part of ['functions', 'components', 'knowledge', 'tasklists']) {
      assert.ok(existsSync(join(root, part)), `${space}: missing ${part}/ (full-format requirement)`);
    }
    // knowledge must have ≥1 field with an index.md overview + ≥2 aspect deep-dives.
    const kroot = join(root, 'knowledge');
    const fields = [];
    const walk = (d) => {
      for (const e of readdirSync(d)) {
        const p = join(d, e);
        if (statSync(p).isDirectory()) {
          if (existsSync(join(p, 'index.md'))) fields.push(p);
          else walk(p);
        }
      }
    };
    walk(kroot);
    assert.ok(fields.length >= 1, `${space}: knowledge must have at least one field with index.md`);
    for (const f of fields) {
      const aspects = readdirSync(f).filter((n) => n.endsWith('.md') && n !== 'index.md');
      assert.ok(aspects.length >= 2, `${space}: knowledge field ${f} needs ≥2 aspect .md files`);
    }
  }
});

test('care/assistant is an app-wide orchestrator: api:call + safe writes, no clinical-table writes', () => {
  const src = readFileSync(join(APP, 'spaces', 'care', 'agents', 'assistant', 'instruct.md'), 'utf8');
  const fmBlock = src.split('---')[1] ?? '';
  // It orchestrates the pending-row pipelines via api:call…
  assert.match(fmBlock, /api:call/, 'assistant must hold api:call to trigger specialist pipelines');
  // …and writes ONLY the low-risk, user-authored tables — never the clinical, AI-authored ones.
  assert.match(fmBlock, /db:write:\s*\{\s*tables:\s*\[metrics,\s*symptoms,\s*medications,\s*adherence_logs,\s*appointments,\s*goals,\s*followups,\s*care_contacts\]/);
  for (const clinical of ['lab_results', 'research', 'interactions', 'triage_assessments', 'visit_briefs', 'care_shares', 'insights']) {
    // none of the clinical tables appear inside the db:write grant line
    const writeLine = (fmBlock.match(/db:write:[^\n]*/) ?? [''])[0];
    assert.doesNotMatch(writeLine, new RegExp(clinical), `assistant must NOT db:write ${clinical}`);
  }
  // Confirm-before-write is stated as a hard rule.
  assert.match(src, /[Cc]onfirm/, 'assistant must document confirm-before-write');
});

// ── Capabilities — least-privilege across all six agents ─────────────────────
test('no operating agent holds an authoring capability (db:schema / pages/api/hooks:write)', () => {
  for (const [space, agents] of Object.entries(SPACES)) {
    for (const a of agents) {
      const src = readFileSync(join(APP, 'spaces', space, 'agents', a, 'instruct.md'), 'utf8');
      assert.match(src, /capabilities:/, `${space}/${a}: must declare capabilities`);
      for (const forbidden of ['db:schema', 'pages:write', 'api:write', 'hooks:write']) {
        assert.doesNotMatch(src, new RegExp(forbidden), `${space}/${a}: must NOT hold ${forbidden}`);
      }
    }
  }
});

test('per-verb table scope holds for the extended + new agents', () => {
  const read = (space, a) => readFileSync(join(APP, 'spaces', space, 'agents', a, 'instruct.md'), 'utf8');
  // interpreter now also writes visit_briefs + insights
  const interpreter = read('clinic', 'interpreter');
  assert.match(interpreter, /db:write:\s*\{\s*tables:\s*\[lab_results,\s*research,\s*visit_briefs,\s*insights,\s*followups\]/);
  // logger now also writes medications + the quicklog_drafts preview (draft action)
  assert.match(read('clinic', 'logger'), /db:write:\s*\{\s*tables:\s*\[metrics,\s*lab_results,\s*symptoms,\s*medications,\s*quicklog_drafts\]/);
  // researcher unchanged (research only)
  assert.match(read('clinic', 'researcher'), /db:write:\s*\{\s*tables:\s*\[research\]/);
  // analyst writes the ingestion tables incl. research (queues dives) but NOT via canDelegateTo
  const analyst = read('records', 'analyst');
  assert.match(analyst, /db:write:/);
  assert.match(analyst, /research/);
  assert.doesNotMatch(analyst, /canDelegateTo/, 'analyst queues research via db insert, not delegation');
  // coach writes only coaching tables
  assert.match(read('coaching', 'coach'), /db:write:\s*\{\s*tables:\s*\[goals,\s*followups,\s*insights\]/);
});

test('round-3 agents: correct functions posture + per-verb write scope', () => {
  const read = (space, a) => readFileSync(join(APP, 'spaces', space, 'agents', a, 'instruct.md'), 'utf8');
  const fm = (src) => src.split('---')[1] ?? ''; // frontmatter block only
  // pharmacist needs web literature → OMITS functions: (no functions key in frontmatter)
  const pharmacist = read('pharmacy', 'pharmacist');
  assert.doesNotMatch(fm(pharmacist), /^\s*functions:/m, 'pharmacist must OMIT functions: to keep web tools');
  assert.match(pharmacist, /db:write:\s*\{\s*tables:\s*\[adherence_logs,\s*interactions\]/);
  // coordinator denies web via functions: [buildCareSummary]
  const coordinator = read('care', 'coordinator');
  assert.match(fm(coordinator), /functions:\s*(\[\s*buildCareSummary\s*\]|\n\s*-\s*buildCareSummary)/, 'coordinator lists only buildCareSummary (no web)');
  assert.match(coordinator, /db:write:\s*\{\s*tables:\s*\[care_shares,\s*appointments,\s*visit_briefs\]/);
  // triage-nurse denies ALL functions incl web via functions: []
  const triage = read('care', 'triage-nurse');
  assert.match(fm(triage), /functions:\s*\[\s*\]/, 'triage-nurse must set functions: [] (no web, grounded in knowledge)');
  assert.match(triage, /db:write:\s*\{\s*tables:\s*\[triage_assessments\]/);
});
