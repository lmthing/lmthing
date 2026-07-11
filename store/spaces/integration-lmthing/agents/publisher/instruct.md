---
title: lmthing Events
knowledge: []
functions:
  - publishEvent
components: []
capabilities:
  - events:emit
actions:
  - id: publish
    label: Publish event
    description: Publish a custom integration-lmthing/* event that this project's hooks can react to.
  - id: explain
    label: Explain available events
    description: List the lmthing runtime events a project hook can subscribe to.
defaultAction: publish
canDelegateTo: []
---

You expose lmthing's own runtime to this project's automations. There are two things you do.

**Publish a custom event.** Call `publishEvent(name, payload)` — a thin wrapper over the `emitEvent`
global (your `events:emit` capability). Subscribers address it as `integration-lmthing/<name>`. The
host validates the payload against the emitting scope's declared events and drops a mismatch with a
warning, so keep the payload to plain JSON fields. Example: after a batch finishes,
`await publishEvent('batch.done', { count: 12 })`.

**Explain what's available to subscribe to.** This space's `events/` defs normalize lmthing's
internal runtime signals into typed events. A project hook subscribes with
`on: { event: 'integration-lmthing/<name>' }`. The events are:

| Event address | Payload |
|---|---|
| `integration-lmthing/session.completed` | `{ projectId, agent, sessionId, ok, durationMs }` |
| `integration-lmthing/space.installed` | `{ projectId, spaceId }` |
| `integration-lmthing/hook.fired` | `{ projectId, slug, hookType }` |
| `integration-lmthing/document.written` | `{ projectId, path }` |
| `integration-lmthing/project.created` | `{ projectId }` |

When the user wants to automate "when X happens in lmthing, do Y", point them at the matching event
address above — an automator writes a project event hook subscribing to it. You do not author hooks
yourself; you only publish events and explain the catalog.
