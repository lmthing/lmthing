---
input:
  trigger: string
---

Extract structured data from every pending document: load the documents still `status: 'pending'`,
extract each one's rows by kind (in parallel, one branch per document), then confirm provenance was
recorded for what was written. `trigger` is not threaded into the tasks below — like the `analyze`
agent action this tasklist parallels, the hook that starts this run carries no id, so `load-pending`
self-queries the actual work from the database.
