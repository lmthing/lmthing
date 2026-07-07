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
  - parsePortalHtml
---

Process every id from `scan_pending.captureIds` (available as `scan_pending.captureIds`) in a
**single loop** — not a `forEach` fan-out — since a later candidate in the SAME capture must dedupe
against a listing an earlier candidate in this same pass may have just inserted (the proven-reliable
single-loop write pattern, same shape as the trips finance space's `write_shares` step):

```ts
const results: { captureId: string; found: number; merged: number }[] = [];

for (const captureId of scan_pending.captureIds) {
  const capture = db.query('raw_captures', { where: { id: captureId } })[0];
  if (!capture || capture.status !== 'pending') continue; // already claimed by a prior pass

  db.update('raw_captures', capture.id, { status: 'parsing' });
  const source = db.query('sources', { where: { id: capture.sourceId } })[0];

  let candidates: {
    title: string; url: string; priceAmount: number; currency: string;
    areaSqm: number; rooms: number; bedrooms: number; floor: string;
    yearBuilt: number; address: string;
  }[] = [];

  try {
    if (capture.sourceUrl) {
      // A pasted link — fetch the real page and prefer its structured fields.
      const html = webFetch(capture.sourceUrl);
      const parsed = parsePortalHtml(html);
      candidates = [{
        title: parsed.title,
        url: capture.sourceUrl,
        priceAmount: parsed.priceAmount,
        currency: parsed.currency,
        areaSqm: parsed.areaSqm,
        rooms: parsed.rooms,
        bedrooms: parsed.bedrooms,
        floor: '', // not derivable from parsePortalHtml's shape — left at default, never guessed
        yearBuilt: 0,
        address: parsed.address,
      }];
    } else {
      // Pasted text — an alert-email digest (possibly several listings) or a single block;
      // parseAlertEmail segments either shape into candidate blocks.
      const blocks = parseAlertEmail(capture.content);
      candidates = blocks.map((block) => extractListingFields(block));
    }
  } catch (err) {
    db.update('raw_captures', capture.id, { status: 'error', error: String(err) });
    results.push({ captureId: capture.id, found: 0, merged: 0 });
    continue;
  }

  let merged = 0;
  for (const candidate of candidates) {
    const key = dedupeKey({
      address: candidate.address,
      rooms: candidate.rooms,
      areaSqm: candidate.areaSqm,
      priceAmount: candidate.priceAmount,
    });
    const existingForSearch = db.query('listings', { where: { searchId: capture.searchId } });
    const exact = existingForSearch.find((l) => l.dedupeKey === key);

    if (exact) {
      // Same unit, cross-posted or re-captured — union portal labels, keep the best url, bump lastSeenAt.
      const portals = new Set((exact.portal || '').split(',').map((p: string) => p.trim()).filter(Boolean));
      if (source?.label) portals.add(source.label);
      db.update('listings', exact.id, {
        portal: Array.from(portals).join(', '),
        url: exact.url || candidate.url,
        lastSeenAt: new Date().toISOString(),
      });
      merged++;
      continue;
    }

    // Borderline: same address + room count + size band, but a DIFFERENT price band —
    // dedupeKey's format is `<addr>|r<rooms>|s<sizeBand>|p<priceBand>`, so comparing the
    // prefix up to `|p` catches this without needing dedupeKey's private address
    // normalization. Coarse-match on identity, disagree on price ⇒ never silently merge
    // (would erase a real price difference) and never silently treat as unrelated
    // (clutters the feed) — flag both `possible_duplicate` in this headless run. (A chat
    // session invoking `parse` interactively instead would raise the `ConfirmMerge` ask
    // component here and let the user decide; this tasklist always runs headless.)
    const addrRoomsSize = key.slice(0, key.indexOf('|p'));
    const borderline = existingForSearch.find((l) => l.dedupeKey.startsWith(addrRoomsSize + '|p'));

    const inserted = db.insert('listings', {
      searchId: capture.searchId,
      dedupeKey: key,
      title: candidate.title,
      url: candidate.url,
      portal: source?.label ?? '',
      priceAmount: candidate.priceAmount,
      currency: candidate.currency || 'USD',
      address: candidate.address,
      areaSqm: candidate.areaSqm,
      rooms: candidate.rooms,
      bedrooms: candidate.bedrooms,
      floor: candidate.floor,
      yearBuilt: candidate.yearBuilt,
      // Sanitize on ingest — captures are untrusted content.
      description: String(capture.content ?? '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
      lastSeenAt: new Date().toISOString(),
      flags: borderline ? ['possible_duplicate'] : [],
    });

    if (borderline && !(borderline.flags ?? []).includes('possible_duplicate')) {
      db.update('listings', borderline.id, { flags: [...(borderline.flags ?? []), 'possible_duplicate'] });
    }
    void inserted;
  }

  if (source) db.update('sources', source.id, { lastIngestedAt: new Date().toISOString() });
  results.push({ captureId: capture.id, found: candidates.length, merged });
}

currentTask.resolve({ results });
```
