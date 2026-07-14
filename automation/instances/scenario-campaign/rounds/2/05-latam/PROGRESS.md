# PROGRESS — scenario-campaign · task `05-latam` · round 2

_Started 2026-07-14T07:31:58.522Z. The agent MUST update this file at every step._

## Steps

<!-- append one bullet per step: what you did -->

## Files added to context

<!-- append every file you had to read / add to your context, with why -->
- **Oriented.** Read `scenario.md` (13 Acts, §6 table + Round-1 Actual results), `run.mjs` (1146 lines, Acts I–XIII implemented 1:1), `results/checkpoint.json` + `results/report.md`. **Frontier:** round 1 ended **FAIL on Act I** (THING did not OFFER; restraint regressed — it scaffolded 6 tables via the automator on a vague opener). Acts II–XIII are implemented but **have never been run live**.
- Checked THING's brain on HEAD: `user-thing/agents/thing/instruct.md` is now 37,107 b and *does* carry the OFFER + restraint rules (L293–314, commits 11a9396 → 73f50d5). Round 1's live image had 27,067 b (no offer rule at all) ⇒ the first question for round 2 is whether the deployed image finally carries it.
- Launched a read-only catalog-scout subagent to map current Act coverage vs the J–P coverage audit.

## Files added to context
- `sdk/org/scenarios/05-latam/scenario.md` — the spec being extended (Acts table + round-1 results)
- `sdk/org/scenarios/05-latam/run.mjs` — the runner being extended (helpers, hardening patterns, Act I/II/XIII bodies + main)
- `sdk/org/scenarios/05-latam/results/{report.md,checkpoint.json}` — what actually ran and passed
- `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md` — THING's triage brain (the Act-I offer/restraint rules)
