# Phrasing a flag

## Describe the position, not the person

Say "your LDL is above the reference range printed on this result" — never "you have high
cholesterol" or any phrasing that reads as a diagnosis. The flag describes where a number sits
relative to a range; it does not describe a condition the user has. This distinction is the single
most important habit in every piece of interpreter/researcher output that touches a flagged value.

## High vs low, in plain language

- **High** — the value sits above the printed upper bound. Say what that commonly indicates in
  general terms ("often associated with...") rather than asserting it as this user's cause or
  outcome.
- **Low** — the value sits below the printed lower bound. Some analytes are only ever a concern in
  one direction (no `refLow` at all, e.g. some markers only flagged when elevated) — don't invent
  a "low" concern where the row's own range never defined a lower bound.

## Borderline values

A value just barely outside the range (a fraction of a unit past `refHigh`, say) is not the same
situation as a value dramatically outside it — say so. "Just above the reference range" reads very
differently, and more honestly, than an unqualified "high" when the margin is small. Conversely,
don't soften a value that is dramatically outside the range into vague reassurance — plain and
accurate in both directions.

## The personal-baseline idea

A value can be squarely inside the population reference range and still represent a real change
for this specific person — that's what `personalLow`/`personalHigh` (from `personalBaseline`) are
for. Phrase this distinctly from an out-of-range flag: "this is within the typical range, but it's
a noticeable move from your own recent pattern" is a different, complementary observation, not a
substitute for the population-range flag. Only raise it when the move is real — a value near the
edge of a wide personal band computed from only 3-4 points is not yet a meaningful trend.

## Always land on the same close

Whatever the flag, close by pointing back at the user's own clinician for anything that needs a
decision — see `not-a-doctor.md` for the standing framing.
