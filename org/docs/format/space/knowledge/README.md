# `knowledge/` — load-on-demand domain docs

Structured reference material an agent pulls in on demand. The loader walks `<space>/knowledge/`, treating each direct child as a **domain** slug and each of its subdirectories as a **field** slug (`knowledge/<domain>/<field>/`) `sdk/org/libs/core/src/spaces/load.ts#loadKnowledge`. Only directories are considered — a non-directory entry is skipped at both the domain and field level `sdk/org/libs/core/src/spaces/load.ts:266-273`.

```
knowledge/
└── <domain>/
    ├── index.md          # optional domain description (body only)
    └── <field>/
        ├── index.md      # frontmatter (variable, type, default) + overview body
        ├── <aspect-a>.md # one aspect, loaded on demand
        └── <aspect-b>.md # …several aspects — NOT a single "overview.md"
```

## Referenced from an agent as `<domain>/<field>`

An agent opts into knowledge through its `knowledge:` frontmatter list, each entry a slash-joined path (`knowledge: [domain/field]` or `domain/field/option`), parsed into `config.knowledge` `sdk/org/libs/core/src/spaces/load.ts:473`. At space load these refs are validated fail-loud: the loader splits each ref on `/` and throws if the domain, field, or (when given) option does not exist `sdk/org/libs/core/src/spaces/load.ts:699-718`. See [../agents/frontmatter.md](../agents/frontmatter.md).

A **two-part** ref (`domain/field`) is surfaced on demand — the system prompt lists the field, its `index.md` overview, and its aspect files, and the agent fetches an aspect via `loadKnowledge(domain, field, option)` `sdk/org/libs/core/src/context/system-block.ts:295-301`. A **three-part** ref (`domain/field/option`) is instead PRELOADED: the option body is resolved up front and injected directly, and its sibling options are hidden `sdk/org/libs/core/src/context/system-block.ts:286-294`.

## Each field is `index.md` + aspect files

`index.md` frontmatter configures the field: `variable` (the binding/variable name, defaulting to the field slug), `type` (defaulting to `string`), and an optional `default`; the frontmatter **body** becomes the field's overview/description `sdk/org/libs/core/src/spaces/load.ts:280-312`. Every other `.md` file in the field directory (all `.md` except `index.md`) is registered as an **option** (aspect), keyed by its basename `sdk/org/libs/core/src/spaces/load.ts:290-299`.

Aspect files are plain markdown and need no frontmatter `store/projects/blog/spaces/newsroom/knowledge/journalism/source-evaluation/credibility-signals.md:1`. If an aspect *does* carry frontmatter it is validated against an allow-list — `description` is required, `icon`/`color`/`label` are optional, any other key throws `sdk/org/libs/core/src/spaces/load.ts:330-353`.

The field overview body should name each sibling aspect file so the agent knows what it can drill into `store/projects/blog/spaces/newsroom/knowledge/journalism/source-evaluation/index.md:23-27`.

## Loaded on demand

Nothing is read from disk at space-load time except `index.md` and each aspect's frontmatter for validation `sdk/org/libs/core/src/spaces/load.ts:280-299`. Aspect bodies are read only when the agent calls `loadKnowledge(...path)`, a value-yielding global that joins the path segments under the space's knowledge dir and reads the file `sdk/org/libs/core/src/globals/load-knowledge.ts#createLoadKnowledgeGlobal`. The host resolver `resolveKnowledge(space, path)` maps a `[domain]`/`[domain,field]`/`[domain,field,option]` path to a value — a list of domains, a field summary, field metadata, or the resolved option content respectively `sdk/org/libs/core/src/spaces/knowledge.ts#resolveKnowledge`. When an option file has frontmatter its data is returned as a structured object (with `body`); otherwise the plain body/text is returned `sdk/org/libs/core/src/spaces/knowledge.ts:56-61`.

## Worked example

From the real newsroom space `store/projects/blog/spaces/newsroom/knowledge/journalism/source-evaluation/index.md:1-4`:

```md
---
variable: sourceEvaluation
description: Judging which sources and items are worth polling and citing, and detecting duplicates.
---

# Evaluating sources and items well
… overview body that names each aspect file (credibility-signals.md, dedup-and-clustering.md) …
```

This field sits at `knowledge/journalism/source-evaluation/` with siblings `credibility-signals.md` and `dedup-and-clustering.md` `store/projects/blog/spaces/newsroom/knowledge/journalism/source-evaluation/credibility-signals.md:1`. An agent references it as `journalism/source-evaluation` in `knowledge:` frontmatter, then reads a specific aspect with `loadKnowledge('journalism', 'source-evaluation', 'credibility-signals')` `sdk/org/libs/core/src/globals/load-knowledge.ts#createLoadKnowledgeGlobal`.

## See also

- [index-file.md](./index-file.md) — the field `index.md` (frontmatter + overview)
- [aspect-file.md](./aspect-file.md) — the per-aspect option files
- [../agents/frontmatter.md](../agents/frontmatter.md) — the agent `knowledge:` list
