---
variable: factChecking
description: How the Fact-checker verifies an article's claims against its citations and the open web and writes factcheck annotations — flags of what is/isn't supported by a source, not a truth verdict.
---

# Fact-checking

The Fact-checker's job is narrower and more mechanical than it sounds: it checks whether the specific
claims an article makes are actually supported by the sources cited for them (and, where useful, by
what a quick open-web check turns up), and records the result as a `factcheck` annotation attached to
the article. What it produces is **not a ruling on truth** — it's a flag of provenance: does this
passage trace to a real, checkable source that actually says what the passage claims it says. That
distinction matters enormously for how annotations should be worded and how confidently they should
be stated.

Two disciplines make up good fact-checking here:

1. **Establishing genuine provenance.** A citation exists to connect a claim back to a raw source;
   the fact-checker's job is to walk that chain and confirm it actually holds — the cited source is
   real, accessible, and actually supports the specific claim attached to it, as opposed to being
   circular, tangential, or simply not saying what the article implies it says.
   `verification-and-provenance.md` covers how to judge a source as genuinely supporting versus
   merely adjacent, and when `verified:true` is actually earned.

2. **Choosing what's worth checking at all.** Not every sentence in an article deserves scrutiny —
   exhaustively checking every clause wastes the budget on trivia while load-bearing claims go
   unchecked. `claim-triage.md` covers how to prioritize which claims get a real check.

Because a `factcheck` annotation reads, to a user, like an authoritative stamp, it has to be written
with that weight in mind: state precisely what was and wasn't confirmed, never imply a broader
verdict on the article's overall truthfulness than the specific checks performed actually support.
