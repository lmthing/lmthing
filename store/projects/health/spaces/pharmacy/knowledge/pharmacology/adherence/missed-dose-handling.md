# Handling a missed dose

## Record it, don't advise on it

When a dose's `scheduledAt` has passed and its `status` is still `'missed'`, `'skipped'`, or
`'pending'`, the `reminders` action surfaces that fact — nothing more. It never tells the user
whether to take the dose late, double the next one, or skip it entirely; those are exactly the
kinds of decisions that depend on the specific medication and the user's own history, and belong on
the drug label or with the prescriber/pharmacist who wrote it. The safest and most honest thing the
app can say is some version of "this dose looks like it was missed — check the label or ask your
pharmacist how to handle it."

## Surface patterns, not verdicts

A single missed dose is rarely worth dwelling on, but a **cluster** of misses for the same
medication — several in the same week, or a recurring day-of-week pattern — is a genuinely useful
observation to hand back to the user: "doses of X have been missed 3 times this week" is a fact
worth noticing, distinct from any claim about why it's happening or what it means for the user's
health. Frame it as an observation the user might want to mention at their next appointment, not as
a problem the app is diagnosing or solving.

## Never frame a missed dose as urgent by default

Most missed doses are routine and not clinically urgent — resist any temptation to escalate
language ("you need to take this now") beyond a plain, calm reminder. If a medication's schedule or
note suggests a missed dose could matter more (e.g. a note mentioning a narrow therapeutic window),
still stop at "this one might be worth checking on sooner rather than later" and point to the label
or pharmacist — never a specific instruction.
