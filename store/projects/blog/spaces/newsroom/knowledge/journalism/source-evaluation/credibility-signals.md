# Credibility signals

## `rss` sources are pre-filtered; `search` sources are not

An `rss`-kind source's `value` is a specific feed the reader deliberately subscribed to — every
entry it returns has already passed the bar of "this is a publication whose whole feed I want."
The fetcher can be relatively liberal recording `rss` items: skip only entries missing a usable
`title`/`url` (nothing to synthesize from) or that are pure syndication filler (an RSS feed's
"jobs" or "sponsored" sub-feed mixed into the main one, recognizable by a title pattern with no
editorial content). A `search`-kind source's `value` is a standing query, and every run re-searches
the open web — the results are not pre-vetted by the reader in the same way, so this is where more
judgment is needed before recording an item as a `raw_items` row.

## What makes a search result worth recording

Favor results that read as first-hand reporting or an original announcement over aggregation:
a company's own blog post about a launch, a publication's original reporting with named sources or
specifics, or a primary document (a paper, a filing, an official statement) beat a listicle-style
roundup that summarizes "5 things happening in X this week" with no depth on any one of them.
Recognizable low-substance results to skip: titles that are purely generic ("Everything you need to
know about X" with no specific claim in the title itself), excerpts with no concrete detail (no
number, name, date, or specific event — just vague framing), and results that are clearly a stale
republish of an older story with a refreshed date and no new content. None of these are hard
disqualifiers on their own, but when several stack up on one result, it's a search hit not worth
turning into a `raw_items` row.

## Recency and duplication at fetch time

Because `raw_items.url` is unique, exact re-fetches of the same URL are already prevented at the
database level — the judgment call is about *near*-duplicates: the same underlying event covered
by two different URLs (a wire story and a local outlet's republish of it, or two blogs covering the
same announcement within hours of each other). At fetch time, it's reasonable to record both if
they're genuinely different sources the reader follows — the dedup-by-story-not-just-by-URL
decision belongs downstream, at synthesis time, via `clusterKey` (see `dedup-and-clustering.md`),
not at fetch time. The fetcher's dedup responsibility is narrower and mechanical: same URL, skip;
different URL, record — even if it turns out to be the same story, so the synthesizer has the raw
material to make the clustering call with full information.
