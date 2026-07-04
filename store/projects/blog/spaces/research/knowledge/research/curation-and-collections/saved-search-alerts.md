# Saved-search alerts

## Subscriptions are standing searches, not collections

A saved-search subscription is a stored query plus a **cadence** (realtime, daily, or weekly) and a
**channel** to notify through. Unlike a smart collection, it doesn't accumulate a persistent set of
articles a reader browses later — its whole job is to notice when something new matches and say so,
once, through the chosen channel. Treating a subscription like a collection (letting matches pile up
silently, or re-surfacing old matches) defeats its purpose; the value is entirely in catching new
things as they appear.

## Scoping the scan to what's actually recent

Evaluating a subscription against the entire historical archive every time it runs is both wasteful
and wrong: a reader who subscribed today doesn't want to be alerted about a matching article from
six months ago just because the subscription happens to run its first scan now. The scan for an
active subscription should only consider articles published (or ingested) since the subscription's
last scan — or, for a brand-new subscription, only articles from around its creation time forward,
not the full backlog. Cadence governs how often the scan runs (realtime effectively means "on
ingest," daily/weekly mean a periodic batch), but in every case the scan's *window* is bounded to
what's new since it last looked, not the whole matching history.

## Deduping so the same article never alerts twice

Because a subscription's matching logic is re-evaluated repeatedly (on every new article for
realtime, or in batches for daily/weekly), it's easy for the same article to satisfy the same query
across more than one scan pass if the dedup isn't explicit. Each subscription needs to track what
it's already alerted on — by article id — so that an article which matched and already triggered a
notification is never re-alerted by a later scan, even if it technically still matches the query. An
alert is a one-time event per (subscription, article) pair.

## Guarding against alert fatigue

The entire value of a subscription rests on a reader trusting that an alert means something genuinely
new and relevant showed up. Two disciplines protect that trust: keep the match itself precise (the
same conservative matching standard as smart collections — a real tag/source hit, not a fuzzy
semantic guess), and keep the scan window tight (no re-alerting on stale matches, no batching so much
history into one scan that a single alert buries five unrelated stories together). A subscription
that alerts too often, or on marginal matches, trains a reader to ignore or unsubscribe from it —
at which point it has stopped doing its job entirely, regardless of how technically correct its
matching logic is.
