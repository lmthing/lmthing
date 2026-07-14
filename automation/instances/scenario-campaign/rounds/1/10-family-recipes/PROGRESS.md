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

## Files added to context

- `sdk/org/scenarios/10-family-recipes/scenario.md` — the spec I must implement 1:1.
- `sdk/org/scenarios/harness/lib/{pod,thing,report}.mjs` + `provision.mjs` — the harness API (Pod
  routes, ThingSession turn/trace projection, Report).
- `sdk/org/scenarios/09-home-renovation/run.mjs` — the most recent complete runner; the model for the
  hardening patterns (checkpoint/resume, keepalive, resilient send, scripted onAsk, unrec()).
- `sdk/org/scenarios/10-family-recipes/fixtures/*` — every fixture, inspected for real (pdftotext,
  xlsx XML dump, `file`, both images viewed, links curl'd) to ground the assertions.
</content>
