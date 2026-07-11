# lmthing events

This integration lets a project **subscribe to lmthing's own runtime events** and **publish its own
custom events** — all through the same event pipeline external integrations (Slack, Telegram, …)
use. It is the simplest integration to try because it needs **no API keys and no setup**: install it
and it works.

## No configuration required

Unlike the messaging integrations, `integration-lmthing` has **no settings and no secrets**. It emits
from lmthing's internal runtime signals and publishes via an in-process global — there is nothing to
paste, no token to create. That also makes it the cleanest way to see the install **consent card**
(what a space asks for before THING installs it).

## Events it emits

Its `events/` dir holds one `internal` emitter def per lmthing runtime signal. Each produces a typed
event a project hook can subscribe to. Subscribers address an event as
`integration-lmthing/<name>`:

| Event address | Fires when… | Payload |
|---|---|---|
| `integration-lmthing/session.completed` | an agent session (top-level or headless) finishes | `{ projectId, agent, sessionId, ok, durationMs }` |
| `integration-lmthing/space.installed` | a space is installed into the project | `{ projectId, spaceId }` |
| `integration-lmthing/hook.fired` | one of the project's hooks runs | `{ projectId, slug, hookType }` |
| `integration-lmthing/document.written` | a document is written in the project | `{ projectId, path }` |
| `integration-lmthing/project.created` | a new project is created | `{ projectId }` |

## How to subscribe (react to an event)

An automator writes a **project event hook** that names the event address. For example, to post a
summary into the chat whenever a space is installed, the hook is a `{ type: 'event' }` hook:

```ts
// <project>/hooks/on-space-installed.ts
export default {
  type: 'event',
  on: { event: 'integration-lmthing/space.installed' },
  // trigger an agent, or filter/act in a code handler:
  async handler(ctx, evt) {
    // evt.payload = { projectId, spaceId }
    await ctx.delegate('user-thing/thing', undefined, {
      input: `A space was just installed: ${evt.payload.spaceId}. Summarize it into the chat.`,
    });
  },
};
```

The handler **is** the filter — plain TypeScript, no DSL. See the events-and-hooks authoring guide
for the full hook contract.

## How to publish your own event

The `publisher` agent (capability `events:emit`) exposes a `publishEvent(name, payload)` function
that wraps the `emitEvent` global. Any custom event you publish flows through the same pipeline:

```ts
await publishEvent('batch.done', { count: 12 });
// subscribers match `integration-lmthing/batch.done`
```

The host validates the payload against the emitting scope's declared events (drop-with-warn on a
mismatch), so keep payloads to plain JSON fields.

## Under the hood

The emitter defs are **pure** (`emit(signal)` does no i/o) and run worker-isolated at dispatch; a
signal missing a contracted field produces no event. Loop protection (depth cap + self-trigger
suppression) is enforced by the pod's signal seam, so a `hook.fired` subscription can't ping-pong.
