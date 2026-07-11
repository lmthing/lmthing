---
name: events-and-hooks
description: Load when authoring the unified event pipeline — an `events/<name>.ts` emitter def (webhook/cron/db/internal), an `events/`-subscribing `hooks/<slug>.ts` event hook, code nodes in space tasklists, project functions, or the generic `@consent` function flag. This is the CURRENT path; legacy inbound `triggers:`/webhook descriptors are `@.claude/skills/triggers.md` + `@.claude/skills/webhooks.md`.
---

# Skill: Events & Hooks (the unified event pipeline)

lmthing has ONE event pipeline with two symmetric halves:

- **Emitter defs** (`events/<name>.ts`) — the **PRODUCER** side. A named `.ts` file default-exports a
  typed `EmitterDef` describing events a SPACE or a PROJECT produces.
- **Event hooks** (`hooks/<slug>.ts`, `{ type: 'event' }`) — the **CONSUMER** side. A hook subscribes
  to a source-qualified event address and runs a code `handler` (which IS the filter) or delegates to
  an agent (`trigger`).

Both live in either a **project** (`<project>/events/`, `<project>/hooks/` — user trust domain,
handlers in-proc) or an **installed space** (`<project>/spaces/<id>/events|hooks/` — store code,
worker-isolated). Payloads carry a typed contract, are validated before dispatch, and can filter in
code before any agent wakes — none of which the legacy `triggers:` path did.

Core types: `sdk/org/libs/core/src/spaces/emitter-def.ts` (the `EmitterDef` union),
`emitter-load.ts` (`validateEmitterDef`), `verify-spec.ts` (`VerifySpec` + builtin shorthand). CLI:
`server/emitter-manifests.ts` (`scanEmitterDefs`), `server/event-dispatch.ts` (`dispatchEmittedEvents`),
`server/internal-signals.ts`, `app/hooks/loader.ts` (`EventHookDef`), `app/hooks/runtime.ts` (db-write
→ synthetic event).

---

## 1. Emitter defs — the producer side

Put one default-exported `EmitterDef` in `<scope>/events/<name>.ts`. The filename basename (`name`) is
the def's stable id, unique per scope. Every def declares its output contract inline in `emits`
(event name → `{ payload }`), and payloads are validated against it at dispatch (drop-with-warn). There
are **four kinds**, discriminated on `type`.

### a. `webhook` — an external caller POSTs to the def's own `path`

```ts
// events/inbound.ts  (in an integration space, e.g. integration-slack)
import type { Emitted, WebhookEmitterDef, WebhookInbound } from '@lmthing/core';

const def: WebhookEmitterDef = {
  type: 'webhook',
  path: 'slack',                              // its OWN inbound URL (URL-safe, globally unique per pod)
  verify: { type: 'builtin', provider: 'slack' }, // builtin shorthand — see below
  emits: {
    'message.received': {
      payload: { text: 'string', from: 'string', chatId: 'string', threadKey: 'string?', raw: 'object' },
    },
  },
  emit(inbound: WebhookInbound): Emitted[] {   // PURE: verified request → events (no i/o, no side effects)
    const ev = (inbound.json as { event?: { type?: string; text?: string; channel?: string; user?: string; ts?: string } })?.event;
    if (!ev || ev.type !== 'message' || !ev.text) return [];  // filter: emit nothing for non-messages
    return [{
      event: 'message.received',
      payload: { text: ev.text, from: ev.user!, chatId: ev.channel!, threadKey: ev.ts, raw: inbound.json as Record<string, unknown> },
      ...(ev.ts ? { threadKey: ev.ts } : {}),   // threadKey → one persisted session per thread
    }];
  },
};
export default def;
```

`verify` is either the **builtin shorthand** `{ type: 'builtin', provider: 'slack' | 'github' }` (for
schemes not expressible in the generic union — Slack's v0-HMAC + replay-skew + `url_verification`
preflight; GitHub's signature — resolved pod-side in `webhook-verifiers.ts`), or a declarative
`VerifySpec` **descriptor** the generic engine interprets purely as data:

```ts
// Descriptor verify (Telegram — constant-time header compare against a namespaced secret):
verify: { type: 'header-equals', header: 'x-telegram-bot-api-secret-token' },
secretEnv: 'INTEGRATION_TELEGRAM_SECRET',     // space defs: env refs MUST be INTEGRATION_<ID>_-prefixed
```

`VerifySpec` kinds (`verify-spec.ts`): `none` · `header-equals` · `body-token` · `hmac`
(algo/encoding/header/prefix/signed/skew) · `ed25519` · `twilio`. Optional `challenge:` is a GET
subscription echo (`hub-challenge`, WhatsApp/Meta); optional `secretEnv` names the pod env var holding
the signing secret. The builtin shorthand names no env (exempt from containment).

### b. `cron` — a scheduled poll with a gated ctx

```ts
// events/poll-inbox.ts
import type { CronEmitterCtx, CronEmitterDef, Emitted } from '@lmthing/core';

const def: CronEmitterDef = {
  type: 'cron',
  every: '30m',                        // exactly one of `every` ('<n>m|h|d') or `daily` ('HH:MM')
  connections: ['gmail'],              // providers ctx.callConnection may reach (project scope)
  emits: { 'mail.arrived': { payload: { id: 'string', subject: 'string' } } },
  async emit(ctx: CronEmitterCtx): Promise<Emitted[]> {
    const since = (ctx.state?.['lastId'] as string) ?? '0';        // ctx.state: persisted JSON KV scratchpad
    const res = await ctx.callConnection!('gmail', { since });     // gated to declared/own provider (SSRF-pinned)
    const msgs = (res as { messages: Array<{ id: string; subject: string }> }).messages;
    if (ctx.state) ctx.state['lastId'] = msgs.at(-1)?.id ?? since;  // write-back survives to the next tick
    return msgs.map((m) => ({ event: 'mail.arrived', payload: { id: m.id, subject: m.subject } }));
  },
};
export default def;
```

`ctx.state` is a non-executable, size-capped JSON KV persisted per def (poll cursors, dedupe marks).
In a **space** def, `callConnection` is locked to the space's OWN provider(s); a **project** def uses
its declared `connections:`.

### c. `db` — fires on a project-db write

```ts
// events/feed-writes.ts  (project scope)
import type { DbEmitterDef, DbEmitterRow, Emitted } from '@lmthing/core';

const def: DbEmitterDef = {
  type: 'db',
  on: { table: 'feed_items', event: 'insert' },   // event ∈ 'insert' | 'update' | 'remove'
  emits: { 'item.added': { payload: { id: 'string', title: 'string' } } },
  emit(row: DbEmitterRow): Emitted[] {             // PURE: written row → typed events
    return [{ event: 'item.added', payload: { id: String(row.row['id']), title: String(row.row['title'] ?? '') } }];
  },
};
export default def;
```

A db emitter turns a raw write into a **named, typed** project event (`project/item.added`). You do
NOT need one to react to a write — every committed write ALSO auto-emits the synthetic
`project/db.<table>.<event>` (see §2), whose payload IS the row. Use a db emitter when you want a
domain event with a curated payload instead of the raw row.

### d. `internal` — an lmthing runtime signal

```ts
// events/space-installed.ts  (integration-lmthing)
import type { Emitted, InternalEmitterDef, InternalSignal } from '@lmthing/core';

const def: InternalEmitterDef = {
  type: 'internal',
  on: { signal: 'space.installed' },               // one of the curated signal set below
  emits: { 'space.installed': { payload: { projectId: 'string', spaceId: 'string' } } },
  emit(signal: InternalSignal): Emitted[] {         // PURE: runtime signal → events
    const d = signal.data as { projectId?: string; spaceId?: string };
    if (typeof d.projectId !== 'string' || typeof d.spaceId !== 'string') return [];
    return [{ event: 'space.installed', payload: { projectId: d.projectId, spaceId: d.spaceId } }];
  },
};
export default def;
```

The curated signal set (`server/internal-signals.ts`): `session.started`, `session.completed`,
`agent.delegated`, `space.installed`, `hook.fired`, `document.written`, `project.created`. Signals are
fire-and-forget — a throwing/hanging internal def is worker-contained and never breaks the instrumented
path. `integration-lmthing` (`store/spaces/integration-lmthing/`) normalizes the whole set into typed
events + a `publishEvent(name, payload)` function.

### The `emits` schema + optional `?` typeStrings

`emits` maps `<event name> → { payload: { <field>: <typeString> } }`. Event names are
dot-separated lowercase (`message.received`, `db.raw_items.insert`). typeStrings are the tasklist
`output` vocabulary — `string | number | boolean | object | array | any` — and a **trailing `?` marks
the field optional** (`threadKey: 'string?'`): the generated DTS emits an optional member and runtime
validation tolerates its absence. (This `?` support was a shipped fix — `validateEmits` in
`emitter-load.ts` strips/preserves the `?`; earlier it rejected `'string?'`, breaking the migrated
messaging spaces. PROGRESS S15, core `9145023`.) Duplicate event names WITHIN one scope fail the whole
scope loudly.

---

## 2. Event hooks — the consumer side

A `hooks/<slug>.ts` file default-exports `{ type: 'event', on: { event: '<address>' }, … }` and
subscribes to ONE source-qualified event address. Exactly one of `handler` (imperative — the handler IS
the filter, no DSL) or `trigger` (`'space/agent#action'` — delegate to an agent).

```ts
// hooks/enrich-on-add.ts  — react to a raw db write, code handler as filter
export default {
  type: 'event' as const,
  on: { event: 'project/db.feed_items.insert' },       // synthetic db event; ctx.input IS the row
  handler: async ({ input, db }: {
    input: { id: string; title?: string; summary?: string };
    db: { update(t: string, o: { where: Record<string, unknown>; set: Record<string, unknown> }): Promise<number> };
  }): Promise<void> => {
    if (!input?.id || (input.summary && input.summary.trim())) return;   // filter in code — cheap, no agent
    await db.update('feed_items', { where: { id: input.id }, set: { summary: `Saved: ${input.title ?? 'untitled'}` } });
  },
};
```

```ts
// hooks/check-interactions.ts — hand the event to an agent instead
export default {
  type: 'event',
  on: { event: 'project/db.interactions.insert' },
  trigger: 'pharmacy/pharmacist#review',               // delegate: run this agent#action, seeded with the payload
  budget: { maxEpisodes: 8, maxWallClockMs: 300000 },  // forwarded to the headless run
};
```

### The source-qualified event address (`<sourceId>/<name>`)

Every event is addressed `<sourceId>/<eventName>`:

| Source | Address form | Example |
|---|---|---|
| the project's own defs | `project/<event>` | `project/item.added` |
| a synthetic db write | `project/db.<table>.<insert\|update\|remove>` | `project/db.orders.insert` |
| an installed space's defs | `<spaceId>/<event>` | `integration-slack/message.received` |

A hook subscribes across BOTH the project and every installed space; the emitting scope is
host-derived (an agent under `<project>/spaces/<id>` emits as `<id>`, everything else as `project`), so
sandbox code cannot spoof another scope's address.

### The upgraded handler ctx

Every event/cron handler (project or space) receives (`app/hooks/loader.ts` `HookHandlerArgs`):

- `input` — the emitted **payload** (uniform across kinds: for `project/db.*` it's the written row;
  for a space event it's that event's payload). `row` is a legacy alias — prefer `input`.
- `db` — the project's async data API (`AsyncDbApi`, Promise-returning).
- `delegate(agent, action?, opts?)` — delegates into a `space/agent`, **passes `opts` as structured
  input AND returns the run's result**. (Pre-events, hook `delegate` dropped opts and discarded the
  result — that was a fix; don't reintroduce the drop.)
- `callConnection(provider, req?)` — gated by the hook def's declared `connections:` (project hooks) or
  the space's own provider (space hooks); throws for an unlisted provider.
- `tasklist.run('<spaceId>/<slug>', seed)` — runs a SPACE tasklist headless (below).

`connections:` on the hook def is REQUIRED to use `callConnection`, and is validated at load against
installed integrations. Add it explicitly:

```ts
export default {
  type: 'event', on: { event: 'integration-slack/message.received' },
  connections: ['slack'],                              // else ctx.callConnection('slack', …) throws
  handler: async ({ input, callConnection }) => { /* … */ },
};
```

### Loop guard (uniform)

One `HookDispatcher` bounds every event kind: per-slug coalesce, budget-pending ≤1/slug, snapshot-and-
clear drain (never re-entrant), a hook-cascade **depth cap**, self-write / self-trigger exclusion, and
a per-hook cooldown. A db-write burst during one eval collapses to a single fire; `hook.fired`-derived
signals can't re-trigger the hook that fired them; an A→B→A ping-pong terminates at the cap. Db-write
dispatch routes through the coalescing queue (`app/hooks/runtime.ts`); webhook/cron/internal events
dispatch directly (`event-dispatch.ts`) since they arrive singly from an external edge.

---

## 3. Code nodes in space tasklists

A tasklist node is normally an `NN-<id>.md` agent node. A sibling `NN-<id>.ts` file is a **code node** —
deterministic host-run code, no model, no LLM:

```ts
// tasklists/research/02-post.ts
// `inputs` = the (declared) tasklist seed keys at top level, merged with each upstream node's
// output keyed by its node id — so `inputs.chatId` is from the seed, `inputs.research` is node
// `research`'s output. (NOT `inputs.seed.*`.)
export const node = { id: 'post', dependsOn: ['research'] };
export async function run(ctx, inputs) {
  await ctx.callConnection('slack', { op: 'postMessage', channel: inputs.chatId, text: inputs.research.summary });
  return { posted: true };
}
```

- The `node` metadata object is **statically extracted** (TypeScript AST) — core never executes node
  modules. `run(ctx, inputs)` is loaded + run **worker-isolated** by the CLI's injected
  `codeNodeCtxFactory` (`server/tasklist-runner.ts`).
- `ctx` exposes exactly `db`, `delegate` (returns the result), and `callConnection` (`WorkerInvokeHandlers`)
  — `callConnection` is locked to the tasklist's `connections:` (frontmatter of
  `tasklists/<slug>/index.md`) **∩ the owning space's own provider(s)**. A space can never reach beyond
  what it declared AND owns. (There is no blessed `ctx.fetch` — reach the network through a pinned
  `callConnection` provider, or do web research in an agent node with `webSearch`/`webFetch`.)
- Output feeds the DAG identically to an agent node (`dependsOn`, `forEach`, `output`); a code-node
  failure is a required-task failure.
- Tasklists stay **space-only** (no project tasklists). A hook handler reaches one via
  `ctx.tasklist.run('<spaceId>/<slug>', seed)` (headless runner, S9).

---

## 4. Project functions

`<project>/functions/*.ts` is a THIRD function scope beside the universal `system-global` toolkit and a
space's `functions/` (`spaces/project-functions-load.ts`). A direct mirror of space functions: plain
synchronous TS exports over host primitives (`fetch`, `execShell`, …); a project function can `import`
a dependency when the project ships `node_modules/`. They're loaded ONLY for project-rooted sessions
(and appear in that session's DTS), usable by project agents and by hook handlers / code nodes.
Authored by `system-engineer` via `writeProjectFunction(name, src)`.

---

## 5. The generic `@consent` flag (host-enforced)

Consent is a **generic, host-enforced** feature for ANY function — not just installs
(`core/src/globals/consent.ts`). A consent-marked call routes through a host-side yield BEFORE
execution: the host renders a `ConsentCard` (function + space + args summary) over the `renderHost.ask`
plumbing and runs the impl only on approval; denial returns a structured refusal.

- A **global** is consent-marked by listing its yield kind in `CONSENT_MARKED_YIELD_KINDS` — today just
  `installSpace` (consumer #1). The yield router runs the gate before the resolver.
- A **space function** opts in with the `@consent` pragma in its **leading comment** (JSDoc block or
  `//` line, before any code — detected on the original TS source):

  ```ts
  /**
   * Delete every archived record. @consent
   */
  export async function purgeArchive() { /* runs only after the user approves the card */ }
  ```

  It's wrapped at injection — the original impl is hidden in a closure; the exposed global first awaits
  the host's `__requestConsent` seam. Sandbox code can never reach the unwrapped function.

**Fails closed:** non-interactive contexts (headless runs, forks, delegates, hooks) have no consent
prompter, so a consent-marked call there is refused with a clear error — never silently executes, never
hangs. Consent is host code, unbypassable by the model.

Store/consent globals (all capability-gated — see §6):

| Global | Capability | Consent | Does |
|---|---|---|---|
| `storeSearch(query?)` | `store:read` | — | catalog entries matching `query` (all when omitted) |
| `storeInspect(spaceId)` | `store:read` | — | the full (enriched) catalog entry for one space |
| `installSpace(spaceId)` | `store:install` | **yes** | install a catalog space into the current project + live-register it for `delegate()` |
| `emitEvent(name, payload)` | `events:emit` | — | publish the caller's OWN scope's declared event into the pipeline (validated vs the scope's `emits`) |

---

## 6. Capabilities & security model

New capability ids (`spaces/capabilities.ts`, bare-only): `store:read`, `store:install`, `events:emit`.
Declared in agent `instruct.md` frontmatter `capabilities:`, enforced at injection + by DTS overlay (an
ungranted call fails typecheck), never by prose.

Security invariants (every one is shipped + tested):

- **Store code runs worker-isolated only.** Space emitter `emit`, space hook handlers, and tasklist
  code nodes are store-downloaded code — they execute in a crash-bounded, timeout-bounded worker
  (`app/api/worker.ts` family), never on the pod's main thread. Emitter defs are extracted **data-only**
  (the `emit` fn is never serialized out; re-loaded worker-isolated to run). Project code (project
  `events/`, `hooks/`, `functions/`) is the user's own trust domain and runs in-proc.
- **Env containment.** A SPACE def's descriptor-style env refs (`secretEnv`, a `hub-challenge`
  `verifyTokenEnv`) MUST sit inside its `INTEGRATION_<ID>_` namespace (`emitter-manifests.ts`
  `envRefsContained`) — a def naming a secret can only live in an `integration-*` space; it can't read
  system or other-space secrets. The builtin shorthand names no env (exempt). Project defs have no
  namespace but every env ref is recorded for audit.
- **Verify before emit.** A webhook def's `emit` runs ONLY after the host verifies the request
  (signature + optional preflight/challenge + dedupe). `emit` is pure — no i/o, no verify logic.
- **Validated payloads.** Every emitted event must name a DECLARED event and fit its payload schema, or
  it's dropped with a warn (`validateEmitted`) — a hostile/buggy emitter can't smuggle an undeclared or
  mistyped event downstream.
- **callConnection gating** everywhere (hooks / cron / code nodes): project → declared `connections:`;
  space → own provider(s). SSRF/IP-pinning inherited from `connections.ts`.

---

## 7. Worked example — "Slack message with a link to domain X → research → post back"

The original user scenario, as a project **event hook** + a space **tasklist**, assuming the user has
installed `integration-slack` (which supplies the `message.received` webhook emitter + a `slack`
outbound provider). The automator authors this into the LIVE project.

**`<project>/hooks/link-research.ts`** — subscribe to inbound Slack messages, filter for a link to the
watched domain in code (cheap, pre-agent), and run a headless space tasklist that researches + replies:

```ts
// Fires on every genuine Slack message the connected workspace delivers.
// The code handler IS the filter: it only proceeds when the message contains a link to example.com,
// so no agent/LLM wakes for unrelated chatter. When it matches, it runs the research tasklist headless,
// seeding the URL + the reply target (channel + threadKey) so the tasklist can post back in-thread.
export default {
  type: 'event' as const,
  on: { event: 'integration-slack/message.received' },   // <spaceId>/<event> — the space's declared event
  handler: async ({ input, tasklist }: {
    input: { text: string; chatId: string; threadKey?: string };
    tasklist: { run: (ref: string, seed?: unknown) => Promise<unknown> };
  }): Promise<void> => {
    const link = input.text.match(/https?:\/\/[^\s>]+/)?.[0];
    if (!link || !/(^|\.)example\.com\b/.test(new URL(link).hostname)) return;   // filter: only the watched domain
    await tasklist.run('integration-slack/research_and_reply', {
      url: link, chatId: input.chatId, threadKey: input.threadKey,
    });
  },
};
```

**`<space>/tasklists/research_and_reply/index.md`** — tasklist-level connection gate + declared seed
input (declaring `input:` keeps those seed keys as top-level `inputs.*` for every node):

```yaml
---
connections: [slack]        # ∩ the space's own provider → callConnection('slack', …) allowed in code nodes
input:
  url: string
  chatId: string
  threadKey: string
---
Research a linked page and post a summary back to the Slack thread.
```

**`…/research_and_reply/01-research.md`** — an agent node does the web research (universal
`webSearch`/`webFetch`). The tasklist seed (`url`) rides in as the node's input context:

```yaml
---
id: research
output:
  summary: string
---
Fetch the seed `url` and research the surrounding topic with webSearch/webFetch, then write a
3-sentence summary.
Resolve: currentTask.resolve({ summary: <text> })
```

**`…/research_and_reply/02-post.ts`** — a **code node** posts the reply through the space's own Slack
provider, threaded on the original message (`inputs.chatId`/`inputs.threadKey` from the seed,
`inputs.research.summary` from the upstream node):

```ts
export const node = { id: 'post', dependsOn: ['research'] };
export async function run(ctx, inputs) {
  await ctx.callConnection('slack', {          // locked to slack (declared ∩ owned)
    op: 'postMessage',
    channel: inputs.chatId,
    thread_ts: inputs.threadKey,               // reply in-thread
    text: inputs.research.summary,
  });
  return {};
}
```

Flow: Slack POST → `integration-slack` webhook emitter verifies (builtin `slack`) → pure `emit` →
typed `message.received` (with `threadKey`) → project event hook matches → code filter keeps only
watched-domain links → `tasklist.run` (headless) → research agent node → code node posts back via
`callConnection('slack')`. No pod code was touched; the whole rule is a folder of files the automator
wrote into the project.

---

## Testing

- Core validation: `pnpm -C sdk/org/libs/core test -- emitter` (`emitter-load.test.ts` — per-type
  validation, builtin shorthand, `?` optional typeStrings, dup-event rejection).
- CLI dispatch: `pnpm -C sdk/org/libs/cli test -- emitter` / `-- event` / `-- internal-signals` /
  `-- hooks` (scan+containment, webhook dispatch, db-event replacement, event-hook ctx, signal routing).
- Migrated store fixtures: `store/spaces/integration-*/events/messages.ts`,
  `store/projects/*/hooks/*.ts` (event hooks on `project/db.*`) are the live reference implementations.
</content>
</invoke>
