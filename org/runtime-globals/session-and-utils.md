# Session & utility globals

The globals that name a session, pause a turn, reach the network, register a space at
runtime, and the whole **synchronous host substrate** (`console`, `execShell`, `process`,
`readFileRaw`, `writeFileRaw`, `progress`, `spacePath`, `resolveSpaceDir`,
`typecheckSource`) that every VM — session, fork leaf, delegate — is bootstrapped with.

Index of all globals and the capability→{inject, DTS} model → [./README.md](./README.md).
Capability frontmatter → [../format/space/agents/capabilities.md](../format/space/agents/capabilities.md).

Covered elsewhere and deliberately **not** repeated here: `ask` / `display` / `inspect`
(conversation), `fork` / `delegate` / `tasklist` (delegation), `loadKnowledge` /
`readDocument` (knowledge & docs), `apiCall` / `callConnection` / `tool` /
`integrationStatus` / `emitEvent` (events & integrations), `storeSearch` / `storeInspect`
/ `installSpace` / `__requestConsent` (store & consent), `db.*` (data), the `write*`
authoring family (app authoring).

---

## At a glance

| Global | Kind | Gate | Injected in |
|---|---|---|---|
| `setSessionMeta(meta)` | value-yield (`kind:'setSessionMeta'`) | `CapabilityProfile.setSessionMeta` | top-level session ONLY `sdk/org/libs/core/src/exec/capability.ts:85,96,107` |
| `sleep(duration)` | value-yield (`kind:'sleep'`) | none | every VM `sdk/org/libs/core/src/exec/bootstrap.ts:158` |
| `fetch(url, opts?)` | value-yield (`kind:'fetch'`) | none | every VM `sdk/org/libs/core/src/exec/bootstrap.ts:159` |
| `registerSpace(dir)` | value-yield (`kind:'registerSpace'`) | `CapabilityProfile.registerSpace` | session; write-capable forks; **never** delegates `sdk/org/libs/core/src/exec/bootstrap.ts:210` |
| `console.{log,warn,error}` | synchronous, fire-and-forget | none | every VM `sdk/org/libs/core/src/globals/host-tools.ts:102-106` |
| `execShell(cmd, opts?)` | synchronous | always injected; **mutating commands refused** unless `allowWrite` | every VM `sdk/org/libs/core/src/globals/host-tools.ts:114-133` |
| `process.env` / `process.exit` | synchronous | none | every VM `sdk/org/libs/core/src/globals/host-tools.ts:136-147` |
| `readFileRaw(path, opts?)` | synchronous | none | every VM `sdk/org/libs/core/src/globals/host-tools.ts:155-181` |
| `writeFileRaw(path, content)` | synchronous | `allowWrite` (else a no-op returning an error) | every VM `sdk/org/libs/core/src/globals/host-tools.ts:191-203` |
| `progress()` | synchronous | only when `ChildVMOpts.progress` is supplied | session + fork, **not** delegate `sdk/org/libs/core/src/globals/host-tools.ts:185-188` |
| `spacePath(...parts)` | synchronous | none | every VM `sdk/org/libs/core/src/globals/host-tools.ts:211-216` |
| `resolveSpaceDir(space)` | synchronous | none | every VM `sdk/org/libs/core/src/globals/host-tools.ts:224-229` |
| `typecheckSource(src)` | synchronous | none (pure/read-only) | every VM `sdk/org/libs/core/src/globals/host-tools.ts:238-248` |
| `currentTask.resolve(v)` | synchronous | only when `ChildVMOpts.currentTaskResolve` is supplied | fork + delegate `sdk/org/libs/core/src/exec/bootstrap.ts:110-120` |

All of the above are bound at the one injection site, `createChildVM`
`sdk/org/libs/core/src/exec/bootstrap.ts:96` — called from exactly three places:
`session/session.ts:638`, `fork/fork.ts:283`, `delegate/delegate.ts:193`.

---

## `setSessionMeta({ title?, slug? })`

The agent names its own conversation. Returns `Promise<{ ok: boolean }>` and **ends the
turn** (it is a value yield, `kind:'setSessionMeta'`)
`sdk/org/libs/core/src/globals/set-session-meta.ts:25-38`. Both fields are optional
`sdk/org/libs/core/src/globals/set-session-meta.ts:5-10`.

```ts
await setSessionMeta({ title: 'Pasta night', slug: 'pasta-night' });
```
(usage form documented on the global itself, `sdk/org/libs/core/src/globals/set-session-meta.ts:22-23`)

**Gate — top-level session only.** `sessionCapabilities()` sets `setSessionMeta: true`;
`forkCapabilities()` and `delegateCapabilities()` set it to `false`
`sdk/org/libs/core/src/exec/capability.ts:85,96,107` — forks/delegates are headless
sub-runs with no session identity to name `sdk/org/libs/core/src/exec/capability.ts:66-69`.
Injection is `if (caps.setSessionMeta)` `sdk/org/libs/core/src/exec/bootstrap.ts:211`, and
the DTS fragment is emitted on the same flag, `caps.setSessionMeta ? SET_SESSION_META_DTS : ''`
`sdk/org/libs/core/src/exec/bootstrap.ts:315` — so in a fork/delegate a stray
`setSessionMeta(...)` fails **typecheck**, not at runtime
(`SET_SESSION_META_DTS`, `sdk/org/libs/core/src/typecheck/library-dts.ts:15-18`).

### Host-side normalization (the slugification rule)

The global is a thin pass-through; **all** trimming/slugifying happens host-side in the
session's yield handler `sdk/org/libs/core/src/session/session.ts:827-842`:

- `title` — kept only if it is a `string`; `.trim()` then **capped at 120 chars**
  `sdk/org/libs/core/src/session/session.ts:832`.
- `slug` — lowercased, every run of non-`[a-z0-9]` replaced with `-`, leading/trailing
  dashes stripped, **capped at 60 chars**; an empty result degrades to `undefined`
  `sdk/org/libs/core/src/session/session.ts:834-837`. So `slug: 'Pasta Night!'` is stored
  as `pasta-night`.
- Nothing is emitted (and `{ ok: false }` is returned) when neither field survives
  normalization `sdk/org/libs/core/src/session/session.ts:838-841`.

Core stays persistence-free: it only writes a `session_meta` **trace event**
(`{ ts, type:'session_meta', nodeId, title?, slug? }`
`sdk/org/libs/core/src/sandbox/trace.ts:85-87`) `sdk/org/libs/core/src/session/session.ts:839`.

### Who consumes the event

- The pod's `SessionManager` subscribes to the tracer and, on `session_meta`, adopts
  `title`/`slug` onto the live `SessionEntry` and **persists** it so the name survives
  eviction/restart `sdk/org/libs/cli/src/server/session-manager.ts:312-318`; those are the
  `title` / `slug` fields of the entry `sdk/org/libs/cli/src/server/session-manager.ts:103-107`,
  surfaced by the session-listing REST routes → [../cli-api/rest/sessions.md](../cli-api/rest/sessions.md)
  and [../cli-api/rest/projects.md](../cli-api/rest/projects.md).
- The session **ledger** records the title too `sdk/org/libs/cli/src/server/session-ledger.ts:203-206`.
- The chat UI shows the agent-set title live (store slice reads `session_meta`
  `sdk/org/libs/ui/src/chat/store/session-slice.ts:79`; the header prefers it over the
  `space · agent` fallback `sdk/org/libs/ui/src/chat/app/ChatView.tsx:167-173`; a
  slug-only event leaves the title untouched
  `sdk/org/libs/ui/src/chat/store/session-title.test.ts:42-44`) →
  [../chat/features.md](../chat/features.md).

---

## `sleep(duration)`

Pauses the run: a value yield (`kind:'sleep'`) that resolves to `void` after the parsed
delay `sdk/org/libs/core/src/globals/sleep.ts:35-57`. **Ungated** — injected
unconditionally into every VM `sdk/org/libs/core/src/exec/bootstrap.ts:158` and declared
in `COMMON_DTS` `sdk/org/libs/core/src/typecheck/library-dts.ts:39`.

Duration grammar — `parseDuration` accepts `<number><unit>` (decimals allowed, optional
whitespace, case-insensitive) with units `ms | s | m | min | h | hr | hrs`; anything else
**throws** `sleep(): cannot parse duration "<input>"`
`sdk/org/libs/core/src/globals/sleep.ts:8-29`:

```ts
await sleep('500ms');   // 500
await sleep('1s');      // 1_000
await sleep('2min');    // 120_000   ('2m' is the same)
await sleep('3h');      // 10_800_000 ('3hr'/'3hrs' too)
```

Parsing happens **before** the yield is pushed, so a bad duration throws inside the sandbox
(a normal statement error the model sees and can fix) rather than becoming a failed yield
`sdk/org/libs/core/src/globals/sleep.ts:44-51`.

The global pushes `args: [duration, ms]` — the pre-parsed milliseconds
`sdk/org/libs/core/src/globals/sleep.ts:50-51` — and the **shared yield router** does the
waiting, using an injectable clock when one is supplied (test-friendly) and plain
`setTimeout` otherwise `sdk/org/libs/core/src/eval/yield-router.ts:147-154`. Because
`routeCommonYield` is the fork leaf's and the delegate's resolver too
(`sdk/org/libs/core/src/fork/fork.ts:464`, `sdk/org/libs/core/src/delegate/delegate.ts:340`),
`sleep()` behaves identically in every context.

---

## `fetch(url, opts?)`

Real, **non-blocking** HTTP as a value yield (`kind:'fetch'`) — it is *not* the old
`execSync(curl)` primitive, which blocked the single Node thread
`sdk/org/libs/core/src/globals/fetch.ts:16-36`. Ungated: injected in every VM
`sdk/org/libs/core/src/exec/bootstrap.ts:159`, declared in `COMMON_DTS`
`sdk/org/libs/core/src/typecheck/library-dts.ts:96`.

Resolved host-side by `resolveFetchYield` `sdk/org/libs/core/src/eval/fetch-yield.ts:9-30`:

- method defaults to `GET`; `headers`/`body` pass through
  `sdk/org/libs/core/src/eval/fetch-yield.ts:11-15`.
- hard **25 s** timeout (`AbortSignal.timeout(25_000)`) so a hung endpoint cannot stall a
  turn `sdk/org/libs/core/src/eval/fetch-yield.ts:15`.
- the body is buffered once and handed back with **synchronous** accessors
  `{ ok, status, text(), json() }` `sdk/org/libs/core/src/eval/fetch-yield.ts:20-26`.
- any failure (network error, timeout) degrades to `{ ok:false, status:0, text:()=>'',
  json:()=>({}) }` rather than throwing `sdk/org/libs/core/src/eval/fetch-yield.ts:27-29`.

> `webSearch` / `webFetch` are **space functions** in `system-global`, built on top of this
> global — not runtime globals.

---

## `registerSpace(dir)`

Loads a space from disk into the live registry so `delegate()` can reach it in the *same*
run. Value yield (`kind:'registerSpace'`), resolving to
`{ ok, spaceKey, agentSlug, error? }` where `spaceKey === dir` and `agentSlug` is the
first agent found `sdk/org/libs/core/src/globals/register-space.ts:3-33`. Host resolution
loads the space and stores it in the shared `dynamicSpaces` map
`sdk/org/libs/core/src/session/session.ts:816-826`.

```ts
const reg = await registerSpace('/tmp/architect-spaces/analyst');
if (!reg.ok) throw new Error(reg.error);
const result = await delegate(reg.spaceKey, reg.agentSlug, 'run', { query: '...' });
```
(the documented usage form, `sdk/org/libs/core/src/globals/register-space.ts:16-19`)

**Gate:** `registerSpace: true` for sessions; for a fork it follows the role's write
capability (`registerSpace: allowWrite` — read-only `explore`/`plan` roles lose it); a
delegate never gets it `sdk/org/libs/core/src/exec/capability.ts:85,96,107` — it mutates
shared session state, so it is withheld exactly like `writeFileRaw`
`sdk/org/libs/core/src/exec/capability.ts:61-64`. See the DTS caveat in
[Gotchas](#gotchas) below.

---

## The synchronous host substrate (`injectHostTools`)

One function injects the whole substrate into every VM
`sdk/org/libs/core/src/globals/host-tools.ts:78`, called as bootstrap step 4 with
`profile: { allowWrite: caps.allowWrite }` `sdk/org/libs/core/src/exec/bootstrap.ts:130-138`.
None of these yield — they are direct host calls that return immediately.

### Path rooting — the `LMTHING_*` contract

Relative paths resolve against `spaceRoot = resolve(opts.spaceDir)`, **never**
`process.cwd()`; absolute paths pass through untouched
`sdk/org/libs/core/src/globals/host-tools.ts:98-99`. `execShell` runs with
`cwd: spaceRoot`, so a file written relative is runnable relative
`sdk/org/libs/core/src/globals/host-tools.ts:120`.

`process.env` is a **frozen copy** of the host env (undefined values dropped) plus, when
supplied `sdk/org/libs/core/src/globals/host-tools.ts:136-147`:

| Var | Value |
|---|---|
| `LMTHING_SPACE_DIR` | the resolved space root (always set) |
| `LMTHING_PROJECT_SPACES_DIR` | the project's `spaces/` dir |
| `LMTHING_PROJECT_DIR` | the project root (the app layer resolves against this) |
| `LMTHING_PROJECT_ID` | basename of the project root |

`process.exit(code?)` does not exit the pod — it **throws** `process.exit(<code>)`
`sdk/org/libs/core/src/globals/host-tools.ts:147`.

### `execShell(cmd, opts?)` → `{ ok, stdout, stderr, exitCode }`

```ts
// relative paths agree across the substrate: both root at LMTHING_SPACE_DIR
writeFileRaw('work/x.ts', 'export const x = 1;\n');
const r = execShell('npx tsx work/x.ts', { timeout: 60_000 });
if (!r.ok) display(`exit ${r.exitCode}: ${r.stderr}`);
```
(the invariant this shape relies on is stated at `sdk/org/libs/core/src/globals/host-tools.ts:108-113`)

`execSync` with `maxBuffer: 8 MB` and a default timeout of **120 000 ms**
(`DEFAULT_EXEC_TIMEOUT_MS`, generous so a first-run `npm install` isn't killed),
overridable per call via `opts.timeout`
`sdk/org/libs/core/src/globals/host-tools.ts:45,114-121`. `exitCode` lets the model
distinguish failure modes (`127` not-found, `126` denied, …); on a signal/timeout it is `1`
`sdk/org/libs/core/src/globals/host-tools.ts:108-131`.

**Read-only roles:** when `allowWrite` is false, a *mutating* command is refused with
`{ ok:false, exitCode:126, stderr:'read-only role: command "<head>" is blocked' }`
`sdk/org/libs/core/src/globals/host-tools.ts:115-117`. Mutating = the command head is one
of `rm mv cp mkdir rmdir touch tee dd truncate chmod chown ln install sed npm pnpm yarn git`
**or** the command contains a `>`/`>>` redirect
`sdk/org/libs/core/src/globals/host-tools.ts:52-69`. Read-only `git` subcommands are
explicitly allowed: `status log diff show branch rev-parse ls-files blame cat-file`
`sdk/org/libs/core/src/globals/host-tools.ts:62-65`.

Its declaration (`EXEC_SHELL_DTS`) is emitted only under `allowWrite`
`sdk/org/libs/core/src/exec/bootstrap.ts:320-322`, so in a read-only fork role a stray
`execShell(...)` fails typecheck.

### `readFileRaw(path, opts?)` → `{ ok, content, lines, truncated, error? }`

Node `fs` read (no shell-quoting hazards). Binary-safe: a NUL byte in the first
**8192** bytes ⇒ `{ ok:false, error:'binary file' }`
`sdk/org/libs/core/src/globals/host-tools.ts:42,157-163`. Optional `offset`/`limit` slice
on **line** boundaries `sdk/org/libs/core/src/globals/host-tools.ts:166-171`. Content is
capped at `READ_BYTE_CAP` = **256 KB**, setting `truncated: true`
`sdk/org/libs/core/src/globals/host-tools.ts:41,172-175`. Errors are returned, never thrown
`sdk/org/libs/core/src/globals/host-tools.ts:178-180`.

### `writeFileRaw(path, content)` → `{ ok, bytes, error? }`

Creates parent dirs (`mkdir -p`) then writes utf8
`sdk/org/libs/core/src/globals/host-tools.ts:195-199`. Under a read-only profile it is a
**no-op** returning `{ ok:false, bytes:0, error:'read-only role: writeFileRaw is blocked' }`
`sdk/org/libs/core/src/globals/host-tools.ts:192-194`, and `WRITE_FILE_RAW_DTS` is withheld
`sdk/org/libs/core/src/exec/bootstrap.ts:320-322`.

### `progress()` → `{ episodes, toolCalls, elapsedMs }`

A fresh read-only snapshot of the run budget (the "complexity factor"); the VM cannot write
back through it `sdk/org/libs/core/src/globals/host-tools.ts:183-188`. Injected **only**
when the caller supplies a live budget accessor: the session
(`sdk/org/libs/core/src/session/session.ts:651`) and forks
(`sdk/org/libs/core/src/fork/fork.ts:292`) do; the **delegate site passes `undefined`**
(a delegate's own turn loop has no Budget) `sdk/org/libs/core/src/delegate/delegate.ts:202`,
`sdk/org/libs/core/src/exec/bootstrap.ts:71-75`.

### `spacePath(...parts)` → `string`

`path.join` replacement inside QuickJS (there is no Node there): the first segment keeps a
leading slash and loses trailing slashes, later segments are trimmed of leading+trailing
slashes, empty segments are dropped, joined with `/`
`sdk/org/libs/core/src/globals/host-tools.ts:205-216`.

### `resolveSpaceDir(space)` → `string`

A value containing `/` is used verbatim (trailing slashes trimmed); a bare slug is resolved
under `LMTHING_PROJECT_SPACES_DIR`, defaulting to `.lmthing/user/spaces`
`sdk/org/libs/core/src/globals/host-tools.ts:218-229`.

### `typecheckSource(src)` → `{ ok, errors }`

Runs `tsc` over a standalone TS string against the **full** `LIBRARY_DTS` (which re-appends
`execShell`/`writeFileRaw` so the check sees every global)
`sdk/org/libs/core/src/globals/host-tools.ts:238-243`,
`sdk/org/libs/core/src/typecheck/library-dts.ts:276-284`. `Cannot find name` diagnostics
(**TS2304 / TS2552**) are dropped — an isolated function may legitimately reference sibling
space functions — while syntax and real type errors still surface
`sdk/org/libs/core/src/globals/host-tools.ts:234-243`. Pure/read-only, so it is available in
every profile. This is the self-correction loop the architect uses before writing a
`functions/*.ts` file → [../format/space/functions/README.md](../format/space/functions/README.md).

---

## `currentTask.resolve(value)`

The result-capture channel for child contexts: injected as bootstrap step 2 **only** when
`ChildVMOpts.currentTaskResolve` is supplied — i.e. fork leaves and delegates, never the
top-level session `sdk/org/libs/core/src/exec/bootstrap.ts:110-120`, declared by
`CURRENT_TASK_DTS` on the same condition
`sdk/org/libs/core/src/exec/bootstrap.ts:246,328`. Implementations must not dispose the VM
from inside the callback `sdk/org/libs/core/src/exec/bootstrap.ts:111-113`. Details →
[./delegation.md](./delegation.md).

## The JSX runtime (bootstrap step 6)

Every VM — session, fork, delegate — also gets a classic-transform `React.createElement` /
`React.Fragment` shim that returns a plain `JSXDescriptor` `{type, props, children}`, plus
one stub global per design-system catalog component (`CATALOG_NAMES`) and per
caller-supplied `componentNames` (space components override on collision, being injected
after) `sdk/org/libs/core/src/exec/bootstrap.ts:213-240`, `CATALOG_NAMES`
`sdk/org/libs/core/src/ui/catalog.ts:134`. That is why `display(<Stack>…</Stack>)` works in
a fork, not just in chat. The matching typed declarations come from `catalogDts()`
(one `declare function <Component>(props?: {...}): JSXDescriptor` per catalog entry)
`sdk/org/libs/core/src/ui/catalog.ts:181-192`, appended to `COMMON_DTS`
`sdk/org/libs/core/src/typecheck/library-dts.ts:108`; the `React` / `JSX` namespaces are
declared in `COMMON_DTS` itself `sdk/org/libs/core/src/typecheck/library-dts.ts:48-65`.

---

## Gotchas

- **`console` is injected but NOT declared.** `console.log/warn/error` route through
  `renderHost.log` `sdk/org/libs/core/src/globals/host-tools.ts:102-106`, but no DTS
  fragment declares `console` (it is absent from `COMMON_DTS`
  `sdk/org/libs/core/src/typecheck/library-dts.ts:35-108`) and the typechecker runs with
  `lib: ['lib.es2022.d.ts']` only — no DOM, no Node types
  `sdk/org/libs/core/src/typecheck/tsc.ts:46-59`. A model statement calling `console.log(...)`
  therefore fails typecheck with **TS2584 `Cannot find name 'console'`** (verified by
  compiling that statement with exactly those compiler options). Use `display()` to render
  and `renderHost` logging from host code; treat `console` as reachable only from injected
  space-function source, not from model-emitted statements.
- **`registerSpace` DTS is unconditional.** It is declared in `COMMON_DTS`
  `sdk/org/libs/core/src/typecheck/library-dts.ts:40` (deliberately — see the note at
  `sdk/org/libs/core/src/typecheck/library-dts.ts:29-33` and
  `sdk/org/libs/core/src/exec/capability.ts:61-64`) even where the global is **not** injected
  (delegates, read-only fork roles). A stray call there passes typecheck and fails at
  runtime — the one place inject/DTS are not in lockstep, along with `progress` (declared at
  `sdk/org/libs/core/src/typecheck/library-dts.ts:107`, not injected in delegates).
- **`execShell` blocks the Node event loop.** It is `execSync`
  `sdk/org/libs/core/src/globals/host-tools.ts:120`, so the per-stream idle watchdog cannot
  fire while it runs. `fetch` is no longer in this category — it is a real yield
  `sdk/org/libs/core/src/globals/fetch.ts:16-21`.
- **`setSessionMeta` ends the turn.** Like every value yield it aborts the statement stream;
  call it once, early, rather than after every message.

---

## See also

- [./README.md](./README.md) — the full global index and the capability→{inject, DTS} registry
- [../format/space/agents/capabilities.md](../format/space/agents/capabilities.md) — the `capabilities:` frontmatter that gates the app globals
- [./delegation.md](./delegation.md) — `fork` / `delegate` / `tasklist` / `currentTask`
- [../cli-api/rest/sessions.md](../cli-api/rest/sessions.md) — where the `title`/`slug` set here surface over REST
