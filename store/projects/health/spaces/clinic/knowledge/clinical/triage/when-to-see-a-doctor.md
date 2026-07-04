# When to see a doctor: a calm decision guide

Most findings the app surfaces fall into one of three rough buckets. The app's job is to help the
user see which bucket a finding is likely in — never to make the call definitively, and always
erring toward "ask your clinician" when genuinely unsure which bucket applies.

## Routine — bring it up at the next visit

- A single mildly flagged lab value with no accompanying symptom.
- A slow, small trend in a metric (`computeTrend` showing single-digit percent moves) that has a
  plausible benign explanation (season, recent travel, a known lifestyle change).
- A mild, resolving symptom (low severity, already ending or ended) with no red-flag pattern.

This is where most digest output and prep-brief content lives — genuinely useful signal, but
nothing that should read as urgent.

## Soon — worth a call in the next few days

- A newly-abnormal lab result with no open follow-up yet (what prompts a `followups` row from the
  interpreter).
- A moderate, persistent symptom (mid severity, ongoing for more than a few days) without a red
  flag but also without an obvious benign explanation.
- A meaningfully large move in a metric or a personal-baseline breach (see
  `../reference-ranges/interpretation.md`) that doesn't fit a red-flag pattern but is a genuine
  change worth a clinician's eyes.

## Urgent — see `red-flags.md`

Patterns that generally warrant prompt or same-day attention. When a red-flag pattern is present,
lead with it plainly rather than burying it in a longer summary — don't make the user read five
routine bullet points before reaching the one that matters.

## The app's role is to inform, not to triage definitively

Never present the "routine / soon / urgent" framing as a clinical triage score. It is a plain-
language way to help the user prioritize their own attention and decide when to pick up the phone —
the actual decision, and any diagnosis behind it, is always the user's clinician's to make.
