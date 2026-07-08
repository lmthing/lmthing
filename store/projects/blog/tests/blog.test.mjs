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
test('all 19 database schemas pass the engine validateSchemaSet (fail-loud)', async () => {
  assert.ok(existsSync(CORE), `built @lmthing/core not found at ${CORE} — run \`pnpm --filter @lmthing/core build\` in sdk/org`);
  const { validateSchemaSet } = await import(CORE);
  const dbDir = join(APP, 'database');
  const tables = readdirSync(dbDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ name: f.slice(0, -5), schema: JSON.parse(readFileSync(join(dbDir, f), 'utf8')) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  assert.deepEqual(
    tables.map((t) => t.name),
    // round 1: articles citations raw_items research settings sources
    // round 2: digest_items digests newsletters reading_events topics
    // round 3: alerts annotations briefings collection_items collections source_health subscriptions
    ['alerts', 'annotations', 'article_takes', 'articles', 'briefings', 'citations', 'collection_items', 'collections', 'digest_items', 'digests', 'newsletters', 'raw_items', 'reading_events', 'research', 'settings', 'source_health', 'sources', 'subscriptions', 'topics'],
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
  // ── round 2 (14) ──
  ['topics/GET.ts', 'listTopics'],
  ['topics/POST.ts', 'followTopic'],
  ['topics/[id]/PATCH.ts', 'updateTopic'],
  ['topics/[id]/DELETE.ts', 'removeTopic'],
  ['topics/[id]/feed/GET.ts', 'topicFeed'],
  ['digests/GET.ts', 'listDigests'],
  ['digests/[id]/GET.ts', 'getDigest'],
  ['digests/POST.ts', 'buildDigest'],
  ['digests/[id]/newsletter/GET.ts', 'getNewsletter'],
  ['reading-events/POST.ts', 'logReadingEvent'],
  ['personalize/POST.ts', 'personalizeFeed'],
  ['insights/GET.ts', 'feedInsights'],
  ['articles/[id]/pin/POST.ts', 'pinArticle'],
  ['articles/[id]/dismiss/POST.ts', 'dismissArticle'],
  // ── round 3 (21) ──
  ['collections/GET.ts', 'listCollections'],
  ['collections/POST.ts', 'createCollection'],
  ['collections/[id]/GET.ts', 'getCollection'],
  ['collections/[id]/PATCH.ts', 'updateCollection'],
  ['collections/[id]/DELETE.ts', 'removeCollection'],
  ['collections/[id]/items/POST.ts', 'addToCollection'],
  ['collection-items/[id]/DELETE.ts', 'removeCollectionItem'],
  ['articles/[id]/annotations/GET.ts', 'listAnnotations'],
  ['articles/[id]/annotations/POST.ts', 'addAnnotation'],
  ['annotations/[id]/DELETE.ts', 'removeAnnotation'],
  ['subscriptions/GET.ts', 'listSubscriptions'],
  ['subscriptions/POST.ts', 'createSubscription'],
  ['subscriptions/[id]/PATCH.ts', 'updateSubscription'],
  ['subscriptions/[id]/DELETE.ts', 'removeSubscription'],
  ['alerts/GET.ts', 'listAlerts'],
  ['alerts/[id]/read/POST.ts', 'markAlertRead'],
  ['briefings/GET.ts', 'listBriefings'],
  ['briefings/[id]/GET.ts', 'getBriefing'],
  ['briefings/POST.ts', 'requestBriefing'],
  ['search/GET.ts', 'search'],
  ['source-health/GET.ts', 'sourceHealth'],
];

test('all 47 api handlers exist and export name / Input / Output / default handler', () => {
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

test('requestResearch tier-gates with a 402 HttpError and seeds a pending row (hook-driven)', () => {
  const src = readFileSync(join(APP, 'api', 'articles', '[id]', 'research', 'POST.ts'), 'utf8');
  assert.match(src, /HttpError\(\s*402/, 'requestResearch must throw HttpError(402) for the free tier');
  // requestResearch seeds a pending `research` row and the `deep-research` database:insert hook drives
  // the researcher (see below) — the pending row doubles as the idempotence guard.
  assert.match(src, /['"]pending['"]/, 'must seed a pending status');
  assert.match(src, /db\.insert\(\s*['"]research['"]/, 'must insert a research row for the hook to pick up');
});

test('addSource enforces the free-tier source cap', () => {
  const src = readFileSync(join(APP, 'api', 'sources', 'POST.ts'), 'utf8');
  assert.match(src, /maxFreeSources/, 'addSource must consult maxFreeSources');
  assert.match(src, /HttpError\(\s*402/, 'addSource must 402 when the free-tier cap is hit');
});

// ── Hooks — cron + database:insert loop ─────────────────────────────────────
test('refresh-sources is an imperative cron handler (no LLM/agent trigger)', () => {
  const src = readFileSync(join(APP, 'hooks', 'refresh-sources.ts'), 'utf8');
  assert.match(src, /type:\s*['"]cron['"]/);
  assert.match(src, /every:\s*['"]30m['"]/, 'must keep the existing 30-minute schedule');
  assert.match(src, /handler:\s*async/, 'must be an imperative handler, not a declarative trigger');
  assert.doesNotMatch(src, /trigger:/, 'must not carry a `trigger` — this hook no longer delegates to an agent');
  assert.doesNotMatch(src, /delegate\(/, 'must never call delegate() — that would re-introduce the LLM');
  // Deterministic fetch/parse/dedupe/insert logic inlined from spaces/newsroom/functions/.
  assert.match(src, /function parseFeedEntries/, 'must inline parseFeedEntries');
  assert.match(src, /function dedupeByUrl/, 'must inline dedupeByUrl');
  assert.match(src, /function extractImage/, 'must inline extractImage');
  assert.match(src, /db\.insert\(\s*['"]raw_items['"]/, 'must insert new raw_items directly');
});

test('synthesize-new is a database:insert hook with an idempotence guard + delegate', () => {
  const src = readFileSync(join(APP, 'hooks', 'synthesize-new.ts'), 'utf8');
  assert.match(src, /type:\s*['"]database['"]/);
  assert.match(src, /table:\s*['"]raw_items['"]/);
  assert.match(src, /event:\s*['"]insert['"]/);
  assert.match(src, /row\.processed/, 'must guard on row.processed (idempotence / loop guard)');
  assert.match(src, /delegate\(\s*['"]newsroom\/synthesizer['"]/, 'must delegate to the synthesizer');
});

// ── Round-2 hooks (4) — digests / newsletters / personalization ─────────────
test('build-daily-digest is a daily cron that triggers the curator', () => {
  const src = readFileSync(join(APP, 'hooks', 'build-daily-digest.ts'), 'utf8');
  assert.match(src, /type:\s*['"]cron['"]/);
  assert.match(src, /daily:/, 'must be a daily cron');
  assert.match(src, /editorial\/curator#digest/);
});

test('render-newsletter is a digests:insert hook with idempotence + delegate to digest-writer', () => {
  const src = readFileSync(join(APP, 'hooks', 'render-newsletter.ts'), 'utf8');
  assert.match(src, /type:\s*['"]database['"]/);
  assert.match(src, /table:\s*['"]digests['"]/);
  assert.match(src, /event:\s*['"]insert['"]/);
  assert.match(src, /newsletters/, 'must check for an existing newsletter (idempotence)');
  assert.match(src, /delegate\(\s*['"]editorial\/digest-writer['"]/, 'must delegate to the digest-writer');
});

test('personalize-on-read is a reading_events:insert hook delegating to the personalizer', () => {
  const src = readFileSync(join(APP, 'hooks', 'personalize-on-read.ts'), 'utf8');
  assert.match(src, /type:\s*['"]database['"]/);
  assert.match(src, /table:\s*['"]reading_events['"]/);
  assert.match(src, /delegate\(\s*['"]editorial\/personalizer['"]\s*,\s*['"]learn['"]/, 'must delegate learn');
});

test('rescore-on-topic-change is a topics:update hook delegating rescore', () => {
  const src = readFileSync(join(APP, 'hooks', 'rescore-on-topic-change.ts'), 'utf8');
  assert.match(src, /type:\s*['"]database['"]/);
  assert.match(src, /table:\s*['"]topics['"]/);
  assert.match(src, /event:\s*['"]update['"]/);
  assert.match(src, /delegate\(\s*['"]editorial\/personalizer['"]\s*,\s*['"]rescore['"]/, 'must delegate rescore');
});

// ── Round-3 hooks (4) — subscriptions / briefings / collections / source health ──
test('scan-subscriptions is a cron hook that triggers the librarian', () => {
  const src = readFileSync(join(APP, 'hooks', 'scan-subscriptions.ts'), 'utf8');
  assert.match(src, /type:\s*['"]cron['"]/);
  assert.match(src, /research\/librarian#scan/);
});

test('generate-briefing is a briefings:insert hook delegating to the analyst with a pending guard', () => {
  const src = readFileSync(join(APP, 'hooks', 'generate-briefing.ts'), 'utf8');
  assert.match(src, /type:\s*['"]database['"]/);
  assert.match(src, /table:\s*['"]briefings['"]/);
  assert.match(src, /event:\s*['"]insert['"]/);
  assert.match(src, /delegate\(\s*['"]research\/analyst['"]\s*,\s*['"]brief['"]/, 'must delegate brief');
  assert.match(src, /pending/, 'must guard on the pending status (idempotence)');
});

test('file-into-collections is an articles:insert hook delegating to the librarian', () => {
  const src = readFileSync(join(APP, 'hooks', 'file-into-collections.ts'), 'utf8');
  assert.match(src, /type:\s*['"]database['"]/);
  assert.match(src, /table:\s*['"]articles['"]/);
  assert.match(src, /event:\s*['"]insert['"]/);
  assert.match(src, /delegate\(\s*['"]research\/librarian['"]\s*,\s*['"]file['"]/, 'must delegate file');
});

test('generate-take is an article_takes:insert hook delegating to the explainer with a pending guard', () => {
  const src = readFileSync(join(APP, 'hooks', 'generate-take.ts'), 'utf8');
  assert.match(src, /type:\s*['"]database['"]/);
  assert.match(src, /table:\s*['"]article_takes['"]/);
  assert.match(src, /event:\s*['"]insert['"]/);
  assert.match(src, /delegate\(\s*['"]editorial\/explainer['"]\s*,\s*['"]explain['"]/, 'must delegate explain');
  assert.match(src, /pending/, 'must guard on the pending status (idempotence)');
});

test('deep-research is a research:insert hook delegating to the researcher with a pending guard', () => {
  const src = readFileSync(join(APP, 'hooks', 'deep-research.ts'), 'utf8');
  assert.match(src, /type:\s*['"]database['"]/);
  assert.match(src, /table:\s*['"]research['"]/);
  assert.match(src, /event:\s*['"]insert['"]/);
  assert.match(src, /delegate\(\s*['"]newsroom\/researcher['"]\s*,\s*['"]deep-dive['"]/, 'must delegate deep-dive');
  assert.match(src, /pending/, 'must guard on the pending status (idempotence)');
});

test('track-source-health is a pure-db raw_items:insert hook (no delegate)', () => {
  const src = readFileSync(join(APP, 'hooks', 'track-source-health.ts'), 'utf8');
  assert.match(src, /type:\s*['"]database['"]/);
  assert.match(src, /table:\s*['"]raw_items['"]/);
  assert.match(src, /source_health/, 'must upsert the source_health row');
  assert.doesNotMatch(src, /delegate\(/, 'must be a pure-db handler — no agent delegate');
});

test('requestBriefing seeds a pending briefing (hook-driven, no spawn)', () => {
  const src = readFileSync(join(APP, 'api', 'briefings', 'POST.ts'), 'utf8');
  assert.match(src, /['"]pending['"]/, 'must seed a pending status');
  assert.match(src, /db\.insert\(\s*['"]briefings['"]/, 'must insert a briefings row');
});

test('buildDigest seeds a building digest and spawns the curator', () => {
  const src = readFileSync(join(APP, 'api', 'digests', 'POST.ts'), 'utf8');
  assert.match(src, /['"]building['"]/, 'must seed a building status');
  assert.match(src, /ctx\.spawn\(\s*['"]editorial\/curator/, 'must spawn the editorial curator');
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

// ── Full space-format compliance (round-2 remediation) ──────────────────────
// A project-scoped space must be MORE than an `agents/` dir: it needs
// tasklists/ functions/ components/ and extensive knowledge/ (each field an
// index.md overview + >=2 aspect deep-dives), and every agent needs BOTH a
// charter.md and an instruct.md.
function assertFullFormatSpace(spaceName, expectedAgents) {
  const spaceDir = join(APP, 'spaces', spaceName);
  for (const sub of ['agents', 'tasklists', 'functions', 'components', 'knowledge']) {
    assert.ok(existsSync(join(spaceDir, sub)), `${spaceName}: missing ${sub}/ (full-format required)`);
  }
  const agents = readdirSync(join(spaceDir, 'agents')).sort();
  assert.deepEqual(agents, expectedAgents.slice().sort(), `${spaceName}: agent set`);
  for (const a of agents) {
    assert.ok(existsSync(join(spaceDir, 'agents', a, 'charter.md')), `${spaceName}/${a}: missing charter.md`);
    assert.ok(existsSync(join(spaceDir, 'agents', a, 'instruct.md')), `${spaceName}/${a}: missing instruct.md`);
  }
  // knowledge: at least one domain, each field = index.md + >=2 aspect files.
  const knowRoot = join(spaceDir, 'knowledge');
  const domains = readdirSync(knowRoot).filter((d) => existsSync(join(knowRoot, d)) && readdirSync(knowRoot, { withFileTypes: true }).find((e) => e.name === d && e.isDirectory()));
  let fieldCount = 0;
  for (const domain of domains) {
    const fields = readdirSync(join(knowRoot, domain), { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const f of fields) {
      fieldCount++;
      const fieldDir = join(knowRoot, domain, f.name);
      assert.ok(existsSync(join(fieldDir, 'index.md')), `${spaceName} knowledge ${domain}/${f.name}: missing index.md overview`);
      const aspects = readdirSync(fieldDir).filter((x) => x.endsWith('.md') && x !== 'index.md');
      assert.ok(aspects.length >= 2, `${spaceName} knowledge ${domain}/${f.name}: needs >=2 aspect deep-dives, has ${aspects.length}`);
    }
  }
  assert.ok(fieldCount >= 3, `${spaceName}: expected >=3 knowledge fields, found ${fieldCount}`);
  // at least one tasklist with an index.md
  const tlRoot = join(spaceDir, 'tasklists');
  const tls = readdirSync(tlRoot, { withFileTypes: true }).filter((e) => e.isDirectory());
  assert.ok(tls.length >= 1, `${spaceName}: needs >=1 tasklist`);
  for (const tl of tls) {
    assert.ok(existsSync(join(tlRoot, tl.name, 'index.md')), `${spaceName} tasklist ${tl.name}: missing index.md`);
  }
  // at least one function + one component file
  assert.ok(readdirSync(tlRoot).length >= 1, `${spaceName}: tasklists present`);
  const fnFiles = readdirSync(join(spaceDir, 'functions')).filter((x) => x.endsWith('.ts'));
  assert.ok(fnFiles.length >= 1, `${spaceName}: needs >=1 function`);
}

test('the app has >=4 project-scoped spaces (assistant + newsroom + editorial + research)', () => {
  const spaces = readdirSync(join(APP, 'spaces'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  assert.deepEqual(spaces, ['assistant', 'editorial', 'newsroom', 'research']);
});

test('research is a full-format space with 3 least-privilege agents', () => {
  assertFullFormatSpace('research', ['analyst', 'fact-checker', 'librarian']);
  const agentsDir = join(APP, 'spaces', 'research', 'agents');
  for (const a of readdirSync(agentsDir)) {
    const src = readFileSync(join(agentsDir, a, 'instruct.md'), 'utf8');
    assert.match(src, /capabilities:/, `${a}: must declare capabilities`);
    // research OPERATES the app — no authoring/schema caps.
    for (const forbidden of ['db:schema', 'pages:write', 'api:write', 'hooks:write']) {
      assert.doesNotMatch(src, new RegExp(forbidden), `${a}: must NOT hold ${forbidden}`);
    }
  }
});

test('newsroom is remediated to the full space format', () => {
  assertFullFormatSpace('newsroom', ['fetcher', 'researcher', 'synthesizer']);
});

test('editorial is a full-format space with 3 least-privilege agents', () => {
  assertFullFormatSpace('editorial', ['curator', 'digest-writer', 'explainer', 'personalizer']);
  const agentsDir = join(APP, 'spaces', 'editorial', 'agents');
  for (const a of readdirSync(agentsDir)) {
    const src = readFileSync(join(agentsDir, a, 'instruct.md'), 'utf8');
    assert.match(src, /capabilities:/, `${a}: must declare capabilities`);
    // editorial OPERATES the app — no authoring/schema caps.
    for (const forbidden of ['db:schema', 'pages:write', 'api:write', 'hooks:write']) {
      assert.doesNotMatch(src, new RegExp(forbidden), `${a}: must NOT hold ${forbidden}`);
    }
  }
});

// ── assistant/editor concierge — acts through validated endpoints via apiCall ──
// The editor is the in-app concierge: it READS with db:read and MUTATES only through
// the app's own `api/` endpoints via `apiCall(...)` (capability-model intent), so every
// action runs the real validators + fires the same database hooks as the UI. It holds
// NO db:write — raw writes would bypass that validation/fan-out.
test('editor declares api:call with an "allow" list (not the invalid "names" key)', () => {
  const src = readFileSync(join(APP, 'spaces', 'assistant', 'agents', 'editor', 'instruct.md'), 'utf8');
  assert.match(src, /api:call:\s*\{\s*allow:\s*\[/, 'editor must use api:call: { allow: [...] } — the engine rejects any other config key');
  assert.doesNotMatch(src, /api:call:\s*\{\s*names:/, 'the "names" key is invalid and fails capability parsing at load');
});

test('editor holds db:read + api:call but NOT db:write (mutations route through apiCall)', () => {
  const src = readFileSync(join(APP, 'spaces', 'assistant', 'agents', 'editor', 'instruct.md'), 'utf8');
  assert.match(src, /-\s*db:read:/, 'editor must keep db:read for grounded answers');
  assert.match(src, /-\s*api:call:/, 'editor must hold api:call to act through endpoints');
  assert.doesNotMatch(src, /-\s*db:write/, 'editor must NOT hold db:write — every mutation goes through a validated endpoint');
  // and, like every operating agent, no authoring/schema caps.
  for (const forbidden of ['db:schema', 'pages:write', 'api:write', 'hooks:write']) {
    assert.doesNotMatch(src, new RegExp(forbidden), `editor: must NOT hold ${forbidden}`);
  }
});

test('every endpoint in the editor api:call allow-list resolves to a real, named api handler', () => {
  const src = readFileSync(join(APP, 'spaces', 'assistant', 'agents', 'editor', 'instruct.md'), 'utf8');
  const m = src.match(/api:call:\s*\{\s*allow:\s*\[([^\]]*)\]/);
  assert.ok(m, 'could not find the api:call allow-list');
  const allow = m[1].split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(allow.length >= 10, `expected a substantial allow-list, got ${allow.length}`);
  // Derive the real endpoint names by scanning every api/**/{GET,POST,PATCH,DELETE}.ts for its
  // `export const name` (the identifier `apiCall(name, …)` resolves against at runtime).
  const realNames = new Set();
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.ts')) {
        const nm = readFileSync(p, 'utf8').match(/export const name\s*=\s*['"]([^'"]+)['"]/);
        if (nm) realNames.add(nm[1]);
      }
    }
  };
  walk(join(APP, 'api'));
  for (const name of allow) {
    assert.ok(realNames.has(name), `allow-list names "${name}" which is not a real api endpoint`);
  }
  // The concierge must be able to do the core reversible actions through endpoints.
  for (const must of ['pinArticle', 'saveArticle', 'dismissArticle', 'followTopic', 'updateTopic', 'createCollection', 'addToCollection', 'createSubscription', 'addSource', 'requestTake']) {
    assert.ok(allow.includes(must), `editor allow-list must include ${must}`);
  }
  // Budget-heavy content generation is DELEGATED to the specialist desks, not apiCall'd directly.
  for (const delegated of ['requestBriefing', 'requestResearch', 'buildDigest']) {
    assert.ok(!allow.includes(delegated), `${delegated} should be delegated to a specialist desk, not in the editor's apiCall allow-list`);
  }
});

test('editor instruct prefers apiCall for actions and delegate for content generation', () => {
  const src = readFileSync(join(APP, 'spaces', 'assistant', 'agents', 'editor', 'instruct.md'), 'utf8');
  assert.match(src, /apiCall\(\s*['"]pinArticle['"]/, 'must show pin via apiCall');
  assert.match(src, /apiCall\(\s*['"]dismissArticle['"]/, 'must show dismiss via apiCall');
  assert.match(src, /apiCall\(\s*['"]requestTake['"]/, 'must show take via apiCall');
  assert.match(src, /delegate\(\s*['"]research\/analyst#brief['"]/, 'must delegate briefings');
  // No raw db mutation verbs — the editor never writes directly.
  assert.doesNotMatch(src, /db\.(insert|update|remove)\(/, 'editor must not perform raw db writes');
});
