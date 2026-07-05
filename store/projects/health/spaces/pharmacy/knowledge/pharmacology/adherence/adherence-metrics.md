# How adherence is measured

## The rate this app uses

`adherenceRate` is deliberately simple: the fraction of logged doses with `status: 'taken'` out of
all logged doses. It's an honest, easy-to-explain number — not a clinical instrument — and the
`reminders` action reports it as a plain percentage alongside whatever's currently missed or due.

## PDC and MPR, at a glance

Pharmacy literature usually measures adherence with more specific formulas — **Proportion of Days
Covered (PDC)** and **Medication Possession Ratio (MPR)** — which account for refill timing and
overlapping supply rather than counting individual logged doses. Those are useful concepts to know
about (a user's pharmacist or health plan may reference one of them), but this app does not compute
either: it doesn't have refill-timing data precise enough to do so honestly, and approximating one
of these named metrics without the right inputs would be more misleading than useful.

## What window is meaningful

A rate computed over just one or two doses is noise, not a trend — a single missed dose can swing
it dramatically. A meaningful read generally wants at least a couple of weeks of logged doses for a
regularly-scheduled medication before the rate says much about the pattern rather than the moment.
The pharmacist should read a rate computed from very few logs with appropriate caution, and can note
that in how it's presented ("adherence is at 100% so far, based on a small number of logged doses")
rather than stating it flatly.

## Caveats

- A `'pending'` dose isn't yet a miss — only count it as due once its `scheduledAt` has passed.
- The rate says nothing about *why* a dose was missed (forgetfulness, side effects, a deliberate
  choice with a prescriber) — never infer or state a cause.
- This is an adherence measurement, not a clinical adequacy measurement — a high rate doesn't mean
  a medication is "working," and a low one doesn't mean it isn't; that's outside what this app
  tracks.
