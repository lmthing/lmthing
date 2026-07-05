---
input:
  question: string
---

Turn the current week's `meal_nutrition` and the household's `settings` targets into a plain-
language weekly summary — a **read-only** pass the coach's `chat` action can run before answering a
question like "how's this week going?". Both steps are `role: explore`: this pipeline never writes
anything; a goal change or a `suggestions` nudge is a decision the `chat` action makes separately,
in its own steps, after seeing this summary.
