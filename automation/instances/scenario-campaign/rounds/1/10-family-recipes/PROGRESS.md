# PROGRESS — scenario-campaign · task `10-family-recipes` · round 1

_Started 2026-07-13T09:34:01.809Z. The agent MUST update this file at every step._

## Steps

- **Orient.** Read `scenario.md` (fully authored: persona, flow, contract, choreography, 11 user
  stories, Acts I–VII + Edges) — but **no `run.mjs` existed**, so round 1 = scaffold the runner from
  the 09 sibling + harness, reach a green baseline, then add the first new Acts.
- **Inspected the fixtures for real content** (assertions must be grounded): `recipe-card.jpg` is a
  real photo of a **handwritten cursive "Orange Cake" card** (English, NOT Greek — the spec claimed
  Greek OCR); `recipe.pdf` is a real printable **"Easy Lasagna"**; `recipes.md` carries the Greek
  seed tokens; **there is no voice-memo fixture** → the audio beat cannot be honestly asserted.
- **Wrote `run.mjs`** (Acts I–VII from the table 1:1 + Edges), keeping every hardening pattern from
  the campaign spec: per-Act checkpoint + `--acts=`, keepalive pinger, resilient send (cold-wake /
  session-lost / error-state), scripted `onAsk`, signed-inbound helper, live-app assertions. Greek
  matching is stem+NFC-normalized so declined forms still count.
- **Added the FIRST batch of NEW Acts (3)** from the feature catalog — capabilities scenario 10 did
  not cover — extending the same persona naturally:
  - **Act VIII — Remember me** (`user-memory`): a "remember forever" household rule (half mint; Nikos
    eats aubergines roasted, never fried) → asserts the memory route + **recall in a later unrelated
    cooking turn**.
  - **Act IX — Consent DENIED** (the half of consent that must fail closed): he asks for
    `integration-telegram`, then **denies** the card → asserts the space is **absent from disk**, the
    other spaces survive, and THING says it did not install it.
  - **Act X — Engineer-authored code** (`system-engineer`): "400γρ αρακά" vs "1 φλιτζάνι αρακά" count
    as different things → a unit-aware merge helper must land as a **REAL file** in the project; the
    app still compiles and the list still de-duplicates (no regression).
- **Updated `scenario.md` 1:1** with the runner: new flow steps 11–13, expectations 11–13, US-12/13/14,
  Acts VIII–X in the Acts table, feature checklist ticks, perf targets — and **corrected the fixture
  claims honestly** (the card is English, not Greek; audio is NOT exercised, no fixture).
  Also split the channel-ping assertion out of Act IV into Act VI, where the integration actually
  exists (no connection is installed at Act IV — asserting a ping there would have been a lie).

## Files added to context

- `sdk/org/scenarios/10-family-recipes/scenario.md` — the spec being implemented + extended.
- `sdk/org/scenarios/10-family-recipes/fixtures/{recipes.md,recipe-card.jpg,recipe.pdf}` — to ground
  the ingest assertions in what the files ACTUALLY contain (card = "Orange Cake"; pdf = "Easy Lasagna").
- `sdk/org/scenarios/09-home-renovation/run.mjs` — the closest sibling runner; the source of the
  hardening patterns (checkpoint/resume, resilient send, keepalive, scripted asks, signed inbound).
- `sdk/org/scenarios/harness/lib/{pod,thing,report}.mjs`, `harness/provision.mjs` — the harness API
  (what can be asserted: `appManifest/appData/appBuild/listSpaces/fsTree/inbound/runHook`, the trace).
- `sdk/org/scenarios/09-home-renovation/results/report.md` — what a passing sibling run looks like.
- `sdk/org/libs/cli/src/server/routes/app-admin.ts` — the real app-manifest shape
  (`{tables,pages,endpoints,hooks,build}` — there is no `functions` key, so Act X asserts on the fs tree).
- `store/spaces/` listing — to pick a real, uninstalled store space for the Act IX denial branch.

## Attempt 2 (resumed after attempt-1 was cut off mid-verification)

- **Re-oriented on the interrupted attempt.** Attempt 1 authored `scenario.md` + `run.mjs` (Acts I–X),
  ran them live, found + fixed **three real product bugs**, pushed them to `sdk/org`, and was killed
  while re-verifying Act IV. Established what actually landed:
  - `fd0b618 fix(cli)` — a hook authored **after** the db booted never joined the live dispatch set
    (Act III's mid-life `db` hook could never fire).
  - `acbc23b fix(automator)` — the automator gated cron handlers on the **wall clock** instead of
    declaring a cadence (Act IV's Sunday planner only worked if it happened to be Sunday).
  - `bdc0597 fix(thing)` — THING recalled memories **after** answering, i.e. never (Act VIII recall).
  - Plus `9eebe4d feat(app)` — the always-available in-app THING dock (the A1 feature).
  - All four are ancestors of sdk `09ca0ed`, which is what parent `ce62339` points at ⇒ the image
    **`compute:ce62339` already carries every fix**. Parent pointer is stale only by `f4ef5aa`
    (another lane's report doc).
- **Identified the real remaining gap:** `run.mjs` has **no A1/A2 Act** — nothing drives the in-app
  chat, nothing opens the app in a browser. The app contract is mandatory, so that is this attempt's
  main build, on top of a clean full-scenario re-run on `compute:ce62339`.

## Files added to context (attempt 2)

- `sdk/org/scenarios/10-family-recipes/results/{checkpoint.json,report.md}` — where attempt 1 stopped.
- `automation/.../10-family-recipes/attempt-1/output.log` — the interrupted attempt's own narrative
  (which fixes it verified live before dying).
- git history of `sdk/org` — to prove the three fixes + the dock are inside `compute:ce62339`.

### Live run (attempt 2) — user v3 on `compute:ce62339`, then v4 on the fixed images

- **Added Act XI** (the mandatory app contract: A1 in-app THING dock + a real change landing from
  inside the app; A2a the app's OWN api routes; A2b browser render) to `scenario.md` + `run.mjs`.
  Committed `05a6d09` before running anything.
- **Ran Acts I–X live on a fresh prod user (v3).** I ✅29/29 (all six fixtures — incl. the Greek
  memo → a `Σπανακόπιτα` row that exists in no uploaded text, and the .xlsx tokens) · II ✅ ·
  III ✅(weakly) · IV ✅ (the headline: cron declared `every:'7d'`, merged shopping list,
  `MERGE-PEAS-400: 2 συνταγές` in one line) · V ✅ · VI ✅ (consent, signed inbound 200 / bad-sig 401,
  `callConnection`) · VII ❌→✅ · VIII–X ✅15/15. This re-verified attempt 1's three fixes live on a
  FRESH project (mid-life hook fires; cron cadence declared; memory recalled).
- **PRODUCT BUG #1 (found by inspecting Act III's row, which my own assertion was too weak to catch).**
  The intake hook wrote `{title, cuisine, ingredients}` into a `recipes` table whose pages render
  `title_gr`/`cuisine_id`, and `writeProjectTable` had SUBSTITUTED the declaration — so
  `database/recipes.json` came back with 9 columns describing a table the runtime does not have
  (reconcile only ADDs columns; all 11 recipes still sat in title_gr/… physically). The book's real
  content became unaddressable and the submitted recipe rendered as a blank card.
  → **Fix `9b50518`**: `writeProjectTable` MERGES a redefinition of an existing table (union; a column
  can never be silently un-declared) + automator's table-level no-clobber rule + Act III now asserts
  the row is RENDERABLE and that no column was un-declared. Shipped as `compute:993b56a`.
- **ASSERTION BUGS (mine, fixed stronger, `1ec07c5`)**: Act VII drove the moussaka bake time 45→40 — a
  correction the mother's VOICE MEMO already makes at ingest, so THING correctly no-op'd and the Act
  failed the product for being right; and its landed-check OR'd a whole-db blob regex that matched a
  DIFFERENT recipe already serving 6. Now: mutate `servings` (a field no fixture touches), assert the
  MOUSSAKA row's column. Verified live: `"10" → "6"`. Act VII ✅4/4.
- **A flake, recorded not "fixed":** one Act VII run left the row unwritten. Re-probed 3× (fresh
  session ×2, the same long resumed session ×1) — it wrote the row every time. Not reproducible ⇒
  recorded honestly, no speculative fix.
- **Verified fix #1 live on a FRESH project (v4, `compute:993b56a`)**: Act I ✅29/29;
  Act III now reports "14 columns declared, all seed columns present" — the book's columns SURVIVE a
  mid-life feature. (On the old image they were wiped.)
- **PRODUCT BUG #2 (revealed once #1 stopped hiding it).** The intake hook now wrote `title_gr`/
  `cuisine_id` correctly (the instruct fix working) but still invented `ingredients`/`instructions`/
  `source`/`intake_id` where the table has `ingredients_text`/`instructions_text`/`source_summary`/
  `notes`. SQLite threw `table recipes has no column named ingredients`, the hook's own catch marked
  the submission `failed`, and the recipe filed through the app's form **never appeared** — no 500, no
  error, just an evaporated submission.
  → **Fix `9a69674`**: `writeProjectHook`/`writeProjectApi` now REJECT source whose `db.insert`/
  `db.update` names a column the table does not have, quoting the table's real columns + a near-miss
  guess, so the agent re-authors (the same gate `writeProjectPage` already uses). Conservative:
  literal table + literal keys, skips spreads, silent for unknown tables. 6 new tests incl. the exact
  live failure; 293 app tests green. Pushed → parent `03bc1882` → `compute:03bc188`.

## Files added to context (attempt 2, cont.)

- `sdk/org/libs/cli/src/app/authoring/globals.ts` — `writeProjectTable`/`writeProjectHook`/
  `writeProjectApi`: where both product fixes live.
- `sdk/org/libs/cli/src/app/store.ts` (`insertOne`) — proved the insert builds `INSERT INTO (cols)`
  verbatim ⇒ an unknown column is a hard SQLite throw, not a silent drop.
- `sdk/org/libs/core/src/db/validate.ts` — the legal column types + why my first test fixture was
  rejected (`description` is required).
- `sdk/org/libs/core/system-spaces/system-appbuilder/agents/automator/instruct.md` — the page
  no-clobber rule, the model for the new table-level rule.
- the live pod's own authored files (`hooks/recipe-intake-normalizer.ts`, `database/recipes.json`,
  `pages/book.tsx`) — the evidence that the book renders `title_gr` while the hook wrote `title`.
