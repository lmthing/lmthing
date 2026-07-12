# Store globals & host-enforced consent

The store globals are the agent-facing surface of the lmthing store's **space catalog**: `storeSearch` / `storeInspect` (discovery) and `installSpace` (installation). `installSpace` is the first — and today the only — consumer of the generic **host-enforced consent** mechanism: a consent-marked call pauses the turn, renders a consent card to the user, and executes *only* on approval `sdk/org/libs/core/src/globals/store.ts:3-23`.

This page also covers `registerSpace()`, because `installSpace` reuses its live-registration machinery — an installed space becomes `delegate()`-able in the same session.

- Capability reference (the `capabilities:` frontmatter these globals are gated on) → [../format/space/agents/capabilities.md](../format/space/agents/capabilities.md)
- The pod REST endpoints behind the same catalog → [../cli-api/rest/store-spaces.md](../cli-api/rest/store-spaces.md)
- Global-injection model, the DTS lockstep rule, the resolver seam → [./README.md](./README.md)
- `delegate()` (what you call after an install) → [./delegation.md](./delegation.md)

---

## 1. The three store globals

| Global | Signature | Capability | Consent |
|---|---|---|---|
| `storeSearch` | `(query?: string) => Promise<any[]>` | `store:read` | no |
| `storeInspect` | `(spaceId: string) => Promise<any>` | `store:read` | no |
| `installSpace` | `(spaceId: string) => Promise<InstallSpaceResult>` | `store:install` | **yes — consent-marked** |

All three are **value-yielding** globals: each pushes a yield (`kind: 'storeSearch' | 'storeInspect' | 'installSpace'`) and the host resolves it, so the call ends the turn `sdk/org/libs/core/src/globals/store.ts:75-122`.

Catalog entries pass through **verbatim** — nothing in core picks or reshapes fields, which is why both readers are typed `any`/`any[]` and you can read `entry.field` without a cast `sdk/org/libs/core/src/globals/store.ts:21-22` · `sdk/org/libs/core/src/typecheck/library-dts.ts:248-255`.

### Injection gate

Injection is per-capability, at the single bootstrap site:

```ts
// exec/bootstrap.ts:189-198
if (caps.app['store:read']) {
  injectGlobal(ctx, 'storeSearch', createStoreSearchGlobal(pushYield) as AnyFn);
  injectGlobal(ctx, 'storeInspect', createStoreInspectGlobal(pushYield) as AnyFn);
}
if (caps.app['store:install']) injectGlobal(ctx, 'installSpace', createInstallSpaceGlobal(pushYield) as AnyFn);
```

`sdk/org/libs/core/src/exec/bootstrap.ts:189-198`

The DTS side reads the *same* grant map: `store:read` → `STORE_READ_DTS`, `store:install` → `STORE_INSTALL_DTS`, emitted by the `CAPABILITY_DTS_FRAGMENTS` loop `sdk/org/libs/core/src/typecheck/library-dts.ts:279-288` · `sdk/org/libs/core/src/exec/bootstrap.ts:306-311`. Not granted ⇒ not injected **and** not declared, so a stray `installSpace(...)` fails typecheck ("Cannot find name") rather than throwing at runtime.

Both ids are registered in `CAPABILITY_IDS` `sdk/org/libs/core/src/spaces/capabilities.ts:41-56` and are **bare-only** — passing a config map is a load error `sdk/org/libs/core/src/spaces/capabilities.ts:65-74`.

### Read-only fork roles

`intersectAppCaps(app, allowWrite=false)` keeps `store:read` (pure catalog discovery) and **drops `store:install`** along with every other mutating grant, so an `explore`/`plan` fork can neither inject nor declare `installSpace` `sdk/org/libs/core/src/exec/capability.ts:16-28`.

### The host resolver (the third gate)

Injection is not enough: the yield needs a host resolver, `StoreResolver`, supplied on `AppGlobalImpls.store`:

```ts
export interface StoreResolver {
  search(query?: string): Promise<unknown[]>;
  inspect(spaceId: string): Promise<unknown>;
  install(spaceId: string): Promise<StoreInstallOutcome>;
  republish?(): Promise<void>;
}
```

`sdk/org/libs/core/src/globals/store.ts:43-56`

The Session threads it into the yield-router context as `storeResolver: this.opts.appGlobals?.store` `sdk/org/libs/core/src/session/session.ts:882-883`. When it is absent (a session outside a project, a bare unit test), the yield **rejects with an actionable, retryable error** rather than binding `undefined`:

- `storeSearch is not available here: no store resolver configured` `sdk/org/libs/core/src/eval/yield-router.ts:263-265`
- `storeInspect is not available here: no store resolver configured` `sdk/org/libs/core/src/eval/yield-router.ts:272-274`
- `installSpace is not available here: no store resolver configured` `sdk/org/libs/core/src/eval/yield-router.ts:285-287`

On the pod, `SessionManager.withStore` builds the resolver — but **only when there is both an `lmthingRoot` and a `projectId`** `sdk/org/libs/cli/src/server/session-manager.ts:404-425`. It maps onto exactly the same catalog functions the REST routes use — `searchCatalog`, `inspectCatalogSpace`, `installStoreSpace` `sdk/org/libs/cli/src/server/store-resolver.ts:39-74` · `sdk/org/libs/cli/src/server/routes/store-spaces.ts` (`searchCatalog`:100, `inspectCatalogSpace`:117, `installStoreSpace`:215) — so agent installs and UI installs share one engine (see [../cli-api/rest/store-spaces.md](../cli-api/rest/store-spaces.md)). Notably the **agent path never passes `force`**: overwriting locally-edited files stays a deliberate HTTP/UI action `sdk/org/libs/cli/src/server/store-resolver.ts:49-51`.

---

## 2. `installSpace()` — the consent-gated install

```ts
declare function installSpace(spaceId: string): Promise<{ ok: boolean; spaceId: string; projectId?: string; spaceKey?: string; agentSlug?: string; diverged?: boolean; message?: string; error?: string }>;
```

`sdk/org/libs/core/src/typecheck/library-dts.ts:262-263` (shape: `InstallSpaceResult`, `sdk/org/libs/core/src/globals/store.ts:61-72`)

### Router order: consent → install → register → republish

The `installSpace` case in the yield router does four things, in that order `sdk/org/libs/core/src/eval/yield-router.ts:279-332`:

1. **Consent** — enforced *before* the switch (§3), so the resolver cannot run unapproved `sdk/org/libs/core/src/eval/yield-router.ts:135-145`.
2. **Install** — `storeResolver.install(spaceId)` materializes the space into the current project and returns a `StoreInstallOutcome` `sdk/org/libs/core/src/globals/store.ts:28-38`.
3. **Live-register** — on success (`outcome.installedDir` present) the router `loadSpace()`s the installed dir and inserts it into the **shared `dynamicSpaces` map** — the same map `registerSpace` writes and `delegate()` reads — so the freshly installed space is reachable in *this* session; `spaceKey` is the installed dir and `agentSlug` is the space's first agent `sdk/org/libs/core/src/eval/yield-router.ts:303-317` · `sdk/org/libs/core/src/session/session.ts:888-892`.
4. **Republish** (best-effort) — `storeResolver.republish?.()` re-derives the pod's webhook manifest / crontab / emitter-scan caches; a failure here never fails a completed install `sdk/org/libs/core/src/eval/yield-router.ts:318-322` · `sdk/org/libs/core/src/globals/store.ts:53-55`.

Two failure shapes matter:

- **Divergence / install failure** is returned as a **value**, not a throw — `{ ok: false, diverged?: true, message?, error? }` — precisely so the agent can relay the "local edits held back" message verbatim `sdk/org/libs/core/src/eval/yield-router.ts:290-302`. The pod's pristine-vs-diverged hash guard produces that branch `sdk/org/libs/cli/src/server/routes/store-spaces.ts:196-198,254-258`.
- **Install succeeded but live registration failed** ⇒ still `ok: true`, with `error: "installed, but live registration failed: …"`. The files *are* on disk, so reporting failure would be wrong; the agent just learns that `delegate()` needs a session restart `sdk/org/libs/core/src/eval/yield-router.ts:312-317`.

### Real usage (the shipped THING agent)

THING holds both store grants `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md:6-8`, delegates discovery to `system-store`'s `finder` (which holds only `store:read`, so it recommends but can never install) `sdk/org/libs/core/system-spaces/system-store/agents/finder/instruct.md:4-6`, and then installs behind the consent card:

````md
   **(b) Install it (consent-gated).** Present the recommendation briefly, then call
   `installSpace` — the host shows the user a consent card and installs only on approval.
   On success the space is live-registered for `delegate()` this same session:
   ```typescript
   const inst = await installSpace(rec.spaceId!);   // pauses for the user's consent card
   …
   display(inst.ok ? `Installed ${rec.title}.` : `Install failed: ${inst.error ?? 'unknown error'}`);
   ```
   A denied card rejects — do not retry unless the user asks again.
````

`sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md:315-325` (the `…` elides three comment lines about reading `inst.error` only)

The same instruct carries a rule that follows directly from the consent model: **never call `installSpace` on an unverified id** — because the call is consent-gated it *always* interrupts the user with a card, and asking someone to approve installing something that cannot exist is a bug. Verify with `storeInspect` first (`undefined` ⇒ not in the catalog) `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md:327-340`. A multi-service request runs the whole find → install → configure sequence **once per distinct integration**, so each install raises its own consent card `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md:299-301`.

---

## 3. Host-enforced consent (`globals/consent.ts`)

Consent is **generic, host-enforced, and fail-closed**: a consent-marked invocation must be approved by the *user* before it executes, and nothing the model writes can bypass it `sdk/org/libs/core/src/globals/consent.ts:5-30`.

There are exactly **two** entry points.

### 3a. A consent-marked GLOBAL — the yield-kind registry

```ts
export const CONSENT_MARKED_YIELD_KINDS: ReadonlySet<string> = new Set(['installSpace']);
```

`sdk/org/libs/core/src/globals/consent.ts:48-54`

The yield router consults this set **before its switch**, so no resolver below it can execute unapproved:

```ts
if (CONSENT_MARKED_YIELD_KINDS.has(req.kind)) {
  await enforceConsent(ctx.requestConsent, {
    function: req.kind,
    argsSummary: summarizeConsentArgs(req.args),
  });
}
switch (req.kind) { /* … */ }
```

`sdk/org/libs/core/src/eval/yield-router.ts:135-146`

Adding another kind to this set is the entire opt-in — that is the "consent flag on a global's definition" `sdk/org/libs/core/src/globals/consent.ts:48-53`.

### 3b. A consent-marked SPACE FUNCTION — the `@consent` pragma

A `functions/<name>.ts` whose **leading comment** (a JSDoc block or a `//` line, before any code) carries `@consent` opts into the same gate `sdk/org/libs/core/src/globals/consent.ts:102-130`. Function files have no frontmatter, so the leading-comment pragma is where function metadata lives; detection always runs on the **original TS source**, because bundling may strip comments `sdk/org/libs/core/src/sandbox/inject-functions.ts:50-53`. An `@consent` *inside* the function body does not count `sdk/org/libs/core/src/globals/consent.ts:107-108` · `sdk/org/libs/core/src/globals/consent.test.ts:69-71`.

Despite the "space function" naming, the pragma is not space-only: the session merges system, **project** (`<project>/functions/*.ts`) and space functions into one name-disjoint map `sdk/org/libs/core/src/session/session.ts:595-624` and hands it to a single `injectSpaceFunctions` call `sdk/org/libs/core/src/exec/bootstrap.ts:121-122`, so a project function carrying `@consent` is wrapped identically.

At injection such a function is not bound directly — it is wrapped, hiding the implementation in a closure the sandbox can never reach:

```ts
export function wrapWithConsentGate(name: string, js: string): string {
  return `globalThis['${name}'] = (function () {
${js}
  var __impl = ${name};
  return function () {
    var __args = Array.prototype.slice.call(arguments);
    return __requestConsent(${JSON.stringify(name)}, __args).then(function () {
      return __impl.apply(null, __args);
    });
  };
})();`;
}
```

`sdk/org/libs/core/src/sandbox/inject-functions.ts:30-41`, selected by `functionRequiresConsent(...)` in the injection loop `sdk/org/libs/core/src/sandbox/inject-functions.ts:70-72`.

Consequences:

- The wrapper is **necessarily Promise-returning even for a synchronous source function** — consent must yield the turn `sdk/org/libs/core/src/sandbox/inject-functions.ts:27-29`.
- `__requestConsent` is the only way in, and it is itself a value-yielding global (`kind: 'consent'`) carrying a **host-built** `ConsentCard` `sdk/org/libs/core/src/globals/consent.ts:140-159`. The router's `consent` case runs the same enforcement primitive and resolves `{ granted: true }` on approval `sdk/org/libs/core/src/eval/yield-router.ts:250-258`.
- `__requestConsent` is injected into **every** VM (session, fork, delegate) but deliberately **absent from the ambient DTS** — the inverse of the usual lockstep — because model code must never call it directly `sdk/org/libs/core/src/exec/bootstrap.ts:205-209` · `sdk/org/libs/core/src/globals/consent.ts:136-139`.

A minimal marked function (from the runtime's own test corpus):

```ts
/** Dangerous.
 * @consent
 */
export default function (target) { globalThis.__ran = target; return "done:" + target; }
```

`sdk/org/libs/core/src/globals/consent.test.ts:239`

**No shipped function carries the pragma today.** `rg -n '@consent' sdk/org/libs/core/system-spaces store` returns exactly one hit — a doc cross-link in `store/CLAUDE.md:49` — so none of the ~14 system-space functions (`system-global/functions/`, `system-architect/functions/`) and none of the store spaces' or store projects' `functions/*.ts` opt in. The pragma path is therefore covered only by tests: the unit suite `sdk/org/libs/core/src/globals/consent.test.ts:238-239` (injection-time wrapper in a real VM) and the live scenario, which *authors* both a project function and a space function with the pragma at run time and asserts they gate — and that they never execute from a hook, a delegate or a webhook `sdk/org/scenarios/02-consent/run.mjs:63,76,628-684`. In production, `installSpace` is consent's only consumer.

### 3c. The enforcement primitive

Both entry points converge on one function:

```ts
export async function enforceConsent(prompter: ConsentPrompter | undefined, card: ConsentCard): Promise<void> {
  if (!prompter) throw consentUnavailableError(card.function);
  const granted = await prompter(card);
  if (!granted) throw consentDeniedError(card.function);
}
```

`sdk/org/libs/core/src/globals/consent.ts:93-100`

The two error strings are a documentable contract:

| Condition | Error the agent sees |
|---|---|
| No prompter (**fail closed**) | `"<fn>" requires user consent — run it from an interactive session (this context has no user to ask, so the call is refused)` `sdk/org/libs/core/src/globals/consent.ts:75-79` |
| User denied | `consent denied: the user declined "<fn>" — do not retry it unless the user explicitly asks for it` `sdk/org/libs/core/src/globals/consent.ts:82-86` |

The card is host-built — `{ function, space?, argsSummary }` — and `argsSummary` is compact JSON **truncated to 300 chars**, so a hostile or huge payload cannot flood the approval UI `sdk/org/libs/core/src/globals/consent.ts:34-41,56-71`.

### 3d. Fail-closed: who actually gets a prompter

`ConsentPrompter` is supplied **only by interactive session contexts** `sdk/org/libs/core/src/globals/consent.ts:43-46`. On the pod:

```ts
consentPrompter: args.interactive ? createAskConsentPrompter(args.renderHost) : undefined,
```

`sdk/org/libs/cli/src/server/session-manager.ts:448-452`

Forks, delegates, hooks and headless runs therefore have **no** prompter, and `enforceConsent` throws `consentUnavailableError` there — it never silently executes, and never hangs on an ask no client will answer `sdk/org/libs/core/src/globals/consent.ts:26-29`. Core reads it as `requestConsent: this.opts.consentPrompter` on the yield-router context `sdk/org/libs/core/src/session/session.ts:885-887`.

### 3e. The card rides the `ask` channel

`createAskConsentPrompter` builds the prompter on `renderHost.ask`, emitting a `ConsentCard` **descriptor** through the same `ask_start` → submit → `ask_end` plumbing interactive forms use `sdk/org/libs/core/src/globals/consent.ts:173-194`:

```ts
const descriptor = {
  type: 'ConsentCard',
  props: { function: card.function, ...(card.space ? { space: card.space } : {}), argsSummary: card.argsSummary },
  children: [],
};
const value = await renderHost.ask(randomUUID(), descriptor);
return isConsentApproval(value);
```

`sdk/org/libs/core/src/globals/consent.ts:181-193`

Approval is deliberately narrow: `true`, `'approve'`, `{ approved: true }` or `{ approve: true }` count — **anything else, including the `null` of a cancelled ask, is a denial** `sdk/org/libs/core/src/globals/consent.ts:161-171`.

The web renderer honours that contract: the chat/Studio transcript detects the descriptor with `isConsentDescriptor` (`d.type === 'ConsentCard'`) `sdk/org/libs/ui/src/chat/components/ConsentCard.tsx:23-25` and renders `<ConsentCard>` with `onApprove={() => onSubmit(true)}` / `onDeny={() => onSubmit(false)}` — the ordinary form-submit path `sdk/org/libs/ui/src/chat/app/Message.tsx:60-66`. **Both** choices *resolve* the ask, so a denied or dismissed card never leaves the agent hanging `sdk/org/libs/ui/src/chat/components/ConsentCard.tsx:13-19`.

---

## 4. `registerSpace()`

```ts
declare function registerSpace(dir: string): Promise<{ ok: boolean; spaceKey: string; agentSlug: string; error?: string }>;
```

`sdk/org/libs/core/src/typecheck/library-dts.ts:40` (shape: `RegisterSpaceResult`, `sdk/org/libs/core/src/globals/register-space.ts:3-10`)

A value-yielding global that loads the space at `dir` into the live registry so `delegate()` reaches it **immediately** `sdk/org/libs/core/src/globals/register-space.ts:12-34`:

```ts
const reg = await registerSpace('/tmp/architect-spaces/analyst');
if (!reg.ok) throw new Error(reg.error);
const result = await delegate(reg.spaceKey, reg.agentSlug, 'run', { query: '...' });
```

`sdk/org/libs/core/src/globals/register-space.ts:16-20`

**Gate.** Not an app capability — a `CapabilityProfile` boolean, because it mutates shared session state (the `dynamicSpaces` map) and so is withheld like the other write primitives `sdk/org/libs/core/src/exec/capability.ts:61-65`:

| Context | `registerSpace` injected? | Source |
|---|---|---|
| top-level session | yes | `sdk/org/libs/core/src/exec/capability.ts:84-86` |
| fork leaf | only when the role is write-capable (`allowWrite`) — `explore`/`plan` lose it | `sdk/org/libs/core/src/exec/capability.ts:94-97` |
| delegate | **no** | `sdk/org/libs/core/src/exec/capability.ts:106-108` |

Injection is one line: `if (caps.registerSpace) injectGlobal(ctx, 'registerSpace', …)` `sdk/org/libs/core/src/exec/bootstrap.ts:210`.

> **Gotcha — the one place inject and DTS are NOT in lockstep.** `registerSpace` is declared **unconditionally** in `COMMON_DTS`, even where the global is not injected (delegates, read-only fork roles) `sdk/org/libs/core/src/typecheck/library-dts.ts:28-40` · `sdk/org/libs/core/src/exec/capability.ts:61-64`. A stray call in those contexts **passes typecheck and fails at runtime**, instead of producing the usual clean "Cannot find name" error. (See [./README.md](./README.md) §4 for the full list of lockstep exceptions.)

**Where it resolves.** Two resolvers, deliberately disjoint:

- The **top-level session** resolves its own `registerSpace` yield (`loadSpace` → `this.dynamicSpaces.set(dir, space)`) `sdk/org/libs/core/src/session/session.ts:816-826`.
- The **yield router**'s `registerSpace` case is **fork-leaf-only** — gated on `ctx.resolveRegisterSpace`, which the session never sets `sdk/org/libs/core/src/eval/yield-router.ts:355-370` · `sdk/org/libs/core/src/session/session.ts:888-892`.

Both write the **same shared `Map` reference**, which is why a space registered inside a fork is visible to the parent's later `delegate()` `sdk/org/libs/core/src/session/session.ts:108-113` · `sdk/org/libs/core/src/eval/yield-router.ts:66-71`. Step 3 of the `installSpace` flow (§2) reuses exactly this mechanism.

---

## 5. Which shipped agents hold these grants

| Space / agent | `capabilities:` | Source |
|---|---|---|
| `user-thing` / `thing` | `store:read`, `store:install` | `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md:6-8` |
| `system-store` / `finder` | `store:read` only — it recommends, it never installs | `sdk/org/libs/core/system-spaces/system-store/agents/finder/instruct.md:4-6` |

That split is the design: discovery is delegated to a read-only agent, while the consent-marked install stays with the top-level interactive agent — the only context that *has* a user to ask.
