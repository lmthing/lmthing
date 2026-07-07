---
id: update_notes
output:
  touchedListingIds: array
dependsOn: [load_signals]
role: general
---

Distill every signal from `load_signals` (available as `load_signals.signalIds`) into `taste_notes`
in a **single loop** — not a `forEach` fan-out — since a later signal in this same pass may need to
merge into a note an earlier signal in the SAME pass just created:

```ts
const touchedListingIds = new Set<string>();

for (const signalId of load_signals.signalIds) {
  const signal = db.query('taste_signals', { where: { id: signalId } })[0];
  if (!signal || signal.folded) continue; // already handled by a prior pass

  if (signal.listingId) touchedListingIds.add(signal.listingId);

  // A dismiss with a stated reason is the highest-value evidence — above all else, distill
  // these. Map the reason onto ONE of style/light/layout/location/building/dealbreaker/other
  // (model judgment over the reason text, and the dismissed listing's own fields when
  // `signal.listingId` is set — e.g. a reason mentioning "too dark"/"no windows" → 'light';
  // "ground floor"/"no elevator" as a stated non-negotiable → 'dealbreaker').
  if (signal.action === 'dismiss' && signal.reason) {
    const dimension = 'other'; // replace with the actual mapped dimension
    const existing = db.query('taste_notes', { where: { searchId, dimension } })[0];

    if (existing) {
      // MERGE — append this signal's evidence and strengthen the existing statement rather
      // than writing a second competing note for the same dimension.
      db.update('taste_notes', existing.id, {
        statement: `${existing.statement} Also dismissed citing "${signal.reason}".`,
        supportCount: existing.supportCount + 1,
        weight: Math.min(1, existing.weight + 0.05),
      });
    } else {
      db.insert('taste_notes', {
        searchId,
        dimension,
        statement: `Dismissed a listing citing "${signal.reason}".`,
        weight: 0.6,
        supportCount: 1,
      });
    }
  } else if ((signal.action === 'save' || signal.action === 'contact') && signal.listingId) {
    // Weaker positive evidence than a reasoned dismiss — only worth a note when it
    // reinforces something the existing notes already track (e.g. repeatedly saving
    // listings that share a trait a note already names); a single bare save with no
    // distinguishing trait usually isn't enough on its own to justify a new note.
  }

  db.update('taste_signals', signal.id, { folded: true });
}

currentTask.resolve({ touchedListingIds: Array.from(touchedListingIds) });
```
