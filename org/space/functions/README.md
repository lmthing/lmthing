# `functions/<fnName>.ts` — deterministic helper

A plain TS module exporting a function whose name matches the file. **No frontmatter, no LLM** —
pure/deterministic logic an agent calls. An agent may only call a function it lists in its
`functions:` frontmatter (see [../agents/](../agents/)).

## Format

```ts
/** Lenient RSS/Atom parser — degrades to [] rather than throwing. */
export function parseFeedEntries(xml: string): { title: string; url: string; excerpt?: string }[] {
  if (!xml || typeof xml !== 'string') return [];
  // …
}
```

## Two roles

1. **Deterministic helpers** — parsing, scoring, deduping, formatting: work that needs no model
   judgment, kept out of the LLM loop (`parseFeedEntries`, `dedupeByUrl`, `scoreRelevance`,
   `formatCitation`). A [tasklist step](../tasklists/) or an agent turn calls them by name.
2. **Integration provider-wrappers** — for a store integration space, the functions are thin
   wrappers (`slackPostMessage`, `slackListChannels`, …) that issue an authenticated request the
   pod pins to the provider's API (SSRF-pinned) and attaches the user's own token via
   `callConnection` — the agent never sees the token or builds URLs itself.

## Notes

- Exposed to an agent's turn only when named in `functions:`; also gated per-task by a task's
  `functions:` allowlist ([../tasklists/](../tasklists/)), which additionally gates system functions
  like `webFetch`/`webSearch`/`fetch`.
- The store manifest extracts each function's `name`, a one-line `summary`, and its `signature`
  into the space's catalog entry.
- A hook **cannot** import a space's functions — shared logic used by a project [hook](../../project/hooks/)
  is copied into the hook file rather than referenced.

Real examples: `store/projects/blog/spaces/newsroom/functions/parseFeedEntries.ts`,
`store/spaces/integration-slack/functions/slackPostMessage.ts`.
