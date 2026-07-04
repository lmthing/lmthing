# Smart collections

## Manual boards versus smart collections

A manual collection is exactly what it sounds like: a reader adds articles to it by hand, one at a
time, and it only ever contains what they deliberately put there. A smart collection instead stores a
`query` spec — some combination of `tags`, `sources`, and a `savedOnly` flag — and articles are filed
into it automatically whenever they match that spec, with no reader action per-article. The two serve
different needs and shouldn't be blurred: a manual board is for a reader's own deliberate curation (a
reading list, a project folder); a smart collection is for a standing category the reader wants kept
populated without maintaining it ("everything tagged `climate-policy`," "articles from this one
source I trust"). When a reader's intent is ambiguous, lean toward a smart collection only when
they've actually described a durable, rule-shaped category — not a one-off grouping.

## Matching should be conservative

Filing an article into a smart collection is an automated, unsupervised action, which means the
matching discipline has to be conservative rather than generous:

- A tag match means the article actually carries that exact tag — not a related concept, not a
  keyword that merely appears somewhere in the body text.
- A source match means the article's `source` field is actually one of the listed sources — not "a
  source that covers similar topics."
- `savedOnly: true` restricts the collection to articles the reader has separately saved/bookmarked;
  it's an intersection with the rest of the spec, not an alternative path to matching.

A fuzzy or semantic "this article feels like it belongs here" match is exactly the failure mode to
avoid — it's invisible to the reader when it goes wrong (nothing prompted them to double-check), and
it erodes trust in every smart collection once one bad match is noticed.

## Avoiding duplicate filing

Before filing an article into a smart collection, check whether it's already there — matching logic
that runs repeatedly (on new articles as they arrive, or on a periodic re-scan) must not re-file an
article it already filed, and should not file the same article into the same collection twice under
slightly different triggering conditions. Filing is a one-time event per article per collection.

## Keeping denormalized counts honest

Collections carry denormalized summary fields — `articleCount` on a collection, and often a
`collectionCount` on whatever aggregates collections — precisely so a reader can see collection sizes
without a live query every time. Every filing action (and every removal, if a reader can also
manually detach an auto-filed article) has to update those counts in the same operation that changes
membership. A count that's drifted out of sync with actual membership is worse than no count at all,
because it looks authoritative while being silently wrong.
