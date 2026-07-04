---
input:
  trigger: string
---

Compile a one-page appointment-prep brief from recent flagged labs, symptoms, trends, and research.
`trigger` is not threaded into the tasks below — like the interpreter's `prep` action this tasklist
parallels, the hook that starts this run carries no id, so `gather` self-queries the actual pending
work (flagged labs, active symptoms, and ready research) and `compose` writes the plain-language
markdown body, ending in a "Questions to ask" list.
