---
input:
  trigger: string
---

Write a conservative urgency observation for every pending `triage_assessments` row. `trigger` is
not threaded into the tasks below — like the triage-nurse's `assess` action this tasklist
parallels, the hook that starts this run carries no id, so `reason` self-queries the actual pending
work and settles on an urgency for each row, grounded strictly in the curated `care/triage`
knowledge (never the open web — this space has no web access by design), and `write` composes the
plain-language observation, always ending with the mandatory "seek care now" escalation line, and
marks each row ready.
