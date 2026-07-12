# `functions/<fnName>.ts` — space function (deterministic helper)

A space function is a plain TypeScript module under `<space>/functions/`; the loader reads every `*.ts`/`*.tsx` file, taking the export name from the file's basename (`functions[name] = src`) (`sdk/org/libs/core/src/spaces/load.ts:179-183`). **There is no frontmatter and no model in the loop** — the loader only reads source text (`sdk/org/libs/core/src/spaces/load.ts:168-206`), and the code is injected verbatim into the agent's sandbox VM via `injectSpaceFunctions` (`sdk/org/libs/core/src/exec/bootstrap.ts:121-124`), so a function is ordinary code the agent calls, not an LLM turn. An agent may call a function only if it lists it in its `functions:` frontmatter array, which becomes `config.functions` (`sdk/org/libs/core/src/spaces/load.ts:474`); `functions` is one of the allow-listed agent frontmatter keys and any unknown key fails loud (`sdk/org/libs/core/src/spaces/load.ts:461-466`) — see [../agents/frontmatter.md](../agents/frontmatter.md).

## Format

```ts
/** Lenient RSS/Atom parser — degrades to [] rather than throwing. */
export function parseFeedEntries(xml: string): { title: string; url: string; excerpt?: string }[] {
  if (!xml || typeof xml !== 'string') return [];
  // RSS uses <item>…</item>; Atom uses <entry>…</entry>. Try RSS first, fall back to Atom.
  // …
}
```

(adapted from `store/projects/blog/spaces/newsroom/functions/parseFeedEntries.ts:6-24`)

## Two roles

1. **Deterministic helpers** — parsing, scoring, deduping, formatting: pure logic that needs no model judgment and is kept out of the LLM loop, e.g. the lenient feed parser that returns `[]` instead of throwing on malformed input (`store/projects/blog/spaces/newsroom/functions/parseFeedEntries.ts:6-24`). A [tasklist step](../tasklists/step-file.md) or an agent turn calls it by name.
2. **Integration provider-wrappers** — for a store integration space, the functions are thin `async` wrappers that issue one authenticated request through `callConnection(provider, { method, path, body, … })`, e.g. `slackPostMessage` posting to `/chat.postMessage` (`store/spaces/integration-slack/functions/slackPostMessage.ts:16-25`). `callConnection` is value-yielding: the sandbox supplies only `provider` + `{ method, path, query?, body?, headers? }`, and the gateway attaches the user's OAuth token and pins the outbound host to the provider's API base — the token never enters the sandbox and the agent never builds a URL itself (`sdk/org/libs/core/src/globals/call-connection.ts:15-18`). It is injected only when the agent holds the `connections:use` capability, and its DTS narrows `provider` to the granted providers so an undeclared provider fails typecheck (`sdk/org/libs/core/src/globals/call-connection.ts:8-14`).

## Gating

- **Per-agent**: a function reaches an agent's turn only when named in that agent's `functions:` frontmatter (`config.functions`, `sdk/org/libs/core/src/spaces/load.ts:474`).
- **Per-task (least privilege)**: a [tasklist step](../tasklists/step-file.md) may declare its own `functions:` allowlist (`sdk/org/libs/core/src/spaces/tasklist-load.ts:30-31,136-137`); the fork scopes the parent agent's functions to exactly that list, and an **empty array `[]` means no functions at all** (`sdk/org/libs/core/src/fork/fork.ts:247-260`). Because `webSearch` and `webFetch` are themselves space functions (`sdk/org/libs/core/system-spaces/system-global/functions/webSearch.ts`, `.../webFetch.ts`) merged into the agent's function set (`sdk/org/libs/core/src/session/session.ts:621`), that allowlist gates them too.

## Notes

- The store catalog build lifts each function into the space's catalog entry via a cheap static parse: the exported function `name`, its declaration line as the `signature`, and the first line of any leading block comment as the `summary` (`store/scripts/gen-apps-manifest.mjs:358-387`).
- A **hook cannot import a space function**: each `hooks/<slug>.ts` is transpiled per-file with esbuild `transform` (not a bundler), so there is no cross-file import resolution and shared logic must live inline in the hook (`sdk/org/libs/cli/src/app/hooks/loader.ts:35-37,361`).
- The same loader also backs a project's `<projectRoot>/functions/` scope (a third function scope), which reuses `loadFunctionsFromDir` unchanged (`sdk/org/libs/core/src/spaces/load.ts:163-167`).

Real examples: `store/projects/blog/spaces/newsroom/functions/parseFeedEntries.ts`, `store/spaces/integration-slack/functions/slackPostMessage.ts`.
