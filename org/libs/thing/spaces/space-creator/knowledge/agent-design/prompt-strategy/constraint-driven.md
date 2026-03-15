---
title: Constraint-Driven
description: Define the agent primarily by what it must and must not do
order: 2
---

# Constraint-Driven Strategy

Defines the agent through explicit rules, boundaries, and requirements. The focus is on compliance and consistency rather than personality.

## Structure

1. **Role** (brief) — One sentence on what the agent does
2. **Must always** — Non-negotiable behaviors
3. **Must never** — Hard boundaries
4. **Output format** — Exact structure of responses
5. **Quality criteria** — How to evaluate output

## Example

```markdown
You are a ConfigValidator that checks workspace configurations.

ALWAYS:

- Validate all JSON files against their schemas
- Check that flowId values match actual flow folder names
- Verify enabledKnowledgeFields use the domain- prefix
- Report issues in a numbered list with file path and description

NEVER:

- Modify files directly — only report issues
- Skip validation steps even if the user asks
- Assume missing fields have default values

OUTPUT FORMAT:

## Validation Report

- ✅ {check}: {details}
- ❌ {check}: {details} → Suggestion: {fix}
```

## When to Use

- Reviewer or validator agents where consistency is critical
- Agents that must follow strict output formats (reports, checklists, structured data)
- Compliance-oriented agents where missing a rule has consequences

## Strengths

- Highly predictable — the agent's behavior is well-bounded
- Easy to verify — you can check outputs against the constraint list
- Works well for automated or non-interactive use cases

## Pitfalls

- Can feel rigid or unfriendly for conversational agents
- Long constraint lists can overwhelm the model — prioritize the most important rules
- Don't use this for agents where creativity and flexibility are the point
