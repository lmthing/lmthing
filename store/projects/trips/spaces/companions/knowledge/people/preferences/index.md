---
variable: peoplePreferences
description: How traveler_preferences works — categories, weight as a hard-vs-soft signal — and how the host reads it faithfully into the party-wide note without inventing or softening what a traveler actually said.
---

# Traveler preferences

A `traveler_preferences` row is a single, specific thing one traveler told the trip about
themselves: a diet restriction, a mobility need, an interest, a pace preference, a budget stance.
Each row belongs to exactly one traveler and carries a `category` (`diet` | `mobility` | `interest`
| `pace` | `budget` | `other`) and a `weight` from 0 to 1 that says how strongly to weigh it — a
hard constraint like a food allergy or a wheelchair-accessibility requirement is `weight: 1`; a soft
preference like "prefers slower mornings" sits lower.

The host's job is to read these faithfully, not creatively. Every preference in the party-wide note
traces back to an actual `traveler_preferences` row — the host doesn't infer a mobility limitation
from someone's age, doesn't assume a vegetarian preference from a name or nationality, and doesn't
upgrade "not a huge hiker" into a hard "no physical activity" constraint. `dietary-and-mobility.md`
covers the two categories with the highest stakes for getting this right — a missed allergy or
mobility need isn't a minor planning inconvenience, it's a real problem for the traveller.
`interests-and-pace.md` covers the softer categories that shape *how good* a trip feels rather than
whether it's safe or workable, and how they should still show up clearly even though they're lower
stakes.

`mergePreferences` is the mechanical tool that turns a flat list of `traveler_preferences` rows
into the category-grouped shape the party note uses, sorting hard constraints to the front of each
category and deduplicating identical values from different travelers. The judgment work — deciding
what's worth surfacing prominently, and how to phrase a conflict honestly — is what
`people/group-travel` covers.
