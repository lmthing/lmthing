# Substitution rules

## Swaps are reason-aware, not just ingredient-aware

The same ingredient can call for a different substitute depending on *why* it's being substituted.
An ingredient that's merely expensive might warrant a cheaper swap that changes the dish's character
slightly (parmesan → nutritional yeast for a savory umami hit, at a fraction of the cost); an
ingredient that's expiring soon might warrant using it up rather than substituting it at all (that's
the `use-it-up` suggestion type, a separate concern from substitution); an ingredient that's
genuinely out of stock needs the most reliable, closest-tasting substitute available, since the
household has no choice but to actually use it. In practice the reason is tracked alongside the
suggestion (`substitutions.reason`) precisely so a household reviewing suggestions understands *why*
each one was made, not just what to buy instead.

## Ratios are rarely 1:1

Most real substitutions change more than the name — they change how much to use. A short list of
common, broadly reliable examples: butter → olive oil for sautéing or most baking works at roughly
3/4 the volume (denser fat content means less is needed); a flax egg (1 tbsp ground flaxseed + 3
tbsp water, rested 5 minutes) replaces one whole egg 1:1 by "egg equivalent" but is a completely
different substance by weight; heavy cream → coconut cream is close to 1:1 by volume but noticeably
changes flavor in savory dishes. Never present a substitute without a ratio, even when that ratio is
1 — an implicit "just swap it" invites a household to use the wrong amount, which can ruin a dish
far more thoroughly than skipping the ingredient entirely would have.

## Diet-aware, but allergy-safe is the hard line

`settings.diet` (vegetarian, vegan, keto, pescatarian, …) should steer *which* substitute among
several reasonable options gets suggested — a vegan household substituting butter should see "vegan
margarine," not "ghee." But `settings.allergies` sits on a completely different footing: it is a
**hard constraint**, never a preference to weigh against how good a substitute otherwise looks. A
suggested substitute whose name matches (even partially — "almond milk" for a household with a tree
nut allergy) any entry in `settings.allergies` must never be written, full stop, regardless of how
well it would otherwise work for the dish. `settings.dislikes` is the softer, middle category — a
household would rather not see it, but suggesting it isn't unsafe the way suggesting an allergen is,
so it doesn't need the same hard block, just a lower preference when other decent options exist.

## Silence is a correct outcome

Not every ingredient has a well-known, broadly-safe substitute — a niche spice, a specific brand of
condiment, or an ingredient central enough to a dish's identity that no real substitute exists (there
isn't a good universal swap for "saffron" that doesn't change the dish substantially). When no rule
confidently applies, the correct behavior is to suggest nothing for that ingredient this run — never
invent a plausible-sounding pairing just to avoid returning empty-handed. A missing suggestion is a
non-event; a bad one actively misleads a household into buying and using the wrong thing.
