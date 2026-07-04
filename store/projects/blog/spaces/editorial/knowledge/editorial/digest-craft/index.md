---
variable: digestCraft
description: How to select and order the best handful of items for a digest, write a blurb for each, and format the resulting newsletter edition.
---

# Digest craft

A digest (`digests` + its ordered `digest_items`) is the editorial desk's one genuinely curatorial
product — everywhere else in the feed, ranking is mechanical (`articles.score`), but a digest is
supposed to read like a human editor picked the handful of things actually worth a reader's next few
minutes, and said briefly why. That means a digest is not "the top 6 articles by score, in score
order" — it's a small, deliberately-composed set that balances what's highest-signal with what's
diverse, freshest, and narratively sensible to read in sequence.

Two crafts make up a good digest:

1. **Selecting and ordering the items.** Picking roughly 6-8 slots out of a much larger candidate
   pool, deduping near-identical stories, balancing topic breadth against raw score, and then
   sequencing them so the digest reads as a coherent roundup rather than a randomly-ordered list —
   covered in `selection-and-ordering.md`, along with how to write a blurb that earns its place.

2. **Formatting the rendered edition.** Once a digest is `ready`, the digest-writer renders it into
   an actual newsletter — a subject line, a short intro, and one section per item. What makes that
   rendering read well (and where it must stay strictly faithful to the digest it's built from) is
   covered in `newsletter-format.md`.

A digest is only as good as its restraint — the temptation to include "one more thing" or pad every
slot with a long blurb works against the whole point, which is a short, trustworthy roundup someone
can read in full.
