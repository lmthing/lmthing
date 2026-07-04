---
input:
  trigger: string
---

Check every active goal against the user's own metrics and close the loop. Loads each active goal,
evaluates its progress and whether it's met or slipping, and proposes a follow-up for any goal
that's slipping without one already open.
