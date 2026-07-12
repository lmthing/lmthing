# The `instruct.md` file

`agents/<slug>/instruct.md` is the required-ish core file of an agent: a YAML frontmatter block followed by a Markdown operating-instructions body, both read by `loadAgent` (`sdk/org/libs/core/src/spaces/load.ts:431-568`). The file is split into `{ data, body }` by `parseFrontmatter`, which throws on malformed YAML (`sdk/org/libs/core/src/spaces/frontmatter.ts` `parseFrontmatter`). The whole file is optional — `loadAgent` guards the read with `fileExists(instructPath)` and falls back to an empty body and `title = slug` if absent (`sdk/org/libs/core/src/spaces/load.ts:440-456`).

## Structure

An `instruct.md` is `---`-delimited frontmatter, then Markdown:

- The frontmatter `data` is parsed against a fail-loud allow-list — any key outside `AGENT_FRONTMATTER_ALLOWED_KEYS` (`title`, `knowledge`, `functions`, `components`, `actions`, `defaultAction`, `canDelegateTo`, `dependencies`, `capabilities`, `model`, `triggers`) throws (`sdk/org/libs/core/src/spaces/load.ts:413-466`). The frontmatter fields themselves are documented in [frontmatter.md](./frontmatter.md).
- The `body` (everything after the closing `---`) is captured verbatim into `instructBody` (`sdk/org/libs/core/src/spaces/load.ts:459`).

## The body is the operating instructions (system prompt)

The Markdown body is the agent's orchestration/routing instructions, injected into the system prompt as a `# Agent Instructions` section by `buildSystemBlock` (`sdk/org/libs/core/src/context/system-block.ts:232-234`). It is placed after the agent's charter, which is rendered as `# Agent` immediately before it (`sdk/org/libs/core/src/context/system-block.ts:229-231`).

The instruct body is top-level (and delegate) only — unlike `charter.md`, which is fork-safe identity/guardrails also injected into every fork; see [charter-file.md](./charter-file.md) for that split (`sdk/org/libs/core/src/context/system-block.ts:227-234`).

## `actions[]` — id / label / description / tasklist

The frontmatter `actions:` list is parsed into `ActionDef` objects, each with `id`, `label`, `description`, and `tasklist` (all coerced to strings, defaulting to `''`) (`sdk/org/libs/core/src/spaces/load.ts:493-505`). `ActionDef` is declared with exactly those four string fields (`sdk/org/libs/core/src/spaces/load.ts` `ActionDef`). Each action is rendered into the system prompt under `# Actions` as `` `<id>` — **<label>**: <description> (tasklist: <tasklist>)`` (`sdk/org/libs/core/src/context/system-block.ts:237-242`).

Every `action.tasklist` must resolve to a loaded tasklist in the same space, or `loadSpace` throws at load time (`sdk/org/libs/core/src/spaces/load.ts:661-668`). Tasklists themselves are documented in [../tasklists/README.md](../tasklists/README.md).

## `defaultAction` — the freeform / host-driven fallback

`defaultAction` names an action `id` and is read verbatim from frontmatter (`sdk/org/libs/core/src/spaces/load.ts:471`). When a top-level session starts and the running agent declares a `defaultAction` whose action has a tasklist, the session takes a host-driven fast path: it runs that action's tasklist via the reliable delegate path (`ctx.runDelegate`) instead of the model-driven turn loop, which auto-captures the tasklist result (`sdk/org/libs/core/src/session/session.ts:308-329`). The action is resolved by matching `a.id === agent.defaultAction && a.tasklist` (`sdk/org/libs/core/src/session/session.ts:315-317`).

This routing is bypassed when the `noDefaultAction` session option is set, restoring the freeform model-driven turn loop (`sdk/org/libs/core/src/session/session.ts:315`; `sdk/org/libs/core/src/session/types.ts:41`).

> UNVERIFIED: the doc-role phrasing "defaultAction is the freeform fallback." In code `defaultAction` selects the host-driven *structured* fast path; the freeform model-driven loop is what runs when `defaultAction` is absent or `noDefaultAction` is set. The wording above reflects the code behavior (`sdk/org/libs/core/src/session/session.ts:308-329`), not the prompt's "freeform fallback" gloss.

## Worked example

Adapted from the real architect agent (`sdk/org/libs/core/system-spaces/system-architect/agents/architect/instruct.md:1-40`):

````markdown
---
title: Architect
knowledge:
  - space_format/frontmatter
functions:
  - writeAgentFile
  - validateSpace
components: []
defaultAction: synthesize_and_run
actions:
  - id: synthesize_and_run
    label: Synthesize & Run Agent
    description: Research the domain, design, scaffold, validate, register, and run a new specialist agent
    tasklist: synthesize_and_run
  - id: iterate_space
    label: Iterate on Existing Space
    description: Reconstruct, improve, re-scaffold, re-register, and re-run an existing synthesized agent
    tasklist: iterate_space
canDelegateTo:
  - "registered:*"
  - system-research/researcher
---

You have exactly TWO jobs, each a short fixed program. Pick the one that matches
the request and emit ONLY its statements. The heavy lifting happens INSIDE the
tasklist — the host runs every step for you.
````

Here `defaultAction: synthesize_and_run` points at the first action, whose `tasklist: synthesize_and_run` makes the session run that tasklist host-driven on start (`sdk/org/libs/core/src/session/session.ts:315-329`).

## Related

- [frontmatter.md](./frontmatter.md) — the canonical spec for every frontmatter key.
- [charter-file.md](./charter-file.md) — `charter.md`, the fork-safe identity injected before these instructions.
- [../tasklists/README.md](../tasklists/README.md) — the tasklists that `actions[].tasklist` / `defaultAction` reference.
- [delegation.md](./delegation.md) — `canDelegateTo` and the delegate path used by `defaultAction`.
