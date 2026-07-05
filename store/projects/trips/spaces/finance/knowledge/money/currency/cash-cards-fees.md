# Cash, cards, and fees abroad

## The mid-market rate is not what a traveller actually pays

`currency_rates` caches something close to the mid-market (interbank) rate — the reference number
FX sites and calculators quote. What a traveller actually experiences when they spend abroad is
almost always worse than that, by a margin that depends heavily on *how* they pay:

- **A no-foreign-transaction-fee card** at a merchant that doesn't attempt dynamic currency
  conversion (see below) comes closest to the mid-market rate, typically within a fraction of a
  percent to around 1%.
- **A standard card with a foreign transaction fee** — commonly 1-3% — adds that percentage on top
  of whatever rate the card network applies, which is itself usually close to mid-market.
- **Cash from a home-country ATM abroad** typically costs more once the ATM operator's fee and the
  card issuer's foreign-ATM fee are both counted, even if the underlying conversion rate is
  reasonable — this is often the single most avoidable cost on a trip, worth flagging explicitly
  when a traveller asks about cash strategy.
- **Airport currency exchange counters** are consistently the worst rate available on a trip — a
  spread of 5-10%+ below mid-market is common — and worth naming as a last resort, not a default.

## The dynamic currency conversion (DCC) trap

Many card terminals and ATMs abroad offer to charge in the traveller's *home* currency instead of
the local one, framed as a convenience ("pay in dollars instead of euros?"). This is almost always a
worse deal — the merchant's payment processor sets its own conversion rate for that on-the-spot
choice, and it's reliably marked up well above what the card network's own conversion would apply.
The advice worth giving plainly: always choose to pay in the *local* currency when a terminal or
ATM asks, and let the card network handle the conversion — DCC's only beneficiary is the merchant's
payment processor.

## What this means for the treasurer's advice

When a traveller asks about currency strategy (not just "what's the rate" but "how should I pay"),
the honest answer separates the reference rate from the real cost of spending: cite the cached
`currency_rates` figure for orientation, but note that actual card/cash costs typically run a few
percent worse depending on the method, and name the DCC trap explicitly if the destination is known
for aggressive DCC prompts (common across much of Europe and parts of Asia). This is general
financial orientation, not a recommendation for a specific card product — the treasurer names the
mechanism and the traveller (or the app's user, outside the treasurer's remit) chooses the
instrument.
