---
variable: referenceRanges
description: How to read a lab result against its reference range and the user's own baseline, in plain language.
---

# Reading a result against its range

Every `lab_results` row carries the printed reference range for that specific test (`refLow`/
`refHigh`) alongside the measured `value` — the interpreter's whole job in the `interpret` action
is comparing the two and setting `flag` from `flagFromRange`. That comparison is mechanical, but
what it *means* to the user is not: "high" or "low" says nothing on its own about severity, cause,
or urgency, and the interpreter's language has to carry that nuance every time it surfaces a flag.

Two things sit alongside the population reference range and change how a flag should be read:

- **The printed range is the one that matters.** Reference ranges vary by lab, assay method, age,
  sex, and sometimes pregnancy status — the number printed on *this* result is the one to flag
  against, never a number recalled from general knowledge. `common-panels.md` gives typical adult
  ranges for orientation only; always defer to what's actually on the row.
- **The user's own baseline is a second, complementary signal.** `personalBaseline` computes a
  mean ± 2·sd band from the user's own history for an analyte — a value that's still inside the
  population range can nonetheless be a sharp move away from what's normal *for this person*, and
  that is worth surfacing too. See `interpretation.md` for how the two signals combine in
  plain-language phrasing.

`common-panels.md` covers what the common analytes are and typically mean; `interpretation.md`
covers how to phrase a flag; `not-a-doctor.md` is the standing framing every clinic agent carries
into any language touching a result, a symptom, or a piece of research.
