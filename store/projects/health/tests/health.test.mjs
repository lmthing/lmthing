/**
 * Self-contained tests for the `health` project-application.
 *
 * Runs dependency-free with Node's built-in runner:
 *   node --test store/projects/health/tests/health.test.mjs
 *
 * - **Schemas** are validated with the REAL engine validator (`validateSchemaSet`
 *   from the built `@lmthing/core` in the sdk/org submodule) — the same fail-loud
 *   check the runtime loader (`libs/cli/src/app/loader.ts`) applies at boot.
 * - **API handlers / hooks / agents** are asserted structurally (the files are TS,
 *   not importable here without a transpile, so we check their required exports /
 *   shape by source) — a green here means the contract the runtime relies on holds.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..'); // store/projects/health
const REPO = join(APP, '..', '..', '..'); // monorepo root
const CORE = join(REPO, 'sdk', 'org', 'libs', 'core', 'dist', 'index.js');

// ── Schemas — real engine validation ────────────────────────────────────────
const EXPECTED_TABLES = [
  'lab_results',
  'metrics',
  'research',
  'settings',
  'sources',
  'symptoms',
];

test('all 6 database schemas pass the engine validateSchemaSet (fail-loud)', async () => {
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

// ── API handlers — the 12 named, typed endpoints ────────────────────────────
const EXPECTED_ENDPOINTS = [
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
];

test('all 12 api handlers exist and export name / Input / Output / default handler', () => {
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

test('getLab uses include to hydrate its relations', () => {
  const src = readFileSync(join(APP, 'api', 'labs', '[id]', 'GET.ts'), 'utf8');
  assert.match(src, /include/, 'getLab must use include to join related data');
});

// ── Hooks — database:insert + cron loops ────────────────────────────────────
test('interpret-new-lab is a database:insert hook on lab_results that triggers the interpreter', () => {
  const src = readFileSync(join(APP, 'hooks', 'interpret-new-lab.ts'), 'utf8');
  assert.match(src, /type:\s*['"]database['"]/);
  assert.match(src, /table:\s*['"]lab_results['"]/);
  assert.match(src, /event:\s*['"]insert['"]/);
  // Declarative trigger — a hook delegate does not thread structured input, so the interpreter
  // self-queries (reconciles all labs) rather than receiving a labResultId.
  assert.match(src, /trigger:\s*['"]clinic\/interpreter#interpret['"]/, 'must trigger the interpreter');
});

test('research-deep-dive is a database:insert hook on research that triggers the researcher', () => {
  const src = readFileSync(join(APP, 'hooks', 'research-deep-dive.ts'), 'utf8');
  assert.match(src, /type:\s*['"]database['"]/);
  assert.match(src, /table:\s*['"]research['"]/);
  assert.match(src, /event:\s*['"]insert['"]/);
  assert.match(src, /trigger:\s*['"]clinic\/researcher#deep-dive['"]/, 'must trigger the researcher');
});

test('daily-digest is a cron hook that triggers the interpreter digest action', () => {
  const src = readFileSync(join(APP, 'hooks', 'daily-digest.ts'), 'utf8');
  assert.match(src, /type:\s*['"]cron['"]/);
  assert.match(src, /clinic\/interpreter#digest/);
});

// ── clinic agents — least-privilege capabilities ────────────────────────────
test('clinic has 3 agents, each least-privilege with no forbidden authoring caps', () => {
  const agentsDir = join(APP, 'spaces', 'clinic', 'agents');
  const agents = readdirSync(agentsDir);
  assert.deepEqual(agents.sort(), ['interpreter', 'logger', 'researcher']);
  for (const a of agents) {
    const src = readFileSync(join(agentsDir, a, 'instruct.md'), 'utf8');
    assert.match(src, /capabilities:/, `${a}: must declare capabilities`);
    // The clinic OPERATES the app; it must not carry authoring/schema caps.
    for (const forbidden of ['db:schema', 'pages:write', 'api:write', 'hooks:write']) {
      assert.doesNotMatch(src, new RegExp(forbidden), `${a}: must NOT hold ${forbidden}`);
    }
  }
});

test('per-verb table scope: interpreter, logger, and researcher each write only their own tables', () => {
  const agentsDir = join(APP, 'spaces', 'clinic', 'agents');
  const interpreter = readFileSync(join(agentsDir, 'interpreter', 'instruct.md'), 'utf8');
  assert.match(interpreter, /db:write:\s*\{\s*tables:\s*\[lab_results,\s*research\]/);
  const logger = readFileSync(join(agentsDir, 'logger', 'instruct.md'), 'utf8');
  assert.match(logger, /db:write:\s*\{\s*tables:\s*\[metrics,\s*lab_results,\s*symptoms\]/);
  const researcher = readFileSync(join(agentsDir, 'researcher', 'instruct.md'), 'utf8');
  assert.match(researcher, /db:write:\s*\{\s*tables:\s*\[research\]/);
});
