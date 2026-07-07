# Rent, fees, and utilities

## What's usually missing from the quoted rent

A listing's rent figure is reliably the biggest line but rarely the only one. Condo/HOA fees
(`condomínio`, service charge, ground rent) are sometimes bundled into the quoted price and
sometimes billed separately — when a listing's description or a `statedFees` entry names one
explicitly, it's `stated` and trusted outright. Utilities (electricity, water, gas, building
internet) are almost never itemized in a listing at all, so `trueCost`'s rent-mode math always adds
an `estimated` utilities line scaled by `areaSqm` at a per-m² rate (`utilitiesPerSqmMonthly`,
default 3.0) rather than a single flat number for every unit regardless of size — a 40 m² studio and
a 120 m² apartment do not cost the same to heat and light.

## When size is unknown

If `areaSqm` is 0 (unstated or not yet parsed), the per-m² estimate has nothing to scale from —
`trueCost` falls back to a flat estimate (currently 80, in the listing's currency) rather than
producing a nonsensical 0. This flat fallback is explicitly noted in the line's `note` field
("flat estimate — size unknown") so a user comparing costs can see this listing's utilities figure
rests on weaker footing than one computed from a real size.

## Reading `costBreakdown` honestly

When presenting `trueCostMonthly` to a user, don't just quote the total — a rent figure that's 90%
`stated` and 10% `estimated` utilities is a much more solid number than one where the fees themselves
are also estimated because the listing never mentioned them. If a listing's description is vague
about fees ("condo fees may apply") but gives no number, that's a case for a low-confidence note
in the listing's `flags`/summary rather than inventing a fee amount to fill `statedFees` — an absent
fee stays absent; only the utilities line is ever synthesized by design.
