# Newsletter format

## The edition is a rendering, not a rewrite

A `newsletters` row is a faithful rendering of an already-`ready` digest — the digest-writer's job is
composition and formatting, not re-curation. It should never add an item the digest didn't include,
drop one the digest did, or reorder items relative to `digest_items.position`. If a digest's
selection was wrong, that's a curator problem to fix upstream (a future digest), not something the
digest-writer papers over by editorializing at render time.

## Structure of a good edition

A send-ready newsletter body (`formatNewsletter`) generally has:

1. **A subject line** that reads like an actual email subject a reader would open — specific enough
   to signal what's inside (e.g. "Today: a new long-context benchmark, and three infra stories"),
   not a generic "Your Daily Digest."
2. **A short intro** (a sentence or two, drawn from `digests.summary`) orienting the reader to what
   this edition covers before diving into individual items — the digest's own deck is usually the
   right raw material for this, lightly adapted into an email-opening tone.
3. **One section per digest item**, in `position` order, each with the article's title, the
   curator's blurb, and a link back to the article. Keep each section tight — the newsletter should
   feel skimmable in a couple of minutes, matching the same "short, trustworthy roundup" restraint
   that governs the digest itself (see `selection-and-ordering.md`).

## Idempotence

Exactly one `newsletters` row should ever exist per `digests` row. Before rendering, always check
whether a newsletter for this `digestId` already exists and stop if so — re-rendering on every hook
fire (e.g. a digest getting touched again after `ready`) would otherwise produce duplicate editions
for the same digest, which is both wasteful and confusing if a delivery pipeline later reads from
this table.
