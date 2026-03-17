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

## Knowledge Tree in System Prompt

When a space is loaded (via `--space` CLI flag or `knowledgeLoader` session option), the system prompt includes a `## Knowledge Tree` section after `## Available Functions`. This section shows the space's knowledge directory as an ASCII tree:

```
knowledge/
├── cuisine/          🌍 Cuisine — World cuisine traditions
│   └── type             [select] cuisineType — Which cuisine tradition
│       ├── italian       Italian — Mediterranean cooking
│       ├── japanese      Japanese — Precision-driven cooking
│       └── mexican       Mexican — Bold, layered flavors
└── dietary/          🥗 Dietary Needs — Dietary restrictions
    └── restriction       [multiSelect] dietaryRestriction — Which restrictions
        ├── vegetarian    Vegetarian — No meat or fish
        └── gluten-free   Gluten-Free — No wheat, barley, rye
```

The tree is built at session init from `buildKnowledgeTree(knowledgeDir)` and formatted via `formatKnowledgeTreeForPrompt(tree)`. It is static for the session — it does not change as the agent loads knowledge files.

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

## Knowledge Content Decay (Strategy 3)

Knowledge files loaded via `loadKnowledge()` contain large markdown documents. When the agent reads them via `stop()`, the content bloats the context window. The knowledge decay system progressively truncates this content based on distance from the current turn.

### How it works:
1. `loadKnowledge()` tags its return value with a Symbol (`KNOWLEDGE_TAG`)
2. When `stop()` is called and the payload contains tagged values, the agent-loop records the message index, turn number, and original `KnowledgeContent`
3. On each `refreshSystemPrompt()`, the agent-loop rebuilds older knowledge-containing stop messages with decayed content

### Decay tiers:

| Distance | Level | What shows |
|----------|-------|------------|
| 0 turns | **full** | Complete markdown content |
| 1–2 turns | **truncated** | First ~300 chars per file + "...(truncated, N chars)" |
| 3–4 turns | **headers** | Just markdown headings: "# Title \| ## Section 1 \| ## Section 2" |
| 5+ turns | **names** | Just file paths: "[knowledge: cuisine/type/italian, dietary/restriction/vegetarian]" |

### Implementation:
```ts
// In context/knowledge-decay.ts
const KNOWLEDGE_TAG = Symbol.for('lmthing:knowledge')

function tagAsKnowledge<T extends object>(obj: T): T
function isKnowledgeContent(value: unknown): boolean
function decayKnowledgeValue(content: KnowledgeContent, distance: number): string
function getKnowledgeDecayLevel(distance: number): 'full' | 'truncated' | 'headers' | 'names'
```

### Agent-loop integration:
- `knowledgeStops` array tracks which messages contain knowledge + the original content
- `decayKnowledgeMessages()` called from `refreshSystemPrompt()` rebuilds those messages at the current decay level
- Non-knowledge keys in the same stop payload are preserved as-is

## Token Budget Enforcement

If still over `maxContextTokens` after all strategies:
1. Evict more code turns (never current)
2. Shrink "full" stop window from 2→1→0
3. Reduce scope value width from 50→30 chars
4. Summarize function/component signatures to names + return types
