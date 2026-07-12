# scenario-campaign instance

Extends the live-prod scenarios in `sdk/org/scenarios/*` with **additional Acts**, runs each
scenario end-to-end against **live production**, fixes any product bug found (with a test), verifies
the fix deploys, and reports honestly. Round-robins the scenarios; each gets its own per-task round —
round 1 reaches a green baseline and adds a first batch of new Acts, later rounds add more.

The prompts are **self-contained**: they embed the process + artifact-format knowledge that used to
live in `sdk/org/scenarios/PLAYBOOK.md` and `SCENARIO-FORMAT.md` (both deleted). The surviving
references the prompts point at — the harness (`sdk/org/scenarios/harness/`), the `_template`, each
`scenario.md`, and `README.md` — still exist.

## Run it

```bash
node automation/lmauto.mjs run  scenario-campaign --dry-run   # preview the next run's prompt
node automation/lmauto.mjs run  scenario-campaign             # one run (next scenario in rotation)
node automation/lmauto.mjs run  scenario-campaign 06-tanzania # force a specific scenario
node automation/lmauto.mjs tui  scenario-campaign             # dashboard
node automation/lmauto.mjs loop scenario-campaign             # headless, every 5h
```

## Notes

- **Whole monorepo, live prod.** The session starts at the monorepo root and commits + pushes BOTH
  the `sdk/org` submodule and the parent repo (to trigger CI), then verifies the compute image
  deploys and re-runs the affected Act live. It provisions a **disposable prod user** per run — it
  will create pods, mint gateway JWTs, and `kubectl set image` a `user-*` pod. Only run where that is
  intended. Needs valid Azure keys in `sdk/org/.env` and cluster/kubectl access.
- **Live runs are long** (hours). The single session babysits its own `run.mjs` via a
  `run_in_background` process and checkpoints per Act; the loop's interval is 5h.
- **Backup accounts.** Add bins in `config.mjs` (`claude.bins`) or `CLAUDE_BINS` to keep going across
  a usage-limit reset — the engine resumes the same scenario on the fallback account.
- **Tasks** = scenario ids: `05-latam`, `06-tanzania`, `07-life-admin`, `08-small-shop`. Append a new
  scenario id to `tasks` and it starts at its own round 1 (baseline + first Acts).
