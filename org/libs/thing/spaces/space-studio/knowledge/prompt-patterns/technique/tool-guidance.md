---
title: Tool Guidance
description: Explain when and how to use each tool with examples and guardrails
order: 4
---

# Tool Guidance

Explicitly instruct the agent on when and how to use its available tools. Include examples, expected inputs/outputs, and guardrails for tool usage.

## Structure

1. **Tool listing** — Name each tool the agent can use
2. **Per-tool instructions** — When to use it, what inputs to provide, what to expect
3. **Tool combinations** — Common sequences of tool calls
4. **Guardrails** — When NOT to use certain tools

## Example

```markdown
You have access to these tools:

**read** — Use to examine existing files before modifying them. Always read a file before editing it. Check the current content to understand what you're working with.

**edit** — Use to modify existing files. Prefer targeted edits over full rewrites. Always validate the file structure after editing (valid JSON, correct frontmatter).

**search** — Use to find files by name or content. Search before creating new files to avoid duplicates. Use glob patterns for file names, content search for finding specific text.

**Do NOT:**
- Edit files without reading them first
- Create new files when an existing one could be updated
- Make multiple edits to the same file in rapid succession
```

## When to Use

Tool guidance is essential for agents that have write access (edit, create) or external interactions. Without explicit guidance, agents may use tools inappropriately — editing without reading, creating duplicates, or making unnecessary changes.

## Tips

- Order tools by frequency of use
- Include "when NOT to use" guidance — it's as important as "when to use"
- Show common tool sequences (read → analyze → edit → validate)
- Set expectations for tool outputs so the agent can handle unexpected results
