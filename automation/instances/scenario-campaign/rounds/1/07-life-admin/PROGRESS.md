# PROGRESS — scenario-campaign · task `07-life-admin` · round 1

_Started 2026-07-13T21:25:14.109Z. The agent MUST update this file at every step._

## Steps

- **[Resume 2026-07-14]** Re-oriented. Confirmed: parent `709f67b8` CI "Build and Push Images"
  **succeeded** → `compute:709f67b` exists in ACR and carries the seed-idempotency fix. Test pod
  `user-381651436288632458` deployment is already on `compute:709f67b` (scaled to zero, wakes on
  request). Committed a stray uncommitted strengthening of Act I (`run.mjs`: assert the six REAL
  bill figures the spreadsheet states, not just row counts — a fabricated bills table must FAIL)
  + `reset-project.mjs` (sdk/org, staged mine only; the concurrent 08-small-shop agent's edits to
  automator/thing `instruct.md` + `05-latam/*` left untouched). Resetting `life-admin` for a clean
  re-verify of Act I on the fixed image (the old project carries pre-fix damage). Bash tool caps
  `timeout` at 600000ms; long Acts (Act I build turn ~8min) run via `run_in_background` — this
  harness re-invokes on background exit, so nothing is orphaned.

- **Oriented.** Read `scenario.md` — it is NOT a stub: fully authored, six sections, 14 Acts, and
  §7 already names the eight never-before-tested claims it exists to force. `run.mjs` did **not**
  exist. So round 1 = implement the 14 Acts 1:1 from the spec (the round-1 rule: "do not rewrite
  the story — implement it"). The spec's Acts already ARE the coverage-audit gaps (L: typecheck
  capability gating + live schema migration; P: loop guard + payload validation; N: `@consent` on a
  FUNCTION; C: code-handler vs agent-trigger cost), so goal 1 and goal 2 converge on the same work.
- **Read the harness** (`pod.mjs`, `thing.mjs`, `report.mjs`, `provision.mjs`) and the two surviving
  reference runners (`06-tanzania/run.mjs`, `05-latam/run.mjs`) for the hardening patterns.
- **Grounded the Acts in the REAL fixture bytes** (not links.md's summary):
  - dumped `household-ledger.xlsx` → bills (PPC 2026-05 €74.10 / 2026-06 €87.40, EYDAP €46.80,
    Heron gas €58.20, Cosmote €34.90, Vodafone €19.90) + warranties (5 appliances, serials).
  - read `voice-memo.txt` → the transcript actually says **"Costas Xenakis"**, while `links.md`
    claims the token is `Kostas Xenakis`. Asserting the links.md spelling verbatim would have been
    a **false FAIL**. The runner accepts `/[KC]ostas Xenakis|ThermoFix/`.
- **Found a probable product bug BEFORE running** (Act III's target): `db.addColumn`
  (`libs/cli/src/app/store.ts:519`) does `ALTER TABLE` + updates the in-memory registry but **never
  persists `database/<table>.json`**. So a live migration is not durable in the app's *declared*
  schema; on the next boot `reconcileTable` sees an undeclared live column and only warns
  ("the app reads only declared columns"). Act III (column declared after) + Act XIII (the reading
  survives a restart) are both written to catch exactly this. Not yet confirmed live.
- **Extended the harness** (the one extension `scenario.md` itself calls for): `ThingSession` now
  accepts + forwards `spaceRef` to `POST /api/sessions`, so Act IV can bind a session directly to
  one specialist's own agent and read its REAL capability profile.
- **Wrote `sdk/org/scenarios/07-life-admin/run.mjs`** — all 14 Acts, 1:1 with the Acts table, with
  every hardening pattern (per-Act checkpoint + `--acts=`, keepalive pinger, resilient send,
  scripted `onAsk`, trace/real-state-only assertions).
  - Key implementation finding: **`db.*` are host functions injected on the VM, not yields**
    (`core/src/exec/app-globals.ts#buildScopedDb`) — a live DDL call leaves **no `yield` event**.
    Act III therefore reads the executed **`statement`** trace event's `code` instead. A runner
    that looked for a `db.addColumn` *yield* would have failed the Act for a harness reason.
- **Provisioned** the disposable prod user (`user-381651436288632458`), raised `MAX_SESSIONS=25`
  (this scenario opens in-app, memory-recall and spaceRef-probe sessions on top of THING's own),
  and ran `smoke.mjs` — prod healthy (10.2s first turn, budget clean).
- **Committed** the runner + harness extension (sdk/org `9a5f0d8`).
- **Ran Act I live → 26/29. Three REAL product bugs found (not assertion bugs).** The ingest half was
  clean: all 7 files classified correctly, `system-files`+`system-vision` delegated, 7/8 of his own
  specifics cited back, THING **offered unprompted** with zero authoring before consent, and a bare
  "yes please, go for it" was enough. 6 of 7 fixture tokens landed in REAL STATE. The BUILD half broke:
  1. **A whole dataset was silently dropped.** `household-ledger.xlsx` has TWO sheets (`bills`,
     `warranties`). The `system-files/sheet` reader read BOTH and displayed every bills row verbatim
     in the trace. But **all three** of THING's build instructions to the automator have **no bills
     section at all** — it collapsed the workbook into one "HOUSEHOLD INVENTORY" concept shaped by the
     *warranties* sheet's columns, so the 6 utility bills never reached the app, while it invented a
     whole "PRODUCT REGISTER" section for a single vase. The user's very next scripted message is
     about his electricity bill. This also blocks Acts III/V/VI/VII/XII, which all need a bills table.
  2. **THING fired the automator 3× and the seed doubled the data.** Every one of his 4 policies is in
     `insurance_policies` TWICE — and the duplicate copy silently disagrees (pension €180/**month**
     came back as `2160`, annualized by the re-seed). Root cause is a genuine CODE bug:
     `SessionManager.seedProjectTable` inserted every row unconditionally, so
     `writeProjectTable(name, schema, rows)` was **not idempotent**.
  3. **Duplicate tables for one concept**: `boiler_service_log` + `boiler_services`, `household_items`
     + `inventory` — two sections holding different subsets of the same facts.
  (Also: `policy.pdf`'s token `2746423` never landed — the PDF was read but not seeded. Folded into
  fix 3's principle; re-checking after the fix.)
- **Fixed all three in the product, with a test** (sdk/org `4b5b48a`, parent `709f67b8`):
  - **code** — `seedProjectTable` is now idempotent: a seed row already in the table is skipped
    ("already there" = every column the seed supplies matches an existing row; the generated `id` and
    defaults it did not supply are ignored, so a row seeded by an earlier run still matches), while
    genuinely-new rows still land. **Test** `session-manager.livedb.test.ts` — seed, re-seed, assert
    2 rows not 4, then prove a new row still gets in. Full `libs/cli/src/server` suite green (348).
  - **prompt (automator)** — "Running twice must CONVERGE on the same app, never double it": read
    `database/` first; extend the table a concept already has, whatever it is named; seed by matching
    on the row's real identity, not by counting.
  - **prompt (THING)** — "Every distinct dataset in the material gets a home": inventory what the
    material CONTAINS before planning a build (a workbook's sheets are separate datasets), then read
    the plan back against that inventory; and do not invent a section the source does not support.
  - Both prompt changes are stated as **general principles** — zero scenario/persona/fixture/table
    names in either (checked).
- **Pushed both repos**; CI is building `compute:709f67b`. Wrote `reset-project.mjs` so Act I can be
  re-verified from a clean slate on the same user (the existing project carries the pre-fix damage,
  so re-running against it would grade the fix on a dirty baseline).

## Files added to context

- `sdk/org/scenarios/07-life-admin/scenario.md` — the spec being implemented (14 Acts, 6 sections).
- `sdk/org/scenarios/_template/run.mjs` — the runner skeleton + the hardening patterns.
- `sdk/org/scenarios/06-tanzania/run.mjs` — the closest reference runner (14 Acts, live-proven).
- `sdk/org/scenarios/harness/lib/{pod,thing,report}.mjs`, `harness/provision.mjs` — the harness API
  (upload/appApi/appBuild/listHooks/runHook/sessionLedger; ThingSession settle loop; Report).
- `sdk/org/scenarios/07-life-admin/fixtures/{links.md,policies.md,voice-memo.txt}` + the parsed
  `household-ledger.xlsx` — the ground truth every token assertion is written against.
- `sdk/org/libs/core/src/exec/app-globals.ts` — proved `db.*` is injected, not yielded (Act III).
- `sdk/org/libs/cli/src/app/store.ts` (`addColumn`, `reconcileTable`) + `libs/cli/src/app/boot.ts` —
  the live-migration durability gap.
- `sdk/org/libs/cli/src/server/routes/hooks.ts` — `hasHandler` / `trigger` shape for Act VII.
- `sdk/org/libs/cli/src/server/routes/sessions.ts` + `session-manager.ts` — confirmed
  `POST /api/sessions` already accepts `spaceRef` (Act IV needed only a harness change).
