---
title: Flow Design Patterns
description: Proven patterns for structuring multi-step flows that are clear, effective, and agent-friendly
order: 4
---

# Flow Design Patterns

A well-designed flow guides the agent through a complex task in discrete, manageable steps. Poor flow design leads to confused agents, incomplete outputs, and frustrated users.

---

## Core Patterns

### Pattern A: Gather → Decide → Execute → Review

The most common pattern for task flows. Four conceptual phases:

| Phase | Purpose | Step Example |
|---|---|---|
| **Gather** | Collect all context needed | "Identify Learning Goals" |
| **Decide** | Make choices / plan approach | "Select Question Types" |
| **Execute** | Perform the core task | "Draft Assessment Questions" |
| **Review** | Validate and finalize | "Review and Finalize" |

```
flow_generate_assessment/
├── 1.Identify Learning Goals.md      ← Gather
├── 2.Select Question Types.md        ← Decide
├── 3.Draft Questions.md              ← Execute
├── 4.Review and Finalize.md          ← Review
```

---

### Pattern B: Context → Analysis → Recommendation → Action

Best for advisory / analytical flows:

```
flow_analyze_data/
├── 1.Understand the Dataset.md       ← Context
├── 2.Identify Patterns.md            ← Analysis
├── 3.Interpret Findings.md           ← Analysis (continued)
├── 4.Recommend Next Steps.md         ← Recommendation
├── 5.Draft Summary Report.md         ← Action
```

---

### Pattern C: Iterative Refinement

For creative or review-heavy tasks where multiple passes are needed:

```
flow_write_article/
├── 1.Define Topic and Audience.md
├── 2.Create Outline.md
├── 3.Write First Draft.md
├── 4.Edit for Clarity.md             ← First refinement pass
├── 5.Strengthen Arguments.md         ← Second refinement pass
├── 6.Final Proofread and Format.md   ← Final polish
```

---

### Pattern D: Branching Decision Tree (via step instructions)

When the flow has conditional paths, encode the branching logic within a decision step's instructions:

```markdown
# Step 2: Choose Approach

Based on the user's project size, recommend one of two paths:

**If small project (< 3 people, < 1 month):**
→ Proceed to Step 3A: Lightweight Plan
Tell the user to skip to "3.Quick Plan.md"

**If large project (> 3 people, > 1 month):**
→ Proceed to Step 3B: Full Project Plan
Tell the user to continue with "3.Full Project Plan.md"
```

---

## Step Content Patterns

### Opening Pattern
Every step should clearly state **what it does** and **what it needs from the user**:
```markdown
# {Step Name}

{One sentence: what this step accomplishes}

{2-3 sentences of context or reasoning}

Ask the user: "{Specific question or prompt}"
```

### Decision Step Pattern
```markdown
# Choose {X}

We need to determine {X} before proceeding.

**Options:**
| Option | Best For |
|---|---|
| Option A | {When to use A} |
| Option B | {When to use B} |

Based on their {context variable}, recommend the most appropriate option. 
Ask for confirmation before proceeding.
```

### Execution Step Pattern
```markdown
# {Generate/Write/Create/Analyze} {Output}

Using the context from previous steps, {produce the output now}.

**Guidelines:**
- {Guideline 1}
- {Guideline 2}
- {Guideline 3}

**Output format:** {Describe exact structure — e.g., numbered list, table, markdown sections}

Present the output and ask if any adjustments are needed before moving on.
```

---

## Step Count Guidelines

| Task Complexity | Steps | Notes |
|---|---|---|
| Simple generation | 3–4 | Gather context → generate → review |
| Structured analysis | 4–6 | Multiple analysis steps justified |
| Multi-phase creative | 5–8 | Include iteration steps |
| Complex workflows | 6–8 | Max — split into sub-flows if longer |

**Never go beyond 8 steps.** If the task needs more, create two separate flows and link them conceptually.

---

## Common Mistakes

| Mistake | Symptom | Fix |
|---|---|---|
| Steps that do too much | Agent produces poor output | One step = one discrete action |
| Steps that do too little | Flow feels padded | Merge similar micro-steps |
| Vague step instructions | Agent improvises badly | Be explicit about expected output format |
| No "confirm before proceeding" | User can't course-correct | Add confirmation prompts at key decision points |
| Missing final review step | Outputs aren't cleaned up | Always end with a review/format step |
