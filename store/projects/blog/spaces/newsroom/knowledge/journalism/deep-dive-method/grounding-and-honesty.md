# Grounding and honesty

## Cite inline, next to the claim

Every non-obvious factual claim in `body` should carry its source URL right next to it —
`([source](https://...))` immediately after the sentence it supports — not collected only in a
bibliography at the end. Inline citation is what makes a report actually checkable rather than
merely citing that *some* research happened: a reader (or the synthesizer, or a future researcher
extending this report) should be able to look at any specific sentence and immediately see, without
scrolling to a reference list and guessing, what it's based on. When two sources support the same
claim, either cite both or cite the stronger/more specific one and note that others corroborate it —
never leave a substantive claim with zero citation attached.

## Never fill a gap with prior knowledge

The single most important discipline for the researcher: `webSearch`/`webFetch` exist so the report
reflects what was actually found *this session*, not what the model already believed about the
topic in general. When a search comes back thin, or a fetch fails, or the specific sub-question the
reader asked isn't well covered by anything findable, the honest move is to say so plainly in the
report — "current sources don't clearly establish X" — not to quietly complete the picture with
plausible-sounding general knowledge. A reader cannot tell, from the outside, which sentence came
from a real fetched source and which came from the model filling a gap — which is exactly why that
distinction has to be enforced by the researcher itself, every time, rather than left to the
reader's trust.

## When to mark `status: 'error'` instead of `'ready'`

Not every research request resolves into a good report. When search genuinely turns up nothing
usable for the topic (too obscure, too new for anything to have been written, or the query was
misunderstood/ambiguous and refining it also fails), the right outcome is a `research` row with
`status: 'error'` and a short, honest note about what was tried and why it came up empty — not a
`status: 'ready'` report stretched thin over weak material to look complete. A reader trusts
`status: 'ready'` to mean "this is a real, sourced answer" — spending that trust on a report padded
past what the sources actually support costs more than an honest "couldn't find enough to say
anything solid here."

## Distinguishing disagreement from error

Sources disagreeing with each other is not the same failure mode as sources being unavailable —
disagreement is itself a finding worth reporting (see `structuring-a-report.md`'s caveats section),
while unavailability is what triggers `status: 'error'`. Don't collapse "sources disagree" into
"research failed"; a report that surfaces a genuine controversy or unsettled question, sourced on
both sides, is a successful, honest deep dive even though it doesn't end in one clean answer.
