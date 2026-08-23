# `@lmthing/dsh-space-components`

Exposes an agent's declared `components:` (LMThing's `components/view/*.tsx` +
`components/form/*.tsx`) as ONE dsh `display` tool — matching LMThing's own `display()` global 1:1.

```
{ spaceDir, agentSlug }  ->  display({ component: <enum of declared names>, props: <json> })
```

- `src/resolve.js` — `resolveComponents(spaceDir, agentSlug)` → `[{ name, kind: 'view'|'form', source }]`.
- `src/props-schema.js` — `extractPropsSchema(source, componentName)` → a dsh `ParameterSchemaSpec`
  or `null`. Static TypeScript AST parse, never executes the source.
- `src/index.js` — the plugin. Mounts **nothing** when the agent declares no components.

## Scope boundary: this does not render real UI

A `display` call is a structured **declaration** — "I am responding with component X and these
props" — returned as the canonical tool value and shown as a generic acknowledgment card. That is
the same fidelity LMThing's own shipped product has today (its own docs note space-authored `view`
components are never actually rendered as real React there either, only carried as
prompt/typecheck metadata). Real `ConversationNodeDefinition` mounting in the dsh Web Client is
the separate, further-out `client-space-components` roadmap item.

## Why `props` is an open `json` parameter

dsh's schema DSL has `string/number/integer/boolean/null/array/object/json/oneOf` and no
conditional "if `component === X` then `props` has shape Y", so a per-component prop shape is not
expressible in one static tool declaration. Where `extractPropsSchema` succeeded, that schema is
applied as **soft, in-body validation** instead: a mismatch comes back as a visible `warnings`
entry on the result (useful authoring feedback), never as a tool error. The extracted prop list is
also projected into the tool description, so the model still sees the types.

## `props-schema.js` is fail-SOFT — deliberately the opposite of `space-tasklist`

`space-tasklist`'s compiler *refuses to compile* when it meets a field it cannot honor
(`capabilities`, `canDelegateTo`, `onFail`, …), because silently dropping one would hand a node
privileges or a failure path its author never asked for — a real correctness/privilege boundary.

**Nothing in this package is a boundary.** A prop type the extractor misses costs only precision:
the tool still works, the model still passes whatever props it likes through the open `props: json`
parameter. So `extractPropsSchema` never throws and never aborts on a surprise:

- one unrecognized/untyped property → that property alone is dropped, the rest still extract;
- a shape it cannot read at all → `null` for the whole component, i.e. fall back to open `props`.

Do not "fix" this into a fail-loud check by analogy with the tasklist compiler. The two policies
differ on purpose; the family does **not** follow one uniform policy.

## Known v1 limitations (and how often they actually fire)

Recognized: one destructured/named parameter with an **inline object type literal**, whose
properties are `string`, `number`, `boolean`, or `string[]`/`number[]`/`boolean[]`. `?` makes a
property optional. Everything else degrades per the rules above.

Surveyed against every real component shipped in this repo today
(`store/projects/*/spaces/*/components/*/*.tsx`, 33 files): **26 extract, 7 fall back.**

All 7 fallbacks are **nested object types**, not the named-interface-reference parameter the plan
flagged as the likely gap:

| file | why |
|---|---|
| `blog/research/view/AlertBadge.tsx` | `{ alert: { title: string; read?: boolean } }` |
| `blog/research/view/BriefingPreview.tsx` | `{ briefing: { title: string; … } }` |
| `homes/intake/ask/ConfirmMerge.tsx` | nested object props + `onMerge?: () => void` callbacks |
| `homes/scout/ask/TasteQuiz.tsx` | nested object props + an `onPick?` callback |
| `kitchen/chef/view/ShoppingListCard.tsx` | `{ lines: ShoppingGapLine[] }` — array of a named interface |
| `trips/finance/view/SettlementSummary.tsx` | `{ balances: { name: string; net: number }[] }` — array of an inline object |
| `trips/logistics/view/PackingChecklist.tsx` | array of an inline object |

So the highest-value follow-up is **recursive nested-object-literal support** (plus arrays of one),
not resolving named type aliases — the limitation the plan flagged as the likely gap fires **zero**
times in this codebase, while nested objects fire seven. `Array<string>` (generic form) is also
unrecognized today. Function-typed props (`onPick?: (id: string) => void`) are not representable in
a JSON schema at all and correctly stay dropped.

Unrelated observation from the same survey: `store/projects/homes/spaces/*/components/**` contains
an **`ask/`** directory alongside `view/`. `space-format`'s `loadComponents` reads only `view/` and
`form/`, so those components are invisible to this plugin. Pre-existing, out of scope here, but
worth a look before this port claims full `components/` coverage.

## Tests

```sh
cd dsh/packages/space-components
node --test          # bare `node --test` — NOT `node --test test/`
```

36 tests. Positive cases run against the real, currently-shipped
`store/projects/blog/spaces/newsroom` space (`agents/synthesizer` → `components: [ArticlePreview]`,
`agents/researcher` → `[ResearchPreview]`, `agents/fetcher` → none); synthetic snippets cover the
edge cases.

## Live verification (`demo/`)

A self-contained keyless harness. It deliberately does **not** extend `dsh/packages/llm-mock` or
`dsh/scripts/assemble-lmthing-profile.mjs` — those are shared files that several feature-plugin
verifications would otherwise edit at once.

- `dsh/system-spaces/system-components-demo/` — toy space: `agents/curator` declares
  `components: [EchoCard]`; `agents/plain` declares none (the negative case);
  `components/view/EchoCard.tsx` has a prop signature that exercises every branch of the type
  mapping at once (required string + optional string/number/boolean/string[]).
- `demo/display-mock.js` — scripted adapter. Always prints the tool names actually visible in
  `options.tools` (the live tool-schema snapshot — the exact thing the Phase 2 missing-`await` bug
  silently corrupted). Mounted by subpath so its `@deepseek-ai/dsh-llm` import resolves from this
  package's own `node_modules`.
- `demo/assemble-demo-profile.mjs` — writes `$DSH_HOME/profiles/components-demo/cordis.patch.yml`,
  mounting `@lmthing/dsh-space-components` **directly** (the umbrella `@lmthing/dsh-space` plugin
  does not compose it yet).

```sh
cd dsh
node packages/space-components/demo/assemble-demo-profile.mjs curator
DSH_HOME=$(pwd)/.dsh-home npx dsh --profile components-demo "display: hello"          # mixed props -> warning
DSH_HOME=$(pwd)/.dsh-home npx dsh --profile components-demo "display! hello"          # all-valid props

node packages/space-components/demo/assemble-demo-profile.mjs plain                   # negative case
DSH_HOME=$(pwd)/.dsh-home npx dsh --profile components-demo "display: nope"           # no display tool at all
```

The profile itself (`.dsh-home/profiles/components-demo/`) is gitignored like every other one in
this track; recreate it by copying `cordis.yml` + `pnpm-workspace.yaml` from another profile, adding
a `package.json` that links `@lmthing/dsh-space-components` and lists the
`@deepseek-ai/dsh-base` + `@deepseek-ai/dsh-headless` bundles, then `pnpm install` in it.

### Outcome (2026-08-23, keyless)

- `display` reaches the model's tool list with `enum: ["EchoCard"]` and a description carrying
  `message: string, stamp?: string, repeats?: number, shouted?: boolean, tags?: string[]` — the
  extractor's output, live.
- A wrong-typed `repeats: "twice"` came back as `EchoCard props: "repeats" must be a number` on a
  **successful** call — fail-soft proven end to end, not just in unit tests.
- `agents/plain` (no `components:`) boots with **no** `display` tool at all.
- The same run printed the full stock tool list — `bash, create_goal, edit, exit_plan_mode,
  get_goal, glob, grep, interrupt_agent, job_kill, job_list, job_output, list_agents, ralph, read,
  read_image, send_message, skill, str_replace_editor, subagent, subagent_fork, todo_write,
  update_goal, web_search, workflow, write` — confirming **no stock dsh tool claims the name
  `display`**.

Not done: a real-model run and the Web-UI pass. The only credential in this checkout
(`sdk/org/.env`'s `LMTHINGCLOUD_API_KEY`) is stale — the gateway answers `401 token_not_found_in_db`
(consistent with the production test-user wipe). Blocked on credentials, not on this code.
