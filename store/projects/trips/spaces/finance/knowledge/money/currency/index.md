---
variable: moneyCurrency
description: How the treasurer normalizes mixed-currency expenses against a trip's home currency, keeps the currency_rates cache honest, and where cash/card fees quietly erode a budget abroad.
---

# Currency and normalization

A multi-destination trip almost always racks up expenses in more than one currency — euros in
Lisbon, pounds in London, a hotel bill quoted in dollars because the property books internationally.
The trip's `budgetUsd`/`homeCurrency` roll-up only means something if every expense is normalized to
one common currency before it's compared or summed, and that normalization has to be honest about
where its numbers come from.

`currency_rates` is a lightweight cache the treasurer maintains via `webSearch`, not a live FX feed
— every row records a `base`, a `quote`, the `rate` found, and a `source` for when a traveller
questions a conversion. `fx-and-conversion.md` covers how to read an FX quote correctly (which
direction `rate` goes, how to pick the freshest cached rate when more than one exists for a pair)
and what the treasurer does when no rate is cached yet: convert at a clearly-labelled 1:1 rather
than inventing a number, via `convertAmount`'s built-in fallback.

Normalizing currency correctly is only half the picture — the *rate itself* is rarely what a
traveller actually pays when they tap a card or pull cash abroad. `cash-cards-fees.md` covers the
gap between the quoted mid-market rate and the real cost of spending abroad: foreign transaction
fees, ATM withdrawal fees, and the dynamic-currency-conversion trap that quietly marks up a card
transaction at the point of sale. The treasurer's `refresh-rates` action keeps the *reference* rate
current; the traveller's actual spend is usually a few percent worse than that reference, and it's
worth saying so plainly when giving currency advice rather than implying the cached rate is exactly
what they'll pay.
