# lmauto — recurring autonomous Claude Code sessions

`lmauto` runs an autonomous `claude -p` session on a **recurring task**, round-robining a set of
tasks and surviving usage limits. Everything about a job lives in one folder under
`instances/<name>/` — **the engine (`lmauto.mjs` + `lib/`) is generic and you never edit it to add
a job.** The shipped example is [`instances/app-builder/`](./instances/app-builder/README.md).

> This README is a **recipe for creating a new instance**. If you are an LLM asked to "add an
> automation", follow it top to bottom.

## Create every instance under `instances/`

An instance is resolved **only** by the path `automation/instances/<name>/`. Nowhere else.

```bash
node automation/lmauto.mjs new my-job     # clones instances/_template/ → instances/my-job/
```

Then edit the files it created (all documented below), and **always dry-run first**:

```bash
node automation/lmauto.mjs run my-job --dry-run
```

## 1. `config.mjs` — the full schema

`config.mjs` default-exports a plain object. Every field:

| field | type | purpose |
|---|---|---|
| `name` | string | Display name. Defaults to the folder name. |
| `cwd` | string | Directory the `claude` session runs in — a **git repo**; its current branch is where the agent commits (exposed as `{{branch}}`). Defaults to the monorepo root. |
| `tasks` | `string[]` **or** `() => string[]` | The round-robin set. **Re-resolved every selection**, so appending an item later makes it run its OWN round 1 (see §4). Each entry is a task id. |
| `firstRoundTemplate` | string | Template file used when the selected task is on **round 1**. Default `prompt.first.md`. |
| `nextRoundTemplate` | string | Template file used when the task is on **round ≥ 2**. Default `prompt.next.md`. |
| `continueTemplate` | string \| omitted | Template used when a usage limit forces a **cross-bin fallback** (different account → no `--resume`). Omit to use the engine's built-in continuation wrapper. |
| `roundMode` | `(round) => string` | Human label for the round → `{{roundMode}}`. |
| `vars` | `(ctx) => object` | Extra template variables computed per run. Every key `K` becomes `{{K}}`. |
| `subagents` | `(ctx) => [{name, scope, model?}]` | Subagents the single session fans out (via its own Task/Agent tool) → `{{subagents}}`. Each `scope` is itself templated. |
| `claude.bins` | `string[]` | Claude binaries = **backup accounts**, tried in order; a usage limit on one rotates to the next (see §6). Default `['claude']`. |
| `claude.addDirs` | `string[]` | Extra `--add-dir` dirs. |
| `claude.flags` | `string[]` | Extra claude flags (e.g. `['--verbose']`). |
| `claude.model` | string | `--model` for the builder. Overridden by env `CLAUDE_MODEL`. |
| `prePull` | boolean | `git pull --ff-only` before each run. Default false. |
| `interval` | number (s) | Seconds between runs in loop mode. Default 18000 (5h). |
| `startDelay` | number (s) | Seconds before the FIRST run. Default 0. |

`ctx` (passed to `vars`/`subagents`) = `{ task, round, roundMode, taskIndex, taskCount, branch,
instanceDir, repoRoot }`. **`round` is the selected task's OWN round.**

## 2. The prompt templates

- **`prompt.common.md`** — the shared body, `{{include}}`d by both round templates. Keep the two
  MANDATORY protocol sections it ships with:
  - **PROGRESS protocol:** the agent must update `{{progressFile}}` at every step, appending what it
    did **and the exact new files it added to its context** that step.
  - **Commit protocol:** commit **early & often to `{{branch}}`** (many small commits, never switch
    branches).
- **`prompt.first.md`** — round-1 framing (initial build). `{{include:prompt.common.md}}`.
- **`prompt.next.md`** — round-≥2 framing (expansion). `{{include:prompt.common.md}}`.
- **`prompt.continue.md`** — optional cross-bin continuation override (see §6). Delete unless used.

### Template contract

- **Always-available vars:** `{{task}}` `{{round}}` `{{roundMode}}` `{{taskIndex}}` `{{taskCount}}`
  `{{branch}}` `{{progressFile}}` `{{subagents}}`. In the continuation template also
  `{{originalPrompt}}`.
- Every key returned by `vars()` becomes `{{KEY}}`.
- `{{subagents}}` expands to a numbered `name → scope` list (empty → a "run single-session" note).
- `{{include:sibling.md}}` inlines a sibling file (resolved before variable substitution).
- Unknown `{{...}}` are left intact and reported as warnings in the loop log.

## 3. First vs next round

The template is chosen by the selected task's **own** round: round 1 → `firstRoundTemplate`,
round ≥ 2 → `nextRoundTemplate`.

## 4. Per-task rounds & late additions

Round is tracked **per task** in `state.json`. On each selection the engine picks the task with the
**fewest completed runs** (ties → list order). So an even list round-robins, and **an item appended
to `tasks` later — with 0 completed runs — is picked next and runs its round 1 with the initial
prompt**, even while the others are on round 5. It then advances through its own rounds.

## 5. State, artifacts, and what's committed

- **`state.json`** (instance root) — the **durable, git-committed ledger**: per-task rounds +
  a run/result history. The engine commits it (and the finished run's artifacts) on `{{branch}}` at
  every run boundary.
- **`rounds/<round>/<task>/`** — per-(round,task) artifacts:
  - `PROGRESS.md` — seeded by the engine, maintained by the agent (persists across attempts).
  - `attempt-<n>/` — one per claude invocation: `prompt.md` (exact rendered prompt), `argv.txt`
    (prompt elided), `output.jsonl` (raw stream), `output.log` (distilled), `result.json`.
- **`state/`** — ephemeral, **gitignored**: `runtime.json` (live process state the TUI reads),
  `control` (the pause/continue channel), `loop.log`.

## 6. Running it, pausing, limits

```bash
node automation/lmauto.mjs run  <name> [task] [--dry-run] [--start-delay=SEC]  # one run
node automation/lmauto.mjs tui  <name> [task] [--attach]   [--start-delay=SEC]  # dashboard
node automation/lmauto.mjs loop <name> [--interval=SEC]    [--start-delay=SEC]  # headless forever
node automation/lmauto.mjs supervise <name> [--start-delay=SEC --duration=SEC --interval=SEC]
node automation/lmauto.mjs schedule <name> cron-install|cron-remove|status
node automation/lmauto.mjs pause|continue|skip|stop <name>   # control a running loop/tui
node automation/lmauto.mjs status <name>
node automation/lmauto.mjs list
```

- **TUI** shows state, task/round/attempt, active bin, per-bin limit countdowns, live activity, and
  countdowns to the next/first/resume run. Keys: **p**ause · **c**ontinue · **s**kip · **q**uit.
- **Pause** SIGSTOPs the running claude immediately. On continue, if the pause was short it
  SIGCONTs; if it was long (> `PAUSE_KILL_THRESHOLD`, default 120s — the in-flight turn's socket is
  dead) it kills and `--resume`s the session.
- **Start delay** holds before the first run (`waiting-for-start`, with a countdown), honoring
  `stop`.
- **Usage limits:** the engine detects a limit hit and parses the "resets at" time. With **multiple
  `claude.bins`** it rotates to the next account and continues **immediately** — but because
  `--resume` is account-scoped, the fallback account gets a **continuation prompt** (built from the
  PROGRESS log + the original prompt) telling it to continue where the previous session stopped.
  Only when **all** bins are limited does it wait for the soonest reset, then resume. A
  limit-interrupted task, once finished, is followed by the next task **immediately** (catch-up).

### Env overrides

`CLAUDE_BINS` (comma-sep; overrides `claude.bins`; single `CLAUDE_BIN` also honored), `CLAUDE_MODEL`,
`RUN_INTERVAL`, `START_DELAY`, `PAUSE_KILL_THRESHOLD`, `LIMIT_BACKOFF` (fallback reset wait when the
reset time can't be parsed, default 3600s).

## 7. Worked example (a 2-task toy)

`instances/hello/config.mjs`:

```js
export default {
  name: 'hello',
  tasks: ['alpha', 'beta'],
  roundMode: (r) => (r <= 1 ? 'CREATE' : 'IMPROVE'),
  vars: (ctx) => ({ NOTE: `working on ${ctx.task}` }),
  subagents: (ctx) => (ctx.round <= 1 ? [] : [{ name: 'reviewer', scope: 'Review {{task}} and list fixes' }]),
  claude: { bins: ['claude'], flags: ['--verbose'] },
};
```

`instances/hello/prompt.first.md`:

```md
# Create {{task}} ({{roundMode}}). {{NOTE}}.
{{include:prompt.common.md}}
Begin.
```

Then `node automation/lmauto.mjs run hello --dry-run` → alpha, round 1, `CREATE`. Run twice more →
beta round 1, then alpha round 2 uses `prompt.next.md` with the `reviewer` subagent.

## Requirements

- The `claude` CLI on `PATH` (or set `claude.bins` / `CLAUDE_BINS`). Runs use
  `--dangerously-skip-permissions` — fully autonomous; it **will edit files, run commands, and (per
  your prompt) commit/push**. Only run where that is intended.
- Node ≥ 24. Zero npm dependencies — the engine is pure Node built-ins.
