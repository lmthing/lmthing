# lmthing.health as a Project-Application — the `health` project

> A concrete instantiation of [the project-as-application model](../org/docs/format/project/README.md) for the
> **personal health research page** the parent plan names as a motivating case. You log metrics, lab
> results, and symptoms; a **`clinic`** space flags out-of-range results and runs literature-backed
> deep dives; a subscription gates the deep research. The `health` project owns the app — `database/`
> (metrics, lab results, symptoms, research, sources, settings), `pages/` (client React dashboard /
> labs / symptoms / research), `api/` (named typed Node endpoints), `hooks/` (a `database` interpreter
> hook + a daily digest cron), and the `clinic` space. Read the parent plan first for the shared
> mechanisms; this file is the health-specific shape. Paths are relative to the org repo root.
>
> **Not medical advice.** This app is an informational research aid over the user's own data. It does
> not diagnose or treat; the `clinic` agents' prompts and the UI state this plainly (see Notes/Safety).

## Context

Most people have health data they can't read: a lab printout of numbers with no context, a wearable's
trends, symptoms they half-remember. They won't research it systematically, and Googling a scary value
at midnight is the opposite of reassuring. This app turns that raw data into understanding. You record
metrics (weight/sleep/BP over time), lab results, and symptoms; the `interpreter` **flags what's
outside the normal range** in plain language, and — when you want to go deeper — a `researcher` reads
the medical literature and writes it up with citations, so you **walk into an appointment informed
instead of anxious**. You can ask for a dive on any symptom or topic by chat. **The value is making
sense of your own body's data** — high-value work a static app can't do and the user can't easily do
themselves — with a clear not-a-doctor line (see Safety). And because health tracking naturally grows
over time, the app grows with you: ask to start tracking a new panel or a medication schedule and THING
builds the table and page for it. (The parent plan names "lmthing.health" as a motivating surface;
there is no `health/` domain today — this is a net-new project-application.)

## The project

- **Project id**: `health`. One per user pod (your health data = per-user, private).
- **Project-scoped space**: `health/spaces/clinic/` — the specialists that maintain the app
  (`logger`, `interpreter`, `researcher`). Because the db is **project-rooted**, all three read/write
  the **same** tables and feed the **same** pages (the multi-agent-application shape).
- **THING** builds/evolves the app by delegating to `system-appbuilder` (parent plan
  §"system-appbuilder"). Health leans on this: **"start tracking my cholesterol panel over time"** or
  **"add a medications schedule"** are *authoring* requests → THING → `system-appbuilder`
  (`data-modeler` adds the table, `page-builder` adds a page). The `clinic` agents only *operate* the
  app; they hold **no** authoring caps.
- **Provisioning**: v1 seeds the `health` project from a checked-in template materialized into the
  pod's `<root>/health/`, with the single `settings` row seeded (`tier:'free'`). In a **later phase**
  it becomes **installable from lmthing.store** as a project app.

## Directory layout

```
health/
├── package.json              # react, @tanstack/react-router, @lmthing/{ui,css}, recharts-free charting via @lmthing/ui …
├── database/
│   ├── metrics.json          # time-series measurements (weight, sleep, BP, steps…)
│   ├── lab_results.json      # blood-panel / lab analyte results with reference ranges
│   ├── symptoms.json         # symptom episodes the user logs
│   ├── research.json         # deep-dive reports (per lab result, symptom, or free topic)
│   ├── sources.json          # trusted literature sources / saved queries
│   └── settings.json         # single-row account settings (tier + budget)
├── pages/                    # client-side React SPA
│   ├── _app.tsx              # QueryClient + design-system theme provider
│   ├── _layout.tsx           # nav chrome: Dashboard · Labs · Symptoms · Research · Settings
│   ├── index.tsx             # "/"                    → trends dashboard (metrics charts)
│   ├── labs/
│   │   ├── index.tsx         # "/labs"                → lab results list (flagged highlighted)
│   │   └── [id].tsx          # "/labs/:id"            → a result + its flag + linked research
│   ├── symptoms.tsx          # "/symptoms"            → symptom log
│   ├── research/[id].tsx     # "/research/:id"        → a dive report + <Chat agent="clinic/researcher">
│   └── settings.tsx          # "/settings"            → tier, budget, disclaimer
├── components/               # MetricChart, LabRow, FlagBadge, SymptomRow, MarkdownBody, Disclaimer…
├── api/
│   ├── metrics/
│   │   ├── GET.ts                    # listMetrics  ({ kind, from?, to? })
│   │   └── POST.ts                   # logMetric
│   ├── labs/
│   │   ├── GET.ts                    # listLabs
│   │   ├── POST.ts                   # addLab       (fires the interpreter hook)
│   │   └── [id]/GET.ts               # getLab       (include research)
│   ├── symptoms/
│   │   ├── GET.ts                    # listSymptoms
│   │   └── POST.ts                   # logSymptom
│   ├── research/
│   │   ├── POST.ts                   # requestResearch   (subscription-gated → 402)
│   │   └── [id]/GET.ts               # getResearch
│   ├── settings/
│   │   ├── GET.ts                    # getSettings   (find-or-create the single row)
│   │   └── disclaimer/POST.ts        # acceptDisclaimer
│   └── stats/GET.ts                  # healthStats   (dashboard counts)
├── hooks/
│   ├── interpret-new-lab.ts  # database lab_results:insert → clinic/interpreter#interpret
│   ├── research-deep-dive.ts # database research:insert → clinic/researcher#deep-dive
│   └── daily-digest.ts       # cron 08:00 → clinic/interpreter#digest
├── spaces/
│   └── clinic/               # project-scoped space (agents / tasklists / knowledge)
│       └── agents/{logger,interpreter,researcher}/instruct.md
├── types/generated.d.ts      # GENERATED — row + endpoint I/O types
└── .data/
    ├── app.db                # SQLite (WAL)
    ├── app.sql               # backup dump
    └── hooks-state.json      # cron last-run / pending queue
```

## Database (schemas — descriptions mandatory, FKs + relations)

Every table and column carries a required `description` (parent plan §"database"); the loader fails
loud on any missing one. `metrics` is deliberately **generic** (a `kind`/`value` time series) so new
measurement types need no schema change; **structured** new tracking (a medications schedule, a
labelled panel) is where THING → `system-appbuilder` adds tables (see §"Self-evolution").

```json
// database/metrics.json — generic time series (no schema change to track a new kind)
{ "title": "Metrics",
  "description": "One dated measurement the user records — weight, sleep hours, blood pressure, steps, resting heart rate, etc. Generic so new kinds need no schema change.",
  "columns": {
    "id":         { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "kind":       { "type": "string", "description": "what was measured, e.g. 'weight' | 'sleep_hours' | 'bp_systolic' | 'steps'", "required": true },
    "value":      { "type": "number", "description": "the numeric measurement", "required": true },
    "unit":       { "type": "string", "description": "the unit, e.g. 'kg' | 'h' | 'mmHg' | 'count'", "required": true },
    "recordedAt": { "type": "date",   "description": "when the measurement was taken", "required": true },
    "source":     { "type": "string", "description": "'manual' or a device name", "default": "manual" },
    "note":       { "type": "string", "description": "optional context the user added" } } }
```

```json
// database/lab_results.json
{ "title": "Lab results",
  "description": "One analyte result from a blood panel or lab test, with its reference range so the interpreter can flag it.",
  "columns": {
    "id":       { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "panel":    { "type": "string", "description": "the test/panel name, e.g. 'Lipid panel'", "required": true },
    "analyte":  { "type": "string", "description": "the measured analyte, e.g. 'LDL cholesterol'", "required": true },
    "value":    { "type": "number", "description": "the measured value", "required": true },
    "unit":     { "type": "string", "description": "the unit, e.g. 'mg/dL'", "required": true },
    "refLow":   { "type": "number", "description": "low end of the reference range (null = no lower bound)" },
    "refHigh":  { "type": "number", "description": "high end of the reference range (null = no upper bound)" },
    "flag":     { "type": "string", "description": "'low' | 'normal' | 'high' — set by the interpreter, not the user", "default": "normal" },
    "takenAt":  { "type": "date",   "description": "when the sample was drawn", "required": true },
    "note":     { "type": "string", "description": "lab or user note" } },
  "relations": {
    "research": { "hasMany": "research", "via": "labResultId", "description": "deep dives about this result" } } }
```

```json
// database/symptoms.json
{ "title": "Symptoms",
  "description": "A symptom episode the user logs, with severity and duration.",
  "columns": {
    "id":        { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "name":      { "type": "string", "description": "the symptom, e.g. 'headache'", "required": true },
    "severity":  { "type": "number", "description": "1 (mild) to 5 (severe)", "default": 1 },
    "startedAt": { "type": "date",   "description": "when it started", "required": true },
    "endedAt":   { "type": "date",   "description": "when it resolved (null = ongoing)" },
    "note":      { "type": "string", "description": "context — triggers, what helped" } },
  "relations": {
    "research": { "hasMany": "research", "via": "symptomId", "description": "deep dives about this symptom" } } }
```

```json
// database/research.json
{ "title": "Research reports",
  "description": "An on-demand or interpreter-triggered literature deep-dive, tied to a lab result, a symptom, or a free topic.",
  "columns": {
    "id":          { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "labResultId": { "type": "string", "description": "the lab result this expands (null if not lab-driven)",
                     "references": { "table": "lab_results", "column": "id", "onDelete": "cascade" } },
    "symptomId":   { "type": "string", "description": "the symptom this expands (null if not symptom-driven)",
                     "references": { "table": "symptoms", "column": "id", "onDelete": "cascade" } },
    "topic":       { "type": "string", "description": "the question or subject researched", "required": true },
    "body":        { "type": "string", "description": "the report, markdown with citations; empty while pending" },
    "status":      { "type": "string", "description": "'pending' while the researcher runs, 'ready' when done", "default": "pending" },
    "createdAt":   { "type": "date",   "description": "when the dive was requested", "generated": "now" } },
  "relations": {
    "lab":     { "belongsTo": "lab_results", "via": "labResultId", "description": "the lab result being expanded" },
    "symptom": { "belongsTo": "symptoms",    "via": "symptomId",   "description": "the symptom being expanded" } } }
```

```json
// database/sources.json
{ "title": "Sources",
  "description": "A trusted literature source or saved research query the researcher prefers (journals, guideline bodies).",
  "columns": {
    "id":    { "type": "string",  "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "kind":  { "type": "string",  "description": "'journal' | 'guideline' | 'query'", "required": true },
    "value": { "type": "string",  "description": "the source domain, guideline name, or saved query; dedupe key", "required": true, "unique": true },
    "label": { "type": "string",  "description": "human label shown in Settings" },
    "trust": { "type": "number",  "description": "0..1 weight the researcher gives this source", "default": 0.5 } } }
```

```json
// database/settings.json — single row
{ "title": "Settings",
  "description": "The single account-settings row for this user's health app. Exactly one row.",
  "columns": {
    "id":              { "type": "string",  "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "tier":            { "type": "string",  "description": "'free' or 'subscription' — gates deep research", "default": "free" },
    "weeklyBudgetUsd": { "type": "number",  "description": "clinic research spend allowance per week (tier-driven)", "default": 1 },
    "acceptedDisclaimer": { "type": "boolean", "description": "whether the user acknowledged this is not medical advice", "default": false } } }
```

- The **"exactly one row"** invariant on `settings` is **not schema-expressible** (as in blog) — seeded
  at provisioning, every reader does `db.query('settings', {})[0]`. To make pages robust even before
  provisioning has run, the app also exposes a **`getSettings`** endpoint that **find-or-creates** the
  single row (seeds `tier:'free'`) — every settings reader goes through it (documented, not enforced).

> **Row-type note (engine truth).** The build's row-interface names come from a **deterministic
> singularizer** (`libs/cli/src/app/build/schema.ts` `tableInterfaceName`): split on `_`/`-`,
> singularize the last word, PascalCase. For this app it yields `Metric`, `LabResult`, `Symptom`,
> `Research` (unchanged — ends `ch`, not `ches`), `Source`, and **`Setting`** — note the `settings`
> table's row type is **`Setting`** (a bare trailing `s` after a normal consonant is stripped), **not**
> `Settings`. Pages/types import `Setting`. This is the same class of gotcha `kitchen` hit with
> `ShoppingList`; the arch docs (engine) win, so the type name is `Setting`.
- **`research` has two optional FKs** (`labResultId` *or* `symptomId`, or neither for a free topic) —
  the loader validates both `references` resolve; `belongsTo` relations give `Research.lab` /
  `Research.symptom`, and `LabResult.research` / `Symptom.research` the reverse.
- **`flag` is agent-owned, not user-owned** — the interpreter sets it; the `logger`/`addLab` path never
  writes it (per-verb table scope enforces this: `addLab` writes the row, the interpreter writes
  `flag`).

## Pages (client React, file-based routing)

Data comes from the generated typed client `useApi(name, input)` — no pod-side loaders.

| File | Route | Reads / writes |
|---|---|---|
| `pages/index.tsx` | `/` | `listMetrics` per kind → trend charts |
| `pages/labs/index.tsx` | `/labs` | `listLabs` (flagged first) |
| `pages/labs/[id].tsx` | `/labs/:id` | `getLab` (include research); `requestResearch` |
| `pages/symptoms.tsx` | `/symptoms` | `listSymptoms`; `logSymptom` |
| `pages/research/[id].tsx` | `/research/:id` | `getResearch`; `<Chat agent="clinic/researcher">` |
| `pages/settings.tsx` | `/settings` | `settings` read; disclaimer acknowledgement |

```tsx
// pages/labs/[id].tsx  → "/labs/:id"
import type { LabResult, Research } from '../../types/generated'
import { useApi } from '@app/runtime'
import { FlagBadge } from '../../components/FlagBadge'

type FullLab = LabResult & { research: Research[] }

export default function LabPage({ params }: { params: { id: string } }) {
  const { data: lab, isLoading } = useApi('getLab', { id: params.id })   // typed FullLab
  if (isLoading) return <Spinner />
  return (
    <article>
      <h1>{lab.analyte} <FlagBadge flag={lab.flag} /></h1>
      <p>{lab.value} {lab.unit} (ref {lab.refLow}–{lab.refHigh})</p>
      {lab.research.map((r) => <ResearchSummary key={r.id} research={r} />)}
    </article>
  )
}
```

- The dashboard (`index.tsx`) draws trend charts from `listMetrics` per `kind` — built with
  `@lmthing/ui` chart primitives under the **design-system token gate** (no raw colors: series use
  `var(--chart-*)` / design tokens, per the mandatory rule).
- A pending research dive shows a "researching…" state and the page polls `getResearch` until
  `status:'ready'` (the "pages are a live read view of a background agent" property).

## API (named, typed, Node handlers)

Endpoint = dir, method = filename; each exports `name`/`description`/`Input`/`Output` + default
handler `(input, { db, delegate, apiCall })`. Dual-addressed (HTTP for the browser, `name` for
agents via `apiCall`).

| name | method + route | I/O sketch |
|---|---|---|
| `listMetrics` | `GET api/metrics` | `{ kind, from?, to? }` → `Metric[]` |
| `logMetric` | `POST api/metrics` | `{ kind, value, unit, recordedAt?, note? }` → `Metric` |
| `listLabs` | `GET api/labs` | `{ panel? }` → `LabResult[]` |
| `addLab` | `POST api/labs` | `{ panel, analyte, value, unit, refLow?, refHigh?, takenAt }` → `LabResult` |
| `getLab` | `GET api/labs/:id` | `{ id }` → `LabResult & { research: Research[] }` |
| `listSymptoms` | `GET api/symptoms` | `{}` → `Symptom[]` |
| `logSymptom` | `POST api/symptoms` | `{ name, severity?, startedAt, note? }` → `Symptom` |
| `requestResearch` | `POST api/research` | `{ topic, labResultId?, symptomId? }` → `{ researchId, status:'pending' }` — **gated** |
| `getResearch` | `GET api/research/:id` | `{ id }` → `Research` |
| `getSettings` | `GET api/settings` | `{}` → `Setting` — **find-or-creates** the single row (seeds `tier:'free'`) |
| `acceptDisclaimer` | `POST api/settings/disclaimer` | `{}` → `Setting` — sets `acceptedDisclaimer:true` (gates first use) |
| `healthStats` | `GET api/stats` | `{}` → `{ metrics, labs, flagged, activeSymptoms, research }` — dashboard counts strip |

```ts
// api/research/POST.ts → POST .../api/research ; name "requestResearch"
/** Kick off a literature deep-dive (fire-and-forget); subscription-gated. */
import { HttpError } from '@app/runtime'   // → 402 { error: { status, message } } — parent plan §api "Error contract"

export const name = 'requestResearch'
export const description = 'Request a literature deep-dive for a lab result, a symptom, or a free topic; the researcher fills it in asynchronously.'

export interface Input  {
  /** the question or subject to research */ topic: string
  /** optional lab result this expands */ labResultId?: string
  /** optional symptom this expands */ symptomId?: string
}
export interface Output { researchId: string; status: 'pending' }

export default async function handler(input: Input, ctx: { db: AsyncDbApi }): Promise<Output> {
  const settings = (await ctx.db.query('settings', {}))[0]
  if (!settings || settings.tier !== 'subscription') throw new HttpError(402, 'Deep research is a subscription feature')
  const r = await ctx.db.insert('research', {
    topic: input.topic, labResultId: input.labResultId, symptomId: input.symptomId, status: 'pending',
  })
  // The `db.insert` fires the `research-deep-dive` database hook, which delegates the researcher —
  // no api-side `spawn`/`delegate` needed (and api `spawn` is fire-and-forget only). Returns immediately.
  return { researchId: r.id, status: 'pending' }
}
```

- `requestResearch` enforces the **subscription tier** in-handler (free tier gets logging + flagging,
  not literature dives) — the same tier-gate shape as blog's, but the gated capability here is the
  `pubmedSearch`-backed research, not a feed.
- `addLab` inserts a row, firing the `interpret-new-lab` **database** hook — so every lab result gets
  flagged (and, for subscribers, researched) with no explicit call.

## Hooks (interpret + digest)

```ts
// hooks/interpret-new-lab.ts — flag each new result, and (subscription) research the abnormal ones
export default {
  type: 'database',
  on: { table: 'lab_results', event: 'insert' },
  budget: { maxEpisodes: 8 },
  handler: async ({ row, db, delegate }) => {
    // Idempotence + loop guard: the interpreter's own `flag` write is a self-write (excluded),
    // so setting flag does NOT re-fire this hook.
    await delegate('clinic/interpreter', 'interpret', { input: { labResultId: row.id } })
  },
}
```

```ts
// hooks/research-deep-dive.ts — fill every pending research row via the researcher
export default {
  type: 'database',
  on: { table: 'research', event: 'insert' },
  budget: { maxEpisodes: 8, maxWallClockMs: 300000 },
  handler: async ({ row, delegate }) => {
    // A research row is created two ways — the interpreter (abnormal lab + subscription) or the
    // user's one-click `requestResearch` — both `db.insert('research', { status:'pending' })`.
    // This one hook fans either into the researcher; the researcher only ever *updates* the row
    // (status→'ready', fills `body`), so its writes never re-fire this insert hook (bounded).
    await delegate('clinic/researcher', 'deep-dive', { input: { researchId: row.id } })
  },
}
```

```ts
// hooks/daily-digest.ts — a morning summary of trends / anything newly flagged
export default {
  type: 'cron',
  daily: '08:00',
  trigger: 'clinic/interpreter#digest',
  budget: { maxEpisodes: 6, maxWallClockMs: 300000 },
}
```

- **The interpreter flags, then (subscription only) requests a dive**: `interpret` sets
  `lab_results.flag` and, if the value is out of range *and* `settings.tier === 'subscription'`,
  `db.insert('research', { labResultId, topic, status:'pending' })`. That insert fires the
  **`research-deep-dive`** database hook, which delegates the researcher — so the interpreter does
  **not** itself hold `canDelegateTo`; the two agents are wired by *hooks over the shared db*, not
  agent-to-agent delegation (the robust, engine-proven shape: `api`/`interpreter` writes a row → a
  `database` hook fans it into the specialist, exactly like `kitchen`'s planner→shopper). The
  researcher only ever `db.update`s `research`, so it never re-fires the insert hook; the interpreter's
  own `flag` write is **self-write-excluded**; the loop is bounded (parent plan §Safety).
- Cron timing is the parent plan's **crond → hook-run endpoint** mechanism
  (`POST /api/projects/health/hooks/daily-digest/run`); a morning missed while the pod was down runs
  once via boot catch-up; local dev uses the in-process fallback tick.

## Chat (deep dives + questions)

One drop-in `<Chat agent="clinic/researcher" />` widget, reusing the always-available multisession WS
endpoint (parent plan §Chat) — the binding is a runtime prop, no `chats/` dir:

- **`/research/:id`** → `<Chat agent="clinic/researcher" />`. The user asks follow-ups on a dive
  interactively; the researcher runs with full caps (`db:write research` + the universal
  `webSearch`/`webFetch` globals — see the round-1 engine-truth note above), so its
  `db.update('research', …)` is a first-class write and the report grows on the
  page. The one-click `requestResearch` POST is the non-interactive path to the same agent.
- The chat agent's prompts carry the **not-medical-advice framing** (Safety) — it summarises
  literature and cites sources, it does not diagnose or prescribe.
- History persists at `health/spaces/clinic/sessions/<id>` (project-session snapshot form, resumable).
  This is **the one place the catalog descriptor renderer re-enters the app** — pages stay real React.

## The `clinic` space (agents + capabilities)

Project-scoped at `health/spaces/clinic/`. Capabilities are least-privilege per agent — one
config-bearing `capabilities:` frontmatter key, table scope **per verb** (parent plan §"Capability
globals"). The `researcher` reads real medical literature through a dedicated `pubmedSearch` binding
(a trusted source, not just open-web `webSearch`) — which is what lets its write-ups cite the
literature rather than a random blog.

| Agent | `db:read` tables | `db:write` tables | `api:call` allow | Role |
|---|---|---|---|---|
| **logger** | `metrics, lab_results, symptoms` | `metrics, lab_results, symptoms` | — | record measurements/results/symptoms from chat or manual entry (never sets `flag`) |
| **interpreter** | `lab_results, metrics, symptoms, settings, research` | `lab_results, research` | — | set `flag` vs reference range; on abnormal + subscription, create a pending `research` (reads `research` to dedupe) |
| **researcher** | `research, lab_results, symptoms, sources` | `research` | *(universal `webSearch`/`webFetch` globals — see note)* | literature deep dives → fill `research` bodies with citations |

```yaml
# health/spaces/clinic/agents/researcher/instruct.md frontmatter
capabilities:
  - db:read:  { tables: [research, lab_results, symptoms, sources] }
  - db:write: { tables: [research] }
# NB (engine truth, round 1): web/literature search is the UNIVERSAL `webSearch`/`webFetch` global,
# NOT an `api:call` binding — grant it by OMITTING `functions:` (which defaults to all system tools).
# There is no external-binding registry yet, so a credentialed `pubmedSearch` binding is a round-2+
# concern; `api:call` is reserved for the app's OWN typed endpoints (the researcher needs none).
```

```yaml
# health/spaces/clinic/agents/interpreter/instruct.md frontmatter
capabilities:
  - db:read:  { tables: [lab_results, metrics, symptoms, settings, research] }  # settings→tier; research→dedupe pending dives
  - db:write: { tables: [lab_results, research] }                              # writes flag; creates pending research
```

- **Literature grounding uses the universal `webSearch`/`webFetch` globals (round 1).** The engine has
  no external-binding registry yet, so the aspirational credentialed **`pubmedSearch`** binding — a
  `{ name, description }` → hidden URL+key the model never sees, pointed at a medical-literature API — is
  a **round-2+** feature (it needs that registry built in `sdk/org`). Until then the researcher grounds
  its write-ups with the universal `webSearch`/`webFetch` tools (granted by omitting `functions:`), and
  the charter steers it toward reputable medical sources (guideline bodies, journals) and explicit
  citations. `api:call` stays reserved for the app's own typed endpoints.
- **`flag` is agent-owned, by role not by capability** — only the *interpreter* is delegated to set a
  result's flag; the `logger`/`addLab` path doesn't. Note the capability model gates whole *tables*,
  not single *columns*, so this boundary is enforced by which agent runs (role + prompt), not by
  `db:write` scope — flagged plainly so no one over-reads the capability model.
- **The interpreter reads `settings`** to decide whether to auto-research — it's the one clinic agent
  allowed to see the tier; the researcher and logger can't read `settings` at all.
- **No `db:schema`/`pages:write`/`api:write` here** — the clinic *operates* the app; evolving it is the
  next section.

## The app grows with you (THING → `system-appbuilder`)

A health tracker's data model legitimately grows over time — you start following something new and want
a place to keep it and a page to see it. Those are **authoring** requests, routed to
`system-appbuilder`, **never** handled by the clinic:

- **"Track my cholesterol panel over time as a chart"** → THING delegates
  `system-appbuilder/app-architect#build` → `data-modeler` (`db:schema`) runs `db.addColumn` /
  `db.createTable` if a structured panel table is warranted, `page-builder` (`pages:write`) authors a
  `/panels/lipid` page (triggering the per-project rebuild), and — if a new query surface is needed —
  `api-author` (`api:write`) adds a typed endpoint. All project-rooted, so they mutate **the `health`
  project's** app, not the system space they live in.
- **"Add a medications schedule with reminders"** → `data-modeler` adds a `medications` table,
  `automator` (`hooks:write`) wires a `cron` reminder hook, `page-builder` adds `/medications`. The new
  `hooks:write`/`db:schema`/`pages:write` globals are the **"write + apply"** kind (parent plan
  §"Capability globals") — the migration runs, the route reloads, the bundle rebuilds — which is what
  makes the evolution live rather than a dead file write.
- **Least-privilege holds end-to-end**: THING holds only `canDelegateTo system-appbuilder` (no app
  caps); the clinic holds only its operating `db:read/db:write/api:call`. Nobody in the runtime path
  can restructure the model — restructuring is always an explicit delegation to the appbuilder
  specialists. That safety property matters most for exactly this kind of sensitive, personal data.

## Serving & domains

- **Local CLI**: `localhost:8080/app/health/…` (pages) and `localhost:8080/app/health/api/<name>` —
  the parent plan's mount, `<project>` = `health`.
- **Prod**: the parent plan **names `lmthing.health`** as a motivating surface, so — like `blog`'s
  `lmthing.blog` — prod exposes a friendly product alias: `lmthing.health/*` → the authenticated
  user's pod `/app/health/*` (Envoy JWT + per-user routing, same wiring as `lmthing.app/health/…`;
  `lmthing.health` is the friendly public host for this one project). It can equally be reached at the
  generic `lmthing.app/health/*`.
- **Admin/dev**: `lmthing.studio` manages it via `/api/projects/health/app` (manifest, data browser,
  manual hook run, build status, live preview iframe of `…/app/health/`).

**No public/shared surface** — health data is strictly per-user; every route and endpoint is an
authenticated, per-user pod read/write, fully within per-user pod isolation. No v1 deviation from the
parent plan (no cross-user routing).

## Tiers & budget

- **Free** — `tier:'free'`, `weeklyBudgetUsd: 1`: log metrics/labs/symptoms, get **reference-range
  flagging** and the daily digest; `requestResearch` returns 402; the interpreter does **not**
  auto-research abnormal results.
- **Subscription** — `tier:'subscription'`: **literature deep dives** on demand and auto-triggered on
  abnormal labs (the `pubmedSearch`-backed researcher), better research model. Stripe entitlement flips
  `settings.tier` via the gateway webhook (parent backend is `cloud/gateway`, no new service).
- The clinic's cron/hook/research episodes consume the user's budget windows; the **budget-exhaustion
  queue** (parent §Safety) defers `daily-digest` (one coalesced pending entry) and **retries on the
  next run attempt** — each subsequent cron fire re-checks the window and runs once it has rolled over.

## Additional features (more user value)

These deepen the core promise — turning data into understanding you can act on. Each is **additive** on
the same engine, and each stays inside the not-a-doctor line (observations and literature, never
diagnosis; see Safety).

### Document upload → type-driven analysis → data + research (kill hand-entry)
The biggest friction in the core app is hand-entering labs/metrics. Let the user **upload the file they
already have** — a lab-report PDF, a wearable CSV export, a phone photo of a doctor's note, a medication
label — and have an agent read it, extract the data into the db by **file type**, and kick off research.
This is a **new project-scoped space** (`records`) so it also satisfies the ≥2-spaces rule; it reads/writes
the same project-rooted db as `clinic`.

- **Data**:
  - `documents` — one uploaded file: `id`, `kind` (`'lab_pdf' | 'wearable_csv' | 'note_image' | 'med_label' | 'other'`; the analyst may correct a guessed kind), `filename`, `mime`, `storagePath` (relative path under `.data/uploads/<id>/…`, git-ignored like the db), `status` (`'pending' | 'analyzing' | 'analyzed' | 'error'`), `summary` (md — what was found), `error`, `uploadedAt` (`generated:'now'`).
  - `document_extractions` — provenance join: `documentId` FK → `documents`, `table` (which domain table a row was written to, e.g. `'lab_results'`), `rowId`, `confidence` (0..1), so every derived row is traceable back to the source file (and re-analysis is idempotent).
  - `knowledge_notes` — the **db-backed knowledge store** research updates: `id`, `topic`, `body` (md, cited), `sourceKind` (`'document' | 'research' | 'literature'`), `documentId?` FK, `analyte?`/`tag?`, `createdAt`. The `interpreter`/`researcher` **read** this on future analyses, so uploads make the app smarter over time. (Runtime agents have no `knowledge:write` for space `knowledge/` files — that stays an authoring action; durable, broadly-reusable notes can later be **promoted into the `records`/`clinic` space `knowledge/` via THING → `system-appbuilder`**. Do NOT invent a runtime knowledge-write capability.)
- **API**: `uploadDocument` `POST api/documents` (multipart; stores the blob under `.data/uploads/<id>/`, inserts `documents` row `status:'pending'`, returns `{ documentId, status }`); `listDocuments` `GET api/documents`; `getDocument` `GET api/documents/:id` (include extractions + linked rows + notes). Enforce a size/type allow-list and per-user pod isolation.
- **Hook**: `analyze-document.ts` — **database** insert on `documents` → `delegate('records/analyst', 'analyze', { documentId })`. Idempotent (skip if `status !== 'pending'` or extractions already exist); loop-guard applies (the analyst's own `documents.status` write is self-write-excluded).
- **Agent (`records/analyst`)** — routes **by `kind`** to a per-type action and writes the domain tables:
  - `lab_pdf` → `pdfExtract` → parse analytes/ranges → `db.insert('lab_results', …)` (which fires the existing `interpret-new-lab` hook → flagging + subscription auto-research);
  - `wearable_csv` → `csvParse` → bulk `db.insert('metrics', …)` (dedupe on `kind`+`recordedAt`);
  - `note_image` / `med_label` → `ocr` → extract symptoms / a `medications` row;
  - unknown → best-effort summary + `status:'error'` with a reason. Always writes `document_extractions` for traceability and sets `documents.status`/`summary`.
- **Research + knowledge update (the second trigger)**: after extraction the analyst delegates to `clinic/researcher#dive` for anything novel/abnormal (a new out-of-range analyte, a new medication interaction). The researcher writes the usual `research` rows **and appends cited `knowledge_notes`** — the durable knowledge the interpreter consults next time. Subscription-gated exactly like `requestResearch`; free tier extracts + flags but doesn't auto-dive.
- **Pages**: `/documents` (drag-drop upload, list with per-row status), `/documents/:id` (source summary + the extracted rows it created + linked research/notes; live-polls while `status` is pending).
- **Capabilities** (least-privilege): `records/analyst` → `db:read [documents, document_extractions, lab_results, metrics, medications, knowledge_notes]`, `db:write [documents, document_extractions, lab_results, metrics, symptoms, medications, knowledge_notes]`, `api:call [pdfExtract, ocr, csvParse]` (named bindings, keys hidden), `canDelegateTo: clinic/researcher#dive`. `clinic/researcher` gains `db:write [research, knowledge_notes]`.
- **Safety**: not-medical-advice framing unchanged; **sanitize all extracted text** (uploaded/OCR'd content is untrusted → XSS); blobs are strictly per-user pod-isolated and `**/.data/uploads/` is backup-excluded like `app.db`.

### Appointment prep brief — walk in ready
Directly serves the "walk into an appointment informed" pitch: a printable page a doctor skims in 30s.
- **Data**: `visit_briefs` table (`body` md, `periodFrom`, `periodTo`, `createdAt`).
- **API**: `prepareVisit` `POST api/visit-brief` `{ since? }` → delegates `clinic/interpreter#prep`,
  which compiles recent **flagged** labs, active/recent symptoms, metric trends, and ready research into
  a one-page brief **with questions to ask**.
- **Pages**: `/visits` — generate, view, print.

### Trends & correlations — signal, not just logs
Most people never spot the patterns in their own data; surfacing them is the assistant's edge.
- **Data**: `insights` table (`kind` `trend`|`correlation`|`anomaly`, `body`, `metricKind?`, `createdAt`).
- **Agent**: `clinic/interpreter#digest` (the existing daily cron) also computes rolling trends
  ("resting HR +8% over 3 weeks") and flags plausible correlations (poor sleep ↔ headaches) into
  `insights`. Framed as observations, never diagnoses.
- **Pages**: an insights strip on the dashboard (design-token colors only).

### Personal baselines — flag vs *your* normal
Catches "in range, but a sharp move from your own trend" — a genuinely assistant-grade read.
- **Behavior**: the `interpreter` computes a personal baseline from each analyte/metric's own history
  and flags deviations from *your* trend, not only the population reference range.
- **Data**: optional cached `personalLow`/`personalHigh` on `lab_results` (or computed live). No new caps.

### Follow-up reminders — close the loop
Turns a one-time flag into managed care over time — the thing people forget to do.
- **Data**: `followups` table (`topic`, `dueAt`, `reason`, `done` bool, optional `labResultId` FK).
- **Agent**: on an abnormal result the interpreter proposes a recheck ("recheck LDL in 3 months");
  `cron daily` surfaces due follow-ups.

### Wearable / export import — real data, not hand entry
Hand-logging is the adoption killer; ingesting an existing export makes the trends real from day one.
- **API**: `importMetrics` `POST api/metrics/import` `{ format: 'apple'|'google', payload }` → bulk
  `db.insert('metrics', …)` (dedupe on `kind`+`recordedAt`).

## Round 2 — feature expansion (implemented)

Round 1 shipped the core loop (six tables, the `clinic` space, twelve endpoints, three hooks, eight
pages) live-verified against DeepSeek. Round 2 folds the §"Additional features" backlog into the
product as **fully-implemented** capability, adds **two new project-scoped spaces**, and brings the
existing `clinic` space up to the **full space format**. Everything below is additive — round-1 files
and behaviour are unchanged. All new spaces read/write the **same** project-rooted db and feed the same
pages; cross-space work is wired through `hooks/` (declarative `trigger:` + self-querying agents,
exactly as round 1 — a hook delegate does not thread structured input, so an agent finds its own work).

### New spaces (now three total; the multi-space shape)
- **`records`** — document ingestion & extraction. Agents **`analyst`** (reads an uploaded document,
  extracts labs/metrics/medications into the db by kind, records provenance, and queues research on
  anything novel) and **`librarian`** (curates the durable `knowledge_notes` store and trusted
  `sources`). Kills hand-entry — the biggest friction in the core app.
- **`coaching`** — wellness coaching & follow-through. Agent **`coach`** (tracks `goals` against the
  user's own metrics, closes the loop with `followups`, and computes personal-baseline observations).
- **`clinic`** (existing) is **remediated to full format**: each agent gains a `charter.md` (already
  present) alongside `instruct.md`, and the space gains `functions/` (deterministic flag/trend/baseline
  helpers), `components/` (chat catalog cards), extensive `knowledge/` (reference-range interpretation,
  triage/red-flags with the not-a-doctor framing, literature-research standards), and `tasklists/`
  (the digest and visit-prep decompositions).

Every project space follows the six-part format (`agents/{charter,instruct}.md`, `tasklists/`,
`functions/`, `components/`, `knowledge/<field>/{index.md + ≥2 aspects}`).

### New tables (eight; plus two columns on `lab_results`)
`documents`, `document_extractions`, `knowledge_notes`, `visit_briefs`, `insights`, `followups`,
`goals`, `medications`. Row types (engine singularizer): `Document`, `DocumentExtraction`,
`KnowledgeNote`, `VisitBrief`, `Insight`, `Followup`, `Goal`, `Medication`. New columns
`lab_results.personalLow`/`personalHigh` cache the user's **own** baseline (mean ± 2·sd) so the
interpreter can flag a sharp move from your trend even when in the population range.

- **Document storage is inline (`documents.content`), not a blob file this round.** The parent plan's
  aspirational `.data/uploads/<id>/` blob path needs fs access from a worker-isolated handler and
  multipart parsing; to stay buildable/testable on the current engine, an upload carries its text (a
  pasted lab report, a CSV export, a note) in `content`, which the analyst parses. Binary PDFs/images
  are out of scope this round (the `kind` allow-list still records them; OCR/pdf-extract remain a
  future round needing a heavier dep). **All extracted/rendered text is sanitised** (untrusted → XSS).

### New API endpoints (sixteen; twenty-eight total)
| name | method + route | I/O sketch |
|---|---|---|
| `uploadDocument` | `POST api/documents` | `{ kind, filename, mime?, content }` → `{ documentId, status:'pending' }` (fires `analyze-document`) |
| `listDocuments` | `GET api/documents` | `{}` → `Document[]` |
| `getDocument` | `GET api/documents/:id` | `{ id }` → `Document & { extractions: DocumentExtraction[]; notes: KnowledgeNote[] }` |
| `prepareVisit` | `POST api/visit-brief` | `{ title?, since? }` → `{ visitBriefId, status:'pending' }` (fires `prepare-visit-brief`) |
| `listVisitBriefs` | `GET api/visit-brief` | `{}` → `VisitBrief[]` |
| `getVisitBrief` | `GET api/visit-brief/:id` | `{ id }` → `VisitBrief` |
| `listInsights` | `GET api/insights` | `{ kind? }` → `Insight[]` |
| `listFollowups` | `GET api/followups` | `{ dueOnly? }` → `Followup[]` |
| `completeFollowup` | `POST api/followups/:id/complete` | `{ id }` → `Followup` |
| `listGoals` | `GET api/goals` | `{}` → `Goal[]` |
| `createGoal` | `POST api/goals` | `{ title, metricKind?, target?, dueAt? }` → `Goal` |
| `updateGoal` | `PATCH api/goals/:id` | `{ id, current?, status?, dueAt? }` → `Goal` |
| `importMetrics` | `POST api/metrics/import` | `{ format:'apple'|'google'|'csv', payload }` → `{ imported }` (bulk insert, dedupe on kind+recordedAt) |
| `listMedications` | `GET api/medications` | `{}` → `Medication[]` |
| `addMedication` | `POST api/medications` | `{ name, dose?, schedule?, startedAt, note? }` → `Medication` |
| `listKnowledgeNotes` | `GET api/knowledge` | `{ analyte?, tag? }` → `KnowledgeNote[]` |

`prepareVisit` follows the robust round-1 shape: it inserts a **pending** `visit_briefs` row (firing the
`prepare-visit-brief` hook → the interpreter compiles it), rather than relying on a stubbed api `spawn`.

### New hooks (four; seven total)
- `analyze-document.ts` — **database** on `documents:insert` → `records/analyst#analyze` (self-queries
  pending docs; idempotent; loop-bounded by self-write exclusion).
- `prepare-visit-brief.ts` — **database** on `visit_briefs:insert` → `clinic/interpreter#prep`.
- `followup-reminders.ts` — **cron** daily 07:30 → `coaching/coach#reminders` (surfaces due follow-ups).
- `goal-checkin.ts` — **cron** daily 20:00 → `coaching/coach#checkin` (updates goal progress, proposes follow-ups).

### New pages (eight)
`/documents` (upload + list), `/documents/:id` (source summary + extracted rows + linked notes; live-polls
while pending), `/visits` (generate/list/print briefs), `/insights` (trends/correlations/anomalies strip),
`/followups` (due reminders + complete), `/goals` (create/track + `<Chat agent="coaching/coach">`),
`/knowledge` (browse the db-backed notes), `/medications` (list + log). New components: `DocumentRow`,
`UploadForm`, `ExtractionList`, `VisitBriefCard`, `InsightCard`, `FollowupRow`, `GoalCard`,
`KnowledgeNoteCard`, `ImportForm`, `MedicationRow`. Design tokens only (no raw colors).

### New / extended agent capabilities (least-privilege, per-verb table scope)
| Agent | `db:read` | `db:write` | other |
|---|---|---|---|
| **records/analyst** | `documents, document_extractions, lab_results, metrics, medications, knowledge_notes, settings` | `documents, document_extractions, lab_results, metrics, symptoms, medications, research` | `functions: [parseCsv, detectKind]` (deterministic parsing; omits web tools by design) |
| **records/librarian** | `knowledge_notes, sources, research, documents` | `knowledge_notes, sources` | — |
| **coaching/coach** | `metrics, lab_results, symptoms, goals, followups, insights, settings` | `goals, followups, insights` | `functions: [goalProgress, computeTrend]` |
| **clinic/interpreter** (extended) | + `visit_briefs, insights, followups` | + `visit_briefs, insights, followups` | new actions `prep`, personal-baselines + recheck follow-ups in `interpret` |
| **clinic/logger** (extended) | + `medications` | + `medications` | logs meds from chat |

No agent gains `db:schema`/`pages:write`/`api:write`/`hooks:write` — evolving the model stays a THING →
`system-appbuilder` authoring concern. The analyst queues research by inserting a pending `research`
row (firing the existing `research-deep-dive` hook → the researcher), so it holds **no** `canDelegateTo`
— the same hooks-over-shared-db shape as round 1, not agent-to-agent delegation.

## Round 3 — feature expansion (implemented)

Rounds 1–2 shipped the core loop plus document ingestion, visit briefs, insights, follow-ups, goals,
and medications — three project-scoped spaces (`clinic`, `records`, `coaching`), fourteen tables,
twenty-eight endpoints, seven hooks, sixteen pages. Round 3 turns the passive tracker into an **active
care-management system**: it tracks whether the user actually **takes** their medications
(adherence), checks the medication list for **literature-backed interactions**, coordinates
**appointments** and a **care team**, produces a shareable **care summary export**, and adds a
conservative, knowledge-grounded **symptom triage** assistant. Two new project-scoped spaces
(`pharmacy`, `care`) bring the app to **five spaces total**. Everything below is strictly additive —
round-1/2 files and behaviour are unchanged, all new spaces read/write the same project-rooted db and
feed the same pages, and cross-space work is wired through `hooks/` (declarative `trigger:` +
self-querying agents — a hook delegate threads no structured input, so an agent finds its own work).

### New spaces (now five total; the multi-space shape)
- **`pharmacy`** — medication adherence & safety. Agent **`pharmacist`** (a) tracks each dose the
  user records against its schedule and computes an **adherence rate**, surfacing missed/due doses each
  morning, and (b) on demand runs **literature-backed drug/food/supplement interaction reviews** over
  the user's medication list, writing cited findings. Subscription-gated for the literature review
  (the same gate as `requestResearch`); adherence tracking is free.
- **`care`** — care coordination & triage. Agents **`coordinator`** (compiles a **shareable care
  summary** from the whole record — labs, meds, insights, upcoming appointments — and surfaces
  upcoming **appointments**, auto-preparing a visit brief for imminent ones) and **`triage-nurse`** (a
  conservative symptom-triage assistant that reasons **only** over the curated `clinic`/`care` triage
  knowledge — red-flags, when-to-see-a-doctor — never the open web, and writes an **urgency
  observation**, never a diagnosis).

Every project space follows the six-part format (`agents/{charter,instruct}.md`, `tasklists/`,
`functions/`, `components/`, `knowledge/<field>/{index.md + ≥2 aspects}`).

### New tables (six; plus two columns + relations on existing tables)
`adherence_logs`, `interactions`, `appointments`, `care_contacts`, `care_shares`,
`triage_assessments`. Row types (engine singularizer): `AdherenceLog`, `Interaction`, `Appointment`,
`CareContact`, `CareShare`, `TriageAssessment` (note: `med_doses` would singularize to the ugly
`MedDos`, so the adherence table is named `adherence_logs` → `AdherenceLog`). New **columns**
`medications.refillsRemaining` (number) and `medications.reminderTime` (`'HH:MM'`) back the dose
reminder; they exercise the boot **additive `addColumn`** path. New **relations**: `medications.doses`
(hasMany `adherence_logs`) + `medications.interactions` (hasMany `interactions`); `symptoms.triage`
(hasMany `triage_assessments`, additive alongside the existing `research` relation);
`visit_briefs.appointments` (hasMany `appointments`); and the reverse `belongsTo` links
(`AdherenceLog.medication`, `Interaction.medication`, `TriageAssessment.symptom`, `Appointment.brief`).

- `adherence_logs` — one recorded/scheduled dose: `medicationId` FK→`medications` (cascade), `scheduledAt`,
  `takenAt` (null = not yet/missed), `status` (`'taken' | 'missed' | 'skipped' | 'pending'`), `note`.
- `interactions` — one interaction finding for a medication: `medicationId` FK→`medications` (cascade),
  `otherName` (the interacting drug/food/supplement), `severity` (`'minor' | 'moderate' | 'severe' |
  'unknown'`), `body` (md, cited; empty while pending), `status` (`'pending' | 'ready'`), `createdAt`.
- `appointments` — `title`, `provider`, `location`, `kind` (`'doctor' | 'lab' | 'imaging' | 'dental' |
  'other'`), `scheduledAt`, `status` (`'scheduled' | 'completed' | 'cancelled'`), `prepBriefId`
  FK→`visit_briefs` (setNull), `note`, `createdAt`.
- `care_contacts` — `name`, `role` (`'primary_care' | 'specialist' | 'pharmacy' | 'emergency' |
  'other'`), `organization`, `phone`, `email`, `note`, `createdAt`.
- `care_shares` — an exportable snapshot: `title`, `scope` (`'full' | 'labs' | 'meds' | 'summary'`),
  `body` (md, empty while pending), `status` (`'pending' | 'ready'`), `token` (opaque share token the
  handler generates), `createdAt`.
- `triage_assessments` — `symptomId` FK→`symptoms` (setNull, optional — a free-text question needs no
  symptom row), `question`, `body` (md observations + when-to-see-a-doctor, empty while pending),
  `urgency` (`'self_care' | 'routine' | 'urgent' | 'emergency' | 'unknown'`), `status`, `createdAt`.

### New API endpoints (sixteen; forty-four total)
| name | method + route | I/O sketch |
|---|---|---|
| `logDose` | `POST api/doses` | `{ medicationId, status?, scheduledAt?, takenAt?, note? }` → `AdherenceLog` |
| `listDoses` | `GET api/doses` | `{ medicationId?, dueOnly? }` → `AdherenceLog[]` |
| `getMedication` | `GET api/medications/:id` | `{ id }` → `Medication & { doses: AdherenceLog[]; interactions: Interaction[] }` |
| `checkInteractions` | `POST api/interactions` | `{ medicationId }` → `{ interactionId, status:'pending' }` — **subscription-gated (402)**; fires `check-interactions` |
| `listInteractions` | `GET api/interactions` | `{ medicationId? }` → `Interaction[]` |
| `listAppointments` | `GET api/appointments` | `{ upcomingOnly? }` → `Appointment[]` |
| `addAppointment` | `POST api/appointments` | `{ title, provider?, scheduledAt, kind?, location?, note? }` → `Appointment` |
| `updateAppointment` | `PATCH api/appointments/:id` | `{ id, status?, scheduledAt?, prepBriefId? }` → `Appointment` |
| `listContacts` | `GET api/contacts` | `{}` → `CareContact[]` |
| `addContact` | `POST api/contacts` | `{ name, role?, organization?, phone?, email?, note? }` → `CareContact` |
| `createShare` | `POST api/shares` | `{ title?, scope? }` → `{ shareId, status:'pending' }` — fires `compile-care-share` |
| `listShares` | `GET api/shares` | `{}` → `CareShare[]` |
| `getShare` | `GET api/shares/:id` | `{ id }` → `CareShare` |
| `requestTriage` | `POST api/triage` | `{ question, symptomId? }` → `{ triageId, status:'pending' }` — **free** (safety); fires `triage-symptom` |
| `listTriage` | `GET api/triage` | `{}` → `TriageAssessment[]` |
| `getTriage` | `GET api/triage/:id` | `{ id }` → `TriageAssessment` |

`checkInteractions`, `createShare`, and `requestTriage` all follow the robust round-1 shape: they
insert a **pending** row (firing the matching hook → the specialist compiles it), rather than relying
on a stubbed api `spawn`. `checkInteractions` gates on `settings.tier === 'subscription'` (402
otherwise) exactly like `requestResearch`; **`requestTriage` is deliberately free** — safety guidance
should not be paywalled.

### New hooks (five; twelve total)
- `check-interactions.ts` — **database** on `interactions:insert` → `pharmacy/pharmacist#review`
  (self-queries pending interaction rows, fills each via the universal `webSearch`/`webFetch` globals,
  loop-bounded because it only UPDATEs the row it fills).
- `compile-care-share.ts` — **database** on `care_shares:insert` → `care/coordinator#compile`.
- `triage-symptom.ts` — **database** on `triage_assessments:insert` → `care/triage-nurse#assess`.
- `dose-reminders.ts` — **cron** daily 09:00 → `pharmacy/pharmacist#reminders` (surfaces missed/due
  doses; computes today's adherence).
- `appointment-reminders.ts` — **cron** daily 07:00 → `care/coordinator#reminders` (surfaces upcoming
  appointments; for an appointment within 48h with no prep brief yet, inserts a pending `visit_briefs`
  row — which fires the existing `prepare-visit-brief` hook → the interpreter compiles it — and links
  it back via `updateAppointment`/`prepBriefId`, a clean cross-space chain over the shared db).

### New pages (ten)
`/doses` (today's dose checklist + adherence log), `/medications/:id` (medication detail: doses +
adherence rate + interactions + `<Chat agent="pharmacy/pharmacist">`), `/interactions` (interaction
findings list), `/appointments` (calendar/list + add), `/appointments/:id` (detail + linked prep brief
+ `<Chat agent="care/coordinator">`), `/contacts` (care team), `/shares` (create + list exports),
`/shares/:id` (printable care summary), `/triage` (ask a triage question + list), `/triage/:id`
(assessment detail + `<Chat agent="care/triage-nurse">`). New components: `DoseRow`, `DoseChecklist`,
`AdherenceBar`, `InteractionCard`, `SeverityBadge`, `AppointmentRow`, `AppointmentCard`, `ContactCard`,
`CareShareCard`, `TriageCard`, `UrgencyBadge`, `MedicationDetail`. Design tokens only (no raw colors;
severity/urgency badges reuse the existing `success`/`warning`/`destructive` flag-color convention).

### New / extended agent capabilities (least-privilege, per-verb table scope)
| Agent | `db:read` | `db:write` | other |
|---|---|---|---|
| **pharmacy/pharmacist** | `medications, adherence_logs, interactions, research, knowledge_notes, sources, settings` | `adherence_logs, interactions` | OMITS `functions:` → keeps universal `webSearch`/`webFetch` for interaction literature + the space's `adherenceRate`/`nextDoseDue` functions |
| **care/coordinator** | `metrics, lab_results, symptoms, medications, adherence_logs, research, insights, followups, visit_briefs, appointments, care_contacts, care_shares, settings` | `care_shares, appointments, visit_briefs` | `functions: [buildCareSummary]` (deny web by design — compiles from the db only; can fire the visit-brief chain) |
| **care/triage-nurse** | `symptoms, triage_assessments, metrics, lab_results, medications, knowledge_notes, settings` | `triage_assessments` | `functions: []` (deny **all** web + space functions — triage is grounded strictly in the curated `care/triage` knowledge, never the open web) |

No new agent gains `db:schema`/`pages:write`/`api:write`/`hooks:write` — evolving the model stays a
THING → `system-appbuilder` authoring concern. None holds `canDelegateTo`: the coordinator's
visit-brief chain and the pharmacist's/triage-nurse's work are all wired hooks-over-shared-db, not
agent-to-agent delegation (the same robust shape as rounds 1–2). The `coordinator` writes
`visit_briefs` (a pending row) to trigger the existing interpreter prep chain; it never sets a lab
`flag` or a research `body` — those stay owned by their respective clinic agents.

### Safety (round 3)
- **Triage is conservative by construction** — the `triage-nurse` holds `functions: []` (no web), so
  it cannot pull an unvetted internet claim into a triage answer; it reasons over the curated
  red-flags / when-to-see-a-doctor knowledge and always frames output as an **observation with an
  explicit "if X, seek care now" line**, never a diagnosis. Emergency-flagged assessments lead with a
  "this may need urgent care — contact a clinician / emergency services" banner.
- **The interaction reviewer never advises changing a medication** — it reports what the literature
  says about a pairing, cites sources, and defers to the user's clinician/pharmacist; the not-a-doctor
  line is unchanged.
- **The care-share export is per-user and pod-isolated** — `token` is an opaque local id for the
  printable page; there is **no** cross-user or public share surface in this round (health data stays
  strictly per-user, per the parent plan). All rendered/exported text is sanitised (untrusted → XSS).

## Phases & order

Assumes the parent plan's engine (db + capability globals, api runtime, typed-contract build, pages
build, hooks runtime, chat) exists. Health-specific work on top:

1. **Schemas** — the six `database/*.json`; verify the two optional FKs on `research` resolve, required
   descriptions pass the fail-loud loader; row + relation types generate (`LabResult.research`,
   `Research.lab`/`Research.symptom`).
2. **`clinic` space** — the three agents' `instruct.md` (config-bearing `capabilities:` — per-verb
   `tables`, interpreter reads `settings`, researcher uses the universal `webSearch`/`webFetch` globals
   — see the round-1 engine-truth note) plus tasklists for `interpret`/`digest`/`deep-dive`. (The
   credentialed **`pubmedSearch` named binding** is deferred to round 2+ — it needs the external-binding
   registry built in `sdk/org` first.)
3. **API** — the nine endpoints; tier gate on `requestResearch`; `getLab` `include` research.
4. **Hooks** — `interpret-new-lab` (database:insert) + `daily-digest` (cron); confirm the
   interpret→(maybe)research loop is bounded (self-write-excluded `flag`, no `research` cascade).
5. **Pages** — dashboard charts (token-gated colors), labs list/detail (flag + research), symptoms,
   research page (+ researcher chat), settings (disclaimer ack); wire `useApi` + `<Chat>`.
6. **Serving** — seed each pod's `health` project from the checked-in template (with the `settings`
   row); serve under `lmthing.app/health/*`; alias `lmthing.health/*` → pod `/app/health/*`; Studio
   manages it under `/api/projects/health/app`.
7. **Grow-with-you demo** — a scripted THING → `system-appbuilder` run that adds a `medications` table
   + page + reminder hook, proving `db:schema`/`pages:write`/`hooks:write` "write + apply" live.
8. **Tiers** — Stripe entitlement → `settings.tier` via the gateway webhook; budget-window wiring.
9. **Additional features** — appointment prep brief, trends/correlations, personal baselines, follow-up
   reminders, wearable import (see §"Additional features"); each is additive (new tables/endpoints/
   digest logic), shippable after the core loop.
10. **Docs** — fold into `org/docs/format/project/` as a worked example.

## Verification (end-to-end, local)

1. Load the `health` project → schemas validate (descriptions/FK/relations), `types/generated.d.ts` has
   `Metric`/`LabResult`/`Symptom`/`Research`/`Source`/`Setting` with relation fields
   (`LabResult.research: Research[]`, `Research.lab`/`Research.symptom`).
2. `lmthing serve`; `GET localhost:8080/app/health/` renders the dashboard (client-side), which calls
   `GET …/app/health/api/metrics?kind=weight`.
3. `addLab { analyte:'LDL', value:190, refHigh:130, takenAt }` (mock streamFn): `interpret-new-lab`
   fires → interpreter sets `flag:'high'`; **subscription** tier → a pending `research` row is created
   and the researcher (mock `pubmedSearch`) fills it `status:'ready'`; the lab page shows the flag +
   report. **Free** tier → flag set, **no** auto-research.
4. `requestResearch` on free tier → **402**; on subscription → `{ status:'pending' }` then the report
   appears; `<Chat agent="clinic/researcher">` follow-up updates the same `research` row; history under
   `health/spaces/clinic/sessions/`.
5. `apiCall('logMetric', { value:'heavy' })` (wrong type) **fails the agent typecheck** (DTS overload);
   an un-allowlisted `apiCall` name → host error naming allowed names; the researcher calling anything
   but `[pubmedSearch, webSearch]` → allowlist error; the logger writing `research` (not in its
   `db:write`) → table-scope error.
6. **Self-evolution**: a scripted THING run — "add a medications schedule with a daily reminder" →
   delegates `system-appbuilder`; `data-modeler` `db.createTable('medications', …)` (migration runs),
   `page-builder` adds `/medications` (bundle rebuilds, page serves), `automator` `writeHook` adds the
   cron (crontab/registry reloads). The clinic agents, lacking authoring caps, **cannot** do this — a
   clinic attempt to `db.createTable` fails the DTS gate.
7. cron `daily-digest` at `daily:'08:00'` (test a `every:'5m'` variant, local fallback tick): restart →
   one boot catch-up run; immediate second restart → no double-run; budget-exhausted → single coalesced
   pending entry, runs on the next attempt after the window rolls.
8. Backup: `app.sql` + schemas + pages + api + hooks + clinic space committed; `**/sessions/` not;
   restore rebuilds `app.db` from `app.sql`.

## Notes & Safety

- **Reuses the parent engine wholesale** — no health-specific runtime; data + agents + pages + hooks on
  the shared layer. If a mechanism is missing here, it belongs in
  [the project-as-application model](../org/docs/format/project/README.md), not a health fork.
- **Why it's a good AI-assisted app** — most people have health data (labs, wearables, symptoms) they
  can't interpret and won't research systematically. Turning that into understanding — flagging what
  matters, summarizing the literature, keeping context over time — is high-value work the user can't
  easily do themselves, bounded by a clear not-a-doctor line.
- **Not medical advice — enforced in the product, not just the docs.** `settings.acceptedDisclaimer`
  gates first use; the researcher/interpreter charters state they summarise the user's own data and the
  literature, cite sources, and never diagnose, prescribe, or urge stopping treatment; the UI shows a
  standing disclaimer. This is a deliberate product constraint, not a runtime capability.
- **Health data is maximally private** — strictly per-user pod isolation, no public/cross-user surface;
  `**/sessions/` (which can contain health questions) follows the parent plan's backup-exclusion —
  flag explicitly if research chat history should be made durable, given its sensitivity.
- **Reference ranges** are stored per result (`refLow`/`refHigh`) rather than in a global table, so a
  lab's own quoted range travels with the value; deriving/normalising ranges is an interpreter prompt
  concern, not a schema one.
