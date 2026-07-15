# 06-tanzania — round 8 report

## Verdict

**Step 2 failed and remains unverified after two fresh verification replays.**

The initial clean replay reached Step 1 successfully, then `replay-1/step-02.json` created only two specialist spaces:

```json
["Ngorongoro Crater Advisor", "Stone Town Guide"]
```

The Cairo and Dar es Salaam scopes required by the scenario were missing. This violates the first Step 2 expectation before considering its other state assertions. The runner was stopped for judging at that point; later stale step artifacts under `replay-1/` were not judged or used to advance the scenario.

I retained and strengthened an **L1 prompt fix** in the uncommitted THING instruction, with the matching documentation update. A direct clean-project probe proves that the existing architect/registration primitives can create all four scopes; this is not an L2/L3 framework gap. However, neither fresh persona replay created the two missing scope specialists, so the fix is **not verified**. No changes were committed or staged.

## Failure evidence

### Initial replay — `replay-1/step-02.json`

The first full replay had a completed Step 1:

- `system-files/dispatch`, `system-files/reader`, and `system-files/sheet` read the textual/PDF/spreadsheet material.
- `system-vision/vision` examined the image.
- The final reply named material-specific details and offered to organise it.
- `state.spaces` was empty and `appManifest.built` was `false`, so no authoring occurred before the user agreed.

On the bare `Yes please.` in Step 2, THING delegated only two direct architect builds:

```text
system-architect/architect/synthesize_and_run  # Ngorongoro Crater
system-architect/architect/synthesize_and_run  # Stone Town / Zanzibar
```

It then delegated to the automator. The persisted state had only:

```json
"spaces": ["Ngorongoro Crater Advisor", "Stone Town Guide"]
```

There was no Cairo or Dar es Salaam specialist and no generic space capable of satisfying the required one-per-leg boundary. No `webSearch` or `webFetch` yield occurred, which is correct for supplied material, but it does not repair the missing scopes.

The same state also showed that this run was incomplete (`appManifest.built: false`) and did not prove the image-only camera detail, but the first failure remains the absent specialists.

## Attribution probe

I ran a fresh one-shot project with the same five attachments and an explicit request to create and register four separately owned scopes before building the tracker. It completed without interruption and returned:

```json
{
  "spaces": [
    "Cairo Trip Advisor",
    "Dar es Salaam Transit Advisor",
    "Northern Tanzania Safari & Ngorongoro",
    "Zanzibar Advisor"
  ],
  "delegates": [
    "system-architect/architect/synthesize_and_run",
    "system-architect/architect/synthesize_and_run",
    "system-architect/architect/synthesize_and_run",
    "system-architect/architect/synthesize_and_run"
  ]
}
```

The trace also contained four `registerSpace` yields. This proves that the existing architect tasklist, registration primitive, and grants can express the required outcome. The failure is the orchestrator's incomplete scope inventory from the in-persona request: **L1 prompt routing**, not a missing structural or framework primitive.

The direct probe recorded some recovered typecheck errors inside architect/automator turns, but all four registrations landed. They are not the cause of this Step 2 verdict.

## Changes

### L1 — `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md`

**Symbol/section:** THING, “When the material splits into distinct PARTS, build the spaces too”.

The existing uncommitted guidance already prohibited merging a short distinct part into a broad specialist. I strengthened that same L1 rule so THING must:

1. make a complete inventory of independently owned scopes before delegating;
2. create one specialist for each scope that has its own facts;
3. treat a broad overview/cross-cutting aggregate as additive only for facts that belong to no individual scope, never as a replacement.

**General principle:** retrieval boundaries follow independent ownership of facts, not current volume or convenience. A broad aggregate may supplement independently addressable scopes but cannot replace them.

This is domain-neutral: it contains no scenario names, fixture tokens, table names, person names, amounts, or place names. I verified with:

```sh
git -C sdk/org diff --unified=0 -- libs/core/system-spaces/user-thing/agents/thing/instruct.md \
  | grep '^+' \
  | grep -iE 'vasilis|athina|tanzania|cairo|ngorongoro|zanzibar|dar es salaam|zzjquu|emmanuel|3344|stone town|ranger|permit|itinerary'
```

which produced no matches. A manual review also confirms the added prose is scope/ownership based rather than scenario-domain framed.

### Documentation — `org/docs/system-spaces/README.md`

**Section:** §4.3 triage-path table, Path 4a.

Updated the source-of-truth system-space documentation to state that THING derives one specialist per distinct independently owned scope before it authors the live-project app. This keeps the documentation consistent with the prompt contract.

`pnpm docs:check` passed:

```text
docs-check: 118 docs, 4554 citations (1569 symbol, 2985 line)
✓ all citations resolve
```

`git diff --check` also passed.

No test was added because this is an L1 instruction-only change; the fresh scenario replays below are the required behavioral validation. No L3 code or documentation change was made.

## Verification evidence

### First fresh replay — `verify-step-02/`

This replay started with `--fresh-server --through 2`. Step 1 passed its attachment/offer/no-authoring checks. Step 2 timed out after 600 seconds:

```text
Error: turn timed out after 600000ms
```

It left partial data only: five overlapping/generic spaces, one `accommodations` table, no pages, and `appManifest.built: false`. It could not verify the L1 repair.

### Second fresh replay — `verify-step-02-rerun-2/`

After strengthening the scope-inventory wording, a second `--fresh-server --through 2` replay completed both steps. Step 1 again passed. Step 2 still delegated only three architect builds:

```text
Ngorongoro Crater & safari
Zanzibar & Stone Town
Tanzania trip logistics, contacts, and overall itinerary
```

Its resulting spaces were:

```json
[
  "Ngorongoro Safari Advisor",
  "Tanzania Trip Logistics",
  "Zanzibar & Stone Town Guide"
]
```

Cairo and Dar es Salaam remain absent; the generic logistics space still absorbs them. The state did contain seeded `itinerary`, `costs`, `contacts`, `park_fees`, `photos`, and `questions` rows, and no web search/fetch yields appeared, but that does not satisfy the missing specialist-space assertion. The app manifest also remained `built: false`, despite one authored root page.

## Why I stopped

The runbook permits approximately two to three verification attempts. The direct probe proves L1 is the correct rung, but the two fresh persona replays either timed out or reproduced the same missing-scope behavior. A third wording-only retry would not establish a new attribution fact; escalating to L2/L3 would contradict the successful direct probe. I therefore stopped with the honest unresolved Step 2 failure.

## Review state

- Product edits are intentionally uncommitted in the SDK submodule:
  - `libs/core/system-spaces/user-thing/agents/thing/instruct.md`
- Matching root documentation is intentionally uncommitted:
  - `org/docs/system-spaces/README.md`
- Round evidence and this report are under:
  - `automation/instances/scenario-campaign/rounds/8/06-tanzania/`
- No `git add`, `git commit`, `git stash`, branch switch, or destructive cleanup was performed.
- The working tree contains unrelated concurrent modifications and older round artifacts; they were left untouched.
