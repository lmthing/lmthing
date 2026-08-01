# Testing

How tests actually run in this repo — the runners, the commands that work (and the ones that
silently don't), the keyless mock-LLM harness, and the live prod scenario runner. Every claim below
was checked against the config and the code.

---

## TL;DR

```bash
cd sdk/org
pnpm test                                     # the whole runtime suite (vitest run)
pnpm test libs/core/src/tasklist              # one directory
pnpm test libs/core/src/tasklist/condition-dsl # one file (substring filter)

pnpm build && LM_LIVE=1 pnpm exec vitest run libs/cli/src/testing/live-llm.test.ts   # real model

node sdk/org/scenarios/run-scenario.mjs 06-tanzania             # a live scenario (own per-run serve, real LLM) — §7
```

There is **no `test` script at the repo root** (`package.json:L8-L16` — only `dev`, `thing`,
`build`, `build:pages`, `lint`, `lint:tokens`, `preview`). The runtime suite lives in the `sdk/org`
submodule and is run from there.

---

## 1. Two workspaces, one confusing consequence

The repo has **two overlapping pnpm workspaces**:

| Workspace | Members | Runner it installs |
|---|---|---|
| repo root | the product SPAs, `cloud`, `org`, **plus `sdk/org/libs/*` and `sdk/org/apps/*`** (`pnpm-workspace.yaml:L1-L12`) | `vite-plus` — the catalog aliases `vitest` to `npm:@voidzero-dev/vite-plus-test@latest` and `vite` to `@voidzero-dev/vite-plus-core@latest`, with `overrides` forcing both (`pnpm-workspace.yaml:L14-L21`, `:L25-L27`) |
| `sdk/org` | `libs/*`, `apps/*` (`sdk/org/pnpm-workspace.yaml:L1-L3`) | real `vitest` `^1.6.0` (`sdk/org/package.json:L18`) |

`sdk/org` is **not** a member of the root workspace (only its `libs/*`/`apps/*` are), so
`@lmthing/root`'s scripts — including `"test": "vitest run"` (`sdk/org/package.json:L9`) — resolve
against `sdk/org`'s own install (`sdk/org/pnpm-lock.yaml`). That is why the runtime suite is run
with `cd sdk/org && pnpm test` and not from the repo root.

The consequence: **the same `libs/*` package directories are installed by whichever `pnpm install`
ran last.** A root install materialises `libs/state/node_modules/vitest` as
`@voidzero-dev/vite-plus-test`; an `sdk/org` install materialises real `vitest`. Keep this in mind
when a runner errors with something that looks like a bundler-internals crash rather than a test
failure.

### The `libs/state` scripts are broken in *both* workspaces

The sharpest instance of that consequence: **`@lmthing/state`'s test scripts cannot run in either
install.** All four of them shell out to `vp`, the vite-plus binary
(`sdk/org/libs/state/package.json:L50-L53`) — but `vite-plus` is declared only by the repo root
(`package.json:L17-L19`) and by `sdk/org/apps/web` (`sdk/org/apps/web/package.json:L67-L68`), never
by `@lmthing/state` itself and never by `@lmthing/root` (`sdk/org/package.json:L15-L22`). So `vp`
reaches a `libs/state` script's PATH only via the **root** workspace's bin dir — i.e. only on a root
install. And on a root install the `overrides` pull the rug out: they force *every* member's `vitest`
onto the catalog alias (`pnpm-workspace.yaml:L25-L27`), so state's declared `vitest: ^4.1.0`
(`sdk/org/libs/state/package.json:L76`) is replaced by `npm:@voidzero-dev/vite-plus-test@latest`
(`pnpm-workspace.yaml:L21`), locked to `@voidzero-dev/vite-plus-test@0.1.24`
(`pnpm-lock.yaml:L85-L87`) — a package that publishes **no `bin` field**. `pnpm --filter
@lmthing/state test` therefore dies before collecting a single test:

```
error: Failed to resolve test command: GenericFailure, Error: Could not find 'vitest' bin entry
in …/@voidzero-dev/vite-plus-test/package.json
```

Reaching past the script doesn't help — `pnpm exec vitest run` inside the package resolves to the
same vite-plus-test, whose vite-plus-core startup then throws `value "builtin:vite-wasm-fallback"
does not match any variant of enum BindingBuiltinPluginName`. The two halves of vite-plus are
aliased as **independent** floating `@latest` pins (`pnpm-workspace.yaml:L19-L21`) and have already
drifted apart in the committed lockfile — core at `0.2.4`, test at `0.1.24` (`pnpm-lock.yaml:L79-L87`).

An `sdk/org` install is no rescue either. It resolves state's `vitest` to real `vitest@4.1.9`
(`sdk/org/pnpm-lock.yaml:L458-L460`), but it installs no `vite-plus` anywhere — so `vp test run` has
no binary to call at all.

Net effect: `libs/state` is excluded from the main runner (`sdk/org/vitest.config.ts:L19-L25`) and
its own scripts don't work, so its **29 test files run nowhere** — the same orphaning as
[`libs/ui`](#the-libsui-gap), with the extra twist that here a `test` script exists and *looks* like
it runs them. Wiring up a runner that actually executes `sdk/org/libs/state/vitest.config.ts` is fair
game.

---

## 2. The vitest configs

### `sdk/org/vitest.config.ts` — the main runtime suite

One node-environment config drives everything under `sdk/org/libs/*` and the node-safe part of
`apps/web` (`sdk/org/vitest.config.ts:L1-L34`):

```ts
    include: [
      'packages/*/src/**/*.test.ts',
      'packages/*/src/**/*.test.tsx',
      'packages/*/apps/*/src/**/*.test.ts',
      'packages/*/apps/*/src/**/*.test.tsx',
      'libs/*/src/**/*.test.ts',
      'libs/*/src/**/*.test.tsx',
      // apps/web has a handful of pure (node-safe) unit tests — origin
      // resolution, host→surface routing. DOM/component tests live in libs/ui
      // (its own jsdom config); keep only node-safe suites matched here.
      'apps/web/src/**/*.test.ts',
    ],
```

Facts worth knowing:

- **Tests are co-located** with source: `<pkg>/src/**/*.test.ts` (`sdk/org/vitest.config.ts:L5-L16`).
  There is no `__tests__/` convention and **no global setup file** — each file imports what it needs.
- The `packages/*` globs match **nothing** — `sdk/org` has no `packages/` directory (it has `libs/`
  and `apps/`); they are dead leftovers (`sdk/org/vitest.config.ts:L6-L9`).
- **`libs/state` and `libs/ui` are excluded** from this runner (`sdk/org/vitest.config.ts:L19-L25`)
  because they are DOM suites.
- **Environment is `node`**, `testTimeout` is **20 s** and `hookTimeout` **30 s**
  (`sdk/org/vitest.config.ts:L26-L32`) — raised from vitest's 5 s default because many suites boot
  real QuickJS VMs and a few spawn the built CLI as a subprocess.

### `sdk/org/libs/state/vitest.config.ts` — the jsdom suite

`@lmthing/state` has its own config: `@vitejs/plugin-react`, `environment: 'jsdom'`, `include:
['src/**/*.test.{ts,tsx}']` (`sdk/org/libs/state/vitest.config.ts:L1-L14`), and its own scripts —
`test` → `vp test run`, plus `test:ui` / `test:coverage` (`sdk/org/libs/state/package.json:L50-L53`).
29 test files live under `sdk/org/libs/state/src/` (e.g.
`sdk/org/libs/state/src/hooks/useSpace.test.tsx`).

### The `libs/ui` gap

`libs/ui` is excluded from the main runner because its suites need jsdom + React transforms that the
node runner does not provide (`sdk/org/vitest.config.ts:L19-L25`) — but **it has no vitest config and
no `test` script to run them with either**. `sdk/org/libs/ui/` contains only `package.json`, `src/`,
`tsconfig.json`; `@lmthing/ui`'s scripts are `lint:tokens` / `lint` / `format` only
(`sdk/org/libs/ui/package.json:L23-L27`) and it has no `vitest` devDependency. Yet **71 test files**
exist under `sdk/org/libs/ui/src/` (e.g. `sdk/org/libs/ui/src/chat/components/ConsentCard.test.tsx`,
`sdk/org/libs/ui/src/chat/app/auto-resume.test.ts`). They are excluded from the root runner and no
script runs them: **`libs/ui`'s tests are currently orphaned**. If you touch `libs/ui`, run its suite
by hand against a jsdom config, and treat wiring one up as fair game.

---

## 3. Running tests

### Everything

```bash
cd sdk/org
pnpm test          # → vitest run   (sdk/org/package.json:L9)
```

### One package / directory / file

`vitest run <filter>` treats its positional arg as a **path substring**, so scoping is a path prefix:

```bash
cd sdk/org
pnpm test libs/core                            # every core suite
pnpm test libs/cli/src/server                  # the pod-server suites
pnpm test libs/core/src/tasklist/condition-dsl # one file
pnpm exec vitest run libs/core/src/globals/ask.test.ts   # equivalent, explicit
```

> **Trap: `pnpm --filter <pkg> test` does nothing.** `@lmthing/core`, `@lmthing/cli`,
> `@lmthing/auth`, `@lmthing/utils` and `@lmthing/ui` have **no `test` script**
> (`sdk/org/libs/core/package.json`, `sdk/org/libs/cli/package.json`, …). pnpm treats a missing
> script in a filtered run as a no-op, so `pnpm --filter @lmthing/core test -- system-functions`
> exits **0 with no output** — it looks green and ran nothing. Only `@lmthing/state`
> (`:L50`) defines `test`. Use the path filter above instead.

### Turbo

`sdk/org/turbo.json:L11-L13` defines a `test` task (`dependsOn: ["^build"]`), but no script invokes
`turbo run test` — `pnpm test` calls `vitest run` directly (`sdk/org/package.json:L9`). `turbo run
test` would only reach the two packages that declare a `test` script.

### CI

**No workflow runs the test suite.** The four root workflows are `build-images.yml`,
`design-tokens.yml`, `pr-decline.yml`, `stale.yml` — a grep for
`vitest|pnpm test|vp test` across `.github/workflows/` returns nothing. The only hard automated gate
is the design-token lint (`.github/workflows/design-tokens.yml`, see
[`README.md`](./README.md#hard-gates-ci-will-fail-you)). **Running the suite before you push is on
you.**

### The ESLint config, and the family of checks it silently was not running

One shared flat config, `sdk/org/libs/config/eslint/index.js`, re-exported by
`sdk/org/eslint.config.js`. Two things about it are worth knowing, because both were invisible while
wrong.

**`eslint-plugin-react-hooks` was a declared dependency that the config never registered.** It sat in
`@lmthing/config`'s `dependencies` and appeared in no `plugins` block, so **`rules-of-hooks` had never
run anywhere in this monorepo**. The only symptom pointed the wrong way: source files carrying
`// eslint-disable-next-line react-hooks/exhaustive-deps` failed lint with "Definition for rule was
not found", which reads like a typo in the comment rather than like a whole family of checks being
absent. Registering it reported, as errors:

- `sdk/org/libs/ui/src/chat/app/Composer.tsx` — an early `return` for replay mode above four hook
  calls, so the hook COUNT depended on a prop. React matches hook state positionally; that is
  "Rendered fewer hooks than expected", or silently reading another hook's state.
- `sdk/org/apps/web/src/lib/gates.tsx#PodEnsureGate` — the same shape above eleven hooks, in the gate
  that fronts every surface. Latent rather than live: it is stable only because `isPodEmbedded()` and
  `isLocalRun()` read deployment facts that never change within a session.
- `sdk/org/libs/state/src/hooks/useDraft.ts#useDraftMutations` — `save` did
  `await import('./fs/useAppFS')` and then CALLED the hook, inside a plain async callback. Hooks read
  the fibre that is currently rendering, and a resolved click handler has none.

`exhaustive-deps` stays at the plugin's own `warn` (~47 of them, several deliberate and annotated).

**The `eslint-recommended` overrides layer was missing**, and had been approximated by hand: the
config turned off `no-undef` and `no-unused-vars`, which are two of the ~23 base rules
`@typescript-eslint` provides that layer to switch off on TypeScript. The other twenty-one were left
firing. `no-redeclare` is the one that bit — it reported
`sdk/org/libs/ui/src/studio/workflow/workflow-card` for importing the TYPE `TasklistListItem` and
exporting a FUNCTION of the same name, which is legal (separate declaration spaces) and which `tsc`
is silent about. Note the layer is not only subtractive: it also ENABLES `prefer-const`, whose default
is too strict for the declare-`let`, define-a-closure, assign-once pattern — hence
`ignoreReadBeforeAssign`.

Two more things the same pass surfaced, both from rules that had always been enabled and whose
findings nobody had read:

- `sdk/org/libs/ui/scripts/bem-sweep.mjs` used `unlinkSync` and never imported it, so the one branch
  that deletes an emptied stylesheet threw instead. Unreportable until now: plain `.js`/`.mjs` matched
  no globals block, so a script could not be linted against its own environment.
- `sdk/org/libs/core/src/fork/fork.ts#ForkEngine` runs its fork inside an `async` Promise executor. A
  throw there does not reject — it leaves the promise **unsettled**, which for a fork is a HANG, not
  an error. `new Budget(...)` was the one throwable statement above the `try`, and is now inside it.

`import/order` and `jsx-a11y/*` are **not enforced**: those plugins are not dependencies, and the
`eslint-disable` comments naming them in `libs/ui` are dead references. Adding them is an open
decision, not an oversight to fix silently.

---

## 4. The mock-LLM harness (keyless testing)

The model is reached through exactly **one** function — `streamFn`, injected at the `Session`
boundary and threaded unchanged into every fork and delegate. So a single scripted `streamFn`
covers session + forks + delegates, and because it sits *upstream* of the tracer, every
`llm_request` / `llm_response` / `yield` trace event still fires — only the *content* is scripted
(`sdk/org/libs/core/src/testing/mock-provider.ts:L3-L13`).

### The three builders

All live in `sdk/org/libs/core/src/testing/mock-provider.ts` and are re-exported from the package
root (`sdk/org/libs/core/src/index.ts:L215-L216`):

| Builder | Signature | Behaviour |
|---|---|---|
| `createMockStreamFn(handler)` | `MockHandler → streamFn` | Raw escape hatch. The handler returns a `string`, a `string[]` (emitted as chunks — exercises streaming), or an `AsyncIterable<string>`; the returned `textStream` honours `abort()` (`mock-provider.ts:L45-L73`) |
| `mockScript(turns)` | `string[] → streamFn` | Sequential queue: call *N* of the run emits `turns[N]`; past the end it emits `''`, which ends the turn loop (`mock-provider.ts:L75-L82`) |
| `mockMatch(rules, fallback?)` | `MockRule[] → streamFn` | First-matching-rule-wins router. A `RegExp` `when` is tested against `system + every message` (`matchHaystack`, `:L93-L104`); a predicate `when` gets the raw `StreamOpts`. **Throws** when nothing matches and no fallback is given — "a loud failure beats a silent empty turn that looks like 'the model decided it was done'" (`:L106-L132`) |

Two contracts to internalise:

- **Returning `''` (or whitespace) ends the turn loop** — the loop treats "no statements" as done
  (`mock-provider.ts:L28-L29`).
- **`ctx.callIndex` is a single counter across the whole run** — session turns *and* fork/delegate
  turns share it (`mock-provider.ts:L16-L20`). That is why `mockMatch` (route on the prompt) is more
  robust than `mockScript` (route on position) once forks interleave.

### Using it in a unit test

A yielding statement aborts the turn, so the call and the statement that consumes its result must
live in **different turns** — this is the canonical shape
(`sdk/org/libs/core/src/testing/harness-features.test.ts:L195-L221`):

```ts
describe('harness — ask()', () => {
  it('yields to the host and binds the returned answer into scope', async () => {
    // A yielding statement aborts the turn, so the ask() and the display() that
    // consumes its result must live in separate turns (callIndex 0 then 1).
    const m = createMockStreamFn((_o, { callIndex }) => {
      if (callIndex === 0)
        return `const name = await ask({ type: "input", props: { label: "name?" }, children: [] });`;
      if (callIndex === 1) return `display("hi " + name);`;
      return '';
    });
    const r = await runSession({
      streamFn: m,
      message: 'go',
      ask: async (_id, descriptor) => {
        // The descriptor the model built is handed through to the host untouched.
        expect((descriptor as { props: { label: string } }).props.label).toBe('name?');
        return 'Ada';
      },
    });
    expect(r.error).toBeUndefined();
    expect(r.displays).toContain('hi Ada');
    // The yield was traced as an ask and resolved with the host's answer.
    expect(r.trace.some((e) => e.type === 'yield' && e.kind === 'ask')).toBe(true);
    expect(
      r.trace.some((e) => e.type === 'yield_resolved' && e.kind === 'ask' && e.value === 'Ada'),
    ).toBe(true);
```

`runSession` there is a local helper: it makes a temp one-agent space, builds a `RenderHost` that
records `display`/`log`, points the `Session` at a temp `trace.jsonl`, runs `start()` (+ optional
`continue()`), disposes, and reads the NDJSON trace back
(`sdk/org/libs/core/src/testing/harness-features.test.ts:L65-L114`). **Assert on the trace and on
host effects, not on prose.**

### Using it from the CLI (`--mock` / `LM_MOCK`)

The CLI takes a mock module path and **skips `resolveModel` entirely, so no API key is required**
(`sdk/org/libs/cli/src/cli/bin.ts:L300-L307`). The module is an ESM `.mjs` whose default export is a
`MockHandler` **or** a `string[]` (wrapped in `mockScript`); it is resolved relative to the CLI's cwd
(`sdk/org/libs/cli/src/cli/bin.ts:L183-L201`). The flag is `--mock <path>`
(`sdk/org/libs/cli/src/cli/args.ts:L164-L169`), env fallback `LM_MOCK`
(`bin.ts:L301`); combine with `--trace <file>` (`args.ts:L115-L120`) to get the NDJSON to assert on,
and `--web [port]` (`args.ts:L182-L189`) or `--request "<msg>"` (`args.ts:L170-L175`) for the server
and headless modes.

### Replaying a recorded trace (`mockFromTrace`)

A `--trace` file already contains everything the model contributed to a run and nothing else — the
tracer sits *downstream* of `streamFn`, writing one `llm_request` / `llm_response` pair per model
call (`sdk/org/libs/core/src/eval/turn-loop.ts:L589`, `:L853-L862`). Feeding those recorded
responses back in through `streamFn` re-runs the **whole host pipeline** — boundary carving,
model-habit sanitization, prose demotion, typecheck, eval, yield binding, error rewriting — against
a known transcript, with no credentials and the model out of the loop
(`sdk/org/libs/core/src/testing/trace-replay.ts:L6-L24`).

```ts
import { mockFromTrace } from '@lmthing/core';

const session = new Session(opts, { streamFn: mockFromTrace('run.ndjson') });
// order-independent variant, for recordings with retries or concurrent forks:
const session2 = new Session(opts, { streamFn: mockFromTrace('run.ndjson', { mode: 'fingerprint' }) });
```

| Export | Role |
|---|---|
| `mockFromTrace(path, opts?)` | Read a trace file and return a replaying `streamFn` (`sdk/org/libs/core/src/testing/trace-replay.ts#mockFromTrace`) |
| `mockFromExchanges(exchanges, opts?)` | Same replay semantics over already-parsed exchanges — in-memory traces, tests (`trace-replay.ts#mockFromExchanges`) |
| `parseTraceExchanges(raw)` / `readTraceExchanges(path)` | Parse a trace into ordered `TraceExchange`s (`trace-replay.ts#parseTraceExchanges`, `#readTraceExchanges`) |
| `requestFingerprint(opts)` | The match key `mode: 'fingerprint'` uses — the last **user** message, whitespace-collapsed (`trace-replay.ts#requestFingerprint`) |

The contracts:

- **Two modes.** `sequential` (default) gives call *N* of the replay recorded response *N* — faithful
  and strict, the right mode for a single-threaded recording. `fingerprint` matches each incoming
  request to a recorded one by `requestFingerprint`, so order stops mattering (retries, concurrent
  forks); repeats of the same prompt are served in recorded order
  (`trace-replay.ts#MockFromTraceOpts`).
- **Exhaustion throws**, naming how many calls were recorded versus requested. It never falls back to
  `''` the way `mockScript` does: an empty response reads as "the model decided it was done"
  (`turn-loop.ts:L1140-L1143`), so a silent one would turn a divergence into a green test
  (`trace-replay.ts#mockFromTrace`).
- **Requests and responses pair per node**, not globally, so interleaved fork calls don't
  cross-contaminate; every event type other than `llm_request`/`llm_response` is skipped
  (`trace-replay.ts#parseTraceExchanges`).
- **A request with no recorded response replays as an empty turn** (`unanswered: true`) — that is
  what the recorded run saw. A response recorded from an *aborted* stream replays verbatim: the
  tracer writes `llm_response` from `parsedStatements`, so a stream cut at a yield recorded exactly
  the statements up to the yield (`turn-loop.ts:L851-L862`, `trace-replay.ts#TraceExchange`).
- **Both on-disk shapes parse** — NDJSON from `--trace` (`sdk/org/libs/core/src/sandbox/trace.ts#Tracer`)
  and the JSON array a persisted `.lmthing/**/sessions/*/trace.json` snapshot holds, bare or in
  `{seq, event}` envelopes (`sdk/org/libs/cli/src/server/session-manager.ts:L1630`).

From the CLI, a `--mock` path ending in `.ndjson` or `.jsonl` is treated as a recorded trace rather
than a mock module and routes through `mockFromTrace`; `LM_MOCK_MODE=fingerprint` selects the
order-independent mode (`sdk/org/libs/cli/src/cli/bin.ts#loadMockStreamFn`):

```bash
node libs/cli/dist/cli/bin.js --space <dir> --trace /tmp/run.ndjson "<message>"   # record
node libs/cli/dist/cli/bin.js --space <dir> --mock  /tmp/run.ndjson "<message>"   # replay
```

**What a replay proves:** the host processes a given transcript the same way it did when the
transcript was recorded — so a prompt/parser/mercy-layer change that silently alters statement
extraction, and a fix that is supposed to neutralize a recorded failure, are both caught offline.
**What it cannot prove:** that a live model would still *generate* that transcript under a changed
prompt. That stays live (§7).

### The failure-fixture bank

`sdk/org/libs/core/src/testing/fixtures/` holds recorded transcripts kept for replay — known-good
runs (a parser change breaks them) and known-bad ones harvested from real runs (narration instead of
code, unterminated literals, a missing `await` on a yielding call, hallucinated globals). The
harvest workflow, the trimming and secret-hygiene rules, and how to regenerate the seed fixture
(`LM_UPDATE_FIXTURES=1 pnpm test libs/core/src/testing/trace-replay`) live in
`sdk/org/libs/core/src/testing/fixtures/README.md`.

---

## 5. `libs/core/src/testing/` — what's in there

Two helper modules plus five suites that are themselves the harness's coverage:

| File | Role |
|---|---|
| `mock-provider.ts` | The three builders above |
| `trace-replay.ts` | `mockFromTrace` + the trace parser — replay a recorded run through the host pipeline (`#mockFromTrace`) |
| `trace-replay.test.ts` | Parsing (per-node pairing, skipping, unanswered requests, both on-disk shapes, a truncated final line), the exhaustion error, fingerprint matching — plus the **round trip**: record a scripted session with tracing on, replay its trace through a fresh session, assert identical statements/displays/responses (`:L18-L31`) |
| `fixtures/` | The failure-fixture bank + its harvest workflow (`fixtures/README.md`) |
| `mock-provider.test.ts` | Unit-tests the builders: chunking, `AsyncIterable` handling, `callIndex` increments, `abort()` mid-flight, `mockMatch` RegExp/predicate routing, first-rule-wins, throw-on-no-match (`:L41-L121`) |
| `mock-session.test.ts` | Drives a **real `Session`** with a scripted provider — budget guardrails (episode / tool-call / wall-clock / fork-depth), `progress()`, per-role fork models on the `llm_request` trace (`:L20-L28`) |
| `harness-features.test.ts` | Keyless end-to-end coverage of **every value-yielding global**: `ask`, `inspect`, `loadKnowledge`, `sleep`, `fork` roles (parallel `Promise.all` binding order + read-only gating), `tasklist` DAGs, `delegate`, `registerSpace`, the system spaces (fs/memory/todo), and history summarisation (`:L13-L31`) |
| `attachments-core.test.ts` | Multimodal input threading through a `Session` (`:L29`) |

Both `mock-session.test.ts` and `harness-features.test.ts` resolve the system spaces manually
(`join(__dirname, '..', '..', 'system-spaces')`) because `defaultSystemSpaceDirs()` assumes the
`dist/` layout and would point at a nonexistent dir when running from `src`
(`sdk/org/libs/core/src/testing/harness-features.test.ts:L33-L40`).

---

## 6. `libs/cli/src/testing/` — subprocess & live suites

These drive the **built** CLI (`libs/cli/dist/cli/bin.js`) as a subprocess, so they need
`pnpm build` first; they self-skip when the binary is absent
(`sdk/org/libs/cli/src/testing/live-harness.ts:L39-L46`).

`live-harness.ts` is the shared kit: `REPO_ROOT` / `BIN` / `TRACE_DIR`
(`:L36-L42`), `loadRepoEnv()` (`:L51`), `runCli(opts)` — space, message, `--mock`, budget caps, extra
env, stdin, timeout (`:L65-L121`) returning `{ code, timedOut, stdout, stderr, trace, tracePath }`
(`:L93-L104`) — plus trace query helpers `sessionRequests` / `forkRequests` / `yieldResolved` /
`emittedCode` / `ofType` (`:L196-L246`).

| Suite | Status |
|---|---|
| `keyless-cli.test.ts` | **QUARANTINED** — `describe.skip` (`:L24`). It drives the built CLI against `fixtures/engineer/` with `--mock`, but the whole `fixtures/` tree was deleted in commit `acb460a`; the suite only self-skipped on a missing `dist/`, so a full `pnpm test` after a build went red. See `sdk/org/.issues/keyless-web-fixtures-removed.md` |
| `web-api.test.ts` | **QUARANTINED** — `describe.skip` (`:L73`). Same cause (`fixtures/cooking/` + `mock-ask.mjs`); it spawns `--web` + `--mock` and exercises `POST /api/message`, `/api/state`, and the WS trace stream (`:L1-L9`) |
| `live-llm.test.ts` | Gated on **`LM_LIVE=1` and a built binary** (`describe.skipIf(!hasBin() || !LIVE)`, `:L85`; `LIVE = !!process.env['LM_LIVE']`, `:L39`). Runs the real model (Azure, keys from `sdk/org/.env`) and asserts on the trace, splitting HARD (host-generated) from SOFT (model-dependent) assertions; traces land in `sdk/org/libs/cli/.live-traces/<scenario>.jsonl` (`:L1-L18`, gitignored via `sdk/org/.gitignore:L15`). Run it with `pnpm build && LM_LIVE=1 pnpm exec vitest run libs/cli/src/testing/live-llm.test.ts` (`:L11`) |
| `multi-session.test.ts` | Multi-session server behaviour (part of the normal run) |

**There is no `sdk/org/fixtures/` tree.** The reference spaces the two quarantined suites drove
(`cooking`, `engineer`, …) were deleted in commit `acb460a`; the only `fixtures/` left in the
submodule is `sdk/org/scenarios/06-tanzania/fixtures/` (scenario attachments). Re-enabling
`keyless-cli.test.ts` / `web-api.test.ts` means **restoring** minimal fixtures first — fix plan in
`sdk/org/.issues/keyless-web-fixtures-removed.md`. There is likewise **no `scripts/live-test.sh`**:
`sdk/org/scripts/` holds only `thing-dev.mjs`, and that shell harness was ported into
`libs/cli/src/testing/keyless-cli.test.ts` (`:L1-L3`) — which is itself now skipped.

**Known flake** (same issue file): `sdk/org/libs/cli/src/server/serve-tree-ws.test.ts` intermittently
fails a full parallel run with `ENOTEMPTY … rmdir '.../user/sessions/<id>'` — a race between an
in-flight session-snapshot write and the recursive temp-dir teardown. It passes reliably in
isolation (`pnpm exec vitest run libs/cli/src/server/serve-tree-ws.test.ts`).

---

## 7. `sdk/org/scenarios/` — the live scenario runner

Vitest stops at the process boundary. The `scenarios/` tree is the layer above: **end-to-end
scenarios played against a real `lmthing serve` with a live LLM** — a real project, a real THING chat
session, real model calls, nothing mocked. The tree is a script-free workspace package,
`@lmthing/scenario-harness` (`sdk/org/scenarios/package.json`), whose public surface is the barrel
`sdk/org/scenarios/index.mjs`.

A scenario is a **single declarative `scenario.yaml`** (persona · promise · invariants · knows ·
steps) plus a **`fixtures/`** dir of real input files — `06-tanzania` and `07-life-admin` today. It is
played by the generic runner `run-scenario.mjs`, **local by design** (`SCENARIO_TARGET=local`, the
default): every invocation spins up its **own** throwaway `lmthing serve` via
`pnpm lmthing serve --cwd <run>/data …`, which runs the CLI from TS source through `tsx` — so a
product fix needs **no `pnpm build`**, just a rerun. The runner writes per-step **evidence** for a
separate judge (`sdk/org/scenarios/campaign/judge.md`) to score — it does not judge.

Each invocation is a fresh, uniquely-numbered **run** under `sdk/org/scenarios/<scenario>/runs/<n>/`:
its own `data/.lmthing`, its own server on an allocated port, and — at the end of every step — a
**snapshot** of the project files under `runs/<n>/snapshots/step-NN/`. A rerun can seed a new run
from a chosen snapshot and continue instead of replaying (the expensive earlier steps stay done).

```bash
node scenarios/run-scenario.mjs 06-tanzania --plan            # dry-print the step plan + fixture-coverage audit
node scenarios/run-scenario.mjs 06-tanzania                    # a fresh run (runs/<next>), every step, write evidence
node scenarios/run-scenario.mjs 06-tanzania --resume 1 --from 2   # new run, seed from run 1's step-2 snapshot, continue at step 3
node scenarios/harness/runs.mjs 06-tanzania list              # inspect / clean up prior runs (list · path · logs · down · gc)
```

The engine is `ScenarioRunner` (`sdk/org/scenarios/lib/runner.mjs#ScenarioRunner`): it starts the
per-run server (`sdk/org/scenarios/harness/lib/local.mjs#startRun`), plays each step's verbs
(`say`, `then_say`, `in_app_chat`, `open_app`, `attach[]`, `fresh_session`, `restart_pod`;
`if_asked{}`/`deny_consent` ground the driver's in-persona answers via
`sdk/org/scenarios/lib/asks.mjs#StepAsks`), and after every step writes the raw `step-NN.full.json`,
the judge-sized `step-NN.json` (`sdk/org/scenarios/lib/evidence.mjs#compactStep`), a `trace.md` block
(`sdk/org/scenarios/lib/evidence.mjs#traceLines`), a captured
`sdk/org/scenarios/lib/evidence.mjs#snapshot` of spaces + app tables, and a project-file snapshot
(`sdk/org/scenarios/harness/lib/local.mjs#snapshotProject`). The server dies WITH the run — a killed
`run-scenario` always takes its server down. `--through N` plays steps 1..N; `--resume <runId> [--from N]`
seeds from a prior run's snapshot and continues — the judge's verify rerun. `expect[]` is passed
through, never executed.

`smoke.mjs` walks the whole chain — register → pod → env → THING session → a real LLM turn → trace
assertions — so no scenario burns time on a broken harness
(`sdk/org/scenarios/harness/smoke.mjs:L1-L14`).

### Layout

- `scenarios/<NN>-<slug>/scenario.yaml` — the **declarative spec**: persona, the verbatim user
  messages as `say` steps, `if_asked` answers, and the `expect[]` the judge verifies.
- `scenarios/<NN>-<slug>/fixtures/` — the real input files (photos, PDFs, spreadsheets, voice memos) a
  `say` step `attach`es.
- `scenarios/<NN>-<slug>/runs/<n>/` — one isolated run: `data/.lmthing` (its runtime root),
  `snapshots/step-NN/` (per-step project-file snapshots for `--resume`), `sessions.log` (the server's
  stdout+stderr), `run.json`, `runner.pid`, and the evidence (`step-NN.json`, `.full.json`, `trace.md`,
  `summary.json`), plus a `runs/latest` pointer; all gitignored.
- `scenarios/lib/` — the runner library: `scenario.mjs` (`loadScenario`/`planLines`), `runner.mjs`
  (`ScenarioRunner`/`runScenario`), `evidence.mjs`, `asks.mjs`, `errors.mjs`. Pure-transform tests
  live beside them (`scenarios/lib/*.test.mjs`, matched in `sdk/org/vitest.config.ts`).
- `scenarios/harness/` — zero-dependency Node ESM the runner drives: `provision.mjs`
  (`sdk/org/scenarios/harness/provision.mjs#getUser`), `lib/pod.mjs`
  (`sdk/org/scenarios/harness/lib/pod.mjs#Pod`), `lib/thing.mjs`
  (`sdk/org/scenarios/harness/lib/thing.mjs#ThingSession`), `lib/local.mjs` (the local-server
  lifecycle), `lib/gateway.mjs` (the prod-provisioning path used by `smoke.mjs`), `lib/report.mjs`
  (`sdk/org/scenarios/harness/lib/report.mjs#Report`), `jwt.mjs`, `paths.mjs`.
- `scenarios/_template/` — `cp -r _template <NN-slug>` scaffold: a `scenario.yaml` skeleton
  (`sdk/org/scenarios/_template/`).
- `scenarios/README.md` — the scenario format, the authoring workflow and the evidence contract.

### The harness API

```js
import { getUser } from './provision.mjs';            // register → pod → Azure keys → ready
import { Pod } from './lib/pod.mjs';                  // projects, files, store, hooks, inbound, app
import { ThingSession, approveAllConsent } from './lib/thing.mjs';
import { Report } from './lib/report.mjs';            // → the markdown results table

const user = await getUser('my-scenario');
const pod = new Pod({ base: user.pod, token: user.token });
const thing = new ThingSession(pod, { onAsk: approveAllConsent, verbose: true });
await thing.start();                                   // POST /api/sessions  (interactive!)
const turn = await thing.send('install a slack integration and watch #eng');

turn.delegates;      // ['system-store/finder/…', 'system-appbuilder/automator/…']
turn.yields;         // every global THING called, incl. installSpace
turn.tokens;         // { in, out }
thing.consentCards() // every ConsentCard raised, and how it was answered
```

That shape is real: `ThingSession.start()` creates the session and `send()` waits out async pod-side
init (`sdk/org/scenarios/harness/lib/thing.mjs:L56-L57`, `:L177`); a turn exposes `yields`,
`delegates` and `tokens` derived from the streamed trace events (`:L317-L326`); `consentCards()`
filters the asks whose descriptor is a `ConsentCard` (`:L346`); `approveAllConsent` /
`denyAllConsent` are the two canned `onAsk` answerers (`:L389-L392`).

### Why assertions read the trace

The pod streams the full execution trace, so a scenario asserts on what the agent **did** — which
specialist it delegated to, which consent-marked global it called, which yields resolved — instead
of grading a paragraph of English (`sdk/org/scenarios/harness/lib/thing.mjs:L16-L22`). A scenario
that only checks the final message is a scenario that passes when the system is broken.

### Prerequisites

- **`sdk/org/.env`** with `AZURE_API_KEY` / `AZURE_RESOURCE_NAME` / `LM_MODEL_*` — `agentEnvFromSdk()`
  parses it and merges it into the pod env, so agent traffic bypasses the per-user LiteLLM key and a
  run can't be halted by a tier cap mid-scenario (`sdk/org/scenarios/harness/lib/gateway.mjs:L46-L62`).
- **`.etc/.gateway-jwt-secret.b64`** at the repo root (gitignored). Prod `POST /api/auth/login` is
  broken, so the harness **mints** the gateway's own HS256 token. Mind the **double base64**: the k8s
  `.data` blob decodes to the env *value*, which is itself base64 of the signing key — pipe through
  `base64 -d` once when fetching and let `jwt.mjs` do the second decode
  (`sdk/org/scenarios/harness/lib/jwt.mjs:L1-L40`).
- Endpoints default to `https://lmthing.cloud` (`LM_GATEWAY`) and `https://lmthing.chat`
  (`LM_POD_BASE`) (`sdk/org/scenarios/harness/lib/gateway.mjs#GATEWAY`, `:L199`).

Scenario users are disposable — provisioned state is cached under `scenarios/harness/.state/users/`
(`sdk/org/scenarios/harness/lib/paths.mjs:L11`; `provision.mjs:L1-L25`) and each gets its own
`user-<id>` namespace; clean up with `kubectl delete ns user-<id>`.

---

## 8. Writing a test — the rules that bite

- **Co-locate**: `<pkg>/src/<area>/<thing>.test.ts`, matched by `libs/*/src/**/*.test.ts`
  (`sdk/org/vitest.config.ts:L10-L11`). No setup file; import `describe/it/expect/vi` from `vitest`
  directly.
- **Prefer the shipped builders** (`mockScript`/`mockMatch`/`createMockStreamFn`) over a hand-rolled
  `streamFn` — they are multi-turn, fork/delegate-aware and honour `abort()`
  (`sdk/org/libs/core/src/testing/mock-provider.ts:L40-L44`).
- **A yield ends the turn.** Do **not** assert that draining pending jobs binds a yielded value back
  into scope — the QuickJS post-`await` continuation does not re-run in this sync model. Binding is
  the **turn loop's** job (`extractBindingPattern` + `vm.setVar`); to test it end-to-end, drive the
  loop with a scripted stream and assert the VM globals / VARIABLES block — see
  `sdk/org/libs/core/src/eval/turn-loop-yield.test.ts` and
  [../runtime/turn-loop.md](../runtime/turn-loop.md).
- **Assert on the trace.** Both the unit harness and the scenario harness read
  `yield` / `yield_resolved` / `llm_request` events rather than rendered prose
  (`sdk/org/libs/core/src/testing/harness-features.test.ts:L217-L220`).
- **Never sleep for something you can poll for.** A `setTimeout` that waits out an async effect
  measures the MACHINE, not the code — it holds on an idle laptop and fails in a 252-file run where
  every core is busy. Three tests in this suite were that, and all three failed as something that
  looks exactly like a product bug:

  | file | the sleep | what it read instead |
  |---|---|---|
  | `sdk/org/libs/cli/src/server/session-manager.spaceref.test.ts#sendAndSettle` | 30 ms for a fire-and-forget `persistSession` | `snapshot.json` absent → `expected false to be true` |
  | `sdk/org/libs/cli/src/app/hooks/runtime.test.ts:L171-L179` | 400 ms for a real `worker_thread` to boot and emit | `['raw-sub']` instead of both hooks — the SYNCHRONOUS drain always lands, the worker one is a race |
  | `sdk/org/scenarios/harness/lib/team-thread.test.mjs:L67-L96` | a 40 ms probe against `askGraceMs: 60` | the reply reclassified as a QUESTION, so `text` came back `''` with `status:'done'` |
  | `sdk/org/libs/core/src/fork/fork.test.ts:L330-L361` | 15 ms for the second fork to overlap the first | `expected 2, got 1` — "the cap serialized forks it should have run in parallel" |

  The first two now poll a predicate the caller supplies (`sendAndSettle`'s `persisted`) or a
  condition on the collected results; the third raises the grace window out of the race rather than
  timing against it; the fourth waits on the OTHER FORK (`active === 2`) instead of on a clock, which
  makes the pass condition the thing being tested. Its `cap = 1` sibling then relies on that barrier
  being UNREACHABLE, and detects a broken cap within a few ms regardless of the bound — only the cost
  of the passing case depends on the timeout at all. **A flaky test is a dead gate** — nobody reads a suite that fails at random, and
  its randomness is what hid the real ESLint findings in [§3](#the-eslint-config-and-the-family-of-checks-it-silently-was-not-running)
  for as long as it did.
- **`sdk/org/CLAUDE.md` rule:** *"Always test every fix. No fix is done until a test would have
  caught it."*

---

## 9. Names and paths that are easy to get wrong

- The runtime package is **`@lmthing/core`** (`sdk/org/libs/core/package.json`) — import from
  `@lmthing/core`, never `@repl/core`.
- **`pnpm --filter @lmthing/<pkg> test` is a silent no-op.** See
  [§3](#one-package--directory--file): the libs declare no `test` script, so the filtered run exits 0
  having run nothing. Always `cd sdk/org && pnpm test <path>`.
- **`pnpm test` only works from `sdk/org`** — the repo root has no `test` script
  (`package.json:L8-L16`).
- The condition-DSL suite lives at `sdk/org/libs/core/src/tasklist/condition-dsl.test.ts` (with the
  tasklist code), not under `eval/`.
- There is **no `solve()` global** and no `fixtures/solver/` space.

---

## See also

- [`README.md`](./README.md) — the contributing index and the hard CI gates
- [`debugging.md`](./debugging.md) — debugging the eval loop / pod / gateway (tracing, `--trace`)
- [`../runtime/turn-loop.md`](../runtime/turn-loop.md) — the yield protocol a mock test scripts against
- [`../runtime/README.md`](../runtime/README.md) — the runtime the suites exercise
- [`../cli-api/commands.md`](../cli-api/commands.md) — every CLI flag, incl. `--mock`, `--trace`, `--web`, `--request`
- [`../devops/local-dev.md`](../devops/local-dev.md) — running the full local stack
