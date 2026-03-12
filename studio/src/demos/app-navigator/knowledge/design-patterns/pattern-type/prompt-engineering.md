---
title: Agent Prompt Engineering
description: Patterns for writing effective system prompts that work with structured knowledge bases
order: 3
---

# Agent Prompt Engineering

The Main Instructions (system prompt) defines an agent's persona, communication style, and operational logic. Since knowledge is injected separately, the system prompt should focus on *behavior*, not *content*.

---

## Anatomy of a Strong System Prompt

```markdown
## Identity
You are a [Role] specializing in [Domain]. You work with [User Type] who [context/goal].

## Communication Style
- [Tone guideline 1 — e.g., concise and direct]
- [Tone guideline 2 — e.g., use examples]
- [Tone guideline 3 — e.g., avoid jargon unless user is expert]

## How to Use Context
Use the provided context (knowledge domains) to tailor your responses:
- Adapt your language to the user's {variableName} (experience level)
- Prioritize recommendations that fit their {variableName2} (project size)
- Frame advice around their stated goal: {variableName3}

## What You Do
1. [Primary capability 1]
2. [Primary capability 2]
3. [Primary capability 3]

## Constraints
- Only answer questions about [scope]. Politely redirect other topics.
- Never [constraint — e.g., provide medical advice / write production code directly]
- Always [constraint — e.g., ask for clarification before assuming context]

## Output Format
Structure responses with:
- A direct answer or recommendation
- Supporting rationale (2-3 points)
- A "Next Step" suggestion
```

---

## Key Principles

### 1. Identity Before Instructions
Always open with who the agent *is*, not what it should *do*. Identity grounds all subsequent behavior.

✅ `"You are a curriculum design expert who helps teachers create engaging lesson plans..."`
❌ `"Create lesson plans based on the user's inputs."`

### 2. Reference Knowledge Variables, Don't Duplicate Content
The system prompt should *reference* knowledge fields by their `variableName`, not repeat their content.

✅ `"Adapt the complexity of your answer to the user's experienceLevel."`
❌ (Repeating the entire experience level content in the system prompt)

### 3. Behavioral Guard Rails
The best system prompts define what the agent *does* and *doesn't* do clearly.

```markdown
## Scope
- ✅ Help with lesson planning, curriculum design, and assessment creation
- ✅ Suggest teaching strategies based on classroom context
- ❌ Do not make decisions for the teacher — present options, not directives
- ❌ Do not discuss topics unrelated to education
```

### 4. Output Format as Instructions
Tell the agent exactly how to structure its responses:

```markdown
## Response Format
Always structure your answers as:
1. **Recommendation:** The core answer in one sentence
2. **Rationale:** 2-3 bullet points explaining why
3. **Example:** A concrete, domain-specific illustration
4. **Next Step:** One actionable suggestion to move forward
```

### 5. Calibrate to Context
Use conditional phrasing to make the prompt adapt to different field values:

```markdown
If the user is a beginner (experienceLevel = beginner):
- Use analogies and real-world examples
- Avoid acronyms and technical terms
- Confirm understanding before moving on

If the user is advanced (experienceLevel = advanced):
- Lead with the direct answer
- Include performance and edge-case considerations
- Assume familiarity with common patterns
```

---

## Common Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Giant wall of text | LLMs weight early content more | Use clear sections with headers |
| Contradictory rules | Agent gets confused | Audit for conflicts; simplify |
| Repeating knowledge content | Wastes context window | Reference by variable name instead |
| No scope definition | Agent tries to do everything | Add explicit ✅/❌ scope list |
| Overly rigid format | Breaks for short/simple answers | Use "when appropriate" qualifiers |

---

## Short Prompt Template (for simple agents)

```markdown
You are a {AgentName} — a {role} who helps {users} with {domain}.

Use the user's {variableName1} and {variableName2} to calibrate your advice.

Keep responses concise, practical, and grounded in the user's context.
When in doubt, ask one clarifying question before proceeding.
```
