# Adding a runtime global

A **global** is a free-standing function or object the host binds on the QuickJS
sandbox's `globalThis` before a turn, so model-authored TypeScript can call it
(`ask`, `db`, `execShell`, `fetch`, …). This page is the code-grounded procedure for
adding one. Before you write a global, read [../runtime-globals/README.md](../runtime-globals/README.md)
(what globals exist and how they are gated) and [../runtime/typecheck.md](../runtime/typecheck.md)
(how the ambient DTS is assembled).

> **Prefer a space function.** A new capability usually belongs in
> `sdk/org/libs/core/system-spaces/system-global/functions/` (injected via
> `injectSpaceFunctions`, `sdk/org/libs/core/src/exec/bootstrap.ts:122`) built *on top of*
> the existing `fetch`/`readFileRaw`/`writeFileRaw` globals — `webSearch`, `todoWrite`,
> `grep` all work this way (`sdk/org/libs/core/src/exec/bootstrap.ts:261-265` note in the
> runtime-globals README). Add a **core global** only when you need a new host-side
> effect that ends the turn (a yield) or a raw host primitive (binary-safe file I/O).

---

## Which kind of global?

Three mechanically different categories (`../runtime-globals/README.md#1-yielding-vs-non-yielding`):

| Kind | Ends the turn? | Where it lives | Example |
|---|---|---|---|
| **Yielding** | yes — pushes a `YieldRequest`, host resolves it, next turn resumes with the value bound | `sdk/org/libs/core/src/globals/<name>.ts` factory + a case in the yield router | `ask`, `sleep`, `fetch`, `emitEvent` |
| **Synchronous host tool** | no — marshalled host call returns immediately | `injectHostTools` in `sdk/org/libs/core/src/globals/host-tools.ts` | `execShell`, `readFileRaw`, `process.env` |
| **Fire-and-forget** | no — calls the render host, returns `void` | its own factory, no `pushYield` param | `display` (`sdk/org/libs/core/src/globals/display.ts`) |

The rest of this page walks the **yielding** path (the common case) end to end, then
covers the synchronous variant.

Three sites do all the work, and there is exactly one of each: injection is unified into
`createChildVM` (`sdk/org/libs/core/src/exec/bootstrap.ts:99-243`) — session, fork and delegate all
route through it; yields are resolved in the shared `routeCommonYield`
(`sdk/org/libs/core/src/eval/yield-router.ts#routeCommonYield`); and the model-facing prose is emitted by the
`globalsSummary` **function** (`sdk/org/libs/core/src/context/system-block.ts#globalsSummary`).

---

## Steps for a yielding global

### 1. Write the factory — `sdk/org/libs/core/src/globals/<name>.ts`

A factory takes `pushYield` (plus any host-derived closure values) and returns the
function the model calls. The function returns a `Promise` and pushes a `YieldRequest`;
pushing the yield ends the turn. `sleep` is the minimal shape
(`sdk/org/libs/core/src/globals/sleep.ts#createSleepGlobal`):

```ts
export function createSleepGlobal(
  pushYield: (req: YieldRequest) => void,
  clock?: Clock,
): (duration: string) => Promise<void> {
  return function sleep(duration: string): Promise<void> {
    const ms = parseDuration(duration);
    return new Promise<void>((resolve, reject) => {
      pushYield({
        kind: 'sleep',
        args: [duration, ms],
        deferred: { resolve: resolve as (v: unknown) => void, reject },
        vmPromiseHandle: undefined,
      });
    });
  };
}
```

Rules, all enforced by the `YieldRequest` shape (`sdk/org/libs/core/src/eval/yield.ts#YieldRequest`):

- **`args` must be serializable** — strings, numbers, plain objects. The host reads them
  in the router; QuickJS handles cannot cross back.
- **Cast `resolve` to `(v: unknown) => void`** to satisfy `deferred`.
- **`vmPromiseHandle: undefined`** — the turn loop binds the resolved value host-side, not
  via a QuickJS Promise continuation (see [../runtime/typecheck.md](../runtime/typecheck.md)
  and the yield-result-binding note in [../runtime-globals/README.md](../runtime-globals/README.md#8-runtime-invariants)).
- **Bake host-derived facts into the closure, never take them from sandbox args.**
  `emitEvent` fixes its `sourceScope` at injection so sandbox code cannot spoof another
  scope (`sdk/org/libs/core/src/globals/emit-event.ts:43-70`, `deriveEventScope`).

### 2. Add the `kind` to the `YieldRequest` union

`sdk/org/libs/core/src/eval/yield.ts#YieldRequest.kind` — the `kind` literal union is the closed set of
yield kinds (21 today). Add your literal:

```ts
export interface YieldRequest {
  kind: 'ask' | 'inspect' | … | 'emitEvent' | '<name>';
  args: unknown[];
  deferred: { resolve: (v: unknown) => void; reject: (e: unknown) => void };
  vmPromiseHandle: QuickJSHandle | undefined;
}
```

### 3. Inject it in `createChildVM` — the single injection site

`sdk/org/libs/core/src/exec/bootstrap.ts:145-211`. This is the **one** place globals are
bound; its three callers (session, fork leaf, delegate) all route through it
(`sdk/org/libs/core/src/exec/capability.ts`). Bind behind an explicit capability check so
"not granted ⇒ not injected":

```ts
if (caps.app['events:emit']) {
  injectGlobal(ctx, 'emitEvent',
    createEmitEventGlobal(pushYield, deriveEventScope(opts.spaceDir, opts.projectRoot)) as AnyFn);
}
```

Pick the gate that matches the global's blast radius:

- A **project-app capability** (`caps.app['<id>']`) — the pattern for anything touching a
  project's data/app surface (`sdk/org/libs/core/src/exec/bootstrap.ts:173-204`). See step 5.
- A **boolean profile flag** (`caps.ask`, `caps.orchestrate`, `caps.delegate`,
  `caps.registerSpace`, `caps.setSessionMeta`) for session/fork/delegate structural gates
  (`sdk/org/libs/core/src/exec/capability.ts#CapabilityProfile`).
- **Ungated** (every VM) only when the global carries no authority and no secret — `sleep`,
  `fetch`, `inspect`, `readDocument`, `loadKnowledge` (`sdk/org/libs/core/src/exec/bootstrap.ts:156-164`).

Also `import` the factory at the top of `bootstrap.ts` (the import block is
`sdk/org/libs/core/src/exec/bootstrap.ts:6-24`).

### 4. Resolve the yield — `routeCommonYield`

Add a `case` in `sdk/org/libs/core/src/eval/yield-router.ts:146` (the `switch (req.kind)`).
Thread the host dependency you need through `YieldRouterContext`
(`sdk/org/libs/core/src/eval/yield-router.ts#YieldRouterContext`) rather than importing it — that keeps
`@lmthing/core` free of `cli`/host imports. **The host resolver is a third gate**
(`../runtime-globals/README.md#the-third-gate-the-host-resolver`): a global can be injected
yet have no resolver (bare unit test, session outside a project). Fail with a specific,
retryable error instead of binding `undefined`:

```ts
case 'emitEvent': {
  if (!ctx.emitEventResolver) {
    throw new Error('emitEvent is not available here: no event resolver configured …');
  }
  const [name, payload, sourceScope] = req.args as [string, Record<string, unknown>, string];
  const value = await ctx.emitEventResolver(name, payload, sourceScope);
  return { handled: true, value };
}
```

Return `{ handled: true, value }` on success, or `{ handled: false }` for kinds a specific
caller must resolve itself (`sdk/org/libs/core/src/eval/yield-router.ts:118-126`; e.g.
`ask`/`inspect` are session-only). The resolver value is what the model's `await` binds.

### 5. Gate it by capability (if project-app scoped)

If your global exposes a project-app effect it should be a **capability**, gated on both
sides from the single `CapabilityProfile` (`sdk/org/libs/core/src/exec/capability.ts#CapabilityProfile`):

1. **Add the id** to `CapabilityId` and `CAPABILITY_IDS`
   (`sdk/org/libs/core/src/spaces/capabilities.ts:26-45`) — there are 12 today. Parsing is
   fail-loud (`parseCapabilities`): an unknown id, or a bare `api:call`/
   `connections:use` without its required allowlist, throws at space load.
2. **Inject** behind `caps.app['<id>']` (step 3).
3. **Declare the DTS fragment** so a stray call fails *typecheck*, not runtime (step 6).
4. **Decide read-only-fork behaviour** in `intersectAppCaps`
   (`sdk/org/libs/core/src/exec/capability.ts#intersectAppCaps`): an `explore`/`plan` fork keeps only
   read/outbound grants; a mutating grant you add is dropped there unless you list it.
5. **Re-check host-side** if the grant carries config (e.g. `db` re-runs
   `assertTableAllowed` on every call, `sdk/org/libs/core/src/exec/app-globals.ts:102-111`).
   The DTS is a convenience; the host is the boundary.

The capability→{globals, doc} table is authored in
[../runtime-globals/README.md](../runtime-globals/README.md#the-13-app-capabilities).

### 6. Add the ambient DTS fragment

The typecheck DTS is composed additively from per-global fragments in
`sdk/org/libs/core/src/typecheck/library-dts.ts`, assembled by `buildAmbientDts`
(`sdk/org/libs/core/src/exec/bootstrap.ts#buildAppCapabilityDts`). **Declaration must stay in lockstep
with injection** — the invariant that makes an ungranted call a clean "Cannot find name"
error (`sdk/org/libs/core/src/exec/capability.ts:36-40`). Where you add the fragment depends
on the gate:

- **Structural gate** (ask/orchestrate/delegate/setSessionMeta) — export a `*_DTS` const and
  add a conditional line in `buildAmbientDts` (`sdk/org/libs/core/src/exec/bootstrap.ts#buildAppCapabilityDts`),
  e.g. `caps.setSessionMeta ? SET_SESSION_META_DTS : ''`.
- **Project-app capability** — add the fragment to `CAPABILITY_DTS_FRAGMENTS`
  (`sdk/org/libs/core/src/typecheck/library-dts.ts:269-278`); `buildAppCapabilityDts`
  (`sdk/org/libs/core/src/exec/bootstrap.ts:282-309`) emits it when the grant is present. If
  the value should be **type-narrowed to the granted values** (like `callConnection`'s
  `provider`), write a composer (`composeConnectionsDts`,
  `sdk/org/libs/core/src/typecheck/library-dts.ts#composeConnectionsDts`) instead of a static const.
- **Ungated (every VM)** — add the `declare` line to `COMMON_DTS`
  (`sdk/org/libs/core/src/typecheck/library-dts.ts:35-108`).

> **Known lockstep exceptions.** Three names are declared unconditionally but not always
> injected (`registerSpace`, `progress`, `integrationStatus`) — a stray call there passes
> typecheck and fails at runtime. Don't add to that list on purpose; see
> [../runtime-globals/README.md](../runtime-globals/README.md#4-known-lockstep-exceptions).

### 7. Tell the model it exists

The model learns the always-available globals from `globalsSummary`
(`sdk/org/libs/core/src/context/system-block.ts#globalsSummary`) — add a bullet there for a
universal global. Capability-gated globals are surfaced through the DTS + the space's
`capabilities:` frontmatter, not this prose block, so a new capability global typically
needs no `system-block.ts` edit.

### 8. Consent (only if the global carries user-visible authority)

To force a host consent card **before** the resolver runs, add the kind to
`CONSENT_MARKED_YIELD_KINDS` (`sdk/org/libs/core/src/globals/consent.ts#CONSENT_MARKED_YIELD_KINDS`, today just
`installSpace`). The router intercepts it before the switch
(`sdk/org/libs/core/src/eval/yield-router.ts:140-145`), and it **fails closed** with no
prompter — forks/delegates/hooks/headless runs can never silently execute it
(`sdk/org/libs/core/src/globals/consent.ts#enforceConsent`). See
[../runtime-globals/README.md](../runtime-globals/README.md#3-consent-generic-host-enforced-fail-closed).

### 9. Test

Two levels:

- **Factory unit test** — `sdk/org/libs/core/src/globals/<name>.test.ts`: mock `pushYield`,
  call the global, assert the captured `kind`/`args`, and that the promise resolves when
  `deferred.resolve(value)` is called. Co-located tests already exist for most globals
  (`ask.test.ts`, `emit-event.test.ts`, `consent.test.ts`, …).
- **DTS lockstep** — `sdk/org/libs/core/src/exec/bootstrap.test.ts` asserts the declared-name
  multiset per context via `runTsc`; a new gated global must appear in (and only in) the
  contexts that inject it.

Run `cd sdk/org && pnpm test libs/core && pnpm typecheck`. (**Not**
`pnpm --filter @lmthing/core test` — `@lmthing/core` declares no `test` script
(`sdk/org/libs/core/package.json`), so pnpm exits 0 having run nothing; the runner is
`vitest run` at `sdk/org/package.json:L9` with a path filter. See
[`testing.md`](./testing.md).)

---

## Synchronous host primitive (the `host-tools.ts` substrate)

For a non-yielding raw primitive (immediate return value, no turn end), add it inside
`injectHostTools` (`sdk/org/libs/core/src/globals/host-tools.ts`, `injectHostTools`) — the
one place session and fork VMs share this substrate; do not duplicate shims in callers.

1. `setGlobal('<name>', (args) => { … return plainObject; })`. Return plain data (functions
   on it, like `fetch().json`, are marshalled and callable; no prototypes/classes).
2. **Honour the write gate** if it mutates: read `profile.allowWrite` the way `writeFileRaw`
   and `execShell` do (`../runtime-globals/README.md#5-full-global-table`), so a read-only
   `fork({ role: 'explore' })` cannot use it.
3. **Declare the DTS**: put mutating primitives in a gated fragment (`EXEC_SHELL_DTS` /
   `WRITE_FILE_RAW_DTS`, appended only under `allowWrite`,
   `sdk/org/libs/core/src/exec/bootstrap.ts:324-325`); read-only ones go in `COMMON_DTS`.
4. Test in `sdk/org/libs/core/src/globals/host-tools.test.ts` — inject into a bare VM and
   `evalCode` a call.

The project-app `db` object and the authoring writers (`writePage`/`writeApi`/`writeHook`/
`writeTableSchema` + their `writeProject*` twins) are also synchronous, but injected
separately via `injectAppGlobals` (`sdk/org/libs/core/src/exec/app-globals.ts:180-223`,
called at `sdk/org/libs/core/src/exec/bootstrap.ts:143`) and gated on `caps.app`. Extend
those rather than `host-tools.ts` when the effect is project-rooted — see
[../runtime-globals/README.md](../runtime-globals/README.md) (`app-authoring.md`,
`data-db.md`).

---

## Checklist

| # | What | Where |
|---|---|---|
| 1 | Factory returning the Promise-pushing function | `sdk/org/libs/core/src/globals/<name>.ts` |
| 2 | Add `kind` to the union | `sdk/org/libs/core/src/eval/yield.ts#YieldRequest.kind` |
| 3 | Inject behind the right gate (+ import) | `sdk/org/libs/core/src/exec/bootstrap.ts:6-24`, `:145-211` |
| 4 | Resolve the yield; thread the resolver; fail-loud if absent | `sdk/org/libs/core/src/eval/yield-router.ts` |
| 5 | Capability id + parse + read-only-fork intersect (if project-scoped) | `sdk/org/libs/core/src/spaces/capabilities.ts`, `sdk/org/libs/core/src/exec/capability.ts` |
| 6 | DTS fragment, in lockstep with injection | `sdk/org/libs/core/src/typecheck/library-dts.ts` + `buildAmbientDts` |
| 7 | Model-facing bullet (universal globals only) | `sdk/org/libs/core/src/context/system-block.ts#globalsSummary` |
| 8 | Consent marking (if it carries authority) | `sdk/org/libs/core/src/globals/consent.ts#CONSENT_MARKED_YIELD_KINDS` |
| 9 | Factory test + DTS lockstep test | `globals/<name>.test.ts`, `exec/bootstrap.test.ts` |

**Doc to update:** add the new global (and any new capability) to
[../runtime-globals/README.md](../runtime-globals/README.md) — its full global table
(§5), the 13-capability table (§2), and the relevant family sub-doc.
