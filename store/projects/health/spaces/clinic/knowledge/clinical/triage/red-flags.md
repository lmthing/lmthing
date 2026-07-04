# Red flags

The patterns below generally warrant *prompt or urgent* medical attention when logged or flagged —
always phrased as "consider seeking care," never as a diagnosis, a probability, or an instruction.
This list is deliberately general; it exists to catch obviously serious patterns, not to triage
finely.

## Symptom patterns

- Chest pain or pressure, especially with shortness of breath, sweating, or pain spreading to the
  arm/jaw.
- Severe or sudden shortness of breath, at rest or with minimal exertion.
- Sudden severe headache unlike any before, especially with confusion, vision change, or trouble
  speaking.
- Fainting or near-fainting, especially recurrent.
- Severe, unrelenting abdominal pain.
- A symptom logged at a high severity (`severity` 4-5) that is new or rapidly worsening rather than
  a known, previously-discussed pattern.

## Lab/metric patterns

- A markedly abnormal result — not just "flagged" but far outside the printed range (an order of
  magnitude, not a marginal miss) — especially on a marker tied to acute risk (e.g. a very high
  potassium, a very low hemoglobin).
- A blood-pressure metric reading in a hypertensive-crisis range (very high systolic/diastolic
  logged together), especially with an accompanying symptom like headache or vision change.
- A rapid, large move in a metric over a short window (`computeTrend` over a small recent slice)
  that has no obvious benign explanation (not a known lifestyle change) and pairs with a symptom.

## How to phrase it

"This combination — [symptom/value] — is the kind of thing that's generally worth prompt medical
attention rather than waiting for a routine visit. Please consider contacting your clinician or
seeking care soon." Never assign a specific likelihood, name a specific condition, or tell the user
what to do beyond seeking care — the app's role stops at flagging the pattern.
