/**
 * Self-contained tests for the `blog` project-application.
 *
 * Runs dependency-free with Node's built-in runner:
 *   node --test store/projects/blog/tests/
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
const APP = join(HERE, '..'); // store/projects/blog
const REPO = join(APP, '..', '..', '..'); // monorepo root
const CORE = join(REPO, 'sdk', 'org', 'libs', 'core', 'dist', 'index.js');

// ── Schemas — real engine validation ────────────────────────────────────────
test('all 6 database schemas pass the engine validateSchemaSet (fail-loud)', async () => {
  assert.ok(existsSync(CORE), `built @lmthing/core not found at ${CORE} — run \`pnpm --filter @lmthing/core build\` in sdk/org`);
  const { validateSchemaSet } = await import(CORE);
  const dbDir = join(APP, 'database');
  const tables = readdirSync(dbDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ name: f.slice(0, -5), schema: JSON.parse(readFileSync(join(dbDir, f), 'utf8')) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  assert.deepEqual(
    tables.map((t) => t.name),
    ['articles', 'citations', 'raw_items', 'research', 'settings', 'sources'],
  );
  // Throws (fail-loud) on a missing description, dup/absent PK, or a dangling FK/relation.
  assert.doesNotThrow(() => validateSchemaSet(tables));
});

test('every table, column, and relation carries a required description', () => {
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

// ── API handlers — the 12 named, typed endpoints ────────────────────────────
const EXPECTED_ENDPOINTS = [
  ['feed-list/GET.ts', 'feedList'],
  ['stats/GET.ts', 'feedStats'],
  ['mark-read/POST.ts', 'markRead'],
  ['mark-all-read/POST.ts', 'markAllRead'],
  ['settings/GET.ts', 'getSettings'],
  ['articles/[id]/GET.ts', 'getArticle'],
  ['articles/[id]/save/POST.ts', 'saveArticle'],
  ['articles/[id]/research/GET.ts', 'getResearch'],
  ['articles/[id]/research/POST.ts', 'requestResearch'],
  ['sources/GET.ts', 'listSources'],
  ['sources/POST.ts', 'addSource'],
  ['sources/[id]/DELETE.ts', 'removeSource'],
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

test('requestResearch tier-gates with a 402 HttpError', () => {
  const src = readFileSync(join(APP, 'api', 'articles', '[id]', 'research', 'POST.ts'), 'utf8');
  assert.match(src, /HttpError\(\s*402/, 'requestResearch must throw HttpError(402) for the free tier');
  assert.match(src, /ctx\.spawn\(/, 'requestResearch must spawn the researcher fire-and-forget');
});

test('addSource enforces the free-tier source cap', () => {
  const src = readFileSync(join(APP, 'api', 'sources', 'POST.ts'), 'utf8');
  assert.match(src, /maxFreeSources/, 'addSource must consult maxFreeSources');
  assert.match(src, /HttpError\(\s*402/, 'addSource must 402 when the free-tier cap is hit');
});

// ── Hooks — cron + database:insert loop ─────────────────────────────────────
test('refresh-sources is a cron hook that triggers the fetcher', () => {
  const src = readFileSync(join(APP, 'hooks', 'refresh-sources.ts'), 'utf8');
  assert.match(src, /type:\s*['"]cron['"]/);
  assert.match(src, /newsroom\/fetcher#refresh/);
});

test('synthesize-new is a database:insert hook with an idempotence guard + delegate', () => {
  const src = readFileSync(join(APP, 'hooks', 'synthesize-new.ts'), 'utf8');
  assert.match(src, /type:\s*['"]database['"]/);
  assert.match(src, /table:\s*['"]raw_items['"]/);
  assert.match(src, /event:\s*['"]insert['"]/);
  assert.match(src, /row\.processed/, 'must guard on row.processed (idempotence / loop guard)');
  assert.match(src, /delegate\(\s*['"]newsroom\/synthesizer['"]/, 'must delegate to the synthesizer');
});

// ── Newsroom agents — least-privilege capabilities ──────────────────────────
test('newsroom has 3 agents, each with least-privilege capabilities and no forbidden authoring caps', () => {
  const agentsDir = join(APP, 'spaces', 'newsroom', 'agents');
  const agents = readdirSync(agentsDir);
  assert.deepEqual(agents.sort(), ['fetcher', 'researcher', 'synthesizer']);
  for (const a of agents) {
    const src = readFileSync(join(agentsDir, a, 'instruct.md'), 'utf8');
    assert.match(src, /capabilities:/, `${a}: must declare capabilities`);
    // The newsroom OPERATES the app; it must not carry authoring/schema caps.
    for (const forbidden of ['db:schema', 'pages:write', 'api:write', 'hooks:write']) {
      assert.doesNotMatch(src, new RegExp(forbidden), `${a}: must NOT hold ${forbidden}`);
    }
  }
});
