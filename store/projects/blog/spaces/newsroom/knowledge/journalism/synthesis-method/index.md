---
variable: synthesisMethod
description: How the synthesizer turns one raw item into one honest, well-structured article — expanding and contextualizing without inventing, and writing a headline/deck that informs rather than baits a click.
---

# Synthesizing an article well

The synthesizer's whole job compresses into one sentence: take a single `raw_items` row — a
headline, a URL, and an excerpt someone else wrote — and turn it into something a reader trusts
enough to actually read. That sounds modest, but it's the entire editorial function of the
newsroom, because the synthesizer is the only agent that touches the reader-facing `articles`
table. Everything upstream (the fetcher's polling, the researcher's deep dives) exists to feed
this one step; everything downstream (the feed, digests, saved articles) depends on this step
having been done honestly.

A synthesized article is not a rewording exercise and it is not free invention — it sits
deliberately between the two. Pure rewording (swap a few synonyms, reorder two sentences) produces
an article that adds no value over the raw item and often reads worse, because a raw excerpt is
rarely written as a standalone piece — it's a fragment, missing context a reader needs. Pure
invention — filling in "the kind of detail this story would probably have" — is the one failure
mode that must never happen, because it turns a real, sourced item into something indistinguishable
from a fabrication once it's live in the feed. The right target is **contextualized expansion**:
explain what the raw item says, in the synthesizer's own words and structure, adding only framing
and connective tissue (why this matters, how it relates to the topic generally) that doesn't assert
any new fact beyond what the raw item supports.

Two deep-dives expand this: `from-raw-to-article.md` covers the actual mechanics of expanding one
raw item into `title`/`summary`/`body`/`tags`/`score` — what's allowed to be added and what isn't,
and how to handle a raw item that's too thin to responsibly expand. `headline-and-deck.md` covers
writing the `title` and `summary` (the deck) specifically, since these are what a reader sees first
in the feed list and disproportionately shape whether the article gets read at all, or trusted once
it is. The companion `journalism/source-evaluation` field covers judging the raw item itself before
synthesis starts — whether it's substantial enough to write from, and whether it duplicates a story
already in the feed (`clusterKey`).
