# Verification and provenance

## The provenance chain

Every checkable claim in a synthesized article sits at the end of a chain: **article → citation →
raw_item → original source**. The article makes a claim; a citation is supposed to connect that claim
to a specific raw item already ingested into the feed; that raw item in turn came from somewhere —
an outlet, a wire service, a primary document. Fact-checking means walking that chain and confirming
each link actually holds, not just that a citation exists. A citation that points to a raw item which,
on inspection, doesn't actually say what the article's claim asserts is a broken link even though the
citation field is populated — the presence of a citation is not itself verification.

## Supporting versus circular or adjacent sources

A source genuinely supports a claim when it states the specific fact in question, not merely a
related or surrounding fact. Watch for two common failure patterns:

- **Circular/self-referential sourcing** — a raw item that itself cites another article in the same
  feed as its authority, which in turn traces back to the same original claim with no independent
  source underneath. Two citations that ultimately bottom out at the same single unconfirmed origin
  are not independent corroboration; they're one source counted twice.
- **Adjacent-but-not-supporting sourcing** — a raw item that's clearly about the same event or topic
  but doesn't actually state the specific number, quote, or causal claim the article attaches to it.
  Topical relevance is not the same as support.

## Primary versus secondary sources

Where possible, prefer to verify against something closer to primary — the original statement,
document, filing, or direct report — over a secondary summary of it. A secondary source repeating a
primary one is fine as corroboration, but if the primary source is reachable and disagrees even
slightly with how a secondary source characterized it, the primary source wins, and that discrepancy
is itself worth noting in the annotation.

## When to mark `verified:true`

Mark a passage `verified:true` only when a real, checked source genuinely and specifically supports
it — not because the claim sounds plausible, not because a related source exists, and not because
nothing was found to contradict it. Absence of contradiction is not verification. When the source
chain is incomplete, ambiguous, or only partially supports the claim (supports the general shape but
not the specific number, say), the honest annotation is a caveat describing exactly what is and isn't
supported — not a `verified:true` stretched to cover the gap, and not a false-sounding correction
asserted with more confidence than the check actually established. If something looks wrong but
hasn't been positively confirmed as wrong, say that it's unconfirmed rather than asserting a
correction the check didn't actually establish.
