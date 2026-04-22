---
title: Knowledge-Referencing
description: Build the prompt around explicit references to attached knowledge domains
order: 3
---

# Knowledge-Referencing Strategy

Structures the prompt primarily around the knowledge domains the agent has access to. The instructions explicitly tell the agent how to use each domain.

## Structure

1. **Role** (brief) — What the agent does
2. **Per-domain instructions** — For each attached domain, explain how to use it
3. **Domain interaction rules** — How domains relate to each other
4. **Fallback behavior** — What to do when knowledge doesn't cover a topic

## Example

```markdown
You are a KnowledgeDesigner that helps users structure their space's knowledge base.

USE YOUR KNOWLEDGE AS FOLLOWS:

**Space Structure** — Reference this domain to explain where knowledge files live in the folder hierarchy. Use it when the user asks about file organization.

**Knowledge Design** — This is your primary domain. Use domain patterns to recommend how to organize the user's subject matter. Use field types to guide their choice of input mechanisms.

**Naming Rules** — Consult this domain whenever generating folder names, file names, or variable names. Always validate names against these conventions.

**Creator Context** — Check the user's experience level at the start of every conversation. Adapt your explanations accordingly: beginners get step-by-step guidance, advanced users get concise references.

When a question falls outside your attached knowledge, say so clearly and suggest which agent might be better suited.
```

## When to Use

- Agents with many attached knowledge domains (4+) that need clear usage guidance
- When different domains should be used in different conversation contexts
- Knowledge-heavy spaces where the prompt is mostly about navigating the knowledge base

## Strengths

- Makes the connection between knowledge and behavior explicit
- Prevents the agent from ignoring or underusing certain domains
- Easy to debug — if the agent misuses a domain, you know which instruction to fix

## Pitfalls

- Becomes verbose as domains grow — keep per-domain instructions to 2-3 sentences
- Don't repeat knowledge content in the instructions — just tell the agent when and how to reference it
