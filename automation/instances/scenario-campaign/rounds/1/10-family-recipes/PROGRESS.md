# PROGRESS — scenario-campaign · task `10-family-recipes` · round 1

_Started 2026-07-14T07:25:23.012Z. The agent MUST update this file at every step._

## Steps

- **Orient.** Read `scenario.md` (fully authored, 6 sections + 12 Acts + Edges). `run.mjs` does NOT
  exist → round-1 job is to implement it 1:1 from the Acts table. Harness read end-to-end.
- **Fixture audit (before writing a single assertion).** Verified every fixture is real: `recipe.pdf`
  extracts selectable text (Easy Lasagna / Cooking with Extension Cookbook pg. 22 / 12 oz. cottage
  cheese / slow cooker Low ~6 hours); `pantry-and-plan.xlsx` is a real 3-sheet workbook
  (Pantry/MealPlan/ShoppingList, inline-string cells, 20 PNT rows + 2 weeks of plan + a merged
  shopping list); `voice-memo.mp3` is real MPEG audio (24 kHz mono, ~36 s); both jpgs are real photos
  (viewed them: the card IS a handwritten "Orange Cake" w/ crisco + 1 cup raisins + Angel food cake
  tin + 400° for 40 min; the dish photo IS a moussaka slice + Greek salad + bulgur/tabbouleh + chopped
  parsley); all 3 `links.md` URLs return **200**.
- **Found a spec↔fixture contradiction (Act II).** `scenario.md` asserts `Σπανακόπιτα`/`Spanakopita`
  occurs in **no** fixture but the audio, and lists `750`/`320` as audio-unique. **All three are false
  against the committed workbook**: the MealPlan sheet schedules `Σπανακόπιτα`/`Spanakopita` on
  Saturday, and the ShoppingList sheet carries `Σπανάκι 750 g` + `Φέτα ΠΟΠ 320 g`. Ran a disjointness
  grep across all fixtures. The genuinely audio-only tokens are: **μαστίχα · τσίπουρο · Δέσποινα ·
  Λευκάδα · πράσο · άνηθο · "αυγό στη γέμιση"** (and `190`/`55`, which appear nowhere at all — the
  memo says them in words). Corrected Act II + the §8 fixtures table to assert on those instead: the
  dish *name* proves nothing (it's in the spreadsheet), the **recipe** is what only the ear can hear.
  This makes the Act *stronger*, not looser — a token that also sits in the xlsx made the audio
  assertion worthless.

- **Baseline run #1 (11:54, Act I only) → FAIL, 21/26.** Four real failures, all triaged against the
  trace + the live pod's on-disk project:
  1. **THING AUTHORED during the ingest turn.** Turn 1 delegated to `system-architect/.../
     synthesize_and_run` twice — it built the two cuisine spaces *before* Vasilis ever said yes. That
     breaks US-1 (the offer turn must author nothing) and is why turn 1 took **951 s** against a 5-min
     ceiling.
  2. **The offer assertion failed** — with the build already done, the reply reported rather than asked.
  3. **The app was EMPTY — the anti-expectation itself.** 4 tables (meal_plan/pantry/recipes/
     shopping_list) with real rows, and **zero pages, zero api routes** on disk (`pages/` holds only
     `_layout.tsx`). `built:true` + `routes:0`; `/app/family-recipes/` served a 479-byte shell. Data in
     a drawer.
  4. **6 unrecovered typecheck errors** (e.g. `Variable 'functions' implicitly has an 'any[]' type` in
     the architect).
- **Triage verdict: 1–3 were fixed by SIBLING lanes after my run started; do not re-fix.** My run
  (11:54) predates `2d145c2` (14:35, user-thing: *"GATE — before ANY authoring delegate, did they
  ASK?"* — exactly failures 1+2) and `3ceb32c` (14:51, system-appbuilder: *"the empty-app failure —
  make the app OPENABLE EARLY"* — failure 3). Checked `f4cb7ae` (uploads: scanned PDF → vision) for a
  conflict with **Act III**: none — `readDocument` *still* returns `{ok:false, kind:'unsupported',
  error:/system-vision/}` for an image (`libs/cli/src/server/uploads.ts`, asserted in
  `uploads.test.ts:342`), so Act III's guard assertion stands.
- **Next: rebuild + restart + re-run Act I on a WIPED project** (Act I asserts "no spaces exist
  before the dump", so it needs a virgin `family-recipes`) to see which failures survive the siblings'
  fixes and which are mine to own.

## Files added to context

- `sdk/org/scenarios/10-family-recipes/scenario.md` — the spec I must implement 1:1.
- `sdk/org/scenarios/10-family-recipes/run.mjs` — the runner a previous attempt of THIS round wrote
  (978 lines, Acts I–XII + Edges); confirmed 1:1 with the Acts table.
- `sdk/org/scenarios/10-family-recipes/results/report.md` — the failing baseline I am triaging.
- `sdk/org/scenarios/harness/probe-automator-pages.mjs` — a sibling lane's minimal repro of the
  empty-app bug (automator returns tables, zero pages); the evidence it was already owned + fixed.
- `git show 2d145c2 / 3ceb32c / f4cb7ae` — the three sibling commits that land between my baseline run
  and now; the first two fix three of my four failures.
- `libs/cli/src/server/uploads.ts` + `uploads.test.ts` — the `readDocument` image guard Act III asserts.
- `sdk/org/scenarios/harness/lib/{pod,thing,report}.mjs` + `provision.mjs` — the harness API (Pod
  routes, ThingSession turn/trace projection, Report).
- `sdk/org/scenarios/09-home-renovation/run.mjs` — the most recent complete runner; the model for the
  hardening patterns (checkpoint/resume, keepalive, resilient send, scripted onAsk, unrec()).
- `sdk/org/scenarios/10-family-recipes/fixtures/*` — every fixture, inspected for real (pdftotext,
  xlsx XML dump, `file`, both images viewed, links curl'd) to ground the assertions.
</content>
