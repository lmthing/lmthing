# From raw item to article

## What's allowed to be added, and what isn't

The synthesizer works from exactly one input: `rawItem.title` and `rawItem.excerpt` (plus
`rawItem.imageUrl` when present). Everything in the finished article has to be traceable to one of
two things — either it restates/explains something the raw item actually said, or it is explicitly
framing rather than fact (e.g. "this comes as..." context that doesn't assert a new claim, a
transition sentence, a closing note on why the topic matters generally). What is never allowed:
a specific number, quote, date, name, or claim that isn't in the excerpt — even a plausible-sounding
one. A raw excerpt that says a company "announced a new product" cannot be expanded into "the
product, priced at $49, ships next month" unless the excerpt actually said that. When the excerpt
genuinely doesn't contain a detail a reader would want, the honest move is to leave it out or note
that it wasn't specified — not to estimate it.

## Expanding a thin excerpt

Many raw items are one or two sentences — an RSS description truncated by the source, or a search
result snippet. The synthesizer's value-add on a thin excerpt is mostly structural and contextual,
not factual: restate the core claim clearly and completely in the opening paragraph, then use the
remaining paragraphs to explain terms or background a reader might not have (what the technology/
company/event is, in general terms that don't require new facts about the specific item), and to
connect it to the tag/topic area it belongs to. This is legitimate expansion — it makes a terse
excerpt readable — as long as the "connect it to the wider topic" material is clearly general
background, not asserted as something that happened in this specific story.

When an excerpt is so thin that even honest structural expansion would produce mostly filler (a
title with no real excerpt at all, or an excerpt that's just the title repeated), it is better to
write a short, honest article that says what little is known than to pad it out with generic
paragraphs to hit some notion of "article length." A short, accurate article beats a long, padded
one every time — length is not a synthesis goal.

## `tags` and `score`

`tags` should be a handful (roughly 2-5) of genuine topic strings that describe what the article is
actually about — specific enough to be useful for feed filtering (`ai/infra`, `climate/policy`) not
so specific that no other article will ever share them, and not so generic (`news`, `update`) that
they filter nothing. Reuse tags that already exist in the feed for the same topic area rather than
inventing near-duplicate variants (`ai-infrastructure` vs `ai/infra` vs `infra-ai`) — check
`db.query('articles')` for tags already in use on similar stories before picking new ones.

`score` is a rough 0-100 relevance estimate — how much this article likely matters to the reader
relative to everything else in the feed, not a measure of writing quality. The `scoreRelevance`
space function gives a cheap keyword-overlap starting point against the reader's interests (from
`sources.topics` across the sources the reader has active), but the synthesizer's own judgment
should override it when the keyword overlap is misleading — e.g. a raw item that happens to mention
an interest term in passing is not automatically as relevant as one centrally about it.

## `imageUrl` and provenance

Carry `rawItem.imageUrl` through to the article's `imageUrl` field when present — never invent one
or substitute a generic stock image. Always insert exactly one `citations` row linking the new
article back to the raw item it was drawn from, with the specific passage relied on (via
`formatCitation`) — this is what lets a reader (and the researcher, later) verify the article
against its source.
