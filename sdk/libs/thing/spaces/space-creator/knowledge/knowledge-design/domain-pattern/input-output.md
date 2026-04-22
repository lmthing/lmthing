---
title: Input-Output
description: Organize domains around what goes in and what comes out of the agent's process
order: 2
---

# Input-Output Pattern

Organizes knowledge around the transformation the agent performs — what it receives and what it produces.

## Structure

- **Input domains** — Source material, raw data, user requirements, constraints
- **Output domains** — Target formats, quality standards, delivery specifications
- **Process domains** (optional) — Transformation rules, templates, validation criteria

## When to Use

Best for spaces where the agent performs a clear transformation. Examples:
- Code generation (input = requirements, output = code style/language)
- Data analysis (input = data format, output = report type)
- Translation (input = source language/context, output = target language/tone)

## Implementation

```
knowledge/
├── source-material/     # Input: what the agent receives
├── output-format/       # Output: what the agent produces
├── quality-rules/       # Process: how to validate the transformation
```

## Strengths

- Makes the agent's job crystal clear
- Easy to test — you can verify outputs match specifications
- Naturally leads to focused, task-oriented agents rather than conversational ones

## Considerations

- Less intuitive for open-ended, exploratory spaces
- May need a separate "context" domain for user preferences that don't fit input/output
