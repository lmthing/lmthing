---
title: Listing clipper
defaultAction: parse
actions:
  - id: parse
    label: Parse pending captures
    description: Turn each pending raw_capture into a canonical listing — extract fields, sanitize, dedupe-merge across portals.
    tasklist: parse-captures
  - id: refresh
    label: Refresh tracked listings
    description: Re-fetch each active search's tracked listings; mark them gone, price-changed, or back online.
  - id: poll
    label: Poll saved searches
    description: Fetch due, opted-in saved-search sources (robots-aware, throttled) and ingest results as new captures.
knowledge:
  - home-intake/listing-parsing
capabilities:
  - db:read:  { tables: [searches, sources, raw_captures, listings] }
  - db:write: { tables: [raw_captures, sources, listings, alerts] }
---

Write your TypeScript one statement at a time, model-driven, `db` calls are synchronous. Narrate
your reasoning in `// comments`, never as bare prose — the sandbox only executes statements.

## Action: parse

Invoked with `input.captureId` as a hint (typically from the `parse-new-capture` hook, fired the
moment a user pastes something) — but the real work always self-scans every capture still
`pending`, so a single id never leaves a straggler behind after a partial prior run. Run the
`parse-captures` tasklist rather than orchestrating the extract/dedupe/merge steps yourself:

```ts
const t = await tasklist('parse-captures', {});
```

It resolves once every currently-pending capture has been segmented into candidate listings,
matched or inserted, and given a summary. See the tasklist for the full logic — it uses
`parseAlertEmail`, `parsePortalHtml`, `extractListingFields`, `dedupeKey`.

## Action: refresh

Invoked by the `refresh-tracked-listings` cron — no input, self-scan every active search's tracked
listings (anything not `dismissed`/`gone`):

```ts
const searches = db.query('searches', { where: { status: 'active' } });

for (const search of searches) {
  const tracked = db
    .query('listings', { where: { searchId: search.id } })
    .filter((l) => l.status !== 'dismissed' && l.status !== 'gone');

  for (const listing of tracked) {
    if (!listing.url) continue; // nothing to re-check without a canonical URL

    let html = '';
    try {
      html = webFetch(listing.url);
    } catch {
      html = ''; // treated the same as an empty page below
    }

    if (!html || html.length < 200) {
      // A near-empty refetch reads as "taken down", not "network hiccup" — the user
      // can always re-paste the listing later if this was a transient failure.
      db.update('listings', listing.id, { status: 'gone', lastSeenAt: new Date().toISOString() });
      db.insert('alerts', {
        searchId: search.id,
        listingId: listing.id,
        kind: 'gone',
        title: `${listing.title} looks like it's been taken down`,
        body: `Refetching ${listing.url} returned no usable content — marking it gone.`,
      });
      continue;
    }

    const fresh = parsePortalHtml(html);
    const priceChanged = fresh.priceAmount > 0 && fresh.priceAmount !== listing.priceAmount;

    // Note: trueCostMonthly is deliberately left as-is here. A price refresh doesn't
    // re-fire the insert-only `enrich-new-listing` pipeline (this is an update, not an
    // insert), so the last-computed true cost goes slightly stale until something else
    // touches the row — an acceptable tradeoff against re-running the whole scout
    // pipeline on every 6h refresh tick.
    db.update('listings', listing.id, {
      lastSeenAt: new Date().toISOString(),
      ...(priceChanged ? { priceAmount: fresh.priceAmount } : {}),
    });

    if (priceChanged && fresh.priceAmount < listing.priceAmount) {
      db.insert('alerts', {
        searchId: search.id,
        listingId: listing.id,
        kind: 'price_drop',
        title: `${listing.title} dropped to ${formatMoney(fresh.priceAmount, listing.currency)}`,
        body: `Was ${formatMoney(listing.priceAmount, listing.currency)}, now ${formatMoney(fresh.priceAmount, listing.currency)} — refetched from ${listing.url}.`,
      });
    }
    // A listing that had been `gone` is never in `tracked` above (filtered out), so a
    // `back_online` alert is raised the one place that DOES see gone listings: `poll`,
    // when the same unit resurfaces as a fresh capture and re-dedupes onto this row.
  }
}
```

## Action: poll

Invoked by the `poll-saved-searches` cron — no input, self-scan every `saved_search` source that's
due, robots-checking each before fetching:

```ts
const sources = db.query('sources', { where: { kind: 'saved_search' } });
const plan = politeFetchPlan(sources, Date.now());

// `plan` is already ordered/spaced per host (politeFetchPlan's earliestAtMs) — walk it
// in order rather than reordering; no literal sleep is needed within one cron tick.
for (const entry of plan) {
  const source = sources.find((s) => s.id === entry.sourceId)!;

  const robotsTxt = webFetch(new URL('/robots.txt', entry.url).toString());
  const check = robotsAllowed(robotsTxt, entry.url);
  if (!check.allowed) {
    // STOP on this source entirely — auto-disable, never rotate a user agent or retry around it.
    db.update('sources', source.id, {
      pollEnabled: false,
      blockedReason: `robots.txt disallows this path (${check.rule ?? 'no matching rule'}) — polling auto-disabled.`,
    });
    continue;
  }

  let url: string | null = entry.url;
  let pagesFetched = 0;
  while (url && pagesFetched < entry.maxPages) {
    const html = webFetch(url);
    const page = paginateSavedSearch(html);
    for (const card of page.cards) {
      // Ordinary raw_captures — the parse-new-capture hook re-enters the same pipeline
      // a pasted email would, so poll results get identical extract/dedupe/merge treatment.
      db.insert('raw_captures', {
        sourceId: source.id,
        searchId: source.searchId,
        content: card.text,
        sourceUrl: card.url,
        status: 'pending',
      });
    }
    url = page.nextPageUrl;
    pagesFetched++;
  }

  db.update('sources', source.id, { lastPolledAt: new Date().toISOString() });
}
```

Guardrails:

- `where` is equality-only — filter/sort in memory for anything beyond exact matches.
- Never invent a field absent from a capture — leave the schema default, don't infer from "typical
  for this area" or similar listings.
- Sanitize on ingest: strip HTML/scripts from a capture's free text before it ever lands in
  `listings.description` — captures are untrusted content.
- A borderline dedupe (same street + size, different price band) is never silently merged or
  silently kept separate without a flag — in a chat session, raise the `ConfirmMerge` ask
  component; in a headless hook run, keep the rows separate and flag both `possible_duplicate`.
- Respect `politeFetchPlan`'s spacing/page caps and `robotsAllowed`'s verdict absolutely — a
  disallow means stop, not retry with a different path or timing.
