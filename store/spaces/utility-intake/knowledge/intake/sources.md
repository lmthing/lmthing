# Sources — how things get INTO `intake_items`

This space does not fetch anything. It routes what other things deposit, which keeps the inbox one
simple contract: **insert a row into `intake_items`, and it gets triaged**.

Row shape: `{ source, payloadJson, intakeKey, status: 'pending', createdAt }`. The `intakeKey`
(from `computeIntakeKey(source, payloadJson)`) makes a repeated delivery — a webhook retry, a
re-imported file — dedupe instead of double-routing. Check before inserting.

## From an integration's inbound event

A project hook subscribing to any installed integration's emitter def:

```ts
// hooks/slack-to-intake.ts
export default {
  type: 'event',
  on: { event: 'integration-slack/message.received' },
  handler: async ({ input, db }: {
    input: Record<string, unknown>;
    db: {
      query(table: string, opts?: { where?: Record<string, unknown> }): Promise<Record<string, unknown>[]>;
      insert(table: string, row: Record<string, unknown>): Promise<{ id: string }>;
    };
  }): Promise<void> => {
    const payloadJson = JSON.stringify(input ?? {});
    // Inline the key (a hook cannot import a space function — each hook is transpiled per-file).
    let h = 5381;
    for (let i = 0; i < payloadJson.length; i++) h = ((h * 33) ^ payloadJson.charCodeAt(i)) >>> 0;
    const intakeKey = `slack:${h.toString(16).padStart(8, '0')}`;

    const seen = await db.query('intake_items', { where: { intakeKey } });
    if (seen.length > 0) return;                       // idempotent: the same delivery twice is one item

    await db.insert('intake_items', {
      source: 'slack', payloadJson, intakeKey,
      status: 'pending', routedTable: '', routedRowId: '',
      createdAt: new Date().toISOString(),
    });
  },
};
```

Note the shape: **a hook cannot import a space function**, because each `hooks/*.ts` is transpiled
per-file with no cross-file resolution. Shared logic is inlined, as above.

## From a webhook

Point the pod's inbound broker at a webhook emitter def (in an integration space, or a personal
endpoint space), then use the same handler pattern on that def's event.

## From a person, or from THING

A plain insert is a perfectly good source — `source: 'manual'`, the payload as JSON. THING can drop
something into the inbox mid-conversation and let the rules decide where it belongs.

## The one rule for a source

Set `status: 'pending'` and let triage decide. A source that pre-assigns `routed` is claiming to
know the destination, which is exactly the judgment this space exists to make with reviewed rules.
