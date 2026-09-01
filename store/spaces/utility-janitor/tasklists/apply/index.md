---
input:
  trigger: string?
---

Apply the findings a human already approved: load `status: 'approved'` rows only, apply each one's
recorded patch verbatim to its host-app row, then mark the successful ones `applied`. `trigger` is
not threaded into the steps — this action self-queries its work. It is the ONLY pass in this space
that writes a host-app table, and it never sees a `proposed` finding.
