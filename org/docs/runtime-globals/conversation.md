# Conversation globals — `display()` and `ask()`

The two globals an agent uses to talk to the **user**. Both take a **JSX descriptor** (the value the injected `React.createElement` shim returns), but they sit on opposite sides of the turn boundary:

| Global | Kind | Ends the turn? | Capability gate | Injected in |
|---|---|---|---|---|
| `display(descriptor)` | fire-and-forget host call | no | none | every VM — session, fork, delegate `sdk/org/libs/core/src/exec/bootstrap.ts:L156` |
| `ask<T>(descriptor)` | value **yield** (`kind:'ask'`) | yes — resumes next turn with the submitted value | `CapabilityProfile.ask` — **top-level session only** | session only `sdk/org/libs/core/src/exec/bootstrap.ts:L155` |

Both are declared for the model in the ambient DTS: `display` unconditionally in `COMMON_DTS` `sdk/org/libs/core/src/typecheck/library-dts.ts:L36`, `ask` only when the capability profile grants it `sdk/org/libs/core/src/exec/bootstrap.ts:L311-L316` (`ASK_DTS` `sdk/org/libs/core/src/typecheck/library-dts.ts:L14`). See [`./README.md`](./README.md) for the general inject-and-declare-in-lockstep rule.

---

## `display(descriptor)` — fire-and-forget output

```ts
declare function display(descriptor: unknown): void;
```
`sdk/org/libs/core/src/typecheck/library-dts.ts:L36`

The implementation pushes the descriptor straight to the render surface and returns — **no yield, no pending value, the turn keeps running** `sdk/org/libs/core/src/globals/display.ts:L11-L25`. Two behaviours worth knowing:

- **Primitive coercion.** A `number`, `boolean` or `bigint` argument is stringified before it reaches the host, so `display(count)` / `display(true)` just work; objects and JSX descriptors pass through unchanged `sdk/org/libs/core/src/globals/display.ts:L18-L22`.
- **Trace attribution.** The optional `onDisplay` hook fires alongside `renderHost.display` `sdk/org/libs/core/src/globals/display.ts:L22-L23`. The session wires it to write a `display` trace event carrying the emitting node's id `sdk/org/libs/core/src/session/session.ts:L655-L658`; forks and delegates wire the same hook so their output is attributed to the right sub-node `sdk/org/libs/core/src/fork/fork.ts:L296` · `sdk/org/libs/core/src/delegate/delegate.ts:L206`.

That trace event is how the chat UI actually receives a display — the WS client explicitly ignores the legacy `display` message and renders the trace event instead `sdk/org/libs/ui/src/chat/store/ws-client.ts:L102-L104`.

The host contract is one method on `RenderHost` `sdk/org/libs/core/src/session/types.ts:L10-L14`:

```ts
export interface RenderHost {
  display(descriptor: unknown): void;
  ask(id: string, descriptor: unknown): Promise<unknown>;
  log(message: string): void;
}
```

---

## `ask(descriptor)` — yield, and resume with the user's answer

```ts
declare function ask<T = unknown>(descriptor: JSXDescriptor | string): Promise<T>;
```
`sdk/org/libs/core/src/typecheck/library-dts.ts:L14`

Flow, end to end:

1. **Validate** the descriptor in the sandbox-facing global (rules below); a failure is returned as a **rejected promise**, not a throw `sdk/org/libs/core/src/globals/ask.ts:L69-L78`.
2. **Mint an id** (`randomUUID`) and **push a yield** `{ kind:'ask', args:[id, descriptor] }` with the promise's `deferred` attached `sdk/org/libs/core/src/globals/ask.ts:L80-L90`. Pushing a yield aborts the model stream and hands control to the host.
3. **The session resolves it itself** — `ask` is *not* one of the kinds handled by the shared yield router (`routeCommonYield` has no `ask` case, `sdk/org/libs/core/src/eval/yield-router.ts`); `Session.handleYield` calls `renderHost.ask(askId, descriptor)` and awaits it `sdk/org/libs/core/src/session/session.ts:L795-L801`.
4. **The surface submits**, and the resolved value is bound host-side into the next turn's scope — so `const answer = await ask(<Form>…</Form>)` reads as an ordinary value on the following turn.

### Gate: top-level session only

`CapabilityProfile.ask` is `true` only in `sessionCapabilities()` `sdk/org/libs/core/src/exec/capability.ts:L84-L86`; `forkCapabilities()` `sdk/org/libs/core/src/exec/capability.ts:L94-L97` and `delegateCapabilities()` `sdk/org/libs/core/src/exec/capability.ts:L106-L108` both set `ask: false` — forks and delegates are headless/autonomous, so there is nobody to answer.

Because the same profile drives the DTS, `ASK_DTS` is also omitted there `sdk/org/libs/core/src/exec/bootstrap.ts:L311-L316`: a stray `ask()` in a fork **fails typecheck** (a clean, retryable, model-visible error) instead of hanging at runtime. The system prompt follows suit — `ask` is dropped from the yield list and **form components are omitted entirely** from an autonomous agent's prompt when `opts.omitAsk` is set `sdk/org/libs/core/src/context/system-block.ts:L140-L146` · `sdk/org/libs/core/src/context/system-block.ts:L328-L336`.

### Descriptor validation / sanitization

`ask()` is the one global that takes model-authored markup destined for a real DOM, so the descriptor is validated **host-side, before the yield is pushed** `sdk/org/libs/core/src/globals/ask.ts:L33-L58`:

- **Shape check** — a value without `type`/`props`/`children` is rejected outright: `ask(): argument must be a JSX descriptor` `sdk/org/libs/core/src/globals/ask.ts:L23-L31` · `sdk/org/libs/core/src/globals/ask.ts:L70-L72`.
- **Blocked types** — `script`, `iframe`, `object`, `embed`, `frame`, `frameset` (compared lower-cased) → `ask(): blocked descriptor type "<type>"` `sdk/org/libs/core/src/globals/ask.ts:L8-L38`.
- **No `dangerouslySetInnerHTML`** — any descriptor carrying that prop → `ask(): dangerouslySetInnerHTML is not allowed` `sdk/org/libs/core/src/globals/ask.ts:L41-L43`.
- **No `javascript:` URLs** — *any* string prop (not just `href`/`src`) whose trimmed, lower-cased value starts with `javascript:` → `ask(): javascript: URL not allowed in prop "<key>"` `sdk/org/libs/core/src/globals/ask.ts:L45-L50`.
- **Recursive** — every child descriptor is validated with the same rules `sdk/org/libs/core/src/globals/ask.ts:L52-L57`.

> **Gotcha — the DTS is wider than the runtime.** `ASK_DTS` types the argument as `JSXDescriptor | string` `sdk/org/libs/core/src/typecheck/library-dts.ts:L14`, and `InkRenderHost.ask` does handle a bare string label `sdk/org/libs/cli/src/render/ink-renderer.tsx:L284-L291` — but `createAskGlobal` rejects any non-descriptor `sdk/org/libs/core/src/globals/ask.ts:L70-L72` (pinned by `globals/ask.test.ts:L47`). So `await ask("What's your name?")` typechecks and then **rejects at runtime**; always pass JSX.

> **Gotcha — no timeout is enforced.** `DEFAULT_TIMEOUT_MS` (5 min) is defined and accepted as a parameter, but nothing in `createAskGlobal` applies it `sdk/org/libs/core/src/globals/ask.ts:L5` · `sdk/org/libs/core/src/globals/ask.ts:L64-L91`, and the injection site passes only `(pushYield, renderHost)` `sdk/org/libs/core/src/exec/bootstrap.ts:L155`. An open ask waits until the surface submits or cancels it.

---

## What a descriptor *is*

Every VM gets a classic-transform React shim, so model-emitted JSX becomes a plain `{ type, props, children }` object — never a React element `sdk/org/libs/core/src/exec/bootstrap.ts:L217-L235`:

```ts
declare interface JSXDescriptor {
  type: string | ((...args: unknown[]) => unknown);
  props: Record<string, unknown>;
  children?: JSXDescriptor[];
}
```
`sdk/org/libs/core/src/typecheck/library-dts.ts:L42-L46`

`type` is always resolved to a **name string** — a component stub's `displayName` `sdk/org/libs/core/src/exec/bootstrap.ts:L219-L224` · `sdk/org/libs/core/src/exec/bootstrap.ts:L236-L240`. Core never evaluates component source: component files are only read for AST extraction (Props/JSDoc), and rendering happens host-side in the CLI/web renderers from the descriptor data `sdk/org/libs/core/src/typecheck/overlay.ts:L160-L173`. That is why descriptors cross the sandbox boundary intact and render on both terminal and web.

---

## How components are referenced

### 1. The built-in catalog (always in scope)

`ui/catalog.ts` is the single cross-platform vocabulary: `DISPLAY_CATALOG` (Heading, Paragraph, Stack, Table, KeyValue, Callout, …) `sdk/org/libs/core/src/ui/catalog.ts:L46-L83` and `FORM_CATALOG` (Form, TextField, Select, ConfirmButtons, ButtonGroup, …) `sdk/org/libs/core/src/ui/catalog.ts:L86-L121`, concatenated into `CATALOG` `sdk/org/libs/core/src/ui/catalog.ts:L122`. It feeds three consumers at once:

- **Globals** — one stub per `CATALOG_NAMES` entry is bound in every VM, so `<Stack>` resolves with no import `sdk/org/libs/core/src/ui/catalog.ts:L134` · `sdk/org/libs/core/src/exec/bootstrap.ts:L236-L240`.
- **DTS** — `catalogDts()` declares each entry as a typed JSX global, appended to `COMMON_DTS` `sdk/org/libs/core/src/ui/catalog.ts:L181-L193` · `sdk/org/libs/core/src/typecheck/library-dts.ts:L108`.
- **Prompt** — `catalogSummary()` renders exact prop signatures into the system prompt, precisely so the model stops guessing `<Callout type=…>` instead of `variant` `sdk/org/libs/core/src/ui/catalog.ts:L140-L178`.

The catalog's own worked examples, verbatim from that prompt text `sdk/org/libs/core/src/ui/catalog.ts:L173-L176`:

```ts
display(<Stack gap={2}><Heading level={1}>Report</Heading><Callout variant="success" title="Done">All good</Callout><Table columns={["Name","Score"]} rows={[["Alice",95]]}/><KeyValue pairs={{ Total: 42 }}/></Stack>)
const ans = await ask(<Form><TextField name="title" label="Title"/><Select name="env" options={["dev","prod"]}/></Form>) as { title: string; env: string }
const confirmed = await ask(<ConfirmButtons/>) as boolean
```

A `<Form>` resolves to an object keyed by each field's `name`; a bare control resolves to that single value — encoded in `flattenForm`, whose `single` flag is set when the top descriptor is not a `Form`/`Fieldset`/`Field` wrapper and there is at most one field `sdk/org/libs/core/src/ui/form.ts:L142-L150`. `isFormDescriptor` decides whether a descriptor is a form at all, by matching the type against the catalog's form vocabulary `sdk/org/libs/core/src/ui/form.ts:L71-L75`; `coerceValue` types each raw control value `sdk/org/libs/core/src/ui/form.ts:L154`.

### 2. Space components (opt-in per agent)

A space's `components/view/<Name>.tsx` and `components/form/<Name>.tsx` reach an agent **only** when the agent lists them in its `components:` frontmatter — `getAgentComponents` returns just the named ones, split into `view` / `form` `sdk/org/libs/core/src/spaces/components.ts:L6-L25`. Those names are then:

- **injected as JSX stubs** alongside the catalog, *after* it, so a space name overrides a catalog name on collision `sdk/org/libs/core/src/exec/bootstrap.ts:L236-L240` — sourced from `getAgentComponents` at the session `sdk/org/libs/core/src/session/session.ts:L273` and delegate `sdk/org/libs/core/src/delegate/delegate.ts:L205` bootstrap sites (fork leaves pass `componentNames: []` `sdk/org/libs/core/src/fork/fork.ts:L295`);
- **declared in the DTS overlay** with their extracted `Props` interface, falling back to `Record<string, unknown>` `sdk/org/libs/core/src/typecheck/overlay.ts:L83-L92`;
- **advertised in the system prompt** with AST-derived props + JSDoc — view components as `display(<Name … />)`, form components as `await ask(<Name … />)` (and form components are suppressed entirely under `omitAsk`) `sdk/org/libs/core/src/context/system-block.ts:L316-L337`.

Full authoring rules → [`../format/space/components/README.md`](../format/space/components/README.md).

---

## How a surface resolves an ask

The pod/web `WebRenderHost` implements both methods `sdk/org/libs/cli/src/rpc/server.ts:L29-L72`:

- `display(descriptor)` → broadcasts a `display` event `sdk/org/libs/cli/src/rpc/server.ts:L29-L31`.
- `ask(id, descriptor)` → records the open ask, emits `ask_start`, and returns a promise held open until `submitForm(id, value)` resolves it (also emitting `ask_end`) `sdk/org/libs/cli/src/rpc/server.ts:L33-L52`.
- `cancelAsk(id)` resolves the **same** promise with `null` — a cancelled ask never hangs the agent `sdk/org/libs/cli/src/rpc/server.ts:L54-L60`.
- `pendingAsks()` snapshots still-open asks so a reconnecting client can re-render them `sdk/org/libs/cli/src/rpc/server.ts:L62-L65`; the agent WS replays them as `ask_pending` on connect `sdk/org/libs/cli/src/server/ws/agent.ts:L79-L80`.

Client → host, over the agent WebSocket: `submitForm` / `cancelAsk` messages call straight into the render host `sdk/org/libs/cli/src/server/ws/agent.ts:L94-L98`. The same two operations are exposed over REST as `POST` / `DELETE /api/sessions/:id/ask/:askId` (plus `GET /api/sessions/:id/asks`) `sdk/org/libs/cli/src/web/agent-api.ts:L302-L334` — see [`../cli-api/rest/sessions.md`](../cli-api/rest/sessions.md).

**In chat**, `AskForm` picks a renderer in this order `sdk/org/libs/ui/src/chat/app/Message.tsx:L35-L92`:

1. a **consent card** (`isConsentDescriptor`) → Approve/Deny → submits `true` / `false` `sdk/org/libs/ui/src/chat/app/Message.tsx:L60-L67`;
2. a **space component** looked up by descriptor `type` in the `window.__SPACE_COMPONENTS__` registry `sdk/org/libs/ui/src/chat/app/Message.tsx:L17-L21` · `sdk/org/libs/ui/src/chat/app/Message.tsx:L40`;
3. a **catalog form** (`isFormDescriptor`) → `<CatalogForm>` `sdk/org/libs/ui/src/chat/app/Message.tsx:L69-L70`;
4. otherwise a plain text input.

Every branch submits through the same channel: `send({ type:'submitForm', id: block.askId, value })` `sdk/org/libs/ui/src/chat/app/Message.tsx:L42`. `ask_start` / `ask_end` / `ask_pending` are folded into the store by the WS client `sdk/org/libs/ui/src/chat/store/ws-client.ts:L105-L113`.

> **Gotcha — `__SPACE_COMPONENTS__` is only populated by the CLI `--web` DevTools UI**, whose esbuild virtual entry imports each space component and assigns the registry on `window` `sdk/org/libs/cli/src/web/serve.ts:L88-L106`. Nothing else writes it, and `spaceComponents()` falls back to `{}` `sdk/org/libs/ui/src/chat/app/Message.tsx:L18-L21`. Since `isFormDescriptor` only recognises *catalog* types `sdk/org/libs/core/src/ui/form.ts:L71-L75`, an `ask(<MySpaceForm/>)` with no registry entry lands on the plain text-input branch.

**In the terminal**, `InkRenderHost.display` renders the descriptor and unmounts `sdk/org/libs/cli/src/render/ink-renderer.tsx:L277-L282`; `InkRenderHost.ask` renders an interactive Ink form for a catalog form descriptor (human mode), falling back to a labelled prompt — with `--claude`/`plain` it uses direct stdin reads instead `sdk/org/libs/cli/src/render/ink-renderer.tsx:L272-L305`.

### Consent rides the same channel

Host-enforced consent is not a separate surface: `createAskConsentPrompter` builds a `{ type:'ConsentCard', props:{ function, space?, argsSummary } }` descriptor and awaits `renderHost.ask(randomUUID(), descriptor)` — the same `ask_start` → submit → `ask_end` round-trip `sdk/org/libs/core/src/globals/consent.ts:L173-L194`. Approval is `true` / `'approve'` / `{approved:true}` / `{approve:true}`; anything else — **including the `null` of a cancelled ask** — is a denial `sdk/org/libs/core/src/globals/consent.ts:L161-L171`. The prompter is wired only for interactive sessions, so consent fails closed everywhere else → [`./store-and-consent.md`](./store-and-consent.md).

---

## See also

- [`./README.md`](./README.md) — the globals index and the capability → inject + DTS registry.
- [`../format/space/components/README.md`](../format/space/components/README.md) — authoring `components/view/*` and `components/form/*`, and the agent `components:` allow-list.
- [`../cli-api/rest/sessions.md`](../cli-api/rest/sessions.md) — `POST`/`DELETE /api/sessions/:id/ask/:askId` and the agent WS.
- [`../chat/features.md`](../chat/features.md) — how the chat surface renders display blocks, ask forms and consent cards.
