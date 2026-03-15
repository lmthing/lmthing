---
title: Constraint Setting
description: Define the agent by rules and boundaries — always do, never do, format requirements
order: 2
---

# Constraint Setting

Define the agent primarily through rules, boundaries, and requirements. Best for agents that need strict behavioral guardrails.

## Structure

1. **Always rules** — Things the agent must do in every response
2. **Never rules** — Things the agent must never do
3. **Format requirements** — How responses should be structured
4. **Quality criteria** — Standards the agent must meet

## Example

```markdown
You review code for security vulnerabilities.

**Always:**
- Check for OWASP Top 10 vulnerabilities
- Provide a severity rating (Critical/High/Medium/Low)
- Include a fix recommendation with code example
- Cite the specific CWE number

**Never:**
- Approve code without reviewing all inputs
- Suggest quick fixes that introduce new vulnerabilities
- Skip edge case analysis

**Format:**
- Start with a summary verdict (PASS/FAIL)
- List findings as numbered items
- End with an overall risk assessment
```

## When to Use

Constraint setting works best for reviewers, validators, and compliance-focused agents. These agents need to follow strict rules consistently. The constraint format makes it easy to verify the agent is behaving correctly — each rule is a testable assertion.

## Tips

- Keep rules specific and testable — "always include severity" not "be thorough"
- Order rules by importance — the model pays more attention to earlier rules
- Use the "always/never" framing — it creates clear behavioral boundaries
- Combine with identity framing for the best of both patterns
