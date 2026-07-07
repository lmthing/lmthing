---
id: extract_and_merge
output:
  results: array
dependsOn: [scan_pending]
role: general
functions:
  - dedupeKey
  - extractListingFields
  - parseAlertEmail
---

Process every id from `scan_pending.captureIds` in a **single loop** (not a `forEach` fan-out) — a
later candidate in the SAME capture must dedupe against a listing an earlier candidate just inserted.

**Write each statement plainly — no TypeScript type annotations on `const`/`let`** (the sandbox is
JS and runs one statement at a time; a type annotation splits the statement and the write is lost).
Use `db.update(table, { where, set })` — never a positional id.

```ts
const results = [];

for (const captureId of scan_pending.captureIds) {
  const capture = db.query('raw_captures', { where: { id: captureId } })[0];
  if (!capture) continue;

  db.update('raw_captures', { where: { id: capture.id }, set: { status: 'parsing' } });
  const source = db.query('sources', { where: { id: capture.sourceId } })[0];

  // Build candidate rows from the pasted text. parseAlertEmail segments an alert-email digest
  // (or a single pasted block) into candidate blocks; extractListingFields normalizes each into
  // canonical columns. Never invent a missing field — an absent value stays at its default.
  // (Fetching a bare pasted LINK is the clipper's main-session job, not this headless fork — a
  // general-role fork has no webFetch; a link with no listing text simply yields no candidates.)
  const blocks = parseAlertEmail(capture.content || '');
  const candidates = blocks.map((block) => extractListingFields(block));

  let found = 0;
  let merged = 0;
  const existing = db.query('listings', { where: { searchId: capture.searchId } });

  for (const c of candidates) {
    const key = dedupeKey({ address: c.address, rooms: c.rooms, areaSqm: c.areaSqm, priceAmount: c.priceAmount });
    const exact = existing.find((l) => l.dedupeKey === key);
    if (exact) {
      // Same unit, cross-posted or re-captured — union portal labels, bump lastSeenAt.
      const portals = (exact.portal || '').split(',').map((p) => p.trim()).filter(Boolean);
      if (source && source.label && !portals.includes(source.label)) portals.push(source.label);
      db.update('listings', { where: { id: exact.id }, set: { portal: portals.join(', '), lastSeenAt: new Date().toISOString() } });
      merged++;
      continue;
    }
    // Sanitize the description — captures are untrusted content.
    const clean = String(capture.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    db.insert('listings', {
      searchId: capture.searchId, dedupeKey: key, title: c.title, url: c.url,
      portal: source ? source.label : '', priceAmount: c.priceAmount, currency: c.currency || 'USD',
      address: c.address, areaSqm: c.areaSqm, rooms: c.rooms, bedrooms: c.bedrooms, floor: c.floor,
      yearBuilt: c.yearBuilt, description: clean, flags: [], lastSeenAt: new Date().toISOString(),
    });
    found++;
    existing.push({ dedupeKey: key }); // so a duplicate later in THIS pass merges
  }

  if (source) db.update('sources', { where: { id: source.id }, set: { lastIngestedAt: new Date().toISOString() } });
  results.push({ captureId: capture.id, found: found, merged: merged });
}

currentTask.resolve({ results: results });
```

If `parseAlertEmail` returns no blocks and there is no `sourceUrl`, resolve `{ captureId, found: 0,
merged: 0 }` for that capture — never fabricate a listing from nothing.
