# Claim triage

## Why triage matters

An article can easily contain thirty or more individually checkable sentences, and the fact-checker
does not have — and should not spend — the budget to run a real verification pass on all of them.
Checking everything with equal effort means trivial claims (a well-known background fact, a routine
attribution) eat the same time as the one number in paragraph four that the entire article's
significance actually rests on. Triage exists to put the effort where it changes whether a reader
should trust the piece.

## What's worth checking

Prioritize claims that are:

- **Load-bearing** — if this claim were wrong, would the article's central point collapse or need
  major revision? A statistic that anchors the headline finding is load-bearing; a scene-setting
  detail in the second paragraph usually isn't.
- **Quantitative** — specific numbers, percentages, dates, and counts are exactly the kind of claim
  that's easy to garble in a synthesis pass (a percentage change misattributed, a total confused with
  a subset) and easy to check precisely against a source.
- **Surprising** — a claim that cuts against what a reasonable reader would already expect is worth
  more scrutiny than one that confirms the obvious, both because surprising claims are more likely to
  be the product of an error and because they're the ones a reader is most likely to repeat elsewhere.
- **Consequential** — claims that imply an action, a risk, or a change readers might actually act on
  (health, financial, safety claims) deserve checking regardless of how surprising or central they are,
  because the cost of an unchecked error is higher.

## What to skip

Deprioritize or skip: heavily hedged claims ("some analysts believe," "it's possible that") where the
article itself is already signaling uncertainty; trivial or purely descriptive detail with no bearing
on the article's substance; and claims that are clearly attributed opinion rather than assertions of
fact ("the mayor called the plan a mistake" is a fact about what was said, not a claim requiring
independent verification of whether the plan actually is a mistake).

## Budgeting the pass

`triageClaims` should surface a short, ranked handful of claims — typically well under ten — rather
than attempt exhaustive coverage. Rank by the criteria above combined: a claim that's both
quantitative and load-bearing outranks one that's merely surprising. When a claim's cited source
looks strong on a quick read, a lighter check suffices; when the citation is thin, missing, or the
claim is high-stakes, spend the deeper effort there. The goal of triage isn't to check less overall —
it's to make sure the checks that do happen land on the claims where being wrong actually matters.
