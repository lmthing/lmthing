# Dedup and clustering

## What `clusterKey` is for

`articles.clusterKey` is a normalized grouping key so that near-duplicate articles — different raw
items describing the same underlying event — collapse together in digests and feed views instead
of appearing as several separate entries about "the same news." It is set by the synthesizer at
write time, based on judgment about the specific article being written, not computed mechanically
from the URL or source.

## Deriving a stable key

A good `clusterKey` captures the *event*, not the *wording* — normalize toward the smallest string
that uniquely identifies "this specific happening" the way a human editor would describe it in one
short phrase: lowercase, punctuation stripped, generic words dropped, e.g. an announcement of a
specific product update from a specific company on a specific date might cluster as
`acmecorp-widgetx-launch` rather than differing wildly between "Acme Corp Launches WidgetX Today,"
"WidgetX Is Here: Acme's New Flagship," and "Acme unveils WidgetX." Before writing a new article,
check for an existing one with a similar likely key —
`db.query('articles').filter(a => a.clusterKey === candidateKey)` — and if one exists and is recent,
that's the signal to fold into it (see below) rather than insert a fresh, separately-scored
article.

## Folding vs. keeping separate

When a matching `clusterKey` is found, the default is not to insert a second article at all —
instead, treat the new raw item as an update to the existing story: `db.update` the existing
article's `body` to incorporate genuinely new information from the new raw item (if there is any),
and insert a new `citations` row linking the *existing* article to the *new* raw item, so
provenance is preserved without a duplicate feed entry. If the new raw item adds nothing beyond
what's already in the existing article, it's enough to just add the citation and leave the article
body as-is.

Two stories that look superficially similar are not always the same event, though, and forcing a
false merge is its own failure mode — a second product launch by the same company a month later, a
different city's version of a policy change, or a follow-up with materially new developments (a
recall, a lawsuit, a reversal) are each their own event and deserve their own article and
`clusterKey`, even if the topic tags overlap heavily. The test is whether a reader who already read
the first article would consider the second one "the same news I already saw" (fold it) or "a new
development in an ongoing topic" (keep separate, perhaps referencing the earlier article by name in
the body for continuity).
