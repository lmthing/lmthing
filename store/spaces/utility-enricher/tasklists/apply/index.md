---
input:
  trigger: string?
---

Write the approved values into the host app's tables — one cell each, and only where the cell is
still empty. Load `status: 'approved'` tasks, re-validate every value, confirm the target row still
exists and its column is still blank, patch that single column, then mark the task `applied`.
`trigger` is not threaded into the steps: the run self-queries the approved queue, and a task that
is already `applied` is never picked up again, so a re-run is free.
