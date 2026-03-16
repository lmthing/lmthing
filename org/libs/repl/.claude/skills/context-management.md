# Context Management — Implementation Guide

## Overview

Manages the agent's context window through two mechanisms: workspace state generation (`{{SCOPE}}` table) and progressive compression (code window + stop payload decay).

**Full specification:** [docs/host-runtime-contract/workspace-and-context.md](../../docs/host-runtime-contract/workspace-and-context.md)

## SCOPE Table Generation

The `{{SCOPE}}` block is replaced in the system prompt on every context injection. It shows all user-declared variables with types and truncated values.

### When to regenerate:
- `stop()` called (before injecting payload)
- Error occurs (before injecting error)
- User intervention (before injecting message)
- Optionally: every ~20 lines during uninterrupted execution

### Implementation:
```ts
interface ScopeEntry {
  name: string
  type: string       // typeof result or constructor name
  value: string      // truncated serialized value
}

function generateScopeTable(sandbox: vm.Context): string
function describeType(val: any): string    // "Array<Object>", "string", "null", etc.
function truncateValue(val: any, maxLen: number = 50): string
```

### Size Limits:
| Constraint | Limit |
|-----------|-------|
| Max variables shown | 50 |
| Max value column width | 50 characters |
| Array element preview | First 3 elements |
| Object key preview | First 5 keys |
| Nested depth | 2 levels max |
| Total scope block size | ~3000 tokens |

## System Prompt Mutation

The scope block is replaced **in the system message**, not appended. This keeps it in a fixed location:

```ts
function updateSystemPrompt(template: string, sandbox: vm.Context): string {
  const scopeBlock = generateScopeTable(sandbox)
  return template.replace(/{{SCOPE}}[\s\S]*?(?=┌|{{|$)/, scopeBlock)
}
```

## Code Window Compression (Strategy 1)

Sliding window over assistant turns. Only the most recent N lines kept verbatim; older code replaced with summary comments.

- `codeWindowLines`: default 200 (max total lines kept verbatim)
- Most recent turn is **never** summarized
- Summary format: `// [lines N-M executed] declared: varA (Type), varB (Type)`

## Stop Payload Decay (Strategy 2)

Progressive truncation by distance from current turn:

| Distance | Treatment | Example |
|----------|-----------|---------|
| 0-2 turns | **Full** | `← stop { input: { "zipcode": "94107" } }` |
| 3-5 turns | **Keys only** | `← stop { input: Object{zipcode,radius} }` |
| 6-10 turns | **Summary** | `← stop (2 values read)` |
| 11+ turns | **Removed** | Turn dropped entirely |

Error injections follow the same decay. User intervention messages are **never** truncated.

## Token Budget Enforcement

If still over `maxContextTokens` after both strategies:
1. Evict more code turns (never current)
2. Shrink "full" stop window from 2→1→0
3. Reduce scope value width from 50→30 chars
4. Summarize function/component signatures to names + return types
