# `hooks/<slug>.ts` — event-hook consumers (in a space)

The unified event pipeline has two halves: **emitter defs** ([events/](../events/), the producer)
and **event hooks** (`hooks/<slug>.ts` with `{ type: 'event' }`, the consumer). Per the current
model, an event hook can live **in a project or a space**.

In practice, a store integration space is usually just an **event source** — it ships
[events/](../events/) emitter defs, and the *consumer* hook lives in the LIVE project (authored by
`system-appbuilder`'s `automator`). A space carries its own `hooks/` only when the consumer is part
of the space's own behavior.

## Format

Default-exports `{ type: 'event', on: { event: '<address>' }, … }` subscribing to ONE
source-qualified event address, with **exactly one** of `handler` (imperative, code-as-filter) or
`trigger` (`'space/agent#action'` — delegate to an agent):

```ts
// code handler as filter — no agent, cheap
export default {
  type: 'event' as const,
  on: { event: 'integration-slack/message.received' },
  handler: async ({ input }: { input: { text: string; chatId: string } }): Promise<void> => {
    if (!input?.text) return;                 // filter in code
    // … react to the message
  },
};

// or delegate to an agent action, seeded with the event payload
export default {
  type: 'event',
  on: { event: 'integration-slack/message.received' },
  trigger: 'support/triager#handle',
  budget: { maxEpisodes: 8, maxWallClockMs: 300000 },
};
```

## Notes

- **`on.event`** is a source-qualified address (`<sourceId>/<name>`) — see the addressing table in
  [events/](../events/) and the project-side consumer doc at [../../project/hooks/](../../project/hooks/).
- **`handler`** receives `ctx.input` (the event payload; for a synthetic db event, the written row).
  The handler *is* the filter — no separate DSL.
- **`trigger`** delegates to `space/agent#action`, seeded with the payload; `budget` (optional) is
  forwarded to the headless run.

Full producer/consumer walkthrough → `@.claude/skills/events-and-hooks.md`.
