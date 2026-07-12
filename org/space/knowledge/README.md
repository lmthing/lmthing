# `knowledge/<domain>/<field>/` — load-on-demand docs

Structured domain knowledge an agent pulls in on demand. Referenced from an agent's `knowledge:`
frontmatter as `<domain>/<field>` (see [../agents/](../agents/)). Each field is a directory with an
`index.md` (frontmatter + overview) and one `<aspect>.md` per aspect.

```
knowledge/
└── <domain>/<field>/
    ├── index.md        # frontmatter (variable, description) + overview covering all aspects
    ├── <aspect-a>.md   # one aspect, loaded on demand
    └── <aspect-b>.md   # …several aspects — NOT a single "overview.md"
```

## `index.md`

```md
---
variable: sourceEvaluation      # the binding name the doc is exposed under
description: Judging which sources and items are worth polling and citing, and detecting duplicates.
---

# Evaluating sources and items well
… overview body that names each aspect file (credibility-signals.md, dedup-and-clustering.md) …
```

| Field | Purpose |
|---|---|
| `variable` | The binding name the knowledge is exposed under to the agent. |
| `description` | One-line summary — used to decide relevance when the agent loads knowledge. |

The overview body should cover **every** aspect and name the sibling aspect files, so the agent
knows what it can drill into.

## Aspect files

`<aspect>.md` files (`credibility-signals.md`, `dedup-and-clustering.md`, …) are **plain markdown,
no frontmatter required**. Each covers one aspect of the field and is loaded on demand — deliberately
*not* collapsed into a single `overview.md`.

Real example: `store/projects/blog/spaces/newsroom/knowledge/journalism/source-evaluation/`
(`index.md` + `credibility-signals.md` + `dedup-and-clustering.md`).
