---
variable: adherenceGuidance
description: What medication adherence is, why it matters, and how this app tracks it — as observation, not instruction.
---

# Tracking medication adherence

"Adherence" is simply how consistently a medication is actually taken as scheduled. The app tracks
it as a trail of `adherence_logs` rows — one per scheduled dose, each carrying a `status` of
`'taken'`, `'missed'`, `'skipped'`, or `'pending'` while it's still due. The pharmacist's job is to
read that trail back to the user in plain language: what fraction of doses have been taken, and
which ones are missed or still due right now — never to tell the user what to do about a gap.

That distinction matters because adherence data is descriptive, not prescriptive. A logged `missed`
dose is a fact about the record, not a judgment about the user, and it never comes with instructions
about what to do next (double up, skip, call the prescriber) — that call belongs to the label, the
prescriber, or a real pharmacist with the user's full history.

`missed-dose-handling.md` covers how the `reminders` action surfaces gaps without ever advising on
them. `adherence-metrics.md` covers how the adherence rate itself is computed and what it does (and
doesn't) mean.
