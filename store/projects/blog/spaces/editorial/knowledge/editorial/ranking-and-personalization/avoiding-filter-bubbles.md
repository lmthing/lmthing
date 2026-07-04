# Avoiding filter bubbles

## The trap personalization can create

A ranking loop that only ever reinforces what a reader has already engaged with will, left
unchecked, converge toward an increasingly narrow feed: the topics they open more get boosted, get
surfaced more, get opened more, in a tightening spiral, while everything else quietly starves for
attention it never gets the chance to earn. This is the filter-bubble failure mode, and it's a real
ethical duty for the personalizer to actively guard against it — not just an optimization nicety.
lmthing.blog's promise to the reader is a feed that reflects genuine interest, not one that has
algorithmically narrowed their world.

## Concrete practices that keep the loop honest

- **Weight clamping is a bubble guard, not just a numeric safety rail.** The `[0.1, 5]` bound on
  `topics.weight` means even a reader's least-engaged topic still contributes a nonzero score
  (`0.1`, not `0`) to any article carrying that tag — it can never be mathematically erased from the
  feed by disinterest alone.
- **`muted` is an explicit override, not implicit via low weight.** `topics.muted` exists precisely
  so a reader who genuinely never wants to see a topic has a clean, deliberate way to say so —
  distinct from a topic that's merely low-weighted. Respect `muted` as absolute (suppress those
  articles), but don't treat merely-low-weight topics the same way — a low weight should mean
  "surfaced less often," never "suppressed entirely." Conflating the two erodes the reader's ability
  to actually control their own feed.
- **Untagged/unfamiliar topics get a neutral default, not a penalty.** `scoreByTopics` gives any tag
  with no matching `topics` row a default weight of `1` (neutral) rather than `0` — so a genuinely
  new topic the reader has never engaged with isn't structurally buried before it ever gets a fair
  first look. This is what gives new stories a chance to surface on their own merits.
- **The curator's digest is a serendipity valve.** Because `digest`/`digest_items` are curated by
  topic breadth and editorial judgment (see `digest-craft`) rather than purely by `articles.score`,
  a well-built digest naturally reintroduces topics a heavily-personalized main feed might otherwise
  crowd out. Don't let the digest collapse into "just the top N articles by score" — that would
  remove the one place in the product designed to counteract the bubble the main feed's ranking
  otherwise tends toward.

## The balance to strike

None of this means personalization should be watered down to the point of being useless — a reader
who clearly loves one topic should see more of it. The duty is narrower and more specific: keep the
floor above zero, keep `muted` as the only true suppression mechanism, keep new topics from starting
at a disadvantage, and keep at least one surface (the digest) that deliberately samples breadth
rather than just amplifying whatever already won.
