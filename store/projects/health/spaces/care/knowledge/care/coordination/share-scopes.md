# Share scopes

A `care_shares` row's `scope` column decides how much of the record the compiled export covers.
The coordinator's `compile` action reads this value and asks `buildCareSummary` to include only the
sections (and depth) that scope calls for — never more, never less.

## `'summary'` — a short version of everything

The default scope. Includes a brief slice (top few items) of each section — labs, medications,
insights, upcoming appointments, and care team — enough for a quick clinician glance without
overwhelming a one-page printout. This is the right default for "just bring something to the
visit" requests.

## `'full'` — everything, in full

Every section, with no truncation: every flagged lab on file, every active medication with its
adherence, every recent insight, every upcoming appointment, and the full care team list. Appropriate
when the user is establishing care with a new clinician who needs the complete picture, or handing
off to a specialist who wants the full history rather than a curated slice.

## `'labs'` — labs only

Just the flagged lab results, in full. Useful for a narrow ask like "send my recent labs to my new
primary care doctor" without pulling in medications or appointments that aren't relevant to that
handoff.

## `'meds'` — medications only

Just the active medication list (with adherence, when there's history to compute one), in full.
Useful for a pharmacy consult or a new prescriber who specifically needs the current medication
list rather than the whole record.

## What makes a good printable clinician handoff

- **Concrete values, not vague summaries.** "LDL 165 mg/dL (high)" beats "cholesterol is a bit
  high." The clinician reads numbers fast; make sure the ones that matter are on the page.
- **Recency matters.** Prefer the most recent flagged reading over an old one that's since
  resolved (the interpreter's own flagging already keeps `lab_results.flag` current).
- **No editorializing.** The export lists what's on file — it never adds a recommendation, a
  likely cause, or a next step beyond what's already in an `insights` row the interpreter wrote as
  an observation.
- **Always end with the not-a-doctor line.** Every compiled summary, regardless of scope, closes
  with an explicit acknowledgement that this is the user's own data for discussion with their
  clinician — never advice on its own.
