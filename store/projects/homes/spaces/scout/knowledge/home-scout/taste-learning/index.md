---
variable: tasteLearning
description: How the ranker distills raw taste_signals (saves, dismisses with reasons, contacts) into cited, inspectable taste_notes, and how blendScore turns those notes plus true cost/commute/flags into an explainable score.
---

# Learning and applying taste

The taste model exists to be read, not just trusted — every `taste_notes` row is a plain-language,
cited statement a user can see, question, and correct, never an opaque number. It's built entirely
from what the user actually DOES on the feed: what gets saved, what gets dismissed (and crucially,
WHY), what gets contacted. A dismiss with a stated reason is worth far more than a bare save, because
it tells you exactly what to weigh against, in the user's own words, rather than leaving you to guess
what pattern a save implies.

`signals-to-preferences.md` covers how to distill raw signals into merged, non-duplicated statements
per dimension; `scoring-and-explanations.md` covers how `blendScore` turns those notes (plus true
cost, commute, and flags) into a score the ranker can explain line by line in `scoreSummary`.
