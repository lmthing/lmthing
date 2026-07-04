# Sources and method

## Triangulate, don't single-source

A single blog post or a single "best things to do" listicle is not a research report — it's a
guess wearing a research report's clothes. Real research triangulates across source types, because
each type is reliable about different things and unreliable about others:

- **Official tourism/government sites** (city tourism boards, national park services, museum and
  venue sites) are the most reliable source for opening hours, admission prices, closure days, and
  accessibility — but they oversell everything as a must-see, so they're a poor source for "is this
  actually worth it."
- **Recent traveller reports** (forum threads, recent trip reports, review sites filtered to recent
  dates) are the best source for "is this actually worth it," current crowd levels, and whether a
  once-great spot has degraded (overtourism, construction, closure). Prioritize anything dated
  within the last 12-18 months; older reports can be stale on hours, prices, and crowd levels.
- **Local/regional press and specialist sites** (a city's own food critics, a hiking-specific site
  for trail conditions) tend to be the most trustworthy for depth on one narrow topic — a good food
  writer's list of where locals actually eat beats a generic "top restaurants" aggregator every
  time.

When two sources disagree, prefer the more recent one and the one more specific to the exact claim
(a venue's own site wins on "is it open Tuesdays"; a recent traveller report wins on "is the queue
still two hours").

## Avoiding SEO spam

A large fraction of top search results for "things to do in <city>" are SEO-optimized content farms
that reword the same generic list with no first-hand knowledge behind it — recognizable by: no
specific sensory detail (what a place actually looks/sounds/tastes like), no mention of downsides
or caveats, suspiciously uniform structure across many different cities' pages from the same
domain, and dates that are always "recently updated" without any actual new content. When
`webSearch` surfaces one of these, don't cite it — either `webFetch` a more specific, better-dated
source, or search a more specific query (e.g. "best pastel de nata Lisbon Alfama" rather than
"things to do Lisbon").

## Seasonality

Almost every claim in a destination report is seasonally conditional — a beach town's "must-do" in
July may be shuttered in January; a mountain trail open in August may be snowed in during the
trip's actual dates. Always search with the trip's actual month/season in the query
(e.g. "Lisbon in October weather what to pack", not just "Lisbon weather"), and note in the report
when something is season-dependent rather than stating it as a flat fact.

## Structuring the report

A useful `research.body` (markdown) generally covers, in roughly this order:

1. A one-paragraph orientation — what kind of place this is, pace, vibe.
2. A short list of what's genuinely worth doing, each with a one-line reason and a rough cost/time
   commitment.
3. Food notes — a few specific, sourced recommendations rather than a generic "try the local
   cuisine."
4. Practical notes — rough costs, anything season-specific, anything to book ahead.
5. Source URLs, inline (e.g. `([source](https://...))`) next to the specific claim they support —
   not just dumped in a bibliography at the end, so the scheduler (and a human reviewer) can see
   exactly which claim came from where.
