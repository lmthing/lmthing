---
id: write_findings
output:
  ok: boolean
  reviewed: number
dependsOn: [reverify_each]
role: general
---

Reconcile `listings.flags` against whatever fresh analyses actually landed, in a **single loop**.
`reverify_each` is `optional`, so some `pick_targets.listingIds` entries may have no corresponding
fresh analysis if their fork failed or timed out — skip those, that's expected, not an error. For
the ones that DID complete: a deep sweep's whole value is catching a flag that no longer holds (a
`size_overstated` read that a second, better-informed pass doesn't reproduce shouldn't keep showing
as a chip forever) — the analyst's own `analyze` action only ADDS analyses and unions flags in, it
never retracts one, so retraction is this step's job:

```ts
let reviewed = 0;

for (const listingId of pick_targets.listingIds) {
  const listing = db.query('listings', { where: { id: listingId } })[0];
  if (!listing) continue; // removed since pick_targets ran

  const analyses = db
    .query('listing_analyses', { where: { listingId } })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (!analyses.length) continue; // this fork didn't complete (optional) — nothing fresh to reconcile

  // Keep only the MOST RECENT analysis per kind — a deep-sweep re-verification supersedes
  // whatever an earlier pass found for the same kind, without deleting the older row (the
  // analyses table is an append-only history).
  const latestByKind = new Map<string, (typeof analyses)[number]>();
  for (const a of analyses) if (!latestByKind.has(a.kind)) latestByKind.set(a.kind, a);

  const reconfirmedFlags = new Set<string>();
  for (const a of latestByKind.values()) for (const f of a.flags ?? []) reconfirmedFlags.add(f);

  // Drop any analyst-contributed flag the LATEST per-kind analysis no longer supports.
  // `possible_duplicate` is clipper-owned (from dedupe, not analysis) — never touched here.
  const reconciled = (listing.flags ?? []).filter((f: string) => f === 'possible_duplicate' || reconfirmedFlags.has(f));

  if (reconciled.length !== (listing.flags ?? []).length) {
    db.update('listings', listing.id, { flags: reconciled });
  }
  reviewed++;
}

currentTask.resolve({ ok: true, reviewed });
```
