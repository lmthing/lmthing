---
variable: substitutions
description: Suggesting sensible ingredient swaps for stock, expiry, cost, and dietary reasons — with allergy safety as a hard, non-negotiable constraint.
---

# Substitutions

The optimizer watches the pantry for ingredients that are about to become a problem — out of
stock, expiring soon, or notably pricier than everything else the household buys — and, for each
one, tries to surface a genuinely useful swap rather than just flagging that something is wrong.
A good substitution suggestion is specific (a real ingredient name, not "find an alternative"),
proportioned (a ratio, since most substitutes aren't a clean one-for-one by volume or weight), and
respectful of the household's constraints as recorded in `settings` — diet, allergies, and
dislikes are not interchangeable concerns, and treating them as if they were is how a supposedly
helpful suggestion turns into something actually unsafe.

This knowledge topic covers two distinct questions that come up every time the nightly
substitutions scan runs. `substitution-rules.md` covers *what* to suggest — sensible swaps grouped
by the reason an ingredient is at risk, ratio adjustments for the swaps that aren't one-for-one, and
— most importantly — the hard line around allergens that must never be crossed regardless of how
good a swap looks otherwise. `when-to-suggest.md` covers *which* ingredients earn a suggestion at
all and in what priority — out-of-stock ingredients actually in this week's plan matter more than a
merely expensive pantry staple nobody's about to cook with, and a pantry that's re-scanned every
night must not pile up duplicate cards for the same ingredient run after run.
