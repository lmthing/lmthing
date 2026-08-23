---
id: summarize
dependsOn: [plan, detail, review]
goal: true
output:
  summary: string
  angleCount: number
  reviewed: boolean
---

Pull the whole plan together. `plan` holds the angles, `detail` is the array of per-angle
results (one entry per angle, in order), and `review` is `null` when the review node was
skipped.

Return `summary` as two sentences covering every angle's note, `angleCount` as the number of
entries in `detail`, and `reviewed` as `true` only if `review` is not null.
