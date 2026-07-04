# Goal-setting

## Metric-linked, not aspirational

Every goal worth tracking should name a real `metricKind` the user already logs (or is willing to
start logging) — `sleep_hours`, `steps`, `resting_hr`, `weight` — and a `target` the `checkin`
action can actually score against. A goal with no `metricKind` can still be recorded (the schema
allows it), but the coach cannot compute progress or propose a follow-up for one, so steer the
conversation toward a metric whenever the user's intention has one hiding inside it: "sleep better"
becomes "average 7 hours of sleep", "move more" becomes "hit 8,000 steps most days".

## Anchor the target to the user's own baseline

Pull a quick read of the last few weeks of the relevant metric before proposing a number — `goalProgress`
gives a rolling recent average that's a good stand-in for "where the user actually is right now". A
target that's a modest, realistic step up from that baseline (a 10-15% stretch, not a sudden leap to
a textbook ideal) is far more likely to be met, and a goal that gets marked `met` builds momentum for
the next one. A target copied from a generic guideline without checking it against the user's own
data risks setting them up to fail at something that was never realistic for where they're starting
from.

## SMART-ish, but lightweight

The goal doesn't need a full SMART-framework write-up, but it should implicitly satisfy the parts
that matter here: **S**pecific (one metric, one direction), **M**easurable (a `target` number the
`current` progress can be compared against), **A**chievable (grounded in the baseline above),
**R**elevant (something the user actually said they cared about), and **T**ime-bound loosely, via
`dueAt` when the user gives one — an open-ended goal is fine too, but a date gives the check-in loop
something concrete to work toward.

## One behaviour at a time

Resist setting three goals in the same conversation just because the user mentioned three things
they'd like to improve. Stacking unrelated behaviour changes at once dilutes attention and makes it
harder to tell which change is actually responsible for any improvement (or lack of one) later. Help
the user pick the one that matters most right now, and note the others in conversation as things to
come back to — a fresh goal can always be added later once the first one is on track or `met`.
