---
id: deliver
dependsOn: [collect]
role: general
capabilities: [db:read, db:write]
functions:
  - computeBatchKey
canDelegateTo: ["*"]
output:
  delivered: number
  empty: number
  failed: number
  skipped: number
  ok: boolean
---

Deliver each non-empty digest to its rule's configured channel and log exactly one row per
delivery. `collect` is the collected fan-out: one branch per rule.

```ts
const branches = (collect ?? []).filter((b: any) => b && typeof b === 'object');
const skipped = branches.filter((b: any) => b.skipped === true).length;
const sendable = branches.filter((b: any) => b.skipped !== true && b.itemCount > 0);
const empty = branches.filter((b: any) => b.skipped !== true && b.itemCount === 0).length;
```

Deliver one at a time, and log each result immediately so a failure mid-loop never loses the record
of what already went out:

```ts
let delivered = 0, failed = 0;
const now = new Date().toISOString();
for (const b of sendable) {
  const batchKey = computeBatchKey(b.ruleId, b.newLastSeen, b.itemCount);
  const already = db.query('dispatch_log', { where: { batchKey } });
  if (already.length > 0) continue; // this exact batch was already delivered
  let status = 'sent';
  try {
    await delegate(b.channelRef, `Deliver this update to the user's configured destination${b.channelHint ? ` (${b.channelHint})` : ''}. Send the text below as-is, without rewriting it:\n\n${b.digest}`);
  } catch (e) {
    status = 'failed';
  }
  db.insert('dispatch_log', {
    ruleId: b.ruleId, batchKey, itemCount: b.itemCount,
    lastSeenCreatedAt: b.newLastSeen, deliveredVia: b.channelRef,
    status, createdAt: now,
  });
  if (status === 'sent') delivered++; else failed++;
}
currentTask.resolve({ delivered, empty, failed, skipped, ok: true });
```

Guardrails:

- **Never send an empty digest** — a rule with nothing new logs nothing, so its watermark stays put
  and the next run reconsiders the same window.
- The ONLY permitted delegation target is `b.channelRef` — the user-confirmed channel from
  `dispatch_rules`. Never substitute another agent, and never delegate for any other purpose.
- A failed delivery is logged `status: 'failed'`, which does NOT advance the watermark for the next
  run (only `'sent'` rows are read as watermarks) — so the batch is retried, not lost.
- Write only `dispatch_log`; never touch the source queue table or any host-app table.
