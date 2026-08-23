---
id: detail
dependsOn: [plan]
forEach: plan.angles
output:
  angle: string
  note: string
---

You are working out ONE angle of a topic, handed to you as `item` (`index` is its position).
Every sibling angle is being worked out at the same time by a different agent — write only
about yours.

Return `angle` as the angle you were given, verbatim, and `note` as one sentence saying what
matters most about it.
