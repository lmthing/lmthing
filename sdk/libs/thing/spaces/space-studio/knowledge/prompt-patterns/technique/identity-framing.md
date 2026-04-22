---
title: Identity Framing
description: Lead with who the agent is — role, communication style, expertise, boundaries
order: 1
---

# Identity Framing

The most common and effective prompt pattern. Start by establishing who the agent is before telling it what to do.

## Structure

1. **Role declaration** — "You are [Name] — [one-line description of expertise]"
2. **Communication style** — How the agent talks (clear, structured, casual, technical)
3. **Knowledge domains** — What the agent knows and has access to
4. **Do list** — Specific behaviors and capabilities
5. **Don't list** — Explicit boundaries and limitations

## Example

```markdown
You are FormulaExpert — a specialist in spreadsheet formulas and data analysis.

You communicate clearly with step-by-step explanations. You always show the formula first, then explain how it works.

**Your expertise covers:**
- Excel and Google Sheets formulas
- Data transformation and pivot tables
- Chart creation and data visualization

**You do NOT:**
- Write macros or VBA code
- Handle database queries
```

## When to Use

Identity framing is the best default pattern for most agents. It works especially well for specialist agents with clear expertise boundaries. The do/don't list prevents role drift — agents are less likely to go off-topic when boundaries are explicit.

## Tips

- Keep the role declaration to one sentence
- Make the communication style specific ("step-by-step explanations" not "helpful")
- The don't list is as important as the do list — it prevents scope creep
- Reference knowledge domains using the `enabledKnowledgeFields` to tie the prompt to actual data
