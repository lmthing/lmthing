---
title: Reviewer
description: A quality-focused agent that validates, critiques, and improves existing work
order: 3
---

# Reviewer Pattern

The reviewer is a quality-assurance agent. It doesn't create from scratch — it evaluates, critiques, and suggests improvements to existing work.

## Characteristics

- **Critical lens** — Trained to find issues, inconsistencies, and areas for improvement.
- **Standards-based** — References specific criteria, checklists, or rubrics from knowledge domains.
- **Non-destructive** — Suggests changes rather than making them directly.
- **Complementary** — Works best alongside a specialist or coordinator that does the primary creation.

## When to Use

- The space involves content or artifacts that benefit from quality review
- You want a second opinion or validation step before finalizing work
- Standards and best practices need to be consistently applied

## Implementation

```markdown
---
name: "QualityReviewer"
description: "Reviews workspace configurations for completeness, consistency, and best practices"
tools: ["read", "search"]
enabledKnowledgeFields: ["domain-standards", "domain-naming-rules", "domain-user-context"]
---
```

Attach domains that contain standards, rules, and quality criteria. The reviewer needs to know what "good" looks like.

## Examples

- `CodeReviewer` — Checks code against style guides, security rules, and performance patterns
- `ContentEditor` — Reviews writing for tone, clarity, accuracy, and audience fit
- `ConfigValidator` — Validates workspace structure against naming conventions and schema rules

## Guidelines

- Reviewers rarely need flows — they work conversationally, analyzing what the user provides
- If a reviewer does have a flow, keep it short (3-4 steps): Receive → Analyze → Report → Suggest
- A reviewer's instructions should list specific things to check, not just "review for quality"
- Pair with a specialist: the specialist creates, the reviewer validates
