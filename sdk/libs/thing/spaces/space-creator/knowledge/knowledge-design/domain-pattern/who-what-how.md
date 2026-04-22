---
title: Who-What-How
description: Organize domains around the user, the subject matter, and the methodology
order: 1
---

# Who-What-How Pattern

The most versatile domain pattern. Splits knowledge into three perspectives: who is involved, what the subject matter is, and how things should be done.

## Structure

- **Who** — User context, roles, experience levels, preferences. Answers: "Who is this agent serving?"
- **What** — Subject matter, content types, domain-specific categories. Answers: "What is the agent working with?"
- **How** — Methods, processes, constraints, quality standards. Answers: "How should the agent approach the work?"

## When to Use

Best for spaces where the agent's behavior changes significantly based on the audience. Examples:

- Teaching spaces (who = student level, what = subject, how = pedagogy)
- Content creation (who = audience, what = topic, how = style/format)
- Consulting (who = client profile, what = domain, how = methodology)

## Implementation

Map each perspective to one or more knowledge domains:

```
knowledge/
├── user-context/        # Who
├── subject-matter/      # What
├── methodology/         # How
```

Add a `creator-context` or `user-context` domain with a `role` or `experience-level` field as the "Who" pillar. This field is typically marked as `required: true` and listed in `runtimeFields` so the agent asks before starting.

## Strengths

- Intuitive and easy to explain to non-technical users
- Scales well — each pillar can grow independently
- Natural fit for agents that need to adapt to different audiences
