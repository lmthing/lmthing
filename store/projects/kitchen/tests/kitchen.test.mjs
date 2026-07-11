/**
 * Self-contained tests for the `kitchen` project-application (round 1 + round 2).
 *
 * Runs dependency-free with Node's built-in runner:
 *   node --test store/projects/kitchen/tests/kitchen.test.mjs
 *
 * - **Schemas** are validated with the REAL engine validator (`validateSchemaSet`
 *   from the built `@lmthing/core` in the sdk/org submodule) — the same fail-loud
 *   check the runtime loader (`libs/cli/src/app/loader.ts`) applies at boot.
 * - **API handlers / hooks / agents / spaces** are asserted structurally (the files
 *   are TS/md, not importable here without a transpile) — a green here means the
 *   contract the runtime relies on holds.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..'); // store/projects/kitchen
const REPO = join(APP, '..', '..', '..'); // monorepo root
const CORE = join(REPO, 'sdk', 'org', 'libs', 'core', 'dist', 'index.js');

// ── Schemas — real engine validation (round 1: 6 tables + round 2: 6 new = 12) ─
const EXPECTED_TABLES = [
  'ingredients',
  'meal_nutrition',
  'meal_plans',
  'nutrition_facts',
  'plan_meals',
  'recipe_ingredients',
  'recipes',
  'settings',
  'shopping_list',
  'shopping_trips',
  'substitutions',
  'suggestions',
];

test('all 12 database schemas pass the engine validateSchemaSet (fail-loud)', async () => {
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

test('the many-to-many + plan chain relations resolve to real tables', () => {
  const dbDir = join(APP, 'database');
  const load = (n) => JSON.parse(readFileSync(join(dbDir, `${n}.json`), 'utf8'));
  const ri = load('recipe_ingredients');
  assert.equal(ri.columns.recipeId.references.table, 'recipes');
  assert.equal(ri.columns.ingredientId.references.table, 'ingredients');
  assert.equal(ri.columns.recipeId.references.onDelete, 'cascade');
  assert.equal(ri.columns.ingredientId.references.onDelete, 'restrict');
  const pm = load('plan_meals');
  assert.equal(pm.columns.planId.references.table, 'meal_plans');
  assert.equal(pm.columns.recipeId.references.table, 'recipes');
  assert.equal(pm.columns.recipeId.references.onDelete, 'restrict');
});

test('round-2 tables carry their key FKs, unique constraints and new columns', () => {
  const dbDir = join(APP, 'database');
  const load = (n) => JSON.parse(readFileSync(join(dbDir, `${n}.json`), 'utf8'));
  const nf = load('nutrition_facts');
  assert.equal(nf.columns.ingredientId.references.table, 'ingredients');
  assert.equal(nf.columns.ingredientId.unique, true, 'nutrition_facts.ingredientId must be unique');
  const mn = load('meal_nutrition');
  assert.equal(mn.columns.planMealId.references.table, 'plan_meals');
  assert.equal(mn.columns.planMealId.unique, true, 'meal_nutrition.planMealId must be unique');
  const sub = load('substitutions');
  assert.equal(sub.columns.ingredientId.references.table, 'ingredients');
  const trip = load('shopping_trips');
  assert.equal(trip.columns.planId.references.table, 'meal_plans');
  const sug = load('suggestions');
  assert.equal(sug.columns.ingredientId.references.onDelete, 'setNull');
  assert.equal(sug.columns.recipeId.references.onDelete, 'setNull');
  // new columns on existing tables
  const ing = load('ingredients');
  assert.ok(ing.columns.expiresAt && ing.columns.costPerUnit, 'ingredients gains expiresAt + costPerUnit');
  const rec = load('recipes');
  assert.ok(rec.columns.cuisine, 'recipes gains cuisine');
  const pm = load('plan_meals');
  assert.ok(pm.columns.rating && pm.columns.cookedAt, 'plan_meals gains rating + cookedAt');
});

// ── API handlers — 14 round-1 + 13 round-2 = 27 named, typed endpoints ──────────
const EXPECTED_ENDPOINTS = [
  // round 1
  ['plan/GET.ts', 'currentPlan'],
  ['plan/POST.ts', 'generatePlan'],
  ['plan/[id]/shopping/GET.ts', 'shoppingList'],
  ['recipes/GET.ts', 'listRecipes'],
  ['recipes/POST.ts', 'addRecipe'],
  ['recipes/[id]/GET.ts', 'getRecipe'],
  ['meals/[id]/PATCH.ts', 'updateMeal'],
  ['meals/[id]/DELETE.ts', 'removeMeal'],
  ['pantry/GET.ts', 'listPantry'],
  ['pantry/low/GET.ts', 'lowStock'],
  ['pantry/POST.ts', 'addIngredient'],
  ['pantry/[id]/PATCH.ts', 'updatePantry'],
  ['shopping/[id]/PATCH.ts', 'toggleBought'],
  ['stats/GET.ts', 'kitchenStats'],
  // round 2
  ['settings/GET.ts', 'getSettings'],
  ['settings/PATCH.ts', 'updateSettings'],
  ['recipes/import/POST.ts', 'importRecipe'],
  ['meals/[id]/rating/PATCH.ts', 'rateMeal'],
  ['meals/[id]/cooked/POST.ts', 'markCooked'],
  ['recipes/[id]/nutrition/GET.ts', 'getRecipeNutrition'],
  ['plan/[id]/nutrition/GET.ts', 'getPlanNutrition'],
  ['pantry/expiring/GET.ts', 'listExpiring'],
  ['plan/[id]/trip/GET.ts', 'getShoppingTrip'],
  ['substitutions/[ingredientId]/GET.ts', 'listSubstitutions'],
  ['nutrition/stats/GET.ts', 'nutritionStats'],
  ['suggestions/GET.ts', 'listSuggestions'],
  ['suggestions/[id]/PATCH.ts', 'dismissSuggestion'],
];

test('all 27 api handlers exist and export name / Input / Output / default handler', () => {
  assert.equal(EXPECTED_ENDPOINTS.length, 27);
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

test('generatePlan spawns the planner; importRecipe spawns the importer', () => {
  const plan = readFileSync(join(APP, 'api', 'plan', 'POST.ts'), 'utf8');
  assert.match(plan, /ctx\.spawn\(/);
  assert.match(plan, /chef\/planner#plan/);
  const imp = readFileSync(join(APP, 'api', 'recipes', 'import', 'POST.ts'), 'utf8');
  assert.match(imp, /ctx\.spawn\(/);
  assert.match(imp, /sourcing\/importer#import/);
});

test('shoppingList + getShoppingTrip compute the diff over include-d relations', () => {
  assert.match(readFileSync(join(APP, 'api', 'plan', '[id]', 'shopping', 'GET.ts'), 'utf8'), /include/);
  assert.match(readFileSync(join(APP, 'api', 'plan', '[id]', 'trip', 'GET.ts'), 'utf8'), /include|recipe_ingredients/);
});

test('toggleBought tops up the pantry when a row is marked bought', () => {
  const src = readFileSync(join(APP, 'api', 'shopping', '[id]', 'PATCH.ts'), 'utf8');
  assert.match(src, /ingredients/);
});

test('pantry writes accept the round-2 columns (expiresAt/costPerUnit) so waste + cost features have data', () => {
  // Without these, the round-2 expiresAt/costPerUnit columns have no write path — the /expiring page,
  // use-it-up hook, and shopping-trip cost estimate would build but never have data to work on.
  const add = readFileSync(join(APP, 'api', 'pantry', 'POST.ts'), 'utf8');
  assert.match(add, /expiresAt/, 'addIngredient must accept expiresAt');
  assert.match(add, /costPerUnit/, 'addIngredient must accept costPerUnit');
  const patch = readFileSync(join(APP, 'api', 'pantry', '[id]', 'PATCH.ts'), 'utf8');
  assert.match(patch, /expiresAt/, 'updatePantry must accept expiresAt');
  assert.match(patch, /costPerUnit/, 'updatePantry must accept costPerUnit');
});

// ── Hooks — 2 round-1 + 4 round-2 = 6 ───────────────────────────────────────────
test('plan-week + recompute-shopping (round 1) are intact', () => {
  const pw = readFileSync(join(APP, 'hooks', 'plan-week.ts'), 'utf8');
  assert.match(pw, /type:\s*['"]cron['"]/);
  assert.match(pw, /chef\/planner#plan/);
  const rs = readFileSync(join(APP, 'hooks', 'recompute-shopping.ts'), 'utf8');
  assert.match(rs, /type:\s*['"]event['"]/);
  assert.match(rs, /event:\s*['"]project\/db\.plan_meals\.insert['"]/);
  assert.match(rs, /chef\/shopper/);
});

test('round-2 hooks: 2 event (nutrition) + 2 cron, on working dispatch paths', () => {
  const cn = readFileSync(join(APP, 'hooks', 'compute-nutrition.ts'), 'utf8');
  assert.match(cn, /type:\s*['"]event['"]/);
  assert.match(cn, /event:\s*['"]project\/db\.plan_meals\.insert['"]/);
  assert.match(cn, /nutrition\/nutritionist#compute/);
  const er = readFileSync(join(APP, 'hooks', 'enrich-recipe-nutrition.ts'), 'utf8');
  assert.match(er, /type:\s*['"]event['"]/);
  assert.match(er, /event:\s*['"]project\/db\.recipes\.insert['"]/);
  assert.match(er, /nutrition\/nutritionist#analyze-recipe/);
  const uu = readFileSync(join(APP, 'hooks', 'use-it-up.ts'), 'utf8');
  assert.match(uu, /type:\s*['"]cron['"]/);
  assert.match(uu, /chef\/planner#suggest-uses/);
  const ns = readFileSync(join(APP, 'hooks', 'nightly-substitutions.ts'), 'utf8');
  assert.match(ns, /type:\s*['"]cron['"]/);
  assert.match(ns, /sourcing\/optimizer#substitutions/);
});

// ── Spaces — 3 project-scoped spaces, each FULL space format ─────────────────────
const SPACES = ['chef', 'nutrition', 'sourcing'];

test('kitchen has 3 project-scoped spaces', () => {
  const dir = join(APP, 'spaces');
  assert.deepEqual(readdirSync(dir).filter((d) => statSync(join(dir, d)).isDirectory()).sort(), SPACES);
});

test('every space is FULL format (agents charter+instruct, tasklists, functions, components, knowledge)', () => {
  for (const sp of SPACES) {
    const base = join(APP, 'spaces', sp);
    for (const sub of ['agents', 'tasklists', 'functions', 'components', 'knowledge']) {
      assert.ok(existsSync(join(base, sub)), `${sp}: missing ${sub}/ (full-format requirement)`);
    }
    // agents each have BOTH charter.md and instruct.md
    for (const a of readdirSync(join(base, 'agents'))) {
      assert.ok(existsSync(join(base, 'agents', a, 'charter.md')), `${sp}/${a}: missing charter.md`);
      assert.ok(existsSync(join(base, 'agents', a, 'instruct.md')), `${sp}/${a}: missing instruct.md`);
    }
    // at least one space function and one component
    assert.ok(readdirSync(join(base, 'functions')).some((f) => f.endsWith('.ts')), `${sp}: needs ≥1 function`);
    const compRoot = existsSync(join(base, 'components', 'view')) ? join(base, 'components', 'view') : join(base, 'components');
    assert.ok(readdirSync(compRoot).some((f) => f.endsWith('.tsx')), `${sp}: needs ≥1 component`);
  }
});

test('every knowledge topic has an index.md overview + ≥2 aspect deep-dives', () => {
  for (const sp of SPACES) {
    const kroot = join(APP, 'spaces', sp, 'knowledge');
    // knowledge/<namespace>/<topic>/{index.md + ≥2 aspects}
    const topics = [];
    for (const ns of readdirSync(kroot).filter((d) => statSync(join(kroot, d)).isDirectory())) {
      for (const topic of readdirSync(join(kroot, ns)).filter((d) => statSync(join(kroot, ns, d)).isDirectory())) {
        topics.push(join(kroot, ns, topic));
      }
    }
    assert.ok(topics.length >= 1, `${sp}: needs ≥1 knowledge topic`);
    for (const t of topics) {
      const files = readdirSync(t).filter((f) => f.endsWith('.md'));
      assert.ok(files.includes('index.md'), `${t}: missing index.md overview`);
      const aspects = files.filter((f) => f !== 'index.md');
      assert.ok(aspects.length >= 2, `${t}: needs ≥2 aspect deep-dives (has ${aspects.length})`);
    }
  }
});

// ── Least-privilege capabilities across all spaces ───────────────────────────────
test('no project agent holds an authoring capability (db:schema/pages/api/hooks:write)', () => {
  for (const sp of SPACES) {
    const agentsDir = join(APP, 'spaces', sp, 'agents');
    for (const a of readdirSync(agentsDir)) {
      const src = readFileSync(join(agentsDir, a, 'instruct.md'), 'utf8');
      assert.match(src, /capabilities:/, `${sp}/${a}: must declare capabilities`);
      for (const forbidden of ['db:schema', 'pages:write', 'api:write', 'hooks:write']) {
        assert.doesNotMatch(src, new RegExp(forbidden), `${sp}/${a}: must NOT hold ${forbidden}`);
      }
    }
  }
});

test('per-verb table scope: planner (+suggestions), shopper, pantry-keeper stay in their lanes', () => {
  const agentsDir = join(APP, 'spaces', 'chef', 'agents');
  const planner = readFileSync(join(agentsDir, 'planner', 'instruct.md'), 'utf8');
  assert.match(planner, /db:write:\s*\{\s*tables:\s*\[meal_plans,\s*plan_meals,\s*suggestions\]/);
  assert.match(planner, /db:read:[^\n]*settings/, 'planner reads settings for dietary filtering');
  const shopper = readFileSync(join(agentsDir, 'shopper', 'instruct.md'), 'utf8');
  assert.match(shopper, /db:write:\s*\{\s*tables:\s*\[shopping_list\]/);
  const keeper = readFileSync(join(agentsDir, 'pantry-keeper', 'instruct.md'), 'utf8');
  assert.match(keeper, /db:write:\s*\{\s*tables:\s*\[ingredients\]/);
});

test('the concierge acts through endpoints: db:read + an api:call allowlist of REAL endpoint names, no db:write', () => {
  // The concierge (chef/concierge) reads the db directly for context but makes every change
  // through the app's own validated endpoints via apiCall — so handler logic + hook fan-out
  // stay correct. This asserts the acting front-door is wired and least-privilege.
  const src = readFileSync(join(APP, 'spaces', 'chef', 'agents', 'concierge', 'instruct.md'), 'utf8');
  assert.match(src, /db:read:/, 'concierge must read the db directly for context');
  assert.doesNotMatch(src, /db:write:/, 'concierge holds NO direct table-write power — it acts through apiCall');

  // Every name in the api:call allowlist must be a real endpoint (export const name = '...').
  const m = src.match(/api:call:\s*\{\s*allow:\s*\[([^\]]*)\]/);
  assert.ok(m, 'concierge must declare api:call: { allow: [...] }');
  const allow = m[1].split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(allow.length >= 20, `concierge allowlist looks too small (${allow.length})`);

  // Collect the real endpoint names the runtime exposes.
  const apiDir = join(APP, 'api');
  const names = new Set();
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (e.endsWith('.ts')) {
        const nm = readFileSync(p, 'utf8').match(/export const name = ['"]([^'"]+)['"]/);
        if (nm) names.add(nm[1]);
      }
    }
  };
  walk(apiDir);
  for (const a of allow) {
    assert.ok(names.has(a), `concierge api:call allowlists '${a}', which is not a real endpoint name`);
  }
  // The spawn-backed action-through-endpoint names the concierge relies on must be allowlisted.
  for (const needed of ['generatePlan', 'importRecipe', 'importRecipeText', 'updateSettings', 'orderGroceries']) {
    assert.ok(allow.includes(needed), `concierge allowlist must include '${needed}'`);
  }
});

test('spawn flows are real (not stubs): importer instruct no longer claims spawn is a no-op', () => {
  // Both api spawn callers must invoke the now-real ctx.spawn, and the importer instruct must not
  // still tell the agent spawn does nothing (which would make it skip finishing the stub).
  const paste = readFileSync(join(APP, 'api', 'recipes', 'paste', 'POST.ts'), 'utf8');
  assert.match(paste, /ctx\.spawn\(/);
  assert.match(paste, /sourcing\/importer#paste/);
  const imp = readFileSync(join(APP, 'spaces', 'sourcing', 'agents', 'importer', 'instruct.md'), 'utf8');
  assert.doesNotMatch(imp, /no-op/i, 'importer instruct must not describe spawn as a no-op anymore');
  assert.doesNotMatch(imp, /spawn does not actually invoke agents/i, 'stale spawn-is-a-stub prose must be gone');
});

test('the importer reaches the web via its task-level functions allowlist, not agent frontmatter', () => {
  // Engine truth: webFetch/webSearch/fetch are UNIVERSAL system globals. Listing them in an
  // agent's `functions:` frontmatter makes the space loader fail-loud ("not found in functions/"),
  // because agent `functions:` is validated against real files in functions/. They belong in a
  // TASK-level functions allowlist (which restricts the otherwise-locked-down task capability set).
  const imp = readFileSync(join(APP, 'spaces', 'sourcing', 'agents', 'importer', 'instruct.md'), 'utf8');
  assert.match(imp, /functions:/);
  assert.match(imp, /webFetch/, 'importer instruct must describe using webFetch');
  const fetchTask = readFileSync(
    join(APP, 'spaces', 'sourcing', 'tasklists', 'import', '01-fetch_page.md'),
    'utf8',
  );
  assert.match(fetchTask, /functions:\s*\[[^\]]*webFetch/, 'the fetch task must allowlist webFetch');
});

test('no agent-level functions: frontmatter lists a system global (fail-loud loader trap)', () => {
  // Regression: a system global (webFetch/webSearch/fetch) in an agent `functions:` block throws
  // at space load. Every agent `functions:` entry must resolve to a file in that space's functions/.
  const SYSTEM_GLOBALS = ['webFetch', 'webSearch', 'fetch'];
  for (const sp of SPACES) {
    const fnDir = join(APP, 'spaces', sp, 'functions');
    const files = existsSync(fnDir)
      ? new Set(readdirSync(fnDir).filter((f) => f.endsWith('.ts')).map((f) => f.slice(0, -3)))
      : new Set();
    const agentsDir = join(APP, 'spaces', sp, 'agents');
    for (const a of readdirSync(agentsDir)) {
      const src = readFileSync(join(agentsDir, a, 'instruct.md'), 'utf8');
      const m = src.match(/\nfunctions:\n((?:\s*-\s*\S+\n)+)/);
      if (!m) continue;
      const listed = [...m[1].matchAll(/-\s*(\S+)/g)].map((x) => x[1]);
      for (const fn of listed) {
        assert.ok(!SYSTEM_GLOBALS.includes(fn), `${sp}/${a}: '${fn}' is a system global — remove it from agent functions:`);
        assert.ok(files.has(fn), `${sp}/${a}: functions: '${fn}' has no file in ${sp}/functions/`);
      }
    }
  }
});
