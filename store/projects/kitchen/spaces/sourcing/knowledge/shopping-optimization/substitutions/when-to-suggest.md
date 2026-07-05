# When to suggest a substitution

## Priority order: stock beats expiry beats cost

An ingredient can be "at risk" for three different reasons, and they are not equally urgent.
**Out-of-stock** is the most urgent — the household has already run out (or is at/below its
`lowStockThreshold`) and needs an actual plan for what to use instead right now, likely for a meal
already slotted this week. **Expiring soon** (within roughly three days) is next — there's still
time to act, but the window is closing, and a substitute suggestion here is really about the
household deciding whether to use it up or plan around not having it (the `use-it-up` suggestion
type is the more natural response to expiry; a substitution suggestion for an expiring item is the
secondary path, for when using it up isn't realistic before it turns). **Cost** — an ingredient
priced notably above the household's typical average — is the least urgent of the three; nothing is
actually broken, it's an opportunity to save money, not a gap to fill. When an ingredient qualifies
under more than one reason simultaneously (rare, but possible — something both low-stock and
pricey), the more urgent reason is the one recorded and surfaced; there's no need to report the same
ingredient as at-risk for two reasons at once.

## Avoiding duplicate cards on a nightly re-scan

The substitutions scan runs nightly, unconditionally, over the whole pantry — which means most
ingredients it looks at were already looked at yesterday, and most of the time nothing has changed.
Re-suggesting the same substitute for the same still-at-risk ingredient every single night would
flood the household's suggestion feed with noise, drowning out genuinely new information. The fix is
straightforward: before proposing anything for an ingredient, check whether an undismissed
`substitution`-type `suggestions` row already exists for it, and skip it if so. This makes a re-run
idempotent in the way that matters to the user — the *first* night an ingredient becomes at-risk, it
gets a card; every subsequent night it remains at-risk without the household having dismissed that
card, it's silently skipped, until either the household dismisses it (making room for a fresh
suggestion later if the situation persists) or the ingredient stops being at-risk at all (restocked,
no longer expiring, price back to normal).

## Not every at-risk ingredient needs a suggestion tonight

Precision matters more than volume here. A pantry with twenty low-priority "somewhat pricey" items
doesn't need twenty new cards flooding in on the same night — better to focus attention on what's
genuinely actionable (an ingredient actually needed for a meal already planned this week) than to
generate a suggestion for every technically-qualifying ingredient regardless of whether the
household will ever act on it. In the current implementation this shows up as the strict priority
ordering above plus the dedupe-by-undismissed-suggestion rule; a more sophisticated version of this
same judgment (e.g. checking whether an at-risk ingredient is actually called for in this week's
`plan_meals`) is a reasonable direction to extend this logic in, without changing the underlying
principle: a suggestion should earn its place in the feed, not just qualify for one.
