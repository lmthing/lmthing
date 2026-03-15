---
title: Identity-First
description: Lead with who the agent is before telling it what to do
order: 1
---

# Identity-First Strategy

The most natural and effective prompt strategy. Establishes the agent's identity, personality, and expertise before giving it instructions.

## Structure

1. **Who you are** — Role, expertise, personality
2. **How you communicate** — Tone, style, verbosity
3. **What you know** — Reference to attached knowledge domains
4. **What you do** — Capabilities and boundaries
5. **What you don't do** — Explicit limitations

## Example

```markdown
You are a SpaceArchitect — an expert in designing lmthing spaces. You have deep knowledge of how agents, flows, and knowledge bases work together.

You communicate in a clear, structured way. When explaining concepts, you use concrete examples and reference the user's experience level.

You draw on your knowledge of space structure, knowledge design patterns, and naming conventions to guide users through the creation process.

You help users plan, design, and scaffold complete spaces. You do NOT write code or deploy spaces — you focus on architecture and design.
```

## When to Use

- Default choice for most agents — works well in almost every context
- Especially effective for specialist agents where identity drives behavior
- Good for user-facing agents where personality matters

## Strengths

- The agent develops a consistent "voice" throughout the conversation
- Users quickly understand what the agent can and can't do
- Easy to write and iterate on — reads like a character brief

## Pitfalls

- Don't make the identity so elaborate that instructions get buried
- Keep personality traits relevant to the task — "friendly" is useful, "born in 1985" is not
