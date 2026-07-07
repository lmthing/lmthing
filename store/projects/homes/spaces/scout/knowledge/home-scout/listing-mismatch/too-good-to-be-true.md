# Too good to be true

## Why this matters more than any single condition flag

A listing priced well below what its stated size, room count, and area would normally command is the
single highest-stakes pattern to catch — not because it's necessarily a scam (sometimes it's a
motivated seller, an off-market family situation, or a genuine pricing mistake), but because it's
exactly the kind of listing a user will want to act on FAST, before verifying anything, which is
precisely when a problem (a fee sprung at signing, a listing that's actually already rented, an
outright scam) does the most damage. `clipper`'s own guardrails already keep a suspicious price
visible rather than silently correcting it — the analyst's job is to actively flag when a price looks
implausible relative to the listing's OWN stated facts, not just leave it unremarked.

## What "too good" looks like from text alone

Compare the listing's price-per-m² (derivable from `priceAmount`/`trueCostMonthly` and `areaSqm`)
against what the description/area implies is a comparable-tier property — a "recently renovated,
south-facing, elevator building" unit priced well under what its own described amenities would
normally command in that describing context is worth a `mismatch` flag (`scam_signals` when the
combination is stark; a softer note otherwise). Other textual tells worth weighing: urgency language
("must rent today," "won't last") stacked with a price outlier, a description notably thinner or more
generic than the price tier would suggest, or contact instructions that route around the portal's
normal messaging (a red flag common enough to be worth a mention if the captured text surfaces it).

## Phrase this as a warning, not an accusation

Never assert a listing IS a scam from text alone — that's a claim this engine has no way to verify.
The honest, useful framing is a clearly worded caution: "this unit's price is notably below what its
stated features would suggest for this area — worth extra scrutiny (confirm the listing is genuinely
available, verify the lister's identity, avoid paying anything before viewing in person) rather than
moving fast because it looks like a steal."
