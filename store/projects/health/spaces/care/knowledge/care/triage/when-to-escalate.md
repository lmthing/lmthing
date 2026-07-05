# When to escalate: mapping a symptom to an urgency level conservatively

Most triage questions won't cleanly match a `red-flags.md` pattern word-for-word — a real
assessment has to map a specific, often ambiguous description onto one of four buckets. This is
where "when in doubt, escalate" earns its keep: erring upward costs little; erring downward can
cost a lot.

## The core heuristic

Ask, in order:

1. **Does this match (or closely resemble) a `red-flags.md` pattern?** If yes, that's `urgent` or
   `emergency` — see that file for which. Don't require an exact match; "crushing chest pressure
   that started while climbing stairs" maps to the chest-pain-with-exertion pattern even though it
   isn't phrased identically.
2. **Is this a genuine, new change without an obvious benign explanation?** A moderate symptom that
   is new, persistent (more than a few days), or unexplained by something ordinary (a known
   lifestyle change, recent travel, a cold that's already resolving) generally warrants `urgent` —
   worth a call in the next day or so, even without a hard red flag.
3. **Is this a known, mild, stable, or resolving pattern?** A low-severity symptom, already easing,
   with a plausible benign explanation and no red flag, generally warrants `routine` — worth
   mentioning at the next visit, not a reason to act now.
4. **Is this squarely self-limiting and well understood?** A mild, common, short-lived symptom with
   an obvious benign cause (e.g. a brief tension headache after a poor night's sleep, mild soreness
   after new exercise) can warrant `self_care` — but only when there is genuinely nothing else
   pointing toward more concern. If anything about the description gives pause, move up a bucket
   rather than defaulting here.

## Ambiguity resolves upward, always

When a description doesn't give enough information to be confident — vague severity, missing
duration, an unfamiliar combination of symptoms — do not default to `routine` "to be safe on the
low side." The safe direction is the opposite: pick the higher bucket the description could
plausibly support. It is far better to prompt an unnecessary clinician call than to under-call a
genuine emergency.

## Never reassure with "probably nothing"

Even a `self_care` assessment should never say the symptom is "probably nothing" or "definitely
fine." Frame it instead as "this looks like it fits a pattern that's often self-limiting" and still
include the standard escalation line. The point isn't to withhold reassurance out of excessive
caution for its own sake — it's that the app has no way to rule out the small chance a description
is missing the detail that would move it to a different bucket, and a diagnosis-shaped reassurance
overclaims certainty this app doesn't have.

## Combine signals, don't average them

A single red flag outweighs several reassuring details. Don't average "mostly reassuring
description, but one red-flag detail" into a middle bucket — a genuine red-flag pattern present
anywhere in the description pulls the whole assessment to `urgent` or `emergency`, regardless of
how mild everything else sounds.
