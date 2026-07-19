# session resume machinery: contamination, cross-run absolute paths, silent hang (L3 Pass B)

Three confirmed defects in `--resume` / `Session.resume()`; until fixed, the campaign's standing
rule is **verify via FRESH runs only**.

1. **Resume contamination** — restored history makes the model re-run old pending work. Evidence:
   07 run 21 step-13 answer byte-identical to run 19 step-4; 06 run 27 (2026-07-19) step 14 re-ran
   totals/research work from run 25 instead of processing the new message.
2. **Cross-run absolute paths** — restored state references the SOURCE run's dirs: run 27's step-14
   delegate path pointed into `runs/25/data/...` while executing in run 27. Snapshot restore does
   not rebase persisted absolute paths (space registry / delegate targets).
3. **Silent resume hang** — 06 run 28 (2026-07-19): `--resume 25 --from 3` restored session
   `0806d123…` which NEVER streamed a single statement (sessions.log = boot lines only,
   statements:0); it sat idle 15 min and was then legitimately reaped
   (`traceDispose: trigger=reaper status=idle`). Run 27 (step-13 snapshot) resumed fine —
   snapshot-content-dependent (step-03 = just-post-build). All SessionEntry creation sites stamp
   `lastActivity: Date.now()` (checked session-manager.ts ~1185/1252/1304), so TTL staleness is NOT
   the cause; suspect `_initResumedSession` / first-send. C1 Option C fixed the buildTarget half
   only; the history-sequencing half is open.

**Also:** a resumed session's restored history embeds behavior learned under the OLD prompts, so
resume-runs cannot fairly verify instruct-routing changes (in-context precedent beats the system
prompt) — a methodology constraint until (1) is fixed.

**Related, small:** scenario 06 step 18 (`restart_pod`) has no post-restart turn, so
`Session.resume()`+summarize (7622962) is never exercised live — add a `then_say` after
`restart_pod` (L0/extend) once resume is trustworthy.

**Where:** `sdk/org/libs/core/src/session/session.ts`, `sdk/org/libs/cli/src/server/session-manager.ts`
(`_initResumedSession`), snapshot restore in the scenario harness. Needs revert-proven tests per leg.
