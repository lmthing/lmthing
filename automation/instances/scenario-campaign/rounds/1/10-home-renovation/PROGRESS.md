# PROGRESS — scenario-campaign · task `10-home-renovation` · round 1

_Started 2026-07-13T04:36:24.819Z. The agent MUST update this file at every step._

## Steps

<!-- append one bullet per step: what you did -->

## Files added to context

<!-- append every file you had to read / add to your context, with why -->

### 2026-07-13 (opus resume) — orientation

- **Naming:** campaign labels this instance `10-home-renovation`, but the repo's home-renovation
  scenario lives at `sdk/org/scenarios/09-home-renovation` (the `10-` slot is `10-family-recipes`).
  Working on `09-home-renovation` (the real home-renovation scenario). Decision recorded.
- Read `09-home-renovation/scenario.md` — fully authored (6 sections + Acts I–VIII + Edges), NO run.mjs
  yet → genuine round 1 (build the runner).
- Read harness libs (pod/thing/report/provision) + `08-small-shop/run.mjs` (gold reference, just
  completed round 1). 09 is a near-perfect structural twin of 08 (same evolving-lifecycle template);
  Acts I–VIII+Edges map 1:1. Plan: adapt 08 runner to renovation domain + add NEW Acts IX (memory),
  X (event storm), XI (restart→auto-resume) — all marked uncovered in 09's feature matrix.
- Read `fixtures/reno-dump.md` → FILE_FACTS (Q-2207-KITCH, Hansson Tiling, Demetriou Plumbing,
  Voutos Cabinetry, €11,400, 2026-09-30, Voutos/Stefanos €4,450, BEAM-2026 later token).

## Files added to context

- sdk/org/scenarios/09-home-renovation/scenario.md — the spec (6 sections + Acts I–VIII + Edges)
- sdk/org/scenarios/harness/lib/{pod,thing,report}.mjs, provision.mjs — harness API
- sdk/org/scenarios/08-small-shop/run.mjs — gold-reference runner (structural twin)
- sdk/org/scenarios/09-home-renovation/fixtures/reno-dump.md — the seed dump (FILE_FACTS)
