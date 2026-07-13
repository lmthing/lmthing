# `agents/<slug>/` — the AI specialists

Each agent is a directory `agents/<agent-slug>/`; the loader reads up to **two** files from it, `instruct.md` then `charter.md` `sdk/org/libs/core/src/spaces/load.ts#loadAgent`.

- **`charter.md`** — persona / identity preamble; its body is read (frontmatter, if any, is stripped) and trimmed `sdk/org/libs/core/src/spaces/load.ts:548-553`. Both files are optional — `loadAgent` defaults `title` to the slug and leaves bodies empty when a file is absent `sdk/org/libs/core/src/spaces/load.ts:440-456`.
- **`instruct.md`** — YAML frontmatter (config) followed by the operating-instructions markdown body `sdk/org/libs/core/src/spaces/load.ts:456-459`.

## `charter.md` — persona preamble

Fork-safe identity and hard guardrails. Its body is prepended to the system prompt under a `# Agent` heading `sdk/org/libs/core/src/context/system-block.ts:229-231`. Detail → [charter-file.md](./charter-file.md).

A real one (the blog newsroom's Fetcher) `store/projects/blog/spaces/newsroom/agents/fetcher/charter.md:1`:

> You are the Fetcher for the lmthing.blog newsroom. You poll active sources and record new raw items. You never fabricate URLs, titles, or excerpts — only what you actually fetched. You do not write articles; synthesis happens downstream.

## `instruct.md` — config + instructions

The frontmatter is parsed by `parseFrontmatter` (which throws on malformed YAML) `sdk/org/libs/core/src/spaces/frontmatter.ts#parseFrontmatter`, and the remaining body becomes the `instructBody` `sdk/org/libs/core/src/spaces/load.ts:457-459`. The body is prepended to the system prompt under a `# Agent Instructions` heading, immediately after the charter `sdk/org/libs/core/src/context/system-block.ts:232-234`.

### Allowed frontmatter keys

The frontmatter is validated against a fixed allow-list — `title`, `knowledge`, `functions`, `components`, `actions`, `defaultAction`, `canDelegateTo`, `dependencies`, `capabilities`, `model`, `triggers` `sdk/org/libs/core/src/spaces/load.ts#AGENT_FRONTMATTER_ALLOWED_KEYS`. **Any key outside this set throws and aborts the whole space load** — most importantly a typo'd `capabilities`/`canDelegateTo` that would otherwise silently grant nothing `sdk/org/libs/core/src/spaces/load.ts:461-466`. Full field reference → [frontmatter.md](./frontmatter.md).

### Worked example — Fetcher's `instruct.md`

Adapted from `store/projects/blog/spaces/newsroom/agents/fetcher/instruct.md:1-20`:

```yaml
---
title: Fetcher                       # display name (defaults to slug)
defaultAction: refresh               # host-driven default: runs this action's tasklist on a freeform start
actions:                             # invocable actions
  - id: refresh
    label: Refresh sources
    description: Poll every active source and record any genuinely new items as raw_items.
    tasklist: refresh                # runs tasklists/refresh/ (optional)
knowledge:                           # refs into knowledge/ (<domain>/<field>)
  - journalism/source-evaluation
functions:                           # refs to functions/*.ts this agent may call
  - parseFeedEntries
  - dedupeByUrl
  - extractImage
capabilities:                        # project-app grants
  - db:read:  { tables: [sources, raw_items] }
  - db:write: { tables: [raw_items, sources] }
---

## Action: refresh
Poll every active source … (system prompt body)
```

### The keys, and where each is documented

- **`title`** — display name; defaults to the slug `sdk/org/libs/core/src/spaces/load.ts:442,470`.
- **`actions`** — each entry is normalized to `{ id, label, description, tasklist }`; the optional `tasklist` names a slug under [../tasklists/](../tasklists/README.md), and with no tasklist the action runs freeform `sdk/org/libs/core/src/spaces/load.ts:493-505`. Actions are rendered into the prompt under `# Actions` `sdk/org/libs/core/src/context/system-block.ts:237-242`.
- **`defaultAction`** — names an action `id`, read verbatim `sdk/org/libs/core/src/spaces/load.ts:471`. When a session starts freeform (no explicit action, and not `noDefaultAction`) and that action has a `tasklist`, the host runs the tasklist **host-driven** via the reliable delegate path instead of the model-driven turn loop — a structured fast path, not a freeform one `sdk/org/libs/core/src/session/session.ts:315-329`. See [instruct-file.md](./instruct-file.md).
- **`knowledge` / `functions` / `components`** — string ref lists into `knowledge/`, `functions/*.ts`, and `components/` `sdk/org/libs/core/src/spaces/load.ts:473-475`; unresolved refs fail the space load `sdk/org/libs/core/src/spaces/load.ts:684-719`. See [../knowledge/README.md](../knowledge/README.md), [../functions/README.md](../functions/README.md), [../components/README.md](../components/README.md).
- **`canDelegateTo`** (or deprecated `dependencies`) — the delegation policy, kept tri-state (omitted / `[]` / list) `sdk/org/libs/core/src/spaces/load.ts:477-492`. Detail → [delegation.md](./delegation.md).
- **`capabilities`** — project-app grants parsed into `AppCapabilities` `sdk/org/libs/core/src/spaces/load.ts:468`. Detail → [capabilities.md](./capabilities.md).
- **`model`** — optional per-agent model alias/spec, trimmed and kept only when a non-empty string `sdk/org/libs/core/src/spaces/load.ts:472`. It takes effect **when the agent is delegated to**: `runDelegate` runs that agent's turns on `agent.model ?? opts.model`, so a specialist can demand its own model regardless of the caller's `sdk/org/libs/core/src/delegate/delegate.ts:101-105` · `sdk/org/libs/core/src/delegate/delegate.ts:390`. `system-vision`'s agent uses exactly this (`model: vision`) `sdk/org/libs/core/system-spaces/system-vision/agents/vision/instruct.md:1-5`. The string is resolved lazily per turn — first as an alias via `LM_MODEL_<NAME>`, otherwise taken as a literal spec `sdk/org/libs/cli/src/cli/bin.ts:316-329` · `sdk/org/libs/cli/src/providers/aliases.ts#resolveAlias`. A session's **own** turns always run on the session's model alias, so `model:` on the session's top-level agent does not change them `sdk/org/libs/core/src/session/session.ts:221`.
- **`triggers`** — legacy inbound webhook bindings (`webhook: { path, provider? }`), each validated against a URL-safe path pattern `sdk/org/libs/core/src/spaces/load.ts:506-544`. The CLI scans every installed space's agents and emits one manifest binding per trigger — `path`, `provider` (defaulting to `generic`) and `agentRef` = `<spaceId>/<agentSlug>` — which is published to the gateway so an external call can wake the pod `sdk/org/libs/cli/src/server/webhook-manifest.ts#scanSpaceTriggers` · `sdk/org/libs/cli/src/server/webhook-manifest.ts:191`. "Legacy" is the manifest's own classification: these bindings carry `kind: 'legacy'`, as opposed to the webhook **emitter defs** in `events/*.ts` `sdk/org/libs/cli/src/server/webhook-manifest.ts#WebhookBinding`. See [../events/README.md](../events/README.md).

Neither `model` nor `triggers` has a dedicated sub-doc; both are covered by the key reference in [frontmatter.md](./frontmatter.md).

## Real examples

- `store/projects/blog/spaces/newsroom/agents/fetcher/{charter,instruct}.md` — a project-app specialist with `db:read`/`db:write` grants `store/projects/blog/spaces/newsroom/agents/fetcher/instruct.md:1`.
- `.lmthing/system/spaces/user-thing/agents/thing/instruct.md` — the top-level THING orchestrator, whose `canDelegateTo` lists specialist agents plus `registered:*` `.lmthing/system/spaces/user-thing/agents/thing/instruct.md:1-11`.

## See also

- [charter-file.md](./charter-file.md) — the persona preamble
- [instruct-file.md](./instruct-file.md) — the config + instructions body
- [frontmatter.md](./frontmatter.md) — every frontmatter field
- [capabilities.md](./capabilities.md) — the `capabilities:` grant model
- [delegation.md](./delegation.md) — the `canDelegateTo:` policy
