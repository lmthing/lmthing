# The tasklist `index.md` special file

`tasklists/<slug>/index.md` is the **header** of a tasklist directory — its overview body plus optional `input` and `connections` frontmatter — and it is **not a step**: the loader explicitly excludes `index.md` from the node-file list (`sdk/org/libs/core/src/spaces/load.ts:370-377`). Step files (`NN-<id>.md` / `NN-<id>.ts`) are documented in [step-file.md](./step-file.md); the directory as a whole in [README.md](./README.md).

## Role in a tasklist

A tasklist directory's node files are `NN-<id>.md` (agent nodes) and `NN-<id>.ts` (code nodes) interleaved by their `NN` prefix; `index.md` is the tasklist header rather than a node, and `.d.ts` files are never nodes (`sdk/org/libs/core/src/spaces/load.ts:366-377`). `loadTasklists` reads `index.md` when present, taking its body as `description` and parsing `input`/`connections` from frontmatter (`sdk/org/libs/core/src/spaces/load.ts:381-398`). Frontmatter is parsed by `parseFrontmatter`, which throws on malformed YAML (`sdk/org/libs/core/src/spaces/frontmatter.ts` `parseFrontmatter`). The resulting `TasklistDir` carries `{slug, files, description?, input?, connections?}` (`sdk/org/libs/core/src/spaces/load.ts:91-105`).

## The overview body

The Markdown body below the frontmatter becomes `TasklistDir.description` (`sdk/org/libs/core/src/spaces/load.ts:385`). This description is the tasklist's overall goal: the orchestrator threads it into every leaf fork as `tasklistDescription` (`sdk/org/libs/core/src/tasklist/orchestrator.ts:246`), where the fork prompt renders it under a `# Tasklist (overall goal — your task is one step in it)` heading (`sdk/org/libs/core/src/fork/fork.ts:364-365`). So the body is standing context for every step, not decoration.

## The `input` frontmatter contract

`input` is a map of field name → type string; each declared value is coerced to a string when loaded (`sdk/org/libs/core/src/spaces/load.ts:386-392`). At run time the orchestrator validates the runtime `seed` against this schema via `validateInput`, throwing `Tasklist "<name>" received an invalid seed` when any field is missing or mistyped; a tasklist with no declared `input` (or an empty map) accepts any seed (`sdk/org/libs/core/src/tasklist/orchestrator.ts:77-88`).

The recognized type strings are `string`, `number`, `boolean`, `object`, `array`, and `any`; a trailing `?` marks the field optional (an absent or `undefined` value passes, a present value is checked against the base type), and unknown base types are treated leniently (`sdk/org/libs/core/src/tasklist/schema.ts:5-42`). This is the same type-string vocabulary used by step `output`/`input` validation (`sdk/org/libs/core/src/tasklist/schema.ts:75-121`).

A declared `input` schema also acts as a **hard filter**: forks receive only the declared keys, so stray context a delegator packed into the seed never rides into leaf prompts; with no declared schema the full seed passes through (`sdk/org/libs/core/src/tasklist/orchestrator.ts:90-99`).

## The `connections` frontmatter gate

`connections` is a string list parsed off `index.md` frontmatter (`sdk/org/libs/core/src/spaces/load.ts:395-397`). Core records it as typed data only and does **not** enforce it — enforcement is the CLI/pod's job (`sdk/org/libs/core/src/spaces/load.ts:101-104`). The pod-side gate lives in `tasklist-runner.ts`: a code node's `ctx.callConnection` is locked to the tasklist's declared `connections:` **intersected** with the owning space's own provider(s) (`sdk/org/libs/cli/src/server/tasklist-runner.ts:22-26`). The space's own providers come from `<spaceDir>/package.json` `lmthing.connection.provider` (`sdk/org/libs/cli/src/server/tasklist-runner.ts:51-64`); the declared list is re-read from `index.md` (`sdk/org/libs/cli/src/server/tasklist-runner.ts:66-76`); the allowed set is `declared ∩ own` (`sdk/org/libs/cli/src/server/tasklist-runner.ts:98-102`). A `callConnection` to a provider outside that set throws, and if the intersection is empty every `callConnection` throws (`sdk/org/libs/cli/src/server/tasklist-runner.ts:116-124`).

The same `declared ∩ own` shape gates a space *hook*'s `ctx.callConnection` (`sdk/org/libs/cli/src/server/routes/hooks.ts:226-232`), so the two enforcement points agree.

No shipped tasklist declares a `connections:` key: every `index.md` under `store/projects/`, `.lmthing/system/spaces/` and `sdk/org/libs/core/system-spaces/` omits it, and no shipped code node calls `ctx.callConnection` — so in practice every shipped space tasklist runs with an empty allowed set. The gate is nonetheless live and enforced end to end: a fixture space whose own provider is `demo` runs a tasklist that declares no `connections:` and whose code node calls `ctx.callConnection('slack')` (`sdk/org/libs/cli/src/server/tasklist-runner.test.ts:64-77`), and the run is asserted to reject (`sdk/org/libs/cli/src/server/tasklist-runner.test.ts:119-131`).

Note that a space's "own" providers are read *only* from its `lmthing.connection` descriptor, while `slack`, `github` and `google` are built-in providers that no space declares (`sdk/org/libs/cli/src/server/connections.ts:41-46`). A tasklist in one of those integration spaces therefore cannot reach its own provider from a code node even if it declares `connections: [slack]` — the intersection is empty.

## Worked example

A real header — `store/projects/trips/spaces/finance/tasklists/hunt-deals/index.md` — declaring one typed input plus the overview body:

````markdown
---
input:
  tripId: string
---

Scan one trip's cost surfaces (destinations, transit legs, costed itinerary items) for savings
opportunities, then write any newly-found ones as `deals` rows — advisory only, never a booking.
````

Here `runTasklist` requires the seed to contain a string `tripId` and rejects any other seed shape (`sdk/org/libs/core/src/tasklist/orchestrator.ts:81-88`); the body is injected into each step fork as the overall goal (`sdk/org/libs/core/src/fork/fork.ts:364-365`). An empty `input: {}` (as in `store/projects/blog/spaces/newsroom/tasklists/refresh/index.md`) declares no fields and accepts any seed (`sdk/org/libs/core/src/tasklist/orchestrator.ts:77-80`).

## See also

- [step-file.md](./step-file.md) — the `NN-<id>.md` / `NN-<id>.ts` step files this header sits above.
- [README.md](./README.md) — the tasklist directory as a whole.
