# Buyer costs and mortgage

## The mortgage estimate is a model, not a quote

For `mode: 'buy'`, `trueCost` amortizes a standard fixed-rate mortgage over `(priceAmount −
downPayment)` at a supplied `annualRatePct` and `termYears` (defaults: 20% down, 30 years) — this is
a MODEL of what a typical buyer's payment would look like, not a lender's actual quote, and its
`note` always says so via `rateSource`. Never call `trueCost` with an `annualRatePct` pulled from
memory or a stale assumption — `webSearch` a current reference mortgage rate for the listing's
country/currency at compute time ("current 30-year mortgage rate Portugal 2026",
"average mortgage rate <country> today") and pass the source through `rateSource` so the line reads
something like "20% down, 3.7% over 30y — rate: ECB reference survey, <date>" rather than a bare
unsourced percentage.

## Down payment and term are knobs, not facts about this buyer

`downPaymentPct` and `termYears` are modeling assumptions the surveyor picks (sensible market
defaults, or ones implied by the search's stated budget/brief), not verified facts about how THIS
particular user will finance the purchase — never present the resulting `trueCostMonthly` as "your
payment will be X," but as "at a typical 20%-down, 30-year mortgage, this would run about X."

## Recurring charges beyond the mortgage

Property tax (IMI-equivalent) and condo charges add up monthly too. When a listing states specific
fees, they go into `statedFees` and are trusted as `stated` lines. When none are given — the common
case for a for-sale listing, which rarely itemizes ongoing costs — `trueCost` estimates a combined
property-tax-plus-charges line at roughly 1%/year of the purchase price, monthly, clearly labelled
`estimated` with that basis in its `note`. This is a coarse rule of thumb, not a jurisdiction-specific
tax calculation — treat it as a reasonable floor for comparison purposes, not as tax advice, and say
so if a user asks for precision beyond what a rough monthly estimate can honestly give.
