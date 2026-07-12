# Testing

How tests actually run in this repo — the runners, the commands that work (and the ones that
silently don't), the keyless mock-LLM harness, and the live prod scenario runner. Every claim below
was checked against the config and the code; where the old `sdk/org/.claude/skills/writing-tests.md`
skill disagrees, the code wins and the [Corrections](#corrections-to-the-old-skill) section says so.

---

## TL;DR

```bash
cd sdk/org
pnpm test                                     # the whole runtime suite (vitest run)
pnpm test libs/core/src/tasklist              # one directory
pnpm test libs/core/src/tasklist/condition-dsl # one file (substring filter)

pnpm build && LM_LIVE=1 pnpm exec vitest run libs/cli/src/testing/live-llm.test.ts   # real model

cd sdk/org/scenarios/harness && node smoke.mjs   # live prod scenarios (real cluster, real LLM)
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

The exclude comment claims `libs/ui` has "its own jsdom config" (`sdk/org/vitest.config.ts:L17-L18`).
**It does not.** `sdk/org/libs/ui/` contains only `package.json`, `src/`, `tsconfig.json` — no vitest
config; `@lmthing/ui`'s scripts are `lint:tokens` / `lint` / `format` only
(`sdk/org/libs/ui/package.json:L23-L27`) and it has no `vitest` devDependency. Yet **71 test files**
exist under `sdk/org/libs/ui/src/` (e.g. `sdk/org/libs/ui/src/chat/components/ConsentCard.test.tsx`,
`sdk/org/libs/ui/src/chat/app/auto-resume.test.ts`). They are excluded from the root runner and no
script runs them: **`libs/ui`'s tests are currently orphaned**. If you touch `libs/ui`, run its suite
by hand against a jsdom config, and treat wiring one up as fair game.

### `libs/openclaw-compat`

Declares `"test": "vitest run"` (`sdk/org/libs/openclaw-compat/package.json:L24`) and its 3 suites
are also picked up by the main `libs/*/src` glob, so `cd sdk/org && pnpm test` covers them.

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
> (`:L50`) and `@lmthing/openclaw-compat` (`:L24`) define `test`. Use the path filter above instead.

### Turbo

`sdk/org/turbo.json:L11-L13` defines a `test` task (`dependsOn: ["^build"]`), but no script invokes
`turbo run test` — `pnpm test` calls `vitest run` directly (`sdk/org/package.json:L9`). `turbo run
test` would only reach the two packages that declare a `test` script.

### CI

**No workflow runs the test suite.** The four root workflows are `build-images.yml`,
`deploy-ghpages.yml`, `design-tokens.yml`, `pr-decline.yml`, `stale.yml` — a grep for
`vitest|pnpm test|vp test` across `.github/workflows/` returns nothing. The only hard automated gate
is the design-token lint (`.github/workflows/design-tokens.yml`, see
[`README.md`](./README.md#hard-gates-ci-will-fail-you)). **Running the suite before you push is on
you.**

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

---

## 5. `libs/core/src/testing/` — what's in there

One helper module plus four suites that are themselves the harness's coverage:

| File | Role |
|---|---|
| `mock-provider.ts` | The only non-test file — the three builders above |
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

> **`sdk/org/fixtures/` no longer exists.** The old skill's whole "Fixtures (reference spaces)"
> section (`cooking`, `sommelier`, `research`, `deep_research`, `engineer`, …) describes a deleted
> tree. To re-enable the two quarantined suites you must **restore** minimal fixtures — see the fix
> plan in `sdk/org/.issues/keyless-web-fixtures-removed.md`.

**Known flake** (same issue file): `sdk/org/libs/cli/src/server/serve-tree-ws.test.ts` intermittently
fails a full parallel run with `ENOTEMPTY … rmdir '.../user/sessions/<id>'` — a race between an
in-flight session-snapshot write and the recursive temp-dir teardown. It passes reliably in
isolation (`pnpm exec vitest run libs/cli/src/server/serve-tree-ws.test.ts`).

---

## 7. `sdk/org/scenarios/` — the live prod runner

Vitest stops at the process boundary. The `scenarios/` tree is the layer above: **six end-to-end
scenarios driven against the live production cluster with a live LLM** — a disposable prod user, a
real compute pod, a real THING chat session. Nothing is mocked
(`sdk/org/scenarios/01-newsroom/run.mjs:L1-L11`).

```bash
cd sdk/org/scenarios/harness
node smoke.mjs                 # prove the harness + prod are healthy first (≈1 min)
node ../01-newsroom/run.mjs    # a scenario's runner writes its own report
```

`smoke.mjs` walks the whole chain — register → pod → env → THING session → a real LLM turn → trace
assertions — and exists so no scenario burns an hour on a broken harness
(`sdk/org/scenarios/harness/smoke.mjs:L1-L14`).

### Layout

- `scenarios/<NN>-<slug>/run.mjs` — the **executable spec**. It writes
  `scenarios/results/<id>-report.md` plus a raw trace JSON
  (`sdk/org/scenarios/01-newsroom/run.mjs:L22`, `:L527`; `sdk/org/scenarios/harness/lib/report.mjs:L109-L121`).
- `scenarios/harness/` — zero-dependency Node ESM. `provision.mjs` (`getUser`, `loadUser` —
  `:L28-L45`) plus `lib/`: `Pod` (the pod REST client, `lib/pod.mjs:L9`), `ThingSession`
  (`lib/thing.mjs:L28`), `Report` (`lib/report.mjs:L13`), `gateway.mjs`, `jwt.mjs`, `paths.mjs`.
- `scenarios/_template/` — `cp -r _template <NN-slug>` scaffold, holding just `scenario.md` +
  `run.mjs` (`sdk/org/scenarios/_template/`).
- `scenarios/README.md` — the document format, the authoring workflow and the run-and-fix process.
  Each scenario dir holds a `scenario.md` (the spec) beside a `run.mjs` (the executable spec) and
  writes `results/report.md`, whose contents are pasted back into the spec's **Actual results**
  section — so the document is both the plan and the record (`sdk/org/scenarios/README.md:24-28`).

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
  (`LM_POD_BASE`) (`sdk/org/scenarios/harness/lib/gateway.mjs:L16`, `:L199`).

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
- **`sdk/org/CLAUDE.md` rule:** *"Always test every fix. No fix is done until a test would have
  caught it."*

---

## Corrections to the old skill

`sdk/org/.claude/skills/writing-tests.md` is stale. Verified against the code, today:

| Skill claim | Reality |
|---|---|
| "`fixtures/` holds reference spaces … `fixtures/cooking/`, `fixtures/engineer/`, …" | **`sdk/org/fixtures/` does not exist** — deleted in `acb460a`. The only `fixtures/` left is `sdk/org/scenarios/06-tanzania/fixtures/` (scenario attachments) |
| "`scripts/live-test.sh`" (referenced twice) | **Does not exist.** `sdk/org/scripts/` contains only `thing-dev.mjs`. It was ported to `libs/cli/src/testing/keyless-cli.test.ts` (`:L1-L3`) — which is itself now `describe.skip` |
| "Condition DSL (`condition-dsl.test.ts`)" listed alongside the eval tests | It lives at `sdk/org/libs/core/src/tasklist/condition-dsl.test.ts`, not `eval/` |
| Imports shown as `from '@repl/core'` | The package is **`@lmthing/core`** (`sdk/org/libs/core/package.json`) |
| `fixtures/solver/`, "the `solve()` global" | Removed; no `solve` global exists |
| `pnpm --filter @lmthing/core test` (also in [`add-a-provider.md`](./add-a-provider.md)) | **Silent no-op** — `@lmthing/core` has no `test` script. Use `cd sdk/org && pnpm test libs/core/src/spaces/system-functions` |
| "Run with `pnpm test`" (unqualified) | Only works **from `sdk/org`** — the repo root has no `test` script (`package.json:L8-L16`) |

Also correcting the config's own comment: `sdk/org/vitest.config.ts:L17-L18` says `libs/ui` has "its
own vitest config". It does not (see [§2](#the-libsui-gap)).

---

## See also

- [`README.md`](./README.md) — the contributing index and the hard CI gates
- [`debugging.md`](./debugging.md) — debugging the eval loop / pod / gateway (tracing, `--trace`)
- [`../runtime/turn-loop.md`](../runtime/turn-loop.md) — the yield protocol a mock test scripts against
- [`../runtime/README.md`](../runtime/README.md) — the runtime the suites exercise
- [`../cli-api/commands.md`](../cli-api/commands.md) — every CLI flag, incl. `--mock`, `--trace`, `--web`, `--request`
- [`../devops/local-dev.md`](../devops/local-dev.md) — running the full local stack
