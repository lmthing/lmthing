# Urgency levels

The `triage_assessments.urgency` column is one of four conservative buckets. Each implies a
specific action for the user — the assessment's body should make that action explicit, not just
name the bucket.

## `self_care` — self-monitor

**What it means:** a mild, common, well-understood symptom with a plausible benign explanation and
no red-flag pattern — the kind of thing that typically resolves on its own with basic self-care
(rest, hydration, over-the-counter comfort measures the user already knows about).

**Examples:** a mild tension headache after a poor night's sleep; mild muscle soreness after
starting a new exercise; a common cold's early, mild symptoms with no red flag.

**Implied action:** watch for it getting worse or lasting longer than expected; no need to contact
a clinician right now, but the assessment still ends with the standard "if X, seek care now" line
in case something changes.

## `routine` — bring it up at the next visit

**What it means:** a finding worth a clinician's attention, but with no urgency to it — no red
flag, no rapid change, nothing suggesting it needs to jump the queue ahead of a normal appointment.

**Examples:** a mild, already-resolving symptom; a symptom that's persisted but is stable and
low-severity with a plausible benign explanation; a single mild finding with no accompanying
red-flag pattern.

**Implied action:** mention it at the next scheduled visit; no need to seek care specifically for
this before then, absent a change in how it presents.

## `urgent` — see a clinician soon

**What it means:** a genuine change or moderate-to-high-severity finding without a hard red-flag
pattern, but concerning enough that waiting for a routine visit isn't appropriate — something a
clinician should look at within the next day or so.

**Examples:** a new, persistent, moderate symptom without an obvious benign explanation; a symptom
matching the "genuine change, no red flag yet" pattern from `when-to-escalate.md`; a high-severity
symptom (4-5) that's new but doesn't clearly match a `red-flags.md` pattern.

**Implied action:** contact a clinician in the next day or so rather than waiting for a routine
appointment; the assessment should say so plainly.

## `emergency` — call emergency services now

**What it means:** the symptom or combination matches (or closely resembles) a `red-flags.md`
pattern — the kind of thing that shouldn't wait for even a same-day clinic visit.

**Examples:** any pattern in `red-flags.md` — chest pain with exertion, stroke's FAST signs,
severe difficulty breathing, anaphylaxis signs, suicidal ideation, severe unrelenting abdominal
pain, high fever with stiff neck.

**Implied action:** call emergency services or go to the nearest emergency department now — this
is the one bucket where the assessment should lead with the escalation line rather than burying it
at the end, per `red-flags.md`'s phrasing guidance.

## Choosing between adjacent levels

When genuinely torn between two adjacent levels, pick the higher one — see
`when-to-escalate.md`'s "ambiguity resolves upward" guidance. The cost of a false positive here
(an unnecessary clinician call) is far lower than the cost of a false negative (a missed emergency
framed as routine).
