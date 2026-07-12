# The `<aspect>.md` file

An **aspect file** is any `.md` file inside a knowledge field directory other than `index.md` — one
option of the field, keyed by its filename slug (`options[optionSlug] = optionPath`, where
`optionSlug = basename(optFile, '.md')`) `sdk/org/libs/core/src/spaces/load.ts:290-297`. The loader
collects every `.md` file in `knowledge/<domain>/<field>/` except `index.md` as an option
`sdk/org/libs/core/src/spaces/load.ts:291-293`. See [`index-file.md`](./index-file.md) for the
field's `index.md` (its frontmatter `variable`/`type`/`default` and prose body).

## Plain markdown, no frontmatter required

An aspect file may be plain markdown with no frontmatter — that is always valid
`sdk/org/libs/core/src/spaces/load.ts:341` (`if (Object.keys(data).length === 0) return`). The two
real newsroom aspect files (`credibility-signals.md`, `dedup-and-clustering.md`) are exactly this:
plain markdown headed by an H1, no frontmatter block
`store/projects/blog/spaces/newsroom/knowledge/journalism/source-evaluation/credibility-signals.md`.

If frontmatter *is* present, it is validated against an allow-list: `description` is required and
must be a non-empty string `sdk/org/libs/core/src/spaces/load.ts:342-344`; `icon`, `color`, and
`label` are the only other permitted keys `sdk/org/libs/core/src/spaces/load.ts:317` (`KNOWLEDGE_OPTION_ALLOWED_KEYS`);
any other key throws fail-loud at load time `sdk/org/libs/core/src/spaces/load.ts:347-352`. This
validation runs both when the field is loaded `sdk/org/libs/core/src/spaces/load.ts:294` and again
when the option is resolved `sdk/org/libs/core/src/spaces/knowledge.ts:56`.

## One aspect of the field each

Each aspect file documents a single facet of its field. In the `source-evaluation` field,
`credibility-signals.md` covers what makes a source or item worth recording versus skipping
`store/projects/blog/spaces/newsroom/knowledge/journalism/source-evaluation/credibility-signals.md`,
while `dedup-and-clustering.md` covers the separate concern of collapsing near-duplicate stories via
`articles.clusterKey`
`store/projects/blog/spaces/newsroom/knowledge/journalism/source-evaluation/dedup-and-clustering.md`.
The field's own `index.md` frames the two aspects as distinct moments and points to each by filename
`store/projects/blog/spaces/newsroom/knowledge/journalism/source-evaluation/index.md`.

## Loaded on demand

Aspect files are *not* read into the agent's context at load time. `loadKnowledge` records only each
option's file **path** in `field.options`, not its content
`sdk/org/libs/core/src/spaces/load.ts:296-297`. The body is read from disk only when the agent
resolves that specific option — `resolveKnowledge(space, [domain, field, option])` calls `readFile`
on the recorded path at resolution time `sdk/org/libs/core/src/spaces/knowledge.ts:53-63`. Resolving
a path with fewer segments returns only an overview: the domain list `sdk/org/libs/core/src/spaces/knowledge.ts:16`,
the field list for a domain `sdk/org/libs/core/src/spaces/knowledge.ts:26-28`, or a field's option
names and metadata `sdk/org/libs/core/src/spaces/knowledge.ts:37-42` — never the aspect bodies.

## Deliberately not collapsed into one `overview.md`

Because each aspect is a separate on-demand file, an agent pulls in only the facet it needs rather
than one large document — the loader deliberately splits a field across many option files keyed by
slug `sdk/org/libs/core/src/spaces/load.ts:290-298`, and resolution fetches exactly one option body
per call `sdk/org/libs/core/src/spaces/knowledge.ts:44-63`.

This is an enforced rule, not merely a convention. The architect's `validateSpace` rejects any
knowledge field a declared agent references that has fewer than two aspect option files, with the
error *"Put the overview in index.md and split detail across multiple options — do NOT use a single
`overview.md`"* `sdk/org/libs/core/system-spaces/system-architect/functions/validateSpace.ts:130-134`,
and it separately requires the field's `index.md` to carry the overview in its body — a body shorter
than 40 characters is an error
`sdk/org/libs/core/system-spaces/system-architect/functions/validateSpace.ts:120-125`. That check
runs as a step of the architect's `synthesize_and_run` tasklist, before the space is registered
`sdk/org/libs/core/system-spaces/system-architect/tasklists/synthesize_and_run/06-validate.md:9-19`.
The same rule is put to the model while it designs the space — a field's `aspects` must be 2–4
distinct sub-topic slugs, explicitly *not* `overview`
`sdk/org/libs/core/system-spaces/system-architect/tasklists/synthesize_and_run/01-design.md:21-22` —
and again while it writes the files: the overview paragraph goes into `index.md` via
`writeKnowledgeIndex`, then one option file per aspect (>= 2) via `writeKnowledgeOption`
`sdk/org/libs/core/system-spaces/system-architect/tasklists/synthesize_and_run/02-build_field.md:26-30`.

## What a real aspect file looks like

Adapted from the newsroom `source-evaluation` field's `dedup-and-clustering.md`
`store/projects/blog/spaces/newsroom/knowledge/journalism/source-evaluation/dedup-and-clustering.md`:

````markdown
# Dedup and clustering

## What `clusterKey` is for

`articles.clusterKey` is a normalized grouping key so that near-duplicate articles collapse
together in digests instead of appearing as several separate entries about the same news.

## Folding vs. keeping separate

When a matching `clusterKey` is found, the default is not to insert a second article — treat the
new raw item as an update to the existing story instead.
````

No frontmatter, one H1, and each `##` section covers one facet of the field — the file is read only
when the agent resolves the `dedup-and-clustering` option
`sdk/org/libs/core/src/spaces/knowledge.ts:53`.

## See also

- [`index-file.md`](./index-file.md) — the field's `index.md` (frontmatter `variable`/`type`/`default`, prose body)
- [`README.md`](./README.md) — the knowledge directory overview
