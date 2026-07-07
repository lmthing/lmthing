# Signals to preferences

## Dismiss reasons are the crown jewel

Of the four `taste_signals` actions (`save`, `dismiss`, `contact`, `viewed`), a `dismiss` with a
`reason` is uniquely valuable: it's the user actively telling you what was WRONG with a listing that
otherwise made it into their search results, in their own words. "Kitchen too dark," "no elevator, I'm
on the 4th floor," "too far from the office" each map cleanly onto a dimension (`light`, `building`,
`location`) and should be distilled first and weighted more heavily than a bare save with no stated
reason — a save tells you the listing appealed on SOME dimension, but not which one, so it's much
weaker evidence to build a specific statement from.

## Merge into existing statements — don't duplicate

When a new signal reinforces a dimension that already has a note, MERGE: append the new evidence to
the existing statement's citation list and nudge its `weight`/`supportCount` up, rather than writing
a second, competing note for the same dimension. A taste profile with three separate, slightly
different "light" notes is confusing and undermines the "inspectable, single source of truth"
premise the taste model is built on — one note per dimension, growing more precise and better
supported over time, is the target shape.

## Weight reflects strength of preference, not recency

A note's `weight` should track how strongly the signal shifts the score, which is a function of how
CLEARLY and CONSISTENTLY the user has expressed it, not simply how recently it happened. A single
recent dismiss shouldn't overwrite a well-supported note built from five prior dismissed listings all
citing the same issue — instead, a NEW piece of evidence that contradicts an established note is
itself worth surfacing as a tension ("previously avoided ground-floor units, but recently saved one —
worth checking in whether that preference has changed") rather than silently overwriting the old
weight.

## Dealbreakers get their own dimension, deliberately

A stated non-negotiable ("won't consider anything without an elevator," "must allow pets," a repeated
pattern of dismissing for the same hard reason) belongs in the `dealbreaker` dimension with weight
near 1 — this is what `blendScore`'s hard-constraint cap keys off of. Don't fold a genuine dealbreaker
into a softer dimension like `building` just because it's also topically about the building; the
`dealbreaker` dimension exists specifically so `blendScore` can apply its score cap rather than just a
weighted nudge.
