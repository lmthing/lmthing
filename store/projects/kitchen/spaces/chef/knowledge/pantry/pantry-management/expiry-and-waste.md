# Expiry and waste

## `expiresAt` is optional, and its absence is normal

Not every ingredient carries an `expiresAt` — shelf-stable staples like flour, oil, rice, or spices
realistically never spoil on a timescale this app needs to track, so most pantry rows will have it
unset. Treat a missing `expiresAt` as "not tracked for expiry," never as "expired" or "expiring
immediately" — a filter like `expiringSoon` must require `expiresAt` to actually be present before
comparing it against a horizon, exactly as it does today (`item.expiresAt && ...`). Only perishables
that were seeded or added with a real expiry date participate in the waste-reduction flow at all.

## FIFO thinking for a single batch

An `ingredients` row generally represents the household's current on-hand batch of that item, not
a running ledger of every purchase — so when new stock of the same ingredient is bought before the
old batch is used up, the realistic behavior is closer to "the newer purchase extends what's on
hand" than to tracking two separate expiry dates. Given the schema has one `expiresAt` per row,
the practical rule for the pantry keeper is: when the user reports buying more of something that
still has stock left, treat it as replenishing the existing row (update `quantity`, and update
`expiresAt` to the new purchase's expiry if the user mentions one) rather than creating a second
row for the same ingredient name — `ingredients.name` is unique, which enforces this at the schema
level as well.

## Avoiding repeat nagging

`suggest-uses` runs nightly, so without a de-duplication check the same expiring ingredient would
generate a fresh `suggestions` card every single night until it's actually used up or discarded.
The fix already baked into the tasklist is to check existing undismissed `use-it-up` cards before
inserting a new one for the same `ingredientId` — once a card exists and hasn't been dismissed, no
new card is created for that ingredient even if it's still within the expiry horizon the next
night. A dismissed card, on the other hand, should be treated as "the household has seen and
acknowledged this" — it should not be resurrected, and a genuinely new concern about the same
ingredient (e.g. it was restocked, then is expiring again) is a new card, not a reopened old one.
