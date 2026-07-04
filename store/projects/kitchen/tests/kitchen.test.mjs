/**
 * Self-contained tests for the `kitchen` project-application.
 *
 * Runs dependency-free with Node's built-in runner:
 *   node --test store/projects/kitchen/tests/
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
const APP = join(HERE, '..'); // store/projects/kitchen
const REPO = join(APP, '..', '..', '..'); // monorepo root
const CORE = join(REPO, 'sdk', 'org', 'libs', 'core', 'dist', 'index.js');

// ── Schemas — real engine validation ────────────────────────────────────────
const EXPECTED_TABLES = [
  'ingredients',
  'meal_plans',
  'plan_meals',
  'recipe_ingredients',
  'recipes',
  'shopping_list',
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

// ── API handlers — the 14 named, typed endpoints ────────────────────────────
const EXPECTED_ENDPOINTS = [
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
];

test('all 14 api handlers exist and export name / Input / Output / default handler', () => {
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

test('generatePlan spawns the planner fire-and-forget', () => {
  const src = readFileSync(join(APP, 'api', 'plan', 'POST.ts'), 'utf8');
  assert.match(src, /ctx\.spawn\(/, 'generatePlan must spawn the planner');
  assert.match(src, /chef\/planner#plan/, 'generatePlan must target chef/planner#plan');
});

test('shoppingList computes the diff over include-d relations', () => {
  const src = readFileSync(join(APP, 'api', 'plan', '[id]', 'shopping', 'GET.ts'), 'utf8');
  assert.match(src, /include/, 'shoppingList must use include to join the plan graph');
});

test('toggleBought tops up the pantry when a row is marked bought', () => {
  const src = readFileSync(join(APP, 'api', 'shopping', '[id]', 'PATCH.ts'), 'utf8');
  assert.match(src, /ingredients/, 'toggleBought must write back to ingredients (pantry top-up)');
});

// ── Hooks — cron + database:insert loop ─────────────────────────────────────
test('plan-week is a cron hook that triggers the planner', () => {
  const src = readFileSync(join(APP, 'hooks', 'plan-week.ts'), 'utf8');
  assert.match(src, /type:\s*['"]cron['"]/);
  assert.match(src, /chef\/planner#plan/);
});

test('recompute-shopping is a database:insert hook on plan_meals that delegates the shopper', () => {
  const src = readFileSync(join(APP, 'hooks', 'recompute-shopping.ts'), 'utf8');
  assert.match(src, /type:\s*['"]database['"]/);
  assert.match(src, /table:\s*['"]plan_meals['"]/);
  assert.match(src, /event:\s*['"]insert['"]/);
  assert.match(src, /delegate\(\s*['"]chef\/shopper['"]/, 'must delegate to the shopper');
});

// ── chef agents — least-privilege capabilities ──────────────────────────────
test('chef has 3 agents, each least-privilege with no forbidden authoring caps', () => {
  const agentsDir = join(APP, 'spaces', 'chef', 'agents');
  const agents = readdirSync(agentsDir);
  assert.deepEqual(agents.sort(), ['pantry-keeper', 'planner', 'shopper']);
  for (const a of agents) {
    const src = readFileSync(join(agentsDir, a, 'instruct.md'), 'utf8');
    assert.match(src, /capabilities:/, `${a}: must declare capabilities`);
    // The chef OPERATES the app; it must not carry authoring/schema caps.
    for (const forbidden of ['db:schema', 'pages:write', 'api:write', 'hooks:write']) {
      assert.doesNotMatch(src, new RegExp(forbidden), `${a}: must NOT hold ${forbidden}`);
    }
  }
});

test('per-verb table scope: planner writes only meal_plans/plan_meals, shopper only shopping_list', () => {
  const agentsDir = join(APP, 'spaces', 'chef', 'agents');
  const planner = readFileSync(join(agentsDir, 'planner', 'instruct.md'), 'utf8');
  assert.match(planner, /db:write:\s*\{\s*tables:\s*\[meal_plans,\s*plan_meals\]/);
  const shopper = readFileSync(join(agentsDir, 'shopper', 'instruct.md'), 'utf8');
  assert.match(shopper, /db:write:\s*\{\s*tables:\s*\[shopping_list\]/);
  const keeper = readFileSync(join(agentsDir, 'pantry-keeper', 'instruct.md'), 'utf8');
  assert.match(keeper, /db:write:\s*\{\s*tables:\s*\[ingredients\]/);
});
