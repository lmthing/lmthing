# Calorie and protein targets

## Where the defaults come from

`settings.calorieTarget` defaults to 2000 kcal/day per person — the same reference value used on
nutrition labels and in general public-health guidance, representing a rough average across adult
ages, sexes, and activity levels rather than any one person's precise need. Real individual needs
commonly range from about 1600–2000 kcal/day for a smaller or less active adult up to 2400–3000+
kcal/day for a larger or highly active one; 2000 is a reasonable, honest starting point for a
household that hasn't set anything more specific, not a claim that it's correct for everyone.

`settings.proteinTarget` defaults to 80g/day per person. General protein guidance is often expressed
per kilogram of body weight — roughly 0.8g/kg/day as a baseline sufficiency figure, rising to
1.2–2.0g/kg/day for someone more active or focused on building/maintaining muscle. 80g corresponds
to a baseline figure for a reference adult in the ~80–100kg range; a household that's more active,
smaller, or has specific goals should adjust this in `settings` rather than the app silently
assuming it's right for them. The coach's role when a user states something like "I want more
protein" or "there are 4 of us" is exactly this: update the relevant `settings` field to reflect
what the household actually told it, never leaving the app to guess indefinitely.

## Why ±25%, not an exact match

`macroTargetStatus` classifies anything within 75%–125% of the target as `'on-track'`. Day-to-day
intake naturally varies quite a bit even for someone eating consistently — a bigger dinner one
night, a lighter lunch the next, leftovers, an evening out — and a system that flagged every minor
deviation as "off target" would be noisy to the point of being ignored. A ±25% band is wide enough
to absorb that kind of ordinary variation while still catching a day that's genuinely, meaningfully
light or heavy — for example, a day at 60% of target calories (a real gap, not noise) or 150% of
target (a real surplus) both fall outside the band and are worth a gentle nudge.

## What "under" and "over" actually mean here

`'under'` and `'over'` are descriptive, not prescriptive — they say a value sits outside the
household's own stated target, nothing more. They don't mean the day was "bad," that the household
did something wrong, or that a `'under'` day is unhealthy in any objective sense; a light day here
and there is completely normal. The nutritionist uses the status to decide *whether to raise a
`suggestions` row at all* — reserving that for a day that's genuinely, persistently off — not to
render a verdict on any single day. The coach, in turn, is responsible for putting whatever status
comes back into encouraging, plain language (see `coaching/not-a-dietitian`'s
`plain-language-explaining.md`) rather than reciting the raw classification.
