# Common panels

Typical adult reference ranges below are for **orientation only** — labs vary in assay method, age-
and sex-specific ranges, and units (mg/dL vs mmol/L). Always flag against the `refLow`/`refHigh`
actually printed on the `lab_results` row, never against the numbers here.

## Lipid panel

- **LDL cholesterol** — commonly flagged high above ~100–130 mg/dL depending on the lab and the
  person's cardiovascular risk profile; "high" here means an elevated cardiovascular risk marker,
  not a disease in itself.
- **HDL cholesterol** — usually the "higher is better" direction; a *low* HDL (roughly below
  ~40 mg/dL men / ~50 mg/dL women) is the flag worth noting, not a high one.
- **Total cholesterol** — a rough summary number; LDL/HDL individually usually matter more than the
  total once flagged.
- **Triglycerides** — commonly flagged high above ~150 mg/dL; strongly affected by recent meals, so
  a fasting vs. non-fasting draw matters (check `note` on the row if present).

## HbA1c

Reflects average blood glucose over roughly the prior 2–3 months. Commonly: under ~5.7% typical,
~5.7–6.4% often labeled "prediabetes range," 6.5%+ often labeled diabetes range — exact thresholds
are the ordering lab/clinician's call, never the app's.

## Fasting glucose

A single-point-in-time measure, more sensitive to the fasting window than HbA1c. Commonly flagged
high above ~100 mg/dL (fasting); very high single readings can be a same-day fluke (illness,
recent meal despite "fasting") worth a plain, non-alarming note rather than an urgent framing.

## CBC (complete blood count)

- **Hemoglobin** — low commonly associated with anemia; the *degree* of low matters a lot more than
  a bare "low" flag, so phrasing should avoid implying a specific cause.
- **WBC (white blood cell count)** — high or low both have many possible drivers (infection,
  medication, recent illness); a single flagged WBC rarely means anything specific on its own.

## Metabolic panel

- **Creatinine** — a kidney-function marker; interpreted together with eGFR rather than alone.
- **eGFR (estimated glomerular filtration rate)** — lower values flagged as reduced kidney
  function; trending over time matters more than any single reading.

## Thyroid (TSH)

Thyroid-stimulating hormone — a *high* TSH commonly associated with an underactive thyroid, a
*low* TSH with an overactive one (the relationship is inverse to the thyroid hormones themselves,
which trips people up — phrase it plainly rather than assuming the user knows the inversion).
