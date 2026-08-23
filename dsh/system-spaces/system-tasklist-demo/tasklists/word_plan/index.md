---
input:
  topic: string
---

Break a topic into a few distinct angles, work each angle out independently and in parallel,
then summarize the whole thing. Deliberately built to exercise exactly the four tasklist
features `@lmthing/dsh-space-tasklist` compiles cleanly onto dsh-workflow — a `dependsOn`
chain, a `forEach` fan-out over an array a node produced at runtime, a `condition` that skips
a node, and exactly one `goal: true` node — and to avoid every field the compiler refuses
(no `code`/`checkpoint` node, no `onFail`, no `prelude`, no `capabilities`, no `functions`,
no `canDelegateTo`, no non-`general` `role`).
