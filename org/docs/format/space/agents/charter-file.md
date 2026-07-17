# The `charter.md` special file

`agents/<slug>/charter.md` is the agent's **fork-safe identity**: its persona, voice, and guardrails, written as plain markdown that is prepended to the system prompt of both the top-level session and every fork. It is optional and sits beside [`instruct.md`](./instruct-file.md) in the agent directory `agents/<slug>/` (`sdk/org/libs/core/src/spaces/load.ts:437-439`, `:548`).

## Location and loading

The loader reads `agents/<slug>/charter.md` when the file exists; a missing charter is fine (the field stays empty) (`sdk/org/libs/core/src/spaces/load.ts:547-553`). The raw file is passed through `parseFrontmatter` and only its `body` is kept, trimmed, as `charterBody` on the `AgentDef` (`sdk/org/libs/core/src/spaces/load.ts:550-559`).

## Plain markdown, NO frontmatter

A charter is plain markdown prose — it carries no structured frontmatter of its own; the loader takes only the body and discards any `data` returned by the parser (`sdk/org/libs/core/src/spaces/load.ts:551-552`). Because it is fed through `parseFrontmatter`, a leading `---` fence would still be stripped, but no charter key is read, so any front-matter you add is silently ignored rather than validated (`sdk/org/libs/core/src/spaces/load.ts:551`). The agent-frontmatter allow-list and its fail-loud check apply to `instruct.md`, not to `charter.md` (`sdk/org/libs/core/src/spaces/load.ts:456-465`).

## Prepended to the system prompt

In the top-level session, `buildSystemBlock` pushes the charter as a `# Agent` section, immediately before the `# Agent Instructions` section built from `instruct.md` (`sdk/org/libs/core/src/context/system-block.ts:227-234`). The charter is emitted only when `charterBody` is non-empty (`sdk/org/libs/core/src/context/system-block.ts:229-231`).

## Injected into every fork (instructions are not)

The charter is the identity carried into isolated task forks: `session.ts` resolves the running agent's `charterBody` and passes it as `parentAgentCharter` into the fork engine (`sdk/org/libs/core/src/session/session.ts:731-741`), as does the delegate path (`sdk/org/libs/core/src/delegate/delegate.ts:299`). The fork renders it back as a `# Agent` section ahead of the task instruction (`sdk/org/libs/core/src/fork/fork.ts:361-363`). `instruct.md` is deliberately **not** injected into forks because it carries `ask`/`delegate`/UI prose a fork cannot honor — the charter is what "an isolated task knows who it works for" (`sdk/org/libs/core/src/fork/fork.ts:358-363`). Keep charters short and free of that orchestration prose for this reason (`sdk/org/libs/core/src/context/system-block.ts:227-228`).

## Persona, identity, voice, guardrails

A charter states who the agent is, the voice it speaks in, and the hard guardrails it must always obey — content that must hold in every execution context. A real one: the Data Modeler charter declares its least-privilege role, its authoring tools, and negative guardrails ("never invent a column…never fabricate a relation") (`.lmthing/system/spaces/system-appbuilder/agents/data-modeler/charter.md`). The store integration agents do the same — the Slack charter fixes identity ("You are the Slack integration agent"), a data-honesty guardrail ("never invent channels, messages, authors"), and a fallback behavior, all as plain prose (`store/spaces/integration-slack/agents/slack/charter.md`).

## Worked example

A complete, real charter — plain markdown, no frontmatter (`.lmthing/system/spaces/system-appbuilder/agents/data-modeler/charter.md`):

```markdown
You are the Data Modeler — a least-privilege specialist that designs a project's data model as
JSON table schemas (`database/<table>.json`). Every table, every column, and every relation MUST
carry a real, human-readable `description` (the schema is the app's mental model of its data, not
just its shape). You author schemas with the injected `writeProjectTable(name, schema)` global (a
synchronous `{ ok }` call) and read existing tables via `db`. You never invent a column that the
request does not justify, and you never fabricate a relation to a table that does not exist.
```

## See also

- [`instruct-file.md`](./instruct-file.md) — the top-level-only orchestration/routing counterpart.
- [Agents README](./README.md) — the full agent directory layout.
