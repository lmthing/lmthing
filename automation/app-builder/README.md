# Autonomous app-builder

Runs **Claude Code headless every 5 hours** to build, test, and ship the five
project-applications described in `app-specifications/{blog,kitchen,health,trips,homes}-application.md`,
each conforming to the two canonical architecture docs the prompt reads in full every run:
`org/format/project/` (the model + file formats) and
`org/runtime-globals/app-authoring.md` (the authoring globals —
§0 global protocol, live-DeepSeek test protocol, push-both-repos protocol, engine phases).
Those two live in the `sdk/org` submodule and are **read-only ground truth**; the builder edits
only the five app specs (in `app-specifications/`, parent repo).

Each 5-hour run targets **one app** (round-robin `blog → kitchen → health → trips → homes`), so a
full cycle touches every app roughly once per 25 hours.

**Rounds scale the ambition.** A round is one full pass over all five apps. **Round 1** builds
each app's core (as its spec describes). **Round 2 and every later round** revisit each app
and expand it *a lot* — adding new project-scoped spaces, new agents, many new pages/APIs/
hooks/tables, and substantial new features to the spec, then implementing and testing them
like round 1. Expansion is strictly additive; earlier rounds are never regressed. The current
round is derived from the round-robin counter in `state/` and passed into the prompt.

Every run:

1. reads `org/format/project/` (the model it must abide by) + that app's spec;
2. **thinks deeply and edits the spec** to add improvements / new features (staying inside
   the parent model);
3. writes a detailed implementation plan (`PLAN.<app>.md`);
4. **executes it** — creates the project under `store/projects/<app>/`;
5. **adds test files and tests with the live model in `sdk/org/.env`** (DeepSeek/Azure),
   runs the app locally, and **installs it to the test user**;
6. **pushes to `main`** (submodule `sdk/org` first for spec/runtime edits, then the parent
   repo bumps the pointer + adds the project).

Cross-run memory lives in `PROGRESS.<app>.md` — each run resumes from there.

## Files

| File | Purpose |
|---|---|
| `run.sh` | one autonomous run (one app). Round-robins, or force with `./run.sh <app>`. |
| `prompt.tmpl.md` | the master instruction prompt (placeholders filled per app by `run.sh`). |
| `schedule.sh` | install/remove the every-5-hours schedule (cron or foreground loop). |
| `logs/` | per-run logs (git-ignored). |
| `state/` | round-robin counter (git-ignored). |
| `PROGRESS.<app>.md`, `PLAN.<app>.md` | written by the runs; tracked so status survives. |

## Start it

```bash
# one-off (next app in the rotation), to sanity-check the wiring:
automation/app-builder/run.sh

# force a specific app:
automation/app-builder/run.sh trips

# schedule every 5 hours via cron (survives reboot):
automation/app-builder/schedule.sh cron-install
automation/app-builder/schedule.sh status

# …or exact 5-hour spacing in the foreground (recommended on an always-on machine):
nohup automation/app-builder/schedule.sh loop >/dev/null 2>&1 &
```

## Requirements / notes

- The `claude` CLI must be on `PATH` (or set `CLAUDE_BIN`). Runs use
  `--dangerously-skip-permissions` — it is fully autonomous and **will edit files, run the
  local stack, and push to `main`**. Only run it in a repo/worktree where that is intended.
- **Two models are in play:** Claude Code (the *builder*) uses your configured Anthropic
  model (override with `CLAUDE_MODEL`); the *app under test* is exercised with the **live
  model from `sdk/org/.env`** (`LM_MODEL` alias, currently the DeepSeek/Azure entry). Make
  sure `sdk/org/.env` has valid `AZURE_API_KEY` / `LM_MODEL_*` before scheduling.
- Env knobs: `CLAUDE_MODEL`, `RUN_INTERVAL` (seconds, default `18000`), `CLAUDE_BIN`.
- To stop: `schedule.sh cron-remove`, or kill the loop process.
