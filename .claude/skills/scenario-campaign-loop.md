---
name: scenario-campaign-loop
description: Load when RUNNING the scenario-campaign judge loop as the human commit-gate — drive a headless "judge" (Azure Sonnet via lmauto) that replays a scenario.yaml, finds the first failure, fixes it at the right rung, and verifies; then YOU review its uncommitted diff, gate-check it, commit to main when you agree, and relaunch. Also covers correcting `judge.md` when the judge itself misbehaves. To AUTHOR a scenario instead, use `@.claude/skills/scenario-authoring.md`.
---

# Skill: Running the scenario-campaign judge loop (you are the commit-gate)

The **judge** is a headless `claude -p` session (Azure Sonnet, `claude.bins` in
`automation/instances/scenario-campaign/config.mjs`) spawned by **lmauto** with the rendered
`judge.md`. It replays a `scenario.yaml` against a fresh local pod, judges each step on real
evidence, **fixes the first failure at the lowest true rung (L0 scenario / L1 prompt / L2 structure /
L3 core)**, verifies with a fresh rerun, writes a report, and **never commits**.

**You are the human commit-gate.** Per round: launch → monitor → review the diff → when you AGREE
it's sound, **you** commit it to `main` and relaunch. Correct `judge.md` when the judge misbehaves.

## The operating discipline (do not break these)
- **You never run the scenario yourself — only the automation runs it.** Do NOT hand-launch
  `run-yaml.mjs`, a local server, or the replay to "verify" a fix. The judge (spawned by `lmauto run`)
  is the only thing that drives the pod. Your job is launch → watch → review → commit → relaunch.
  Verification of a fix is the JOB of the next automation round, not something you do by hand.
- **Every round, you inspect the changes the automation made** and take exactly one path:
  1. **Sound** → commit to `main`, relaunch.
  2. **Overfit but salvageable** → rewrite the diff yourself into the domain-neutral principle
     (keep the behavior, strip the scenario/domain costume), **AND** update the scenario-campaign
     prompts so the automation won't produce that overfitting again, then relaunch.
  3. **Wrong (bad rung, unsalvageable, fake pass)** → reject: discard the diff (`git -C sdk/org
     checkout -- <files>`), update the scenario-campaign prompts so the automation avoids the
     mistake, and relaunch.
- **Overfitting ALWAYS costs a prompt update.** Whether you fixed the diff yourself or rejected it,
  if the automation overfit then `judge.md` / `scenario-spec.md` failed to stop it — harden them in
  the SAME breath (see "No overfitting" below) so the next round can't repeat it. A de-overfit with
  no prompt update is an incomplete fix.

## Read first
- `automation/instances/scenario-campaign/judge.md` — the judge's prompt (the loop it runs).
- `automation/instances/scenario-campaign/config.mjs` — the bin (Azure Sonnet), tasks, `maxParallel:1`.
  Keep only the ACTIVE scenario in `tasks:`; when it goes fully green, replace it with the next id.
- `automation/instances/scenario-campaign/attempts/<id>.md` — the **cross-round attempt ledger**: the
  judge's memory. Each round reads it before attributing and appends its rung + verify outcome. It's
  how a fresh-context round knows a rung is exhausted and must climb (each judge session starts blank,
  so without it round N+1 re-tries what round N already proved doesn't work). It persists on disk
  untracked; **commit it as campaign meta whenever you gate-commit** (the engine won't).
- `automation/lib/loop.mjs`, `state.mjs` — the engine (path-limited ledger commits; reaps abandoned runs).
- `sdk/org/scenarios/run-yaml.mjs` — the generic runner the judge drives (`--fresh-server`, self-PID).

## Launch (one scenario, human-gated)
```bash
node automation/lmauto.mjs run scenario-campaign <id>   # ONE round; spawns the judge, returns when it exits
```
Run it in the background (it's ~40 min / ~$2–4). The judge writes to
`automation/instances/scenario-campaign/rounds/<n>/<id>/attempt-1/output.log` — **that is the claude
log** (the judge's own reasoning/tool stream). Its scenario EVIDENCE lands wherever it points
`--out` (usually the round dir): `step-NN.json`, `trace.md`, `run.log`, `report.md`.

## Monitor (background watchers, not foreground sleeps)
Foreground `sleep` is blocked. Poll with a `run_in_background` bash `until/while` loop that breaks on
a real signal (a `step-NN.json` appears, `report.md` written, the judge process exits, a source edit
shows in `git -C sdk/org status`), then reports and returns — you're notified when it exits.
**Gotchas learned the hard way:**
- **pgrep self-match**: `pgrep -f run-yaml` matches your own command AND the judge (its cmdline
  embeds the whole prompt, which contains "run-yaml"). Use `ps -eo args | grep '[c]laude-azure/launch.sh'`
  and check `run.log` markers, not process greps, for runner liveness.
- The judge's Bash caps at **10 min**; the replay is 30–40 min → it runs the runner in the BACKGROUND
  and polls. `run.log` ending in `played N/18 steps` = clean finish; a node stack / `Cannot find
  module` = a crashed runner.
- Progress signal = `step-NN.json` count in the round dir (written per step). `output.log` is bursty
  (the judge blocks in long Bash calls between writes) — quiet ≠ stuck.

## Review the fix — the two things that matter most
When the judge edits source (`git -C sdk/org diff …`), before committing:
1. **Right rung.** Prompt file (`system-spaces/**`) = L1/L2; `libs/core/src/**` = **L3 framework** —
   review L3 hardest (must ship lockstep injection+DTS+intersection, a test that would've caught it,
   and the `org/docs/` page in the SAME change; `pnpm docs:check` is the gate). A prompt fix that
   didn't change behavior last round is a signal the real cause is deeper — expect a climb.
2. **No overfitting.** Grep the diff for scenario literals (persona names, fixture facts, this
   scenario's table names) — any is an automatic reject:
   `git -C sdk/org diff <files> | grep -iE '^\+' | grep -iE '<persona|place|token|number>'`.
   **The grep is necessary but not sufficient** — also READ the added prose for scenario-DOMAIN
   framing, which no grep catches: a travel scenario's fix that teaches THING about "itineraries" /
   "destinations", a cooking one about "recipes", etc. bends a system-wide brain toward this one
   story's domain and is overfit just as badly as a literal. Demand the domain-NEUTRAL principle (the
   real Tanzania fix: not "list each destination in an itinerary" but "a distinct part with few facts
   still gets its own specialist; brevity is not a reason to merge"). Test each added sentence: could
   it have come from a scenario in a completely different domain? If not, reject — send it back or
   rewrite it yourself before committing.
3. **Verified.** The report must show a fresh `--fresh-server --through <N>` replay where the failed
   step (and everything before it) passes. An honest partial-FAIL is fine (next round continues);
   a fake PASS is not.

## Commit when you agree (submodule first, then parent)
Gate-check, then:
```bash
# in sdk/org: the product diff
git -C sdk/org add <changed system-spaces / test files> && git -C sdk/org commit -m "…" && git -C sdk/org push origin main
# in parent: any org/docs change + the submodule pointer bump
git add org/docs/... sdk/org && git commit -m "…" && git pull --rebase origin main && git push origin main
```
CI auto-pushes image-tag commits to `main`, so `git pull --rebase` before pushing is routine. Commit
messages: note the round, the rung, the general principle, and "Co-Authored-By: Claude Opus 4.8".
Then relaunch the next round. Progress is cumulative — the product keeps every committed fix even
though each round replays from scratch.

## Correct judge.md when the JUDGE (not the product) misbehaves
If the judge itself makes a mistake, fix its PROMPT and rerun (don't fix the product). Classes seen:
- **Ends its turn after launching the runner** → a headless session dies when it stops emitting tool
  calls; judge.md must force a blocking-poll loop with a hard "DO NOT END YOUR TURN" rule.
- **Runs the runner foreground** → exceeds the 10-min cap; must background + poll.
- **cwd-dependent launch** (`cd sdk/org && node scenarios/…`) → crashes MODULE_NOT_FOUND; use the
  ABSOLUTE path `{{repoRoot}}/sdk/org/scenarios/run-yaml.mjs`.
- **Poll can't see a crash** → detect it (module-error patterns / dead `runner.pid`), don't wait forever.
Commit judge.md fixes too (they're infrastructure you agree with).

## Recover from a crash / abandoned run
Nothing is lost if you committed each round. On restart: `ps` for stragglers, `local-server.mjs down`,
clear the dead round's stale evidence (`rm rounds/<n>/<id>/**/{step-*.json,run.log,runner.pid}`), and
relaunch — the engine reaps the abandoned "running" ledger entry and starts fresh.

## Watch for
- **Whack-a-mole on one step** (a step failing a new way each round from LLM non-determinism): each
  fix is real, but if it persists, consider directing the judge to harden that whole flow in one pass.
- **Persistent recovered typecheck errors** in the tasklist code — real latent bugs, non-fatal, a
  candidate for a dedicated round.
