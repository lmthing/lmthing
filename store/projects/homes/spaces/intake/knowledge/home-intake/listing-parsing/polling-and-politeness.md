# Polling and politeness

## Opt-in by design

Paste-first is the default and the only path that needs zero trust: the user controls exactly what
gets ingested. Polling a `saved_search` source's URL is an explicit per-source opt-in
(`sources.pollEnabled`) precisely because unattended, scheduled fetching of a third-party site is a
much bigger promise than parsing text the user handed over directly — it has to be throttled, it has
to respect the site's own stated wishes, and it has to fail safely rather than get louder when it's
being told no.

## What `politeFetchPlan` enforces, deterministically

`politeFetchPlan` is a pure function precisely so its throttling behavior is testable and never drifts
by model whim: `pollIntervalHours` floors at 6 regardless of what a source is configured with, a
source is only "due" once `now − lastPolledAt` clears that floor, and requests to the SAME host are
spaced with jitter so the poller never issues a burst of near-simultaneous requests to one portal even
across several due sources. A hard per-run page cap (12 pages, ≤3 per source) bounds worst-case load
in a single cron tick no matter how many sources are due at once.

## Robots checks come before every fetch, not once per source

`robotsAllowed` is called against the FRESHLY fetched `robots.txt` for the specific path about to be
requested, not cached from source creation — a site can change its policy at any time, and the
clipper's job is to notice the moment it does, not to keep acting on a permission that was true when
the source was first configured. A disallow is terminal for that source: `pollEnabled` flips to
`false`, `blockedReason` is set to a human-readable explanation citing the actual rule that matched,
and the poll STOPS for that source entirely in that run. There is no retry, no alternate path, no
user-agent rotation — the auto-disable is the point, and it's surfaced to the user as a visible reason
rather than a silent stop, so they know to either re-enable it once the policy changes or fall back to
pasting for that portal.

## Saved-search results feed the SAME pipeline as pasted captures

A `paginateSavedSearch` card becomes an ordinary `raw_captures` row with `status: 'pending'` — it gets
no special treatment relative to a pasted email or link. This is deliberate: it means every dedupe,
extraction, and sanitization guarantee the parse pipeline gives a human-pasted capture applies
identically to a polled one, and it means the parse-new-capture hook's insert trigger does the actual
work of re-entering the pipeline without the poller needing to know anything about extraction.
