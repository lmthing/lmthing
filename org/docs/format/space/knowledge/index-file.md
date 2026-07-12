# Knowledge field `index.md` (special file)

A knowledge field is a directory `knowledge/<domain>/<field>/` whose `index.md` is the field's header: frontmatter that names the binding + type, and a body that is the field's **overview** (`sdk/org/libs/core/src/spaces/load.ts:280-314`). The other `.md` files in the directory are the field's aspect options, loaded on demand (`sdk/org/libs/core/src/spaces/load.ts:290-299`). See [`README.md`](./README.md) for the domain/field/aspect layout and [`aspect-file.md`](./aspect-file.md) for the option files.

## Location and role

`loadKnowledge` walks `knowledge/<domain>/<field>/` and reads `index.md` (when present) as field metadata (`sdk/org/libs/core/src/spaces/load.ts:271-288`); it is not itself an aspect option — the option scan explicitly skips it (`optFile === 'index.md'`, `sdk/org/libs/core/src/spaces/load.ts:294`). A separate domain-level `knowledge/<domain>/index.md` also exists, but only its body is read (as the domain description) — it has no `variable`/`type` frontmatter (`sdk/org/libs/core/src/spaces/load.ts:316-322`); this doc covers the **field** `index.md`.

## Frontmatter keys

The field `index.md` frontmatter is parsed for three keys, all optional (`sdk/org/libs/core/src/spaces/load.ts:283-286`):

- **`variable`** — the binding name the field is exposed under; sets `KnowledgeField.variableName`, defaulting to the field's directory slug when omitted (`sdk/org/libs/core/src/spaces/load.ts:276,285`). It is returned to the agent both in the field-metadata object from `resolveKnowledge` (`sdk/org/libs/core/src/spaces/knowledge.ts:37-42`) and, when the agent loads the field `index.md` at runtime via the `loadKnowledge` global (injected under exactly that one name — there is no alias — at `sdk/org/libs/core/src/exec/bootstrap.ts:188`, declared `loadKnowledge(...path: string[]): Promise<any>` in the model DTS at `sdk/org/libs/core/src/typecheck/library-dts.ts:38`), inside the parsed `frontmatter` object alongside the body (`sdk/org/libs/core/src/globals/load-knowledge.ts:35-45`) — telling the agent what variable name to store the loaded knowledge under.
- **`type`** — the field's declared value type, defaulting to `'string'`; surfaced next to the field in the system prompt (`sdk/org/libs/core/src/spaces/load.ts:275,284`, `sdk/org/libs/core/src/context/system-block.ts:301`).
- **`default`** — an optional default value; stored on the field when present (`sdk/org/libs/core/src/spaces/load.ts:277,286,307-309`).

The field `index.md` frontmatter is **not** run through the option allow-list validator — that validator applies only to the aspect option files (`sdk/org/libs/core/src/spaces/load.ts:293-298,339-353`); unrecognized keys on `index.md` are simply ignored by the runtime parser.

Studio's browser-side VFS parser reads the same file and additionally recognizes three **UI-only** hints that the runtime ignores — `label`, `fieldType` (how to render/ask for the field), and `required` (`sdk/org/libs/state/src/lib/fs/parsers/config.ts:13-34`); the Studio editor writes them back with `serializeKnowledgeFieldIndex` (`sdk/org/libs/state/src/lib/fs/parsers/config.ts:36-44`). They never reach `KnowledgeField` in the runtime, which keeps only `type`/`variableName`/`default`/`description`/`options` (`sdk/org/libs/core/src/spaces/load.ts:301-312`).

## The body is the overview

The `index.md` body (everything after the frontmatter) becomes `KnowledgeField.description` — the field's overview (`sdk/org/libs/core/src/spaces/load.ts:287,310-312`). This overview is inlined into the agent's system prompt as the field summary, with the aspect option files listed as "aspects (load on demand)" — so the overview is what the agent reads first and uses to decide which aspect to pull (`sdk/org/libs/core/src/context/system-block.ts:296-301`). Because the aspects are loaded on demand and the overview is always present, the overview body **should name every aspect file** so the agent knows what each one covers before loading it (`sdk/org/libs/core/src/context/system-block.ts:300-301`).

### There is no `description:` frontmatter key on a field `index.md`

Unlike an aspect option file — where `description` is the *required* frontmatter key (`sdk/org/libs/core/src/spaces/load.ts:331,343-345`) — a field `index.md` has no `description` frontmatter key. The loader reads only `type`, `variable` and `default` from the frontmatter and takes the overview from the **body** (`sdk/org/libs/core/src/spaces/load.ts:283-287`); the browser-side parser does the same (`description` = the trimmed body, `sdk/org/libs/state/src/lib/fs/parsers/config.ts:24,32`). Existing spaces (including the worked example below) do write a `description:` line into the field `index.md` frontmatter, but **nothing reads it**: it is not stored on `KnowledgeField` and never reaches the system prompt. Relevance selection is driven entirely by the body-overview surfaced at `sdk/org/libs/core/src/context/system-block.ts:296-301`. The only way that frontmatter line becomes visible is if the agent loads the field `index.md` directly via the `loadKnowledge` global, which returns the whole raw `frontmatter` object next to the body (`sdk/org/libs/core/src/globals/load-knowledge.ts:35-45`) — the extension-less path `<domain>/<field>` falls back to `<field>/index.md` (`sdk/org/libs/core/src/globals/load-knowledge.ts:55-65`).

Practical consequence: **put the overview in the body.** A `description:` line alone leaves the field with no overview in the system prompt.

## Worked example

From the `newsroom` space's `journalism/source-evaluation` field (`store/projects/blog/spaces/newsroom/knowledge/journalism/source-evaluation/index.md`). The frontmatter names the binding (`variable: sourceEvaluation`); its `description:` line is inert (see above) — the body opens with an overview that then names both aspect files — `credibility-signals.md` and `dedup-and-clustering.md` — which are exactly the two option files in the directory (`store/projects/blog/spaces/newsroom/knowledge/journalism/source-evaluation/` — `credibility-signals.md`, `dedup-and-clustering.md`, `index.md`):

```markdown
---
variable: sourceEvaluation
description: Judging which sources and items are worth polling and citing, and detecting when two items are really the same story...
---

# Evaluating sources and items well

The newsroom's feed is only as trustworthy as the material that enters it...

`credibility-signals.md` covers what makes a source/item worth recording versus
skipping ... `dedup-and-clustering.md` covers the practical mechanics of collapsing
near-duplicate stories via `articles.clusterKey` ...
```

## Related

- [`aspect-file.md`](./aspect-file.md) — the `<slug>.md` option files (frontmatter allow-list: `description` required, `icon`/`color`/`label` optional).
- [`README.md`](./README.md) — knowledge domain/field/aspect layout and on-demand loading.
