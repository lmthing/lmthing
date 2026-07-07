# lmthing.kitchen — Product Ideas & Proposal

An implementation-informing proposal for evolving the **kitchen** project-application. Every
proposal below is grounded in what the app actually is today and constrained to what the pod
runtime can actually do (client-side React pages via `@app/runtime`; Node worker-isolated `api/`
handlers with `db`/`spawn`/`apiCall`; `cron`/`database` `hooks/`; capability-gated agents in the
QuickJS sandbox with `webSearch`/`webFetch`; `<Chat agent="…" />` widgets; Azure/lmthing.cloud
model tiers XS/S/M/L + reasoning variants). Design tokens are mandatory; icons are inline SVG.

Proposals are prioritized **Now (P0)** / **Next (P1)** / **Later (P2)**. A consolidated roadmap is
at the end.

---

## 0. What the kitchen app is today (the ground truth)

**12 tables.** `settings` (single household row), `ingredients` (pantry stock + cost + expiry),
`nutrition_facts` (per-ingredient estimate), `recipes` + `recipe_ingredients` (the M:N join),
`meal_plans` → `plan_meals` (the week grid) → `meal_nutrition` (per-slot totals), `shopping_list`
(the gap diff) → `shopping_trips` (aisle-grouped, cost-estimated), `substitutions`, and
`suggestions` (the proactive card feed).

**11 route pages** behind an 8-tab top nav (`This Week`, `Recipes`, `Pantry`, `Shopping`,
`Nutrition`, `Expiring`, `Import`, `Preferences`):
- `/` (`index.tsx`) — Suggestions strip + `StatsStrip` + `WeekGrid`, with `generatePlan` and a
  4s poll while `status === 'planning'`.
- `/recipes` + `/recipes/[id]` — the recipe box and detail (with `getRecipeNutrition`).
- `/pantry` — stock editor + inline `<Chat agent="chef/pantry-keeper" />`.
- `/shopping` — the current plan's shopping list with `toggleBought`.
- `/nutrition` — `getPlanNutrition` + `nutritionStats` dashboard.
- `/expiring` — `listExpiring` + suggestions.
- `/import` — URL import + `<Chat agent="sourcing/importer" />`.
- `/preferences` — settings form + `<Chat agent="nutrition/coach" />`.
- `/plan/[planId]` and `/trip/[planId]` — a specific week and its `<Chat agent="sourcing/optimizer" />`.

**27 endpoints**, e.g. `currentPlan`, `generatePlan`, `kitchenStats`, `listRecipes`, `addRecipe`,
`importRecipe`, `getRecipe(+Nutrition)`, `updateMeal`, `removeMeal`, `rateMeal`, `markCooked`,
`listPantry`, `lowStock`, `addIngredient`, `updatePantry`, `shoppingList`, `toggleBought`,
`getShoppingTrip`, `listExpiring`, `listSubstitutions`, `getPlanNutrition`, `nutritionStats`,
`listSuggestions`, `dismissSuggestion`, `getSettings`, `updateSettings`.

**3 spaces / 7 agents:**
- `chef/` — `planner` (`plan`, `suggest-uses`), `shopper` (`recompute`), `pantry-keeper` (`chat`).
- `nutrition/` — `nutritionist` (`compute`, `analyze-recipe`), `coach` (`chat`).
- `sourcing/` — `importer` (`import`), `optimizer` (`substitutions`, `organize-trip`).

**6 hooks:** `plan-week` (cron 18:00 → `planner#plan`), `use-it-up` (cron 08:00 →
`planner#suggest-uses`), `nightly-substitutions` (cron 07:00 → `optimizer#substitutions`),
`compute-nutrition` (db insert `plan_meals` → `nutritionist#compute`), `enrich-recipe-nutrition`
(db insert `recipes` → `nutritionist#analyze-recipe`), `recompute-shopping` (db insert `plan_meals`
→ `shopper#recompute`).

**The gaps that motivate this document:** the app is a strong *back-end* (rich schema, sound
capability-scoped agents, bounded hook chains) with a *thin front-end and a fragmented AI surface*.
Four separate `<Chat>` widgets each control a slice; there is no single place to drive the whole
app conversationally. The week grid is the only "hero" screen and it is functional-but-plain. The
LLM does real work in hooks but almost nothing *interactive and streaming* in the pages. And every
piece of external data (prices, nutrition, recipes) is either estimated by the model or hand-typed.

---

## 1. Modern, well-thought UX

### 1.1 Information architecture — collapse 8 flat tabs into a task-shaped IA `P0`

Eight equal-weight tabs is a "list of database tables," not a workflow. The real kitchen loop is
**Plan → Shop → Cook → Track**. Re-group the nav into that mental model:

- **Cook** (default, `/`) — This Week grid, today's meals pulled to the top, the suggestions feed.
- **Recipes** — the box + import folded in as a header action (kill the standalone `/import` tab;
  keep the route, surface it as a `+ Import from URL` button beside `+ Add recipe`).
- **Shop** — merge `/shopping`, `/trip/:planId`, and the `substitutions` list into one screen with
  tabs (List · Trip · Swaps). These are three views of the same "what do I buy" question.
- **Insights** — merge `/nutrition` + `/expiring` (both are "how's the household doing" read-only
  dashboards). Expiring waste and macro adherence belong on one health-of-the-kitchen page.
- **Preferences** stays, but moves to a top-right avatar/gear menu, not a primary tab.

Net: 4 primary destinations (Cook / Recipes / Shop / Insights) + a settings menu. The current
`_layout.tsx` "pill" nav is fine as a pattern — just fewer, heavier pills, and on mobile a bottom
tab bar (see 1.6).

### 1.2 The "This Week" hero — the screen users see every day `P0`

`WeekGrid` today renders a flat 7×3 grid. Redesign it as the app's centerpiece:

- **"Tonight" card above the grid.** The single most-relevant slot (today's dinner) as a large card
  with the recipe hero image (`recipes.imageUrl`), prep time, a one-tap **Start cooking** →
  **Mark cooked** flow, and the slot's `meal_nutrition` macros inline. Most days the user only
  cares about one meal; make it a first-class object, not a cell in a grid.
- **The grid as a calendar, not a table.** Columns = days, rows = breakfast/lunch/dinner, but each
  filled cell shows a thumbnail, title, a cooked-checkmark, and the `RatingStars`. Empty cells are
  dashed "+ add" affordances that open the recipe picker (see 4 — the agent can fill these too).
- **Plan status as a live progress bar.** The `status === 'planning'` poll already exists; replace
  the pulsing dot with a determinate bar ("Planned 4 of 7 dinners…") driven by counting filled
  `plan_meals` vs. the target, so the 4s poll *shows progress* instead of an indefinite spinner.
- **Coverage ribbon.** Reuse `chef/functions/coverageScore.ts` — show "This week is 82% cookable
  from your pantry · 6 items to buy" with a link to Shop. This is the app's core value proposition
  and it is currently invisible on the home screen.

### 1.3 Empty / loading / error states — make them do work `P0`

Today most pages render a bare "No X yet" or "Failed to load." Every empty state is a chance to
teach or to trigger the next action:

- **First-run empty pantry / no recipes.** A guided "Stock your kitchen in 3 ways" card: *Import a
  recipe from a URL*, *Snap your groceries* (see 3.4), or *Just tell the chef what you have* (opens
  the concierge, §4). Seed a few starter recipes on install so `generatePlan` isn't dead on arrival.
- **Loading.** Replace the single `<Spinner />` with **skeleton rows** shaped like the content
  (skeleton `WeekGrid` cells, skeleton `RecipeCard`s). Perceived latency matters most on the plan
  screen where the model is actually working.
- **Errors.** The generic "Failed to load this week's plan." should carry a **Retry** button wired
  to the existing `refetch`, and — when `generatePlan.error` fires — surface the *actual* message
  the handler returns (it already threads `error.message`) plus a "the chef couldn't finish, here's
  what it managed" partial state instead of a blank grid.

### 1.4 Micro-interactions & optimistic UI `P1`

- **Optimistic `toggleBought` / `markCooked` / `rateMeal`.** These already `invalidate` queries;
  add optimistic updates so the checkbox/stars respond instantly and reconcile on settle. Checking
  a shopping item off should animate a "topped up your pantry (+500g pasta)" toast — the top-up is
  already the documented behavior, but it's silent.
- **Rating is a moment.** After `markCooked`, auto-open a compact "How was it?" rating prompt (the
  planner favors winners / avoids flops — so make the rating loop frictionless and rewarding).
- **Drag-to-reschedule** on the week grid (move Tuesday's dinner to Thursday) → `updateMeal`.

### 1.5 Visual polish `P1`

- **Recipe imagery everywhere.** `recipes.imageUrl` exists but the UI barely uses it. Cards, the
  Tonight hero, and week-grid thumbnails should all be image-forward with a token-driven gradient
  placeholder when absent.
- **A macro visual language.** `MacroBar` / `MacroBadge` exist; standardize a protein/carbs/fat
  color-token triplet (define new semantic tokens in `tokens.json`, never raw colors) and reuse it
  identically on the recipe detail, the Tonight card, and the nutrition dashboard so macros read as
  "the same thing" everywhere.
- **Suggestion cards with type-specific accents.** `suggestions.type` is `use-it-up` |
  `substitution` | `nutrition`; give each an inline-SVG icon and a token accent so the feed scans.

### 1.6 Responsive & mobile `P0`

The kitchen is a *phone-in-hand* context (cooking, shopping in-aisle). Today's `max-w-*` layouts
are desktop-first. Concrete:

- **Bottom tab bar** on `< sm` for the 4 primary destinations; sticky header collapses to a title.
- **Shopping list = a checklist optimized for one thumb**, grouped by aisle (reuse `AisleGroup`),
  big tap targets, stays awake / re-sorts bought items to the bottom.
- **Cooking mode** on the recipe detail: a full-screen, step-by-step, large-type view with
  wake-lock (`navigator.wakeLock`) and swipe-between-steps, parsed from `recipes.instructions`
  markdown. This is the single highest-value mobile screen the app doesn't have.

### 1.7 Accessibility `P1`

- Semantic landmarks (`<nav aria-label>`, one `<main>` per page — already mostly there).
- The week grid needs a real table/grid role + keyboard navigation between cells; `RatingStars`
  needs a radio-group semantics + labels; the number-input-on-blur pattern in `/pantry` needs
  visible labels, not just placeholders.
- Announce async results (plan ready, item bought) via an `aria-live` region — critical because so
  much of the app updates from background hooks the user didn't trigger.
- Respect `prefers-reduced-motion` for the pulse/progress animations.

---

## 2. Better use of LLMs

The app already uses agents well for **background** work (planning, nutrition estimation,
substitutions). The opportunity is **interactive, streaming, in-page** intelligence and
**higher-quality** background work. Model-tier guidance: **XS/S** for extraction/classification and
high-frequency hook work; **M** for conversational agents and planning; **L / reasoning** only for
genuinely hard synthesis (multi-constraint week planning, "cook from what I have" search).

### 2.1 Make recipe import genuinely smart `P0`

`importRecipe` + `sourcing/importer` fetch a URL today. Extend to the messy real world:

- **Paste-anything import.** Accept pasted free text (a photo caption, a friend's WhatsApp recipe,
  a screenshot's OCR text) not just a URL. An **XS/S extraction** call turns prose → structured
  `{title, servings, prepMinutes, ingredients:[{name, quantity, unit}], instructions}`, reusing the
  existing `sourcing/functions/parseRecipe.ts` + `matchIngredient.ts` ingredient-dedup path.
- **Ingredient normalization is an LLM job.** "2 cloves garlic," "a knob of butter," "1 tin
  tomatoes" → canonical `ingredients` rows with sane units. Do this in the importer with a strict,
  schema-constrained prompt and a `basisNote`-style confidence flag; low-confidence lines surface
  in the import preview for one-tap correction rather than being silently wrong.
- **Cost/latency:** import is user-initiated and tolerant of a few seconds — but stream the preview
  (title first, then lines) so it never feels stalled. Keep it an **agent `spawn`** (it already is)
  because it needs `webFetch` + multi-step parsing; the page polls the created recipe row.

### 2.2 "Cook from what I have" — the killer interactive feature `P0`

New endpoint + agent action: given the pantry (especially `expiringSoon` items) and `settings`
constraints, propose 3 recipes cookable *tonight* with what's on hand, ranked by (a) pantry
coverage, (b) expiry urgency, (c) taste history (`plan_meals.rating`/`cookedAt`). This is the
natural evolution of the `use-it-up` hook from a passive card into an **on-demand, streaming**
request.

- Where: an on-page action on `/` and in the concierge (§4). Implement as `chef/planner#improvise`
  (or a new lightweight agent) — it reads pantry + recipes + ratings and returns candidates; a
  **reasoning-M** tier fits because it's a real ranking-under-constraints problem.
- Streaming UX: results stream in as cards; "Add to tonight" writes a `plan_meals` row (which fans
  out to nutrition + shopping recompute automatically via existing hooks — nice reuse).

### 2.3 Weekly plan quality: constraints, variety, and *why* `P1`

- **Explainable planning.** The planner should write a short rationale per slot ("Thai green curry
  Tuesday — uses the coconut milk expiring Friday, and you rated it 5★"). Store it (add
  `plan_meals.rationale`, additive column) and surface it on hover in the grid. Trust in an
  AI-planned week comes from legibility.
- **Better variety modeling.** Feed the planner the last N weeks of `plan_meals` history so it
  avoids repeats and rotates cuisines (`rotation-and-repeats.md` knowledge already exists — wire the
  actual history in as context).
- **Leftover awareness.** Let the planner deliberately plan a cook-once-eat-twice slot (a big-batch
  recipe scaled up, then a "leftovers" slot) — a real household behavior the current per-slot model
  can't express. Requires a small schema note (`plan_meals.leftoverOf`).

### 2.4 A real nutrition/recipe knowledge grounding `P1`

The `nutritionist` estimates macros from the model's own priors today (honest, but coarse). Ground
it with a real food-data source (see 3.1 USDA FDC) so `nutrition_facts` are *retrieved-then-
reconciled* rather than guessed. The LLM's job shifts from "estimate calories of olive oil" to
"map this pantry ingredient to the best FDC match and scale to our `unit`" — a much more accurate,
cheaper (XS/S) task, with the `basisNote` recording the FDC source id.

### 2.5 Personalized, synthesized digests `P1`

A weekly **"Kitchen wrap"** hook (cron, Sunday) that synthesizes the week: meals cooked, favorites,
waste avoided (expiring items used), macro adherence vs. `settings` targets, and next week's
suggested focus. One **M-tier** summarization call over already-computed data → a single high-value
`suggestions` card or a dedicated Insights banner. This is classic LLM synthesis over structured
data — cheap, and it makes the app feel like it's paying attention.

### 2.6 Smarter substitutions, on demand `P2`

`substitutions/[ingredientId]/GET` + the nightly hook exist. Add an **inline** "out of X — what can
I use?" affordance anywhere an ingredient appears (recipe detail, shopping list), answered by a fast
XS/S call constrained by `settings` (diet/allergy/dislikes) so a swap never violates constraints.
The nightly proactive pass stays; this adds the reactive, in-context path.

### 2.7 Prompt/quality & cost discipline (cross-cutting)

- **Extraction/classification → XS/S, JSON-schema-constrained.** Import lines, ingredient
  categorization (auto-fill `ingredients.category` for aisle grouping), suggestion triage.
- **Conversation → M.** The concierge (§4) and the existing coach/keeper chats.
- **Hard synthesis/ranking → M-reasoning / L**, and only where it's user-visible and worth the
  latency (week planning, improvise, wrap-up).
- **Always ground, never fabricate** — the charters already enforce this ethos (importer:
  "grounded strictly in the page"; nutritionist: `basisNote`). Extend it: any retrieved external
  fact (price, macro) carries a provenance field so the UI can show "est." vs. "from Kroger".

---

## 3. Integrations with other services

Each integration below names the service, the exact data in/out, the tables/endpoints/hooks it
touches, the user value, and the concrete connection mechanism. Ordered by value/effort.

### 3.1 USDA FoodData Central — accurate nutrition `P0`

- **Service:** USDA FDC REST API (`api.nal.usda.gov/fdc/v1/foods/search`, free API key).
- **Data flow:** *out* — an ingredient name query; *in* — canonical food + per-100g macros
  (`Energy`, `Protein`, `Carbohydrate`, `Total lipid`).
- **Touches:** the `nutritionist` agent (or, better, a new `api/nutrition/lookup` handler it calls
  via `apiCall`), writing `nutrition_facts` scaled to each ingredient's `unit`; drives
  `getRecipeNutrition`, `getPlanNutrition`, `nutritionStats`.
- **Value:** replaces guessed macros with real ones → the whole `/nutrition` surface becomes
  trustworthy.
- **Connection:** REST poll from a Node `api/` handler (server-side, keeps the key off the client);
  the `enrich-recipe-nutrition` and `compute-nutrition` hooks already fire at exactly the right
  moments — swap their estimate step for lookup-then-reconcile. Cache by ingredient in
  `nutrition_facts` (already 1-row-per-ingredient) so each ingredient is fetched once.

### 3.2 Grocery pricing & delivery — Instacart / Kroger `P1`

- **Service:** Instacart Developer Platform (Connect / "Create Shopping List" + recipe pages API),
  or Kroger Products API (`api.kroger.com` — OAuth2 client-credentials, `/v1/products` price +
  availability by store/location).
- **Data flow:** *out* — the plan's `shopping_list` lines (name, quantity, unit); *in* — real
  per-item prices/availability, and (Instacart) a deep link that opens a pre-filled cart.
- **Touches:** `shopping_trips.estimatedCost` becomes a *real* estimate (replacing
  `ingredients.costPerUnit` guesses); a new `shopping_trips.checkoutUrl`; `optimizer#organize-trip`
  can pick the cheaper store. New endpoint `api/shopping/[id]/order` returns the deep link.
- **Value:** "Buy this week's groceries" is one tap from the Shop screen — the biggest possible
  reduction in friction between plan and pantry.
- **Connection:** Kroger via OAuth2 client-credentials from a Node `api/` handler (REST poll for
  prices when a trip is organized); Instacart via their list/cart-link API. Both server-side; no
  client secrets. Degrade gracefully to today's `costPerUnit` estimate when unconfigured.

### 3.3 Calendar sync — Google Calendar / ICS `P1`

- **Service:** Google Calendar API (OAuth) for two-way, or a generated **ICS** feed for zero-auth
  one-way subscription.
- **Data flow:** *out* — each `plan_meals` slot as an event ("Dinner: Thai green curry, 30 min
  prep, start ~18:30"); optional *in* — read busy blocks so the planner slots quicker recipes on
  busy nights (respecting `settings.maxPrepMinutes`).
- **Touches:** `plan_meals` (source); a new `api/plan/[id]/calendar.ics` handler; the `planner`
  could read a "busy" hint.
- **Value:** meals show up where people already live (their calendar); prep reminders arrive at the
  right time.
- **Connection:** ICS is a plain GET handler (cheapest, ship first). Google two-way is OAuth +
  REST from Node; a cron hook pushes updates when a plan changes.

### 3.4 Photo/receipt/barcode capture — pantry input without typing `P1`

- **Service(s):** device camera (client) + an OCR/vision path, and **Open Food Facts**
  (`world.openfoodfacts.org/api/v2/product/<barcode>` — free, no key) for barcode → product.
- **Data flow:** *out* — a barcode or a receipt/fridge photo; *in* — product name/category/unit
  (Open Food Facts) or a vision-extracted item list.
- **Touches:** `ingredients` (bulk `addIngredient`/`updatePantry`); a new `api/pantry/scan` handler;
  optionally the `pantry-keeper` agent to reconcile fuzzy matches against existing stock.
- **Value:** the #1 reason pantry apps die is manual entry. "Scan your receipt after shopping" or
  "point at the fridge" makes stock-keeping nearly free.
- **Connection:** barcode lookup is a REST poll from Node; receipt/fridge vision runs through the
  pod's LLM (vision-capable tier) as a `spawn`ed extraction that proposes rows for user confirmation
  (never silent bulk writes — see §4 safety).

### 3.5 Recipe discovery — Spoonacular / Tavily `P2`

- **Service:** Spoonacular API (recipe search by ingredients / diet), or the already-available
  **Tavily `webSearch`** for open-web recipe discovery + the existing `importer` to ingest.
- **Data flow:** *out* — pantry ingredients + `settings` diet/cuisine; *in* — recipe candidates
  (title, url, image), fed into the existing import pipeline.
- **Touches:** `recipes`/`recipe_ingredients` (via `importRecipe`); the `sourcing/importer` agent.
- **Value:** the recipe box grows itself. "Find me 5 new high-protein dinners under 30 min" →
  discovered, imported, ready to plan.
- **Connection:** Tavily `webSearch` needs no new integration (it's a runtime primitive) — do this
  first; Spoonacular (REST + key from Node) later for structured, license-clean data.

### 3.6 Notifications — email / push / messaging `P2`

- **Service:** the pod → `cloud/` gateway for transactional email, or Web Push (VAPID); optionally
  a Telegram/WhatsApp bot for two-way ("what's for dinner?" → reply from the concierge).
- **Data flow:** *out* — "your week is planned," "3 items expiring tomorrow," "start dinner in
  30 min," the weekly wrap (§2.5).
- **Touches:** driven by the existing cron hooks (`plan-week`, `use-it-up`) and a new reminder hook
  reading `plan_meals.day`; a `settings.notifyChannels` column.
- **Value:** the app reaches out at the right moment instead of waiting to be opened.
- **Connection:** email/push via a gateway endpoint (all server-side logic belongs in `cloud/` per
  repo rules — the pod hook calls the gateway); Web Push subscription stored per household.

> **Boundary note:** any external secret (FDC/Kroger/Spoonacular keys, OAuth tokens) lives in the
> pod/gateway env, never in `pages/`. All third-party calls happen in Node `api/` handlers or agents
> — never from the client — and every integration degrades to today's local behavior when
> unconfigured, so the app never hard-depends on a third party.

---

## 4. The Kitchen Concierge — one agent to drive the whole app

Today four `<Chat>` widgets each own a slice (`pantry-keeper`, `coach`, `importer`, `optimizer`).
There is no single conversational surface that can drive the *entire* app. Propose a new
**`chef/concierge`** agent + a persistent, app-wide chat dock.

### 4.1 Why a concierge (and how it complements, not duplicates, the pages)

The pages are the *system of record* — direct manipulation, always available. The concierge is the
*fast path* for intent that spans multiple pages/tables: "plan a cheap vegetarian week, we're out of
rice, and skip Thursday — we're eating out." That single sentence touches `settings`, `ingredients`,
`meal_plans`, and `plan_meals` — four screens today. The concierge orchestrates; the pages remain
the place to inspect and fine-tune. It never replaces direct manipulation; it accelerates the
cross-cutting cases and onboarding.

### 4.2 Capabilities

The concierge is deliberately **broad-read, action-via-`api:call`** rather than broad-write, so it
reuses the exact same validated endpoints the UI uses (single source of truth, no bypass of handler
logic like the shopping-list top-up or the plan→hook fan-out):

```yaml
# spaces/chef/agents/concierge/instruct.md (frontmatter sketch)
capabilities:
  - db:read: { tables: [settings, ingredients, recipes, recipe_ingredients,
                        meal_plans, plan_meals, meal_nutrition, shopping_list,
                        substitutions, suggestions] }
  - api:call: { names: [generatePlan, updateMeal, removeMeal, rateMeal, markCooked,
                        addIngredient, updatePantry, addRecipe, importRecipe,
                        toggleBought, updateSettings, shoppingList, getShoppingTrip,
                        getPlanNutrition, listExpiring, dismissSuggestion] }
canDelegateTo:
  - sourcing/importer#import
  - sourcing/optimizer#organize-trip
  - nutrition/coach#chat
```

Rationale: `api:call` over raw `db:write` means every mutation goes through the handler that
already exists — e.g. `generatePlan` correctly spawns the planner and lets the nutrition/shopping
hooks fan out, and `toggleBought` performs the pantry top-up. The concierge *reads* directly (fast
context) but *writes* through the front door. It delegates specialist multi-step jobs (web import,
trip organization, coaching) to the existing agents rather than reimplementing them.

### 4.3 What it can do — a capability map

| Intent | Action taken |
|---|---|
| "Plan next week, vegetarian, cheap" | `updateSettings` (if diet changes) → `generatePlan` → report the drafted week |
| "We finished the milk, bought 2kg flour" | `updatePantry` / `addIngredient` (or delegate to `pantry-keeper`) |
| "Swap Thursday dinner for something quick" | read `plan_meals`, pick a fast recipe → `updateMeal` |
| "What can I cook tonight?" | the §2.2 improvise flow → cards, "add to tonight" → `updateMeal` |
| "Import this recipe: <url>" | delegate `sourcing/importer#import` |
| "How's our protein this week?" | read `getPlanNutrition`/`nutritionStats`, explain (or delegate `coach`) |
| "Build my shopping trip for Kroger" | `shoppingList` → delegate `optimizer#organize-trip` |
| "What's going off soon?" | `listExpiring` → offer a use-it-up plan |

### 4.4 UX — a persistent dock, results as live UI

- **Placement.** A floating **"Ask the chef"** launcher (bottom-right on desktop, a nav entry on
  mobile) opening a dock with `<Chat agent="chef/concierge" />`. It is app-wide, unlike today's
  page-bound widgets — those can remain as focused shortcuts, or be replaced by the concierge with
  a pre-seeded prompt ("I'm on the pantry page…").
- **Rich result rendering.** The concierge should render results as the app's real components, not
  walls of text — reuse the space `components/view/` pattern already present
  (`WeekPlanCard`, `ShoppingListCard`, `SubstitutionCard`, `ImportedRecipePreview`). "Plan my week"
  streams narration then drops a `WeekPlanCard` the user can act on. This is the one place the
  descriptor renderer lives inside an app (per the runtime docs).
- **Deep links.** Every result offers "Open in Shop / Open recipe" so the conversation hands back to
  the pages for fine-tuning.
- **Streaming.** Narrate reasoning while working ("Checking your pantry… you've got 12 of 15
  staples… drafting 7 dinners…") so a multi-second orchestration feels alive.

### 4.5 Safety & confirmation (this is load-bearing)

The concierge can trigger destructive/expensive actions, so:

- **Confirm before destructive or bulk writes.** Deleting meals (`removeMeal`), regenerating a plan
  that overwrites an existing week, bulk pantry edits, or anything that spends money (ordering,
  §3.2) must render an explicit **confirm card** ("This replaces your current Mon–Sun plan — 5
  meals. Proceed?") with Confirm/Cancel, not execute silently. The agent proposes; the user commits.
- **Read-then-write, echo the diff.** Before `updateSettings`, echo the change ("Setting diet →
  vegetarian, keeping allergies: peanuts. OK?"). Before ordering, show the itemized cost.
- **Scope guard.** Because writes go through `api:call` (not raw `db:write`), the concierge
  physically *cannot* touch a table an endpoint doesn't expose — the capability model is the
  enforcement, not prose. Keep it that way; don't grant it `db:write`.
- **Undo where cheap.** For reversible actions (rate, mark cooked, toggle bought) skip confirmation
  but offer a toast-level undo.

### 4.6 Example conversation

```
User:  we've got people over saturday, plan the week but make saturday dinner impressive
       and we're vegetarian this week

Chef:  On it — switching this week to vegetarian (allergies unchanged: peanuts).
       [reads settings, pantry, ratings]
       You're well-stocked: 13 of 16 staples on hand. Drafting 7 dinners, saving something
       special for Saturday…
       → [WeekPlanCard: Mon Lentil ragù · … · Sat Mushroom Wellington ★new]
       Saturday's Wellington needs puff pastry and chestnut mushrooms you don't have —
       want me to add them to the shopping list?  [Add to list] [Not now]

User:  add them, and actually swap tuesday for something under 20 minutes

Chef:  Added 2 items to Saturday's list.
       Tuesday → 15-min chickpea shakshuka (you rated it ★★★★★ last month). Updated.
       → [Confirm card only if it were replacing an already-cooked meal]
```

### 4.7 Build notes

- New space agent `chef/agents/concierge/{charter.md,instruct.md}` with the frontmatter in 4.2;
  `defaultAction: chat`. Keep the charter tight (identity + "propose, confirm destructive"), put
  orchestration/routing in `instruct.md` (top-level only).
- No new hooks required — the concierge is interactive; it leans entirely on existing endpoints and
  agents. The only schema touch is the optional `plan_meals.rationale` (§2.3) if we want it to
  explain slots.
- Model tier **M** (conversation + light orchestration); it delegates the heavy specialist jobs.

---

## 5. Consolidated roadmap

**Now (P0) — highest value, lowest new surface area**
- IA re-group into Cook / Recipes / Shop / Insights + mobile bottom tabs (§1.1, §1.6).
- This-Week hero redesign: Tonight card, calendar grid, determinate plan progress, coverage ribbon
  (§1.2).
- Working empty/loading/error states with retry + first-run onboarding + seed recipes (§1.3).
- Paste-anything + normalized recipe import (§2.1).
- "Cook from what I have" streaming improvise flow (§2.2).
- USDA FoodData Central for real nutrition (§3.1).

**Next (P1)**
- The Kitchen Concierge agent + app-wide dock (§4) — the flagship feature.
- Optimistic UI, cooking mode + wake-lock, drag-to-reschedule, macro visual language (§1.4–1.5).
- Explainable/variety-aware planning + leftovers (§2.3), grounded nutritionist (§2.4), weekly wrap
  (§2.5).
- Grocery pricing/ordering (§3.2), calendar/ICS (§3.3), photo/barcode pantry capture (§3.4).

**Later (P2)**
- Inline on-demand substitutions everywhere (§2.6).
- Recipe discovery via Tavily/Spoonacular (§3.5).
- Notifications/reminders + optional messaging bot (§3.6).
- Full a11y pass (§1.7).

**Guiding principles**
1. *Reuse the front door* — new AI writes go through existing `api/` endpoints so handler logic and
   hook fan-out stay correct.
2. *Ground, don't guess* — retrieved facts (macros, prices) carry provenance; the model reconciles
   rather than fabricates.
3. *Propose, then commit* — destructive/expensive actions always confirm; the capability model, not
   prose, is the safety boundary.
4. *Design tokens + inline SVG only* — every new surface honors the hard token gate.
</content>
</invoke>
