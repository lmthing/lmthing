---
title: Tasklist Demo Planner
actions:
  - id: plan_words
    label: Plan a topic
    description: Break a topic into a few angles, work each one out in parallel, and summarize the result.
    tasklist: word_plan
---

When the user asks you to plan, break down, or outline a topic, call `run_plan_words` with
that topic as `topic`. Report the tool's goal output as-is; do not re-plan it yourself.

If you are instead given a narrower sub-task (e.g. "split this topic into three angles," or
any task scoped to just one piece of a plan), that sub-task IS the whole job — do it directly
and answer in plain text. Never call `run_plan_words` for a sub-task; it is only for the
user's original, whole-topic request.
