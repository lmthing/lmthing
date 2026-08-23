# dsh/ — LMThing space format on DeepSeek Harness

Experimental, non-production track. See `/home/vasilis/.claude/plans/i-want-to-make-foamy-tower.md`
for the full plan (context, architecture mapping, phase breakdown, roadmap).

This does not touch `sdk/org`, `cloud/`, or production pods.

## Status: Phase 2 — one dsh plugin per feature — DONE and live-verified

The Phase 1 walking skeleton (below) has been rebuilt as a family of independently-mountable dsh
Cordis plugins instead of an external script pre-rendering a static `cordis.patch.yml`. A profile
now mounts exactly **`@lmthing/dsh-space`** (the umbrella plugin, `packages/space/`) once per agent
— it internally `ctx.plugin()`s `space-functions`, `space-persona`, and `space-delegate` itself,
each fully self-loading from `{ spaceDir, agentSlug }` (no pre-computed function lists or delegate
rows). `scripts/assemble-lmthing-profile.mjs` shrank accordingly: it only sets THING's persona on
the global `system-prompt.persona` config (the one thing headless mode still can't do through a
plugin — see the architecture notes) and mounts one `@lmthing/dsh-space` row.

**A real bug found and fixed along the way**: every nested `ctx.plugin()` call in this family was
originally unawaited. `Context.plugin()` returns a `Fiber & PromiseLike<Fiber>` that "settles once
loading finished" — an unawaited call only *initiates* a child's mount; it does not wait for the
child's own async work (here: `loadSpace()` + dynamic `import()`s) to finish before the parent's own
`apply()` returns. A synchronous child registers in time regardless; `space-functions` (genuinely
async) did not — its tools silently missed the first request's tool-schema snapshot, with no thrown
error anywhere. Isolated by registering two debug probe tools at matching nesting depth, one
synchronous (visible) and one behind the same async gap as `space-functions` (invisible) — not a
Cordis scoping limit as first suspected, just a missing `await` on every `ctx.plugin()` call. Fixed
in `space/src/index.js`, `space-delegate/src/index.js`, and `space-persona/src/index.js`.

End to end, `dsh --profile lmthing "echo: <msg>"`: loads the ported `user-thing`/`system-echo`
spaces via `space-format`, mounts THING's persona + `remember`/`recall`/`forget`/`recallAll` as real
dsh tools via `space-functions`, and reaches the echo specialist through a `delegate_echo`
tool-subagent mounted by `space-delegate` — a REAL in-process child spawns with the echo
specialist's own distinct persona and a `toolFilter` narrowed to its own `echoBack` function, runs
it, and the result flows back to THING.

**Verified twice**: once keyless (`packages/llm-mock`, a scripted deterministic adapter, for
CI-style repeatable checks — see its test-trigger phrases in `src/index.js`), and once with a REAL
model (DeepSeek-V4-Flash-0731 via an OpenAI-completions-compatible gateway, wired through
`@deepseek-ai/dsh-llm-pi-ai`'s hand-declared-route config) which independently decided to call
`delegate_echo` and correctly reported the specialist's stamped response back — unscripted
confirmation that the whole bridge (space format → persona/tools → cross-space delegation) holds
up against a real model, not just pattern-matched trigger phrases.

Also verified: the negative case — setting `canDelegateTo: []` on THING and regenerating produces
no `delegate_echo` row at all (checked both by grepping the generated patch and by a live run that
correctly fell through to a plain answer instead of delegating).

### Reproduce (keyless)

```sh
cd dsh
pnpm install
node scripts/assemble-lmthing-profile.mjs   # regenerates .dsh-home/profiles/lmthing/cordis.patch.yml
DSH_HOME=$(pwd)/.dsh-home npx dsh --profile lmthing "echo: hello"
DSH_HOME=$(pwd)/.dsh-home npx dsh --profile lmthing "remember: favoriteColor=blue"
DSH_HOME=$(pwd)/.dsh-home npx dsh --profile lmthing "recall: favoriteColor"
```

### Reproduce (real model)

Write a `--patch` overlay (do NOT commit one with a real key — `apiKeyEnv` is a credential
*reference*, resolved from the environment, never stored in config):

```yaml
- id: llm-pi-ai
  config:
    providers:
      <your-route-name>:
        apiKeyEnv: YOUR_KEY_ENV_VAR
        api: openai-completions
        baseURL: https://your-openai-compatible-endpoint/v1
        models: [{ id: your-model-id }]
- id: agent-default-model
  config: { provider: <your-route-name>, model: your-model-id }
```

```sh
YOUR_KEY_ENV_VAR=... DSH_HOME=$(pwd)/.dsh-home npx dsh --profile lmthing --patch /path/to/overlay.yml "echo: hi"
```

### Environment gotcha hit along the way

dsh's launcher watches the active profile directory for live patch-file edits. That directory
contains pnpm's symlink-heavy `node_modules`, and on a machine with the default
`fs.inotify.max_user_watches` (65536) already partly consumed by other tools (editors, browsers),
booting a profile can throw `ENOSPC: System limit for number of file watchers reached`. Fix:
`sudo sysctl -w fs.inotify.max_user_watches=524288`. Environmental, not a defect in anything here.

Pinned dsh version: **0.1.1-rc.2** throughout (developer preview, breaking changes expected — an
unpinned `dsh plugin add` resolved a stale `dsh-headless@0.0.1-rc.1` that referenced a renamed,
404ing internal package, confirming the warning is not theoretical).

`DSH_HOME` for all local work in this track is `dsh/.dsh-home` (gitignored, analogous to a real
user's `~/.dsh` — generated profile installs, not durable content).

### Reproduce (web UI)

```sh
cd dsh
LMTHING_CLOUD_API_KEY=... ./scripts/run-web.sh --real   # or omit --real for the keyless mock
```

Then open http://127.0.0.1:3081. This boots THING with the same ported content as headless, but
as a real multi-turn chat session. Live-verified against DeepSeek-V4-Flash-0731 with the current
plugin family: `remember`/`recall` persisting across turns, and — after self-correcting from one
wrong-shaped first attempt — a real `delegate_echo` call spawning the echo specialist subagent and
returning its exact stamped response. See "The `lmthing-web` profile is broken" below for why this
script targets the stock `web` profile via `--patch` rather than `dsh --profile lmthing-web`
directly.

### A real bug this caught: `recall`'s missing-key case

`recall.js` originally returned `{ value: undefined, found: false }` for a missing key. dsh's tool
pipeline snapshots return values as **lossless JSON**, which explicitly rejects `undefined` (along
with `BigInt`, cycles, `-0`, ...) — so the call failed outright with `invalid output: value is not
lossless JSON`, not a silently-wrong answer. Fixed by returning `null` instead. Left as a live
example of the kind of bug this format extension (dsh tools need real output schemas) will keep
catching that LMThing's original raw-sandbox-injection format never could.

### The `lmthing-web` profile is broken (root cause not found — real bug or environment, unclear)

`dsh --profile lmthing-web ...` reproducibly fails on **every** tool call — including a completely
unmodified `todo_write` — with `Cannot read properties of undefined (reading 'prepare')`, thrown
outside the normal tool-execution error handling (no `tool/result` is ever logged; the whole turn
dies). This is **not** a bug in this port: extensive isolation testing (each proved live, via the
real model over the actual browser UI, using `chrome-devtools` MCP) established:

- A completely stock `dsh --profile web` (no patches at all beyond wiring a real provider) works.
- Every one of our customizations works **individually** applied to stock `web`: the persona
  override alone, our custom tools alone (one, then all four), and the `delegate_echo`
  tool-subagent row alone (proving actual cross-space delegation live over the web UI).
- The **full combination** — persona + all tools + subagent + the `watch: false` overrides —
  also works, applied to stock `web` as a `--patch` overlay.
- Yet a profile **named** `lmthing-web`, holding line-for-line the same generated
  `cordis.patch.yml`, fails every time — including after a full `rm -rf` + recreate from scratch.

So the content is provably correct; something about booting a *separately-named* profile with this
composition is broken, and the cause wasn't found (not a leftover file anywhere `grep`-able under
`.dsh-home`, not a package-version mismatch between the two profile directories). Workaround (what
`scripts/run-web.sh` does): apply `lmthing-web`'s generated `cordis.patch.yml` as a `--patch`
overlay on the stock `web` profile instead of booting a profile named `lmthing-web` directly. Worth
reporting upstream once this repo's issue tracker is checked; developer preview, 9 days old at the
time this was found.

## Architecture notes worth knowing before touching this

- **Every nested `ctx.plugin()` call MUST be `await`ed** — see the Phase 2 status section above.
  This is the single easiest mistake to reintroduce when adding a new feature plugin: a synchronous
  child happens to register in time regardless, so a bug here only shows up once a child does real
  async work (a `loadSpace()` call, a dynamic `import()`), and it fails *silently* — no thrown error,
  the tool/section/whatever just never appears.
- **dsh's in-process subagents (spawn/fork) JOIN the parent's own preset** rather than mounting a
  distinct one — `persona`/`toolFilter` on a `dsh-tool-subagent` row only override identity and
  narrow what's already registered. There is no "run a child under a completely different preset"
  mechanism at delegation time. `space-delegate`'s actual bridge: mount the delegated target's OWN
  `space-functions` into the delegator's scope too (so there's something to narrow *to*), then mount
  a `dsh-tool-subagent` per target with `persona` + `toolFilter: {allow: [target's own functions]}`.
  Net effect: a delegator's preset ends up holding the UNION of its own + every allowed target's
  functions, narrowed only at call time — a real fidelity gap against LMThing's per-agent-isolated
  capability model. See `packages/space-delegate/src/resolve.js`'s doc comment for the full reasoning.
- **`dsh-persona` is scope-only** — mounting it outside an agent-preset scope collides with
  `dsh-system-prompt`'s own unscoped registration and fails loud. This port has no
  `dsh-agent-presets` roster yet (headless mode has exactly one ambient agent), so
  `@lmthing/dsh-space` takes a `mountPersona: false` escape hatch for exactly this case: THING's
  persona is set directly on the global `system-prompt.persona` config (via `resolvePersonaText`,
  a plain function — no plugin involved) instead of through `space-persona`, and the echo
  specialist's persona rides `dsh-tool-subagent`'s own per-row `persona` field, which needs no
  scoped preset mount either. A later phase adding multiple named/selectable presets can default
  `mountPersona` away entirely — see `packages/space/src/index.js`'s doc comment.
- **Ported function files are `.js`, not `.ts`** — LMThing's originals run inside a TS-only QuickJS
  sandbox; this port's functions run as real Node ESM (dynamically `import()`ed by
  `space-functions/src/index.js`), so `space-format`'s loader was widened to also recognize
  `.js`/`.mjs` (documented in `load.js`, not a silent LMThing behavior change).
- **Ported functions additionally export `schema`/`description`/`outputSchema`** — a deliberate,
  documented extension of the LMThing function-file format for this port, since dsh tools need a
  declared JSON Schema and LMThing's format has none (functions were injected raw into the sandbox).
- **`user-thing/functions/*.js` are thin re-exports** of `system-global`'s real implementations —
  a stand-in for LMThing's `mergeSystemInto` (not ported; see roadmap), just enough for THING's own
  `loadSpace` validation to see the functions it declares as physically present.
- **A message's `role: 'user'` is NOT enough to mean "the human's own text"** — a single dsh turn's
  `options.messages` also carries role:'user' entries for tool results (`source.kind: 'tool'`),
  system-prompt runtime snapshots (`source.kind: 'plugin', form: 'snapshot'`), and — found only by
  actually running this from inside the lmthing git checkout — `dsh-agent-instructions` feeding the
  REPO'S OWN root `CLAUDE.md` in as workspace instructions (`source.kind: 'agent-instructions'`).
  Only `source.kind === 'user'` is the real thing; see `packages/llm-mock/src/index.js`.

## Layout

```
dsh/
  packages/
    llm-mock/          # keyless, scripted test-double LLM adapter (not part of the port)
    space-format/        # pure parser for the LMThing space format, no Cordis dependency
    space/                 # @lmthing/dsh-space — THE umbrella plugin a profile mounts; loads everything below
    space-functions/        # functions/* -> dsh tools (self-loading: { spaceDir, agentSlug })
    space-persona/           # charter+instruct -> dsh-persona (self-loading)
    space-delegate/           # canDelegateTo -> tool-subagent (see architecture notes above)
  system-spaces/          # ported content, same on-disk shape as sdk/org/libs/core/system-spaces/*
    system-global/          # 4 of 8 functions ported (remember/recall/forget/recallAll)
    user-thing/             # trimmed THING (charter + a short routing instruct.md, no tasklists/knowledge)
    system-echo/            # toy specialist, built for this port to prove cross-space delegation
  scripts/
    assemble-lmthing-profile.mjs   # sets THING's global persona + mounts @lmthing/dsh-space per agent
  .dsh-home/              # gitignored — local Harness home for this track
```

## Roadmap (not started)

See the plan file's current sections: the tasklist DAG → `dsh-workflow` bridge (`space-tasklist`,
in progress — compiler design done, package not finished), knowledge → an ambient system-prompt
tree + `loadKnowledge` tool (`space-knowledge`, not started), `space-components` (a `display` tool
over `components/view`+`components/form`, not started), the project-authoring capability model
(db/views/api/connections/events — no dsh analog exists), `client-space-components` (real Web
Client UI rendering — a distinct, further-out concern from `space-components` above), the remaining
12 system spaces, and a real `dsh-agent-presets` roster once multiple named/switchable presets are
needed. Also still open: `webSearch`/`webFetch`/`todoWrite`/`todoRead` from `system-global` were not
ported (need the render service / no dsh equivalent decided yet).
