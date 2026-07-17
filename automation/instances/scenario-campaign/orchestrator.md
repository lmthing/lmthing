# Scenario-campaign orchestrator (Opus → Sonnet fan-out) — durable runbook

This file is the **durable brain of the autonomous orchestrator**. A fresh Opus context (after a
usage-reset wakeup or its own handoff) reads THIS file + `state/orchestrator-state.json` + each live
scenario's `state/<id>.handoff.md` and resumes with no lost work. It never asks the human anything.

## Mission

Drive the lmthing scenario campaign to green, fully automated:
1. **Migrate** `08-small-shop` / `09-home-renovation` / `10-family-recipes` from prose `scenario.md`
   + `fixtures/` → `scenario.yaml` (one Sonnet subagent each, `migrate.md`).
2. **Run** every scenario (`06`, `07`, then `08`/`09`/`10` as they land) to fully green — one Sonnet
   runner-judge-fixer each, `judge.md`: play the runner step-by-step, judge each step, fix failing
   steps at the lowest rung in source (prefer loadable knowledge over prompt prose — never overfit),
   verify via snapshot/resume, until all steps pass.
3. **Review + commit.** The orchestrator is the sole committer. It reviews each ready fix under the
   edit-lock and commits+pushes to `main` as early as possible, or feeds back to the subagent.

## Substrate

- **Orchestrator = the Opus session** (this one). Subagents = `Agent` tool, `model: sonnet`, run in
  the background, all in the **shared `main` working tree** (no worktrees). `sdk/org` is a git
  submodule; "main" = the submodule's `main`. After committing there, bump the parent superproject's
  submodule pointer.
- **Runner:** `cd sdk/org && node scenarios/run-scenario.mjs <id>` — per-run isolated server on an
  allocated port under `scenarios/<id>/runs/<n>/`, per-step snapshots, `--resume <runId> --from N`,
  `--plan` (dry). No build (tsx from source; `--adopt-system-spaces` on every boot). Evidence:
  `runs/<n>/step-NN.json` (compact — poll this), `.full.json`, `trace.md`, `run.json.completedSteps`.
  Logs: `runs/<n>/sessions.log`, `runs/<n>/data/.lmthing/sessions-ledger.jsonl`.

## Concurrency (bounded)

- 3 migration subagents in parallel immediately (cheap — YAML authoring, no pod).
- ≤2 scenario runners at once to start (06, 07); add 08/09/10 runners as migrations land — **cap ~3
  expensive runner lanes** total. Migrations don't count against the runner cap.
- Runs parallelize freely (isolated `runs/<n>/` + servers). **Source edits are serialized by the
  edit-lock** (below), so only one subagent's tracked diff is ever pending review.

## The edit-lock (shared-tree safety)

`state/edit.lock/` (gitignored). A subagent takes it with atomic `mkdir` before touching ANY tracked
source and holds it through edit + verify + the orchestrator's review. The orchestrator releases it
only after committing (or telling the subagent to abandon). If a lock's holder subagent is dead/stale
(check `state/edit.lock/holder` against live agent ids) and no diff is pending, the orchestrator
force-releases it (`rm -rf state/edit.lock`). One pending diff at a time keeps every commit clean.

## Review + commit-or-feedback gate

When a subagent signals a ready fix (or a migration finishes):
1. `cd sdk/org && git status --porcelain` + `git diff -- <named files>` — review ONLY the files the
   subagent named (path-scoped).
2. **Anti-overfit (hard gate).** For any edited `agents/**/instruct.md|charter.md`,
   `tasklists/**/*.md`, or space-function body: grep for scenario literals (persona names, place
   names, fixture tokens) AND domain framing (e.g. "trip"/"recipe"/"tenant" reasoning in a
   system-wide brain). Domain heuristics MUST live in `knowledge/<domain>/<field>/<option>.md` loaded
   on demand (the `user-thing/knowledge/organizing/split/` pattern), never in a system-wide prompt.
   Violation → **feedback, no commit**.
3. **Correctness gate.** `cd sdk/org && pnpm typecheck`; `pnpm test <touched path>`; `pnpm
   lint:tokens`; for a mechanism fix, `pnpm test scenarios`; for L3 core, `pnpm docs:check` + require
   the matching `org/docs/` page in the diff.
4. **Migration diff:** `node scenarios/run-scenario.mjs <id> --plan` parses + all fixtures ✅.
5. **Commit** (path-scoped so no sibling's in-flight edit is swept in):
   `cd sdk/org && git add <named files> && git commit -m "<msg>"` with the trailer, then
   `git push origin HEAD:main`. Bump the parent pointer: `cd .. && git add org && git commit -m
   "bump sdk/org: <msg>" && git push`. Then release the edit-lock and tell the subagent (SendMessage)
   it's committed → continue.
6. **Feedback path:** if wrong/overfit, `SendMessage` the subagent specific, actionable feedback;
   it revises under the same lock and re-signals. Never commit an overfit or red-gate diff.

Commit message trailer (both repos):

    Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01FJnNWbu2dhpPtzhDdbxWqR

## Usage guard (strict 95%) — the shared 5h budget

- The statusline wrapper `~/.claude/statusline-capture.sh` writes `~/.claude/lmthing-orchestrator/
  usage.json = {updated_at(ms), five_hour:{used_percentage,resets_at}, seven_day, …}` on every
  render. Each orchestrator turn is a render, so it's fresh when read.
- **Every heartbeat read `five_hour.used_percentage`.** If **≥ 95**: SendMessage every live subagent
  to ensure `handoff.md` + latest snapshot are current, then stop; stop launching new subagents;
  record `paused_at` + `resets_at` in state. Then **schedule the restart**: `ScheduleWakeup` clamps to
  ≤3600s, but a 5h reset can be further out, so CHAIN — schedule 3600s, and on each wake re-check
  `usage.json.resets_at`; if the reset epoch hasn't passed, reschedule; once past (and
  `used_percentage` dropped), resume. Subagents are stopped during the pause, so usage stays flat
  below 100% and the tiny chained-wakeup turns never lock out.
- **On resume:** re-spawn each paused scenario from its `handoff.md` (`--resume <runId> --from <K-1>`).
- **Heartbeat cadence while active:** `ScheduleWakeup` ~600s + subagent-completion notifications (also
  heartbeats). Read usage, check subagent liveness + `output_file` sizes, review any pending fix.

## 400k-token handoff

Each subagent maintains `state/<id>.handoff.md` after EVERY step (current step, `--resume <runId>
--from <K-1>` point, per-step verdicts, fixes+files, lock state). Two triggers to hand off:
1. The subagent self-checkpoints and stops when its own context is under pressure (releases the lock
   first).
2. The orchestrator watches each live subagent's `output_file` **byte size** (via `stat -c%s` —
   NEVER read/tail the file). Past the calibrated cap (start ≈ 8 MB ≈ ~400k-token transcript; refine
   by observation), SendMessage it to checkpoint+stop, wait for `handoff.md` to be current + lock
   released, then spawn a fresh continuation subagent pointed at `handoff.md` + the attempt ledger +
   the snapshot resume point. The per-step `handoff.md` makes the exact cutoff non-critical.

## State files

- `state/orchestrator-state.json` (gitignored) — the live ledger the orchestrator maintains:
  `{ updatedAt, phase, usage:{last_pct,last_resets_at,paused}, scenarios:{ <id>:{ status, subagent:
  {name,agentId,outputFile}, resumeRunId, resumeStep, lastCommit } }, editLock:{held,holder},
  commits:[…] }`. `status ∈ migrating|migrated|queued|running|green|paused|blocked`.
- `state/<id>.handoff.md` (gitignored) — per-scenario resume note, owned by that scenario's subagent.
- `attempts/<id>.md` (TRACKED, committed with campaign meta) — cross-attempt fix ledger, per judge.md.

## Loop

0. (done once) usage wrapper + settings; this runbook + state; the updated `judge.md`/`migrate.md`.
1. Spawn 3 migration subagents (08/09/10) + 2 runner subagents (06/07). Start the heartbeat.
2. On each migration signal → review `--plan`, commit+push the `scenario.yaml`, mark `migrated`, and
   if a runner lane is free spawn its runner (→ `running`).
3. On each runner fix signal → review + commit+push (or feedback). On `green` → mark green, spawn the
   next queued scenario if a lane is free.
4. Every heartbeat: usage guard, liveness, output_file sizes, pending reviews. Pause/resume on 95%.
   Hand off any subagent past the size cap.
5. Done when 06–10 are all green. Report; optionally spawn `extend.md` rounds for more coverage.
