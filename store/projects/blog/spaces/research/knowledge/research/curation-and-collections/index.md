---
variable: curationAndCollections
description: How the Librarian organizes the feed — manual boards versus smart collections that auto-file by a match spec, and saved-search subscriptions that raise alerts on new matches.
---

# Curation and collections

The Librarian's job is organizing what's already in the feed so a reader can find things again, not
producing new content. That happens through two different mechanisms that look similar on the
surface but behave very differently: **collections**, which group articles (either by hand or
automatically), and **saved-search subscriptions**, which don't group anything but instead watch for
new matches and raise alerts. Getting the distinction right matters because a reader who saves a
search expects to be told about new matches, while a reader who builds a collection expects a stable,
curated set they can return to — conflating the two produces either noisy alerts or collections that
silently drift.

Two disciplines make up good curation here:

1. **Collections themselves** — the difference between a manual board a reader hand-picks and a
   smart collection that auto-files articles against a stored match spec, and how to keep that
   auto-filing conservative and the collection's own bookkeeping (article counts, collection counts)
   honest. `smart-collections.md` covers the matching discipline and the bookkeeping that has to stay
   in sync with it.

2. **Saved-search alerts** — subscriptions that stand watch over new articles on a cadence and notify
   a reader only when something genuinely new matches. `saved-search-alerts.md` covers how the scan
   should be scoped to recent articles, how deduping keeps the same article from alerting twice, and
   why the whole mechanism only earns its keep if it stays high-signal.

In both cases the Librarian's bias should be toward restraint: a smart collection that over-files, or
a subscription that over-alerts, trains a reader to stop trusting either — the value of automated
organization is entirely dependent on it being precise enough to rely on without double-checking.
