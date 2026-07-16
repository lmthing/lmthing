# 06-tanzania — round 13 report

## Verdict

**Step 2 still fails; the L2 repair did not verify.** A fresh local `--through 2` replay passed step 1 and reached the full build path, but created nine overlapping specialist spaces rather than one per independently owned leg, and left `appManifest.built` false. The runner stopped after step 2; no later scenario step was run.

## Change: organizer action-node contracts

- **Files / symbols:**
  - `sdk/org/libs/core/system-spaces/user-thing/tasklists/organize_material/01-inventory.md#prelude`
  - `sdk/org/libs/core/system-spaces/user-thing/tasklists/organize_material/02-build_specialist.md#build_specialist`
  - `sdk/org/libs/core/system-spaces/user-thing/tasklists/organize_material/03-build_app.md#build_app`
  - `sdk/org/libs/core/src/spaces/system-spaces-dag.test.ts#shipped-system-spaces-load-validate`
- **Rung:** L2 — tasklist structure/action contract, not a fourth routing-prompt rewrite.
- **Why:** the R12 ledger identified every organizer node as a sequence of independent statements that referenced variables declared in a preceding statement. The task evaluator runs those statements as separate modules, so `result`, `built`, and `app` cannot persist between them. This was a concrete structural reliability defect in the existing `organize_material` artifact.
- **General principle:** gather deterministic external inputs in a task prelude; every action node that delegates must package and resolve its result within the same executable statement. A task must not depend on a local value surviving into a separately evaluated statement.

### Before → after

Before, inventory read attachments in its instruction body and then expected a later statement to resolve them. The specialist and app nodes each delegated in one statement and used the delegate result in later statements. They could therefore surface recovered `unavailable result`-style failures and retry/re-enter.

After:

1. Inventory reads all attachments in a `prelude`, following the shipped research-task pattern. The model receives `documents` before it classifies scopes and emits one resolve statement.
2. The specialist fan-out node has one statement that awaits its architect delegate and resolves the packaged outcome inline.
3. The app node has one statement that awaits its automator delegate and resolves inline.
4. The DAG test now asserts the inventory prelude and the two self-contained action contracts.

This is intentionally domain-neutral. A grep over the edited organizer tasklist and test found no scenario literals (`Vasilis`, `Athina`, `Tanzania`, `Zanzibar`, `Cairo`, `Dar es Salaam`, `Ngorongoro`, `ZZJQUU`, `Emmanuel`, or `Stone Town`).

## Validation

- `pnpm --dir sdk/org exec vitest run libs/core/src/spaces/system-spaces-dag.test.ts` — **PASS**, 16 tests. It emitted two pre-existing automator delegation warnings.
- `pnpm --dir sdk/org --filter @lmthing/core typecheck` — **PASS**.
- `pnpm --dir sdk/org --filter @lmthing/cli... build` — **PASS**; copied the changed system spaces into CLI `dist`.
- `git -C sdk/org diff --check` — **PASS**.

## Replay evidence

Artifact directory: `automation/instances/scenario-campaign/rounds/13/06-tanzania/verify-step-02/`.

### Step 1 — pass

`step-01.json` shows vision and file-reader/sheet delegates, no created spaces (`spaceCount: 0`), no tables, and `appManifest.built: false`. The reply offered to organize the supplied material without authoring it. The one recovered parse/typecheck error did not prevent the five attachment modalities from being read or the offer from landing.

### Step 2 — fail

`step-02.json` shows the organizer tasklist executed (`yieldKinds` includes `tasklist`, `readDocument`, `delegate`, `registerSpace`, and `inspect`), and no `webSearch` or `webFetch` yield occurred. It did produce meaningful source-backed data:

- DB rows: `itinerary_legs: 8`, `cost_items: 14`, `ngorongoro_tariffs: 41`, `contacts: 11`, `memories: 2`.
- The response reported the spreadsheet total `$3,344.20`, Ngorongoro fees, the Stone Town photo, Emmanuel, and the ranger-tip fact.

But its state violates the key build assertions:

- `spaceCount: 9`, with overlapping/duplicate spaces: `Ngorongoro Tariffs Reference` appears twice, alongside `Ngorongoro Voice Memo`, `Stone Town Memory`, `Tanzania Trip Itinerary`, `Tanzania Trip Planner`, `Trip Budget Tracker`, `Trip Cost Tracker`, and `Trip Memories`. This is neither the required four real-world specialists nor a clean partition.
- `appManifest` lists five populated tables and six pages but reports `built: false`, so the required served live app is not proved.
- The trace still has a recovered `Cannot find name 'organize_material_result'` error after the tasklist resolves, plus several downstream architect/automator errors. The new cross-statement `result` / `built` / `app` error shape did not appear, but the end-to-end build remains unreliable.

## What remains / why I stopped

The source-data and no-research portions now land, but specialist partitioning and app-finalization still fail in the fresh replay. The next invocation should trace the exact tasklist envelope and the post-tasklist THING continuation: specifically, why it still attempts to inspect a nonexistent `organize_material_result`, why the planner/architect creates overlapping knowledge facets as spaces, and why the automator leaves a populated manifest with `built: false`.

Do **not** restore the previous direct build path or add another scope-inventory prose rule. The ledger already establishes that those L1 routes are exhausted. This round made one bounded L2 repair and one fresh verification run, then stopped honestly at the first remaining failure.
