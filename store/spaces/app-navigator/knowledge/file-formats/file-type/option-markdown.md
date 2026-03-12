---
title: Option Markdown File
description: A selectable knowledge option with YAML frontmatter and rich body content
order: 6
---

# Option Markdown File — Complete Reference

Located at `knowledge/{domain}/{field}/{slug}.md`. Each file represents one selectable option for a field.

## Full Schema

```markdown
---
title: {Display Title}
description: {Short one-line description shown in selector UI}
order: {integer sort order, 1 = first}
---

# {Title}

{Introductory paragraph giving context for this option.}

## Key Characteristics
- {Bullet: defining trait 1}
- {Bullet: defining trait 2}
- {Bullet: defining trait 3}

## Best Practices
- {Actionable recommendation 1}
- {Actionable recommendation 2}

## When to Choose This Option
- {Scenario or condition 1}
- {Scenario or condition 2}

## Implications / Considerations
- {Downstream effect or important caveat 1}
- {Downstream effect or important caveat 2}
```

## Frontmatter Field Reference

| Field | Type | Rules |
|---|---|---|
| `title` | string | Human-readable display name, Title Case |
| `description` | string | One sentence, ~60-80 chars, shown as subtitle in selector |
| `order` | integer | Sort position (1 = first). Sequential, no gaps needed. |

## File Naming Rules

| Rule | Detail |
|---|---|
| Format | `kebab-case` |
| Extension | `.md` |
| No spaces | Use hyphens instead (e.g., `small-class.md` not `small class.md`) |
| Slug = filename | The filename without `.md` is the slug used in `default` |
| Unique per field | No duplicate filenames within a field folder |

**Examples of good slugs:**
- `beginner.md`, `intermediate.md`, `advanced.md`
- `small-team.md`, `large-enterprise.md`
- `react.md`, `vue.md`, `angular.md`

## Content Quality Guide

The body of the option file is **injected verbatim** into the agent's context. Write it as a briefing document for an expert:

### ✅ Rich, actionable content (aims for 150-400 words)
```markdown
# Advanced Experience Level

## Key Characteristics
- Deep familiarity with core concepts and standard patterns
- Comfortable with edge cases, performance trade-offs, and system design
- Often self-directed — prefers concise, reference-style answers over step-by-step tutorials

## Communication Style
- Skip basic definitions; assume prerequisite knowledge
- Lead with the answer, follow with rationale
- Provide code examples using idiomatic patterns, not simplified versions
- Flag non-obvious gotchas and subtle distinctions

## What This User Values
- Accuracy over simplicity
- Nuance over brevity
- Being treated as a peer, not a student
```

### ❌ Weak content (too sparse to be useful)
```markdown
# Advanced

The user is advanced.
```

## Validation

- ✅ Frontmatter is valid YAML (proper indentation, no tabs)
- ✅ All three frontmatter fields present (`title`, `description`, `order`)
- ✅ Body content is substantive (at least 3-4 bullet points or a paragraph)
- ✅ `order` is an integer (not a string, not a float)
- ✅ Filename uses kebab-case only
- ✅ `title` in frontmatter matches the `# Heading` in body (for consistency)
- ✅ No trailing spaces on lines (can break YAML parsing)
