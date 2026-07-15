# Knowledge & documents — `loadKnowledge`, `readDocument`, `inspect`, `serialize`

The four pieces of the runtime that let an agent **read something it does not already have in context**, and that decide **how much of a value the model actually sees**.

| Name | Kind | Capability gate | Host resolver |
|---|---|---|---|
| `loadKnowledge(...path)` | value **yield** (`kind:'loadKnowledge'`) | none — injected in every VM `sdk/org/libs/core/src/exec/bootstrap.ts:164` | the session resolves it itself `sdk/org/libs/core/src/session/session.ts:806-815`; fork leaves via the router's `knowledgeSpaceDir` `sdk/org/libs/core/src/eval/yield-router.ts:345-354` |
| `readDocument(id, opts?)` | value **yield** (`kind:'readDocument'`) | none — deliberately universal, like `fetch` `sdk/org/libs/core/src/exec/bootstrap.ts:160-163` | `YieldRouterContext.documentResolver` `sdk/org/libs/core/src/eval/yield-router.ts:92-96` |
| `inspect(...args)` | value **yield** (`kind:'inspect'`) | none `sdk/org/libs/core/src/exec/bootstrap.ts:157` | resolved by the **session** (`req.args[0]`), never by `routeCommonYield` `sdk/org/libs/core/src/session/session.ts:802-805` |
| `serialize(value, opts?)` | not a global — the **host-side** formatter behind every VARIABLES block | n/a | `sdk/org/libs/core/src/globals/serialize.ts#serialize` |

All three globals are declared unconditionally in `COMMON_DTS`, so they typecheck in the session, in forks and in delegates `sdk/org/libs/core/src/typecheck/library-dts.ts#COMMON_DTS` · `sdk/org/libs/core/src/typecheck/library-dts.ts:97`. See [./README.md](./README.md) for the full global inventory, the capability→global gate table and the resolver seam.

---

## `loadKnowledge(...path)` — on-demand knowledge load

```ts
declare function loadKnowledge(...path: string[]): Promise<any>;
```
`sdk/org/libs/core/src/typecheck/library-dts.ts:38`

Injected as `createLoadKnowledgeGlobal(pushYield, opts.spaceDir + '/knowledge')` — the base dir is always **`<spaceDir>/knowledge`**, never `process.cwd()` `sdk/org/libs/core/src/exec/bootstrap.ts:164`. The path segments are `join`ed onto that base, and the yield carries the normalized `domain/field/option` string as `args[0]` `sdk/org/libs/core/src/globals/load-knowledge.ts#createLoadKnowledgeGlobal`.

```ts
const k = await loadKnowledge('journalism', 'source-evaluation', 'credibility-signals');
```

The return type is deliberately `any` so `k.body` reads without a cast (same convention as `tasklist`/`delegate`); the system prompt tells the model exactly that `sdk/org/libs/core/src/context/system-block.ts:164-165`.

### How a path resolves to a file

`loadKnowledgeFile(filePath)` is the single reader `sdk/org/libs/core/src/globals/load-knowledge.ts#loadKnowledgeFile`:

1. Read `<spaceDir>/knowledge/<...path>` verbatim.
2. On a read miss — and only when the path does **not** already end in `.md` — fall back to `<path>.md`, then `<path>/index.md` `sdk/org/libs/core/src/globals/load-knowledge.ts:52-65`. This is why the prompt can hand the model an extension-less aspect **slug** and `loadKnowledge('domain','field','aspect')` still resolves (and why a bare `loadKnowledge('domain','field')` resolves to the field's `index.md` overview).
3. Parse:
   - with YAML frontmatter (`---` … `---`) → `{ frontmatter, body }` (frontmatter parsed with `logLevel:'silent'`; a YAML error degrades to the raw frontmatter text) `sdk/org/libs/core/src/globals/load-knowledge.ts:35-46`;
   - otherwise → the **raw markdown string**, trimmed. A frontmatter-less file is *never* run through the YAML parser: markdown such as `- **MMLU-Pro**: 75.9` is almost-valid YAML — the parser does not throw, it returns a mangled structure and silently corrupts the agent's knowledge `sdk/org/libs/core/src/globals/load-knowledge.ts:6-16` · `sdk/org/libs/core/src/globals/load-knowledge.ts:48-49`.
4. Both candidates missing ⇒ `Error: loadKnowledge(): cannot read "<path>": <reason>` `sdk/org/libs/core/src/globals/load-knowledge.ts:30`.

For the on-disk shape this reads (`knowledge/<domain>/<field>/index.md` + aspect files) see [../format/space/knowledge/README.md](../format/space/knowledge/README.md); the loader that builds the in-memory tree is `sdk/org/libs/core/src/spaces/load.ts#loadKnowledge` (options = every `.md` in the field dir except `index.md`, keyed by basename `sdk/org/libs/core/src/spaces/load.ts:290-299`).

Note the two parsers disagree on strictness, on purpose. `loadKnowledge` (the global) accepts **any** frontmatter, or none. `loadSpace` validates each option file against an allow-list — frontmatter, if present, **must** carry a non-empty `description`, and only `description`/`icon`/`color`/`label` are allowed; it throws `Knowledge option "<path>" has frontmatter but is missing required key "description"` `sdk/org/libs/core/src/spaces/load.ts:330-348`. So a malformed option file fails at **space load**, long before any agent calls `loadKnowledge`.

### Who resolves the yield

- **Top-level session** — `Session.handleYield` handles `loadKnowledge` *before* consulting the router: it joins `<spaceDir>/knowledge/<rel>` and returns the parsed **content** (returning `args[0]` would bind the path string) `sdk/org/libs/core/src/session/session.ts:806-815`.
- **Fork leaf** — the router resolves it from `ctx.knowledgeSpaceDir`, which the ForkEngine sets to the parent's space dir `sdk/org/libs/core/src/fork/fork.ts:431` · `sdk/org/libs/core/src/eval/yield-router.ts:345-354`. The host **must** return the content: the turn loop resolves the yield's deferred with whatever `processYield` returned `sdk/org/libs/core/src/eval/turn-loop.ts:628-630`, so an `undefined` there wins the race against the global's own `loadKnowledgeFile().then(resolve)` and the fork binds `k = undefined`. That was a real regression; it is now covered by a test `sdk/org/libs/core/src/fork/fork.test.ts:123-160`.

- **Delegate — binds `undefined` today (the fork bug, still live on this path).** A delegate builds its `YieldRouterContext` *without* `knowledgeSpaceDir` `sdk/org/libs/core/src/delegate/delegate.ts:340-355` — the ForkEngine is the only writer of that field in the whole runtime `sdk/org/libs/core/src/fork/fork.ts:431`. So the router's `loadKnowledge` case hits its `if (!ctx.knowledgeSpaceDir) return { handled: false }` guard `sdk/org/libs/core/src/eval/yield-router.ts:349`, the delegate's `processYield` returns `undefined` for the unhandled kind `sdk/org/libs/core/src/delegate/delegate.ts:383`, and the turn loop resolves the yield's deferred with that `undefined` `sdk/org/libs/core/src/eval/turn-loop.ts:628-630` — beating the global's own `loadKnowledgeFile(filePath).then(resolve)` `sdk/org/libs/core/src/globals/load-knowledge.ts#createLoadKnowledgeGlobal`, whose `readFile` has not come back yet. The `vm.getVar` preference in `bindYieldResults` does not rescue it: the VM's own promise settled with the same `undefined` `sdk/org/libs/core/src/eval/turn-loop.ts#bindYieldResults`. Confirmed by running a real delegate (a space with `knowledge/domain/field/opt.md`) whose turn 1 is `const k = await loadKnowledge('domain', 'field', 'opt')` and whose turn 2 resolves `{ loaded: !!k }` → `{ loaded: false }`. The one-line fix is `knowledgeSpaceDir: space.dir` in that router context (mirroring `fork.ts:431`); until then, **an agent that runs as a delegate must get its knowledge from a `knowledge:` frontmatter ref**, not from a `loadKnowledge()` call — preloads *do* work in a delegate, they are resolved at prompt-build time `sdk/org/libs/core/src/delegate/delegate.ts:151`.

### How knowledge *refs* reach the agent

An agent's `knowledge:` frontmatter list is resolved at **prompt-build** time, not at call time `sdk/org/libs/core/src/context/system-block.ts:259-314`:

- a **2-part** ref `domain/field` stays **on demand** — the system block prints the field, its `index.md` body inline as `overview:`, and the list of `aspects (load on demand)`, under the header ``Access with `loadKnowledge(domain, field, option)` `` `sdk/org/libs/core/src/context/system-block.ts:296-309`;
- a **3-part** ref `domain/field/option` is **preloaded** — `resolvePreloadedKnowledge` resolves it up front and the option's body is injected directly into the system block, with its sibling options deliberately *not* listed: that agent has access only to the option it was bound to `sdk/org/libs/core/src/context/system-block.ts:60-79` · `sdk/org/libs/core/src/context/system-block.ts:286-294`.

A real 2-part ref, from the blog store project `store/projects/blog/spaces/newsroom/agents/researcher/instruct.md:9-10`:

```yaml
knowledge:
  - journalism/deep-dive-method
```

The two resolution paths are distinct and must not be confused: **preloads** go through `resolveKnowledge(space, path)` over the *loaded space tree* — it accepts `[domain]` / `[domain, field]` / `[domain, field, option]` and throws `Knowledge domain|field|option "…" not found` `sdk/org/libs/core/src/spaces/knowledge.ts#resolveKnowledge` — while the `loadKnowledge` **global** reads the filesystem directly `sdk/org/libs/core/src/globals/load-knowledge.ts#createLoadKnowledgeGlobal`.

---

## `writeKnowledge(domain, field, option, markdown, opts?)` — author own-space knowledge

```ts
declare function writeKnowledge(domain: string, field: string, option: string, markdown: string, opts?: { source?: 'user' | 'researched' | 'agent' }): { ok: boolean; path: string; error?: string };
```
`sdk/org/libs/core/src/typecheck/library-dts.ts#KNOWLEDGE_WRITE_DTS`

The runtime twin of `loadKnowledge`, and the write half of the *research-and-store* loop: a synthesized space agent that hits a gap researches the answer, then persists it here so the next question is free. Unlike the yielding `loadKnowledge`, `writeKnowledge` is a **synchronous** host global (execShell-class, no yield-router entry) `sdk/org/libs/core/src/globals/write-knowledge.ts#createWriteKnowledgeGlobal`.

- **Capability-gated.** Injected only when the agent holds `knowledge:write` (`sdk/org/libs/core/src/exec/bootstrap.ts#createChildVM`); absent from the DTS otherwise, so a stray call fails typecheck. It is a WRITE grant, so `intersectAppCaps` drops it from read-only fork roles — a writing tasklist node must be `role: general` `sdk/org/libs/core/src/exec/capability.ts#intersectAppCaps`.
- **Own-space only, unspoofable.** Like `loadKnowledge`, the write root is closure-bound to `<spaceDir>/knowledge`; there is NO `space` parameter, so sandbox code cannot retarget another space `sdk/org/libs/core/src/globals/write-knowledge.ts#createWriteKnowledgeGlobal`. The `knowledge:write` cap's optional `{ spaces: [...] }` allow-list is parsed for a future cross-space grant but not yet honored.
- **Where it writes.** `knowledge/<domain>/<field>/<option>.md`, matching what `loadKnowledge('<domain>','<field>','<option>.md')` reads back. A trailing `.md` on `option` is stripped; `option: 'index'` is reserved (that is the architect's `writeKnowledgeIndex`).
- **Provenance.** When `opts.source` is set, a one-line `> source: …` blockquote is prepended — the signal `reconcile_conflict` reads to rank a stored fact (user-asserted > researched > agent guess).

This is a runtime SIBLING of the architect's build-time `writeKnowledgeOption` builder function (`sdk/org/libs/core/system-spaces/system-architect/functions/writeKnowledgeOption.ts`), which keeps its `space` argument because it authors a space it is constructing; the runtime global drops it to stay own-space.

---

## `readDocument(attachmentId, opts?)` — read an upload's text

```ts
declare function readDocument(attachmentId: string, opts?: { maxChars?: number }): Promise<{
  ok: boolean; attachmentId: string; mediaType: string; filename?: string;
  kind: 'text' | 'unsupported'; text?: string; truncated?: boolean; error?: string;
}>;
```
`sdk/org/libs/core/src/typecheck/library-dts.ts:97` · result type `ReadDocumentResult` `sdk/org/libs/core/src/globals/read-document.ts#ReadDocumentResult`

**Never capability-gated** — injected into every VM (session, fork, delegate) exactly like `fetch`, so any agent can read an attachment by id `sdk/org/libs/core/src/exec/bootstrap.ts:160-163` · `sdk/org/libs/core/src/globals/read-document.ts:38-50`. **The bytes never enter the sandbox**: the sandbox supplies only the id (+ optional `maxChars`); the host reads the file from the uploads dir and hands back extracted text `sdk/org/libs/core/src/globals/read-document.ts:47-49`.

The host side is `YieldRouterContext.documentResolver` `sdk/org/libs/core/src/eval/yield-router.ts:92-96`. When it is absent (a bare in-memory session, no uploads dir) the yield **rejects** with a clear, retryable error rather than binding `undefined`:

```
readDocument is not available here: no document resolver configured
```
`sdk/org/libs/core/src/eval/yield-router.ts:225-236`

### The pod resolver (extraction matrix)

`SessionManager` attaches `resolveDocument` to **every** session, project-rooted or not `sdk/org/libs/cli/src/server/session-manager.ts:385-390` · `sdk/org/libs/cli/src/server/session-manager.ts:447`, backed by `resolveUploadDocument(uploadsDir, id, opts)` `sdk/org/libs/cli/src/server/uploads.ts#resolveUploadDocument`. It is server-authoritative (only the id is trusted; bytes + metadata are re-read from disk) and **never throws** — an unreadable file resolves to `kind:'unsupported'` with an `error` string the agent can relay `sdk/org/libs/cli/src/server/uploads.ts:184-191`.

| Input | Result |
|---|---|
| unsafe id / no metadata | `{ok:false, kind:'unsupported', error:'invalid attachment id' \| 'attachment not found'}` `sdk/org/libs/cli/src/server/uploads.ts:198-204` |
| `kind:'audio'` | `{ok:true, kind:'text', text: <transcript captured at upload time>}` `sdk/org/libs/cli/src/server/uploads.ts:206-209` |
| `kind:'image'` | `{ok:false, error:'image — use system-vision instead'}` `sdk/org/libs/cli/src/server/uploads.ts:210-213` |
| spreadsheet (xlsx/xls/xlsm/ods/csv/tsv — by media type **or** filename) | every sheet rendered to CSV via SheetJS `sdk/org/libs/cli/src/server/uploads.ts:63-92` · `sdk/org/libs/cli/src/server/uploads.ts:218-228` |
| text media (`text/*`, json/xml/yaml/csv/js/ts/markdown/x-sh/toml), excluding the OOXML container family | utf8 decode `sdk/org/libs/cli/src/server/uploads.ts:36-43` · `sdk/org/libs/cli/src/server/uploads.ts:229-237` |
| `application/pdf` | `unpdf` extraction. A **scan** has no text layer, so extraction yields nothing: its pages were rasterized to image uploads at save time `sdk/org/libs/cli/src/server/uploads.ts#extractPdfPageImages`, and the error **names those page ids** so the agent hands them to `system-vision` instead of dead-ending `sdk/org/libs/cli/src/server/uploads.ts#resolveUploadDocument` |
| Word / PowerPoint / ODT / ODP | `officeparser` `sdk/org/libs/cli/src/server/uploads.ts:109-124` · `sdk/org/libs/cli/src/server/uploads.ts:247-254` |
| anything else | `{ok:false, error:'file type not yet supported: <mediaType>'}` `sdk/org/libs/cli/src/server/uploads.ts:256-257` |

Text is capped at `opts.maxChars` (default `READ_DOCUMENT_MAX_CHARS = 100_000`) and `truncated:true` is set when the cap bit `sdk/org/libs/cli/src/server/uploads.ts:181-182` · `sdk/org/libs/cli/src/server/uploads.ts:197`.

### DOCUMENT CONTENTS — why the model sees the whole file

The bound result would otherwise be shown through the VARIABLES serializer, whose 200-char string cap would reveal only the opening of a real document (and its `…` marker would read as real truncation). So the turn loop collects every `readDocument` yield that came back readable and appends the **full text** as its own block after VARIABLES `sdk/org/libs/core/src/eval/turn-loop.ts:40-65` · `sdk/org/libs/core/src/eval/turn-loop.ts:726-733`:

```
DOCUMENT CONTENTS (full text of the file(s) you just read — answer from THIS,
not from the truncated `doc` preview in VARIABLES above):

--- report.pdf (application/pdf) ---
<extracted text>
```
`sdk/org/libs/core/src/eval/turn-loop.ts#formatReadDocuments`

A capped document gets ` — truncated (capped); later content was not included` appended to its header line `sdk/org/libs/core/src/eval/turn-loop.ts#formatReadDocuments`.

---

## `inspect(...args)` — surface a value (or a slice of it) to the model

```ts
declare function inspect(...args: (unknown | [unknown, InspectQuery])[]): Promise<void>;
declare interface InspectQuery {
  path?: string; slice?: [number, number]; depth?: number; filter?: string;
  sample?: number; keys?: boolean; count?: boolean; search?: string;
}
```
`sdk/org/libs/core/src/typecheck/library-dts.ts#COMMON_DTS` · `sdk/org/libs/core/src/typecheck/library-dts.ts:67-76`

Each argument is either a bare value or a `[value, query]` pair; the query is applied **inside the global, before the yield is pushed**, so the host only ever sees the reduced value `sdk/org/libs/core/src/globals/inspect.ts#createInspectGlobal`. It yields (`kind:'inspect'`) and resolves to `void`.

`applyQuery` runs the operators in a fixed order — `path` → `keys` → `count` → `search` → `filter` → `slice` → `sample` `sdk/org/libs/core/src/globals/inspect.ts#applyQuery`:

- **`path`** — dotted access, array indices included (`'items.0.title'`) `sdk/org/libs/core/src/globals/inspect.ts#getPath`
- **`keys` / `count`** — `Object.keys(...)`, or the length of an array/string / key count of an object `sdk/org/libs/core/src/globals/inspect.ts:62-73`
- **`search`** — case-insensitive substring match over `JSON.stringify(item)` for array items `sdk/org/libs/core/src/globals/inspect.ts:75-80`
- **`filter`** — a restricted predicate over array items: `<dotted.path> <op> <literal>` joined by `AND` / `OR`; ops `== != > < >= <=`; literals `true|false|null|number|"quoted"|bare` `sdk/org/libs/core/src/globals/inspect.ts:125-174`
- **`slice` / `sample`** — `[start, end]`, or `n` random items (the whole array when `n >= length`) `sdk/org/libs/core/src/globals/inspect.ts:88-103`
- **`depth`** — *not* applied by `applyQuery`; it is a hint the serializer's truncation messages suggest (`inspect([var, { depth: 8 }])`), and today it does not change what `inspect` returns `sdk/org/libs/core/src/globals/inspect.ts#applyQuery` · `sdk/org/libs/core/src/globals/serialize.ts:42-51`

```ts
await inspect([results, { filter: 'score >= 0.8 AND kind == "paper"', slice: [0, 5] }]);
await inspect([tree, { keys: true }], [rows, { count: true }]);
```

Two behaviours make `inspect` unlike every other yield:

1. **The session resolves it, not the router.** `routeCommonYield` has no `'inspect'` case (its doc comment says so explicitly) — the session returns `req.args[0]` directly `sdk/org/libs/core/src/eval/yield-router.ts:123-126` · `sdk/org/libs/core/src/session/session.ts:802-805`.
2. **Its values are surfaced without a binding.** `inspect(x)` is normally called with no `const` on the left, so the turn loop's name-binding captures nothing. The loop therefore pulls the processed args out of the yields, formats them with `formatInspectResult`, and splices those lines into the VARIABLES block the model already reads — otherwise a bare `inspect()` would surface *nothing* and the model would re-type or hallucinate the values `sdk/org/libs/core/src/eval/turn-loop.ts:696-725`.

`formatInspectResult` labels each value `inspected[i]`, or `inspected[i].<path>` when the query carried a `path` `sdk/org/libs/core/src/globals/inspect.ts#formatInspectResult`:

```
VARIABLES
inspected[0].items.0.title: "Extraction basics"
```

The turn loop also nudges the model toward `inspect` when it binds a value from a **non-**yielding call (whose result is never surfaced automatically): "If you must SEE that result before the next step, call `inspect(<var>)` — it surfaces the value and resumes you." `sdk/org/libs/core/src/eval/turn-loop.ts#CONTINUATION_NUDGE`

---

## `serialize(value, opts?)` — the capped VARIABLES formatter

Not a global: it is the host-side function that renders every value the model sees, with caps chosen so one large binding cannot blow up the context `sdk/org/libs/core/src/globals/serialize.ts#serialize`.

| Cap | Default | Behaviour on overflow |
|---|---|---|
| `byteCap` | 4096 | truncate + `` … [truncated — inspect([var, { slice: [0, 10] }]) to expand] `` `sdk/org/libs/core/src/globals/serialize.ts:6-24` |
| `depthCap` | 6 | `[… N items, truncated — inspect([var, { depth: 8 }]) to expand]` / `{… N keys, truncated — …}` `sdk/org/libs/core/src/globals/serialize.ts:42-51` |
| string | 200 chars | `"head… (N chars total)"` `sdk/org/libs/core/src/globals/serialize.ts:33-40` |
| array | 20 items | `, … (N items total)` `sdk/org/libs/core/src/globals/serialize.ts:53-58` |
| object | 20 keys | `, … (N keys total)` `sdk/org/libs/core/src/globals/serialize.ts:65-74` |

`ArrayBuffer` / typed arrays render as `<ArrayBuffer N bytes>` `sdk/org/libs/core/src/globals/serialize.ts:60-63`. Every truncation message names `inspect(...)` **with the exact query to expand** — that is the designed loop: *serialize shows a capped preview; `inspect` is how the model asks for more.*

Call sites: the VARIABLES block (`emitVariables` `sdk/org/libs/core/src/context/variables.ts:8-13`), the inspect fold (`formatInspectResult` `sdk/org/libs/core/src/globals/inspect.ts#formatInspectResult`), the trace `variables` event (`sdk/org/libs/core/src/eval/turn-loop.ts:685-691`) and the fork/task prelude's first VARIABLES snapshot (`sdk/org/libs/core/src/exec/prelude.ts:248-251`).

---

## Gotchas

- **`inspect`, `loadKnowledge` and `readDocument` all YIELD** — they end the current turn and resume the next one with their value bound host-side. (`display` is the only fire-and-forget surface global.) See [./README.md](./README.md).
- **`loadKnowledge` is rooted at `<spaceDir>/knowledge`** — it cannot reach outside the space's knowledge tree by construction `sdk/org/libs/core/src/exec/bootstrap.ts:164`.
- **`loadKnowledge()` inside a `delegate()` binds `undefined`** — the delegate's router context has no `knowledgeSpaceDir`, so the host resolves the yield with `undefined` and wins the race against the global's own file read `sdk/org/libs/core/src/delegate/delegate.ts:340-355` · `sdk/org/libs/core/src/delegate/delegate.ts:383`. Sessions and fork leaves are fine. In a delegated agent, bind knowledge via a `knowledge:` frontmatter ref instead (see [Who resolves the yield](#who-resolves-the-yield)).
- **A knowledge aspect file is markdown, not YAML** — only a leading `---` frontmatter block is parsed; everything else comes back verbatim `sdk/org/libs/core/src/globals/load-knowledge.ts:48-49`.
- **`readDocument` on an image fails on purpose** (`'image — use system-vision instead'`) — images go to the vision specialist `sdk/org/libs/cli/src/server/uploads.ts:210-213`.
- **Never read a document's text out of the VARIABLES preview** — read it from the DOCUMENT CONTENTS block appended after it `sdk/org/libs/core/src/eval/turn-loop.ts:726-733`.
- **`readDocument` needs a host resolver, not a capability** — outside a pod/CLI with an uploads dir the yield rejects with a named error `sdk/org/libs/core/src/eval/yield-router.ts:225-236`.

## See also

- [./README.md](./README.md) — the global inventory, capability gates and the host-resolver seam
- [../format/space/knowledge/README.md](../format/space/knowledge/README.md) — the `knowledge/<domain>/<field>/` on-disk format these globals read
- [./session-and-utils.md](./session-and-utils.md) — `display`, `fetch`, and the synchronous host-tools substrate
