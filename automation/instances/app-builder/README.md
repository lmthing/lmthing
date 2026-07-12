# app-builder instance

Builds & ships the five store project-applications (`blog`, `kitchen`, `health`, `trips`, `homes`)
autonomously — one app per run, round-robined, each app advancing through its own rounds. Round 1
is a CORE BUILD (single session); round ≥ 2 is a FEATURE EXPANSION fanned across subagents
(`spaces-builder`, `data-api-hooks-builder`, `pages-builder`, `test-and-verify`). This is the
instance form of the old `automation/run.sh`.

## Run it

```bash
node automation/lmauto.mjs run app-builder --dry-run     # preview the next run's prompt/argv
node automation/lmauto.mjs run app-builder               # one run (next app in rotation)
node automation/lmauto.mjs run app-builder homes         # force a specific app (doesn't advance counts)
node automation/lmauto.mjs tui app-builder               # dashboard (pause/continue/skip)
node automation/lmauto.mjs loop app-builder              # headless, every 5h
node automation/lmauto.mjs schedule app-builder cron-install
```

## Notes specific to this instance

- **Two models are in play.** Claude Code (the *builder*) uses your configured Anthropic model
  (override with `CLAUDE_MODEL`); the *app under test* is exercised with the **live model from
  `sdk/org/.env`** (`LM_MODEL` alias → `LM_MODEL_<alias>`), read by `config.mjs`'s `vars()` and
  passed to the prompt as `{{MODEL_ALIAS}}`/`{{MODEL}}`. Ensure `sdk/org/.env` has valid keys.
- **Backup accounts.** Add more bins in `config.mjs` (`claude.bins`) or via `CLAUDE_BINS` to keep
  building across a usage-limit reset.
- **Cross-round memory** stays in `PROGRESS.<app>.md` / `PLAN.<app>.md` here; the engine also seeds
  a per-run `rounds/<round>/<app>/PROGRESS.md`.
- The runs push to `{{branch}}` on BOTH repos (submodule first). Only run where that is intended.
