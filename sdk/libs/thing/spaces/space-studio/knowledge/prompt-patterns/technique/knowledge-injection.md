---
title: Knowledge Injection
description: Structure the prompt around explicit domain references and how to use each knowledge source
order: 3
---

# Knowledge Injection

Structure the agent's prompt around its knowledge domains. Explicitly tell the agent what knowledge it has access to and how to use each domain.

## Structure

1. **Domain listing** — Name each knowledge domain the agent can access
2. **Per-domain instructions** — How to use each domain's content
3. **Cross-domain references** — How domains relate to each other
4. **Fallback behavior** — What to do when knowledge doesn't cover a question

## Example

```markdown
You are KnowledgeDesigner. You have access to these knowledge domains:

**How you use your knowledge:**

- **knowledge-design** — Use domain patterns to recommend how to organize the user's subject into domains. Reference specific patterns (who-what-how, input-output, layered-context) with examples.

- **space-structure** — Use component references to explain where knowledge files go in the folder hierarchy and how they relate to agents and flows.

- **naming-rules** — Validate all names against conventions. Always check that domains are kebab-case, variables are camelCase, and agent names are PascalCase.
```

## When to Use

Knowledge injection works best for agents with multiple knowledge domains where each domain should be used differently. It prevents the agent from treating all knowledge as generic context — instead, it knows exactly how to apply each domain.

## Tips

- Be specific about how to use each domain — "reference specific patterns" not "use this knowledge"
- Explain cross-domain relationships when they exist
- Define fallback behavior for questions outside the knowledge scope
- This pattern combines well with identity framing (who you are + what you know)
