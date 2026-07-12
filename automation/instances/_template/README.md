# _template — copy me to create a new instance

This is the scaffold `lmauto new <name>` clones. To create an instance:

```bash
node automation/lmauto.mjs new my-job      # copies this folder → instances/my-job/
```

Then, in `instances/my-job/`:

1. **`config.mjs`** — set `name`, `tasks`, `cwd`, `claude.bins`, and (optionally) `vars` +
   `subagents`. Every field is documented in [`../../README.md`](../../README.md).
2. **`prompt.common.md`** — the shared body (ground truth + the PROGRESS and commit protocols; keep
   those two). Add your task's real instructions and definition of done.
3. **`prompt.first.md` / `prompt.next.md`** — round-1 (initial build) vs round-2+ (expansion)
   framing. Both `{{include:prompt.common.md}}`.
4. **`prompt.continue.md`** — optional; delete it unless you set `continueTemplate` in config.

Sanity-check the rendering **before** running for real:

```bash
node automation/lmauto.mjs run my-job --dry-run
```

Then run it live (`tui` for the dashboard, `loop` headless, `schedule` for cron). See the root
README for the full authoring guide, the template variables, and the runtime behavior.
