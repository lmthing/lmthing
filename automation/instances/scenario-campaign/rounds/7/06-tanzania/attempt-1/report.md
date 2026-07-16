# 06-tanzania — attempt 1 report

## Verdict

**Step 2 failed.** The original replay created only three specialist spaces — `Ngorongoro Safari Specialist`, `Tanzania Trip Advisor`, and `Zanzibar Advisor` — while the scenario requires separate Cairo, safari/Ngorongoro, Zanzibar, and Dar es Salaam specialists. The full trip app/data work otherwise landed, but the missing Cairo and Dar specialists makes the step a fail.

I made an **L1 prompt fix** in `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md` and updated the matching system-spaces documentation. The direct clean-project attribution probe proves the primitive can author and register all four spaces. However, the required fresh persona replay did **not verify the fix**: both verification attempts had an interrupted first turn, and the runner then sent the bare “Yes please” into a replacement session with no preceding offer. The failure therefore remains **unverified**, not passed.

No changes were committed or staged.

## Initial failure evidence

Source replay evidence: `step-02.json` from the original attempt (the original runner evidence was subsequently replaced/removed by a concurrent round process; its captured tool output is in the session transcript).

- Delegates called `system-architect/architect/synthesize_and_run` three times only: Ngorongoro safari, Zanzibar/Stone Town, and an overall Tanzania trip.
- The resulting state listed exactly three spaces:
  ```json
  ["Ngorongoro Safari Specialist", "Tanzania Trip Advisor", "Zanzibar Advisor"]
  ```
- The "Tanzania Trip Advisor" generic catch-all absorbed Cairo and Dar es Salaam instead of creating one specialist per distinct leg.
- This was not a research failure: there were no `webSearch` or `webFetch` yields during the build.
- Recovered builder errors occurred (`Maximum call stack size exceeded` while registering a space and several typecheck slips), but the app state still contained itinerary, costs, contacts, and notes. They are metrics, not the reason for this verdict.

## Attribution probe

**Probe:** a fresh local project received the same five attachments and a direct instruction to create four specialists (Cairo, northern safari/Ngorongoro, Zanzibar, Dar es Salaam) before building the tracker.

The probe dispatched four parallel architect syntheses and registered all four:

- `cairo-stopovers`
- `northern-tanzania-safari-advisor`
- `zanzibar-advisor`
- `dar-es-salaam-advisor`

The trace shows four `system-architect/architect/synthesize_and_run` delegates and four `registerSpace` yields. It then began the app build, timing out only after the four specialist registrations had succeeded.

This establishes that the format, builder functions, registration primitive, and capabilities already express the requirement. The original persona replay made the wrong part list; the lowest valid rung is **L1**, not L2/L3.

## Changes

### L1 — `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md`

Changed the “distinct PARTS” routing rule around `instruct.md:460`.

**Before:** the rule required a complete distinct-part list, but did not explicitly rule out treating a short, distinct part as a reason to merge it into a broad overview. In the failing replay, this allowed a generic trip-wide specialist to replace two destination specialists.

**After:** the instruction states that a part with only a few facts must still be its own specialist, and that a broad overview may be additional only for facts that belong to no individual part.

**General principle:** a stable retrieval boundary is determined by distinct ownership of facts, not by how many facts are currently available. A short but separate destination/stage/client/equipment part must remain independently addressable.

The change contains no new scenario literals. The source diff contains no person name, fixture token, table name, or destination from this scenario.

### Documentation — `org/docs/system-spaces/README.md`

Updated the Path 4a row to describe the per-distinct-place/stage/topic specialist derivation before the live-project app is authored. This keeps the source-of-truth documentation aligned with the system-space prompt.

`pnpm -C /home/vasilis/LMTHING/lmthing run docs:check` passed:

```text
docs-check: 118 docs, 4554 citations (1569 symbol, 2985 line)
✓ all citations resolve
```

## Verification attempts

### `verify-step-02/`

Fresh replay through step 2 was started after the prompt change. Step 1 recorded all attachment delegates but was marked `interrupted: true`; its session was replaced before an offer could become durable in the next session. Step 2 therefore replied that it had no previous offer and built nothing.

### `verify-step-02-rerun-2/`

A second fresh replay was run after the concurrent local runner had exited. The same failure recurred:

- Step 1 recorded `system-vision/vision`, `system-files/dispatch`, `reader`, and `sheet`, but ended `interrupted: true` before its offer.
- Step 2 used a new session, delegated to `user-memory/memory`, and replied:
  > “I’m coming into this conversation partway through … I don’t have the full context of what was offered before.”
- State remained empty: no spaces, tables, pages, or app.

This is a harness/session-continuity failure that prevents assessment of the prompt change, not evidence that the L1 routing change failed. I stopped after the prescribed couple of verification attempts rather than treating an invalid replay as a pass.

## Review notes

- Product edits remain uncommitted: the THING instruction and the matching `org/docs` page.
- The repository contained unrelated concurrent changes (including `sdk/org/scenarios/07-life-admin/*` and scenario-campaign artifacts); I did not modify, stage, restore, or remove them.
- The report/artifact directory also contains the two fresh replay traces and JSON evidence under `verify-step-02/` and `verify-step-02-rerun-2/`.
