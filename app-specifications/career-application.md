# lmthing.career as a Project-Application — the `career` project

> A concrete instantiation of [project-as-application.md](./project-as-application.md) for a
> **job-search command center**: you paste a job posting URL, an **`agency`** space of agents fetches
> and parses it, tailors your resume and cover letter from a structured fact base (never inventing a
> word of experience), preps you for interviews with researched briefs, and nudges you when an
> application goes stale. The `career` project owns the app — `database/` (profile facts, postings,
> applications, activities, documents, settings), `pages/` (client React pipeline board / posting /
> application / profile), `api/` (named typed Node endpoints), `hooks/` (a `database` enrich hook +
> a daily follow-up cron + an interview-brief hook), and the project-scoped `agency` space. Read the
> parent plan first for the shared mechanisms (capability globals, typed-contract pipeline, serving);
> this file is the career-specific shape. Paths are relative to the org repo root.

## Context

A job search is a second job with terrible tooling: dozens of tabs, a spreadsheet that dies in week
two, a "base resume" mangled per-application at 1am, and follow-ups that never happen. This app runs
the search as a pipeline. You maintain one **fact base** — your experience, skills, and achievements
as structured entries, written once. Paste a posting URL and the `scout` fetches it, extracts the
role, requirements, and salary, and files it. One click and the `tailor` drafts a resume and cover
letter **assembled strictly from your facts**, reordered and reworded against the posting's
requirements — with a hard charter rule that it may never fabricate experience. When you log an
interview, the `coach` researches the company and writes a prep brief; every day it sweeps the
pipeline and drafts the follow-up you'd otherwise forget. **The value is that every application ships
with tailored, truthful documents and nothing falls through the cracks** — the discipline of a great
recruiter working only for you. (There is no `career/` domain today — it's a net-new
project-application, served under the generic `lmthing.app/<project>/` mount.)

## The project

- **Project id**: `career`. One per user pod (your work history and search = per-user, sensitive
  data). A user runs many applications as rows; the *project* is the search machine, not one job.
- **Project-scoped space**: `career/spaces/agency/` — the specialists that maintain the app
  (`scout`, `tailor`, `coach`). Because the db is **project-rooted**, all three read/write the
  **same** tables and feed the **same** pages (the multi-agent-application shape).
- **THING** builds/evolves the app by delegating to `system-appbuilder` (parent plan
  §"system-appbuilder") — "add a salary-negotiation tracker", "track freelance leads separately"
  are authoring requests. **Runtime** work is the `agency` agents, driven by hooks, api handlers,
  and chat — not THING.
- **Provisioning**: v1 seeds the `career` project from a checked-in template materialized into the
  pod's `<root>/career/`, with an empty fact base and a short onboarding card on `/profile`
  ("paste your current resume into chat and the coach will file it as facts"). In a **later phase**
  it becomes **installable from lmthing.store** as a project app (parent plan §Risks
  "Distribution").

## Directory layout

```
career/
├── package.json              # react, @tanstack/react-router, @lmthing/{ui,css}, lucide-react …
├── database/
│   ├── profile_facts.json    # the structured "master resume": one fact per row
│   ├── postings.json         # a fetched + parsed job posting
│   ├── applications.json     # one application: posting + stage + dates (the pipeline row)
│   ├── activities.json       # timeline events on an application (applied, interview, follow-up…)
│   ├── documents.json        # generated artifacts: resume, cover letter, brief, thank-you
│   └── settings.json         # single row: follow-up cadence, target roles, tone
├── pages/                    # client-side React SPA
│   ├── _app.tsx              # QueryClient + design-system theme provider
│   ├── _layout.tsx           # nav chrome: Pipeline · Postings · Profile
│   ├── index.tsx             # "/"                     → the pipeline board (stage columns)
│   ├── postings/
│   │   ├── index.tsx         # "/postings"             → saved postings (+ paste-a-URL box)
│   │   └── [id].tsx          # "/postings/:id"         → parsed posting + "apply" action
│   ├── applications/
│   │   └── [id].tsx          # "/applications/:id"     → timeline + documents + stage controls
│   ├── documents/[id].tsx    # "/documents/:id"        → one document (markdown, copyable)
│   └── profile.tsx           # "/profile"              → the fact base (+ coach chat dock)
├── components/               # StageColumn, ApplicationCard, PostingHeader, FactRow, DocumentView…
├── api/
│   ├── postings/
│   │   ├── GET.ts                    # listPostings
│   │   ├── POST.ts                   # addPosting     (url → stub row; enrich hook fills it)
│   │   └── [id]/GET.ts               # getPosting
│   ├── applications/
│   │   ├── GET.ts                    # pipeline       (the deterministic centrepiece)
│   │   ├── POST.ts                   # createApplication
│   │   └── [id]/
│   │       ├── GET.ts                # getApplication (include posting, activities, documents)
│   │       ├── PATCH.ts              # updateStage
│   │       └── tailor/POST.ts        # tailorDocuments (delegates the tailor, returns immediately)
│   ├── activities/
│   │   └── POST.ts                   # logActivity    (interview activities trigger the brief hook)
│   ├── documents/
│   │   ├── GET.ts                    # listDocuments
│   │   └── [id]/GET.ts               # getDocument
│   ├── profile/
│   │   ├── GET.ts                    # listFacts
│   │   ├── POST.ts                   # addFact
│   │   └── [id]/PATCH.ts             # updateFact (edit / retire)
│   └── stats/GET.ts                  # careerStats (board counts + response rate)
├── hooks/
│   ├── enrich-posting.ts     # database postings:insert → agency/scout#enrich (webFetch + parse)
│   ├── follow-up.ts          # cron daily 09:00 → agency/coach#nudge (stale applications)
│   └── prep-brief.ts         # database activities:insert → agency/coach#brief (interviews only)
├── spaces/
│   └── agency/               # project-scoped space (agents / tasklists / knowledge)
│       └── agents/{scout,tailor,coach}/instruct.md
├── types/generated.d.ts      # GENERATED — row + endpoint I/O types (incl. relation fields)
└── .data/
    ├── app.db                # SQLite (WAL)
    ├── app.sql               # backup dump
    └── hooks-state.json      # cron last-run / pending queue
```

## Database (schemas — descriptions mandatory, FKs + relations)

Career is the **document-pipeline** example: a fact base feeds a generator whose outputs are
first-class rows (`documents`), and the pipeline row (`applications`) is a small state machine whose
staleness the cron computes from its `activities`. Every table and column carries a required
`description`; the loader fails loud on any missing one.

```json
// database/profile_facts.json — the structured master resume
{ "title": "Profile facts",
  "description": "One verifiable fact about the user's career: a role held, a skill, an achievement with numbers, an education entry, a preference, or a link. The ONLY source the tailor may draw on.",
  "columns": {
    "id":        { "type": "string",  "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "kind":      { "type": "string",  "description": "'experience' | 'skill' | 'achievement' | 'education' | 'preference' | 'link'", "required": true },
    "title":     { "type": "string",  "description": "short headline, e.g. 'Senior Engineer @ Acme (2021-2024)' or 'PostgreSQL'", "required": true },
    "body":      { "type": "string",  "description": "the substance, markdown — responsibilities, numbers, context. For 'achievement': concrete and quantified", "required": true },
    "tags":      { "type": "json",    "description": "array of match keywords, e.g. ['backend','postgres','team-lead']" },
    "fromYear":  { "type": "number",  "description": "start year, for experience/education ordering" },
    "toYear":    { "type": "number",  "description": "end year; null = ongoing" },
    "retired":   { "type": "boolean", "description": "excluded from tailoring when true (old/irrelevant facts are retired, not deleted)", "default": false },
    "source":    { "type": "string",  "description": "'user' | 'agent' — agent = filed by the coach from pasted-resume chat", "default": "user" },
    "createdAt": { "type": "date",    "description": "when the fact was added", "generated": "now" } } }
```

```json
// database/postings.json
{ "title": "Postings",
  "description": "A job posting: pasted as a URL, fetched and parsed by the scout into structured fields.",
  "columns": {
    "id":           { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "url":          { "type": "string", "description": "the posting URL; dedupe key", "required": true, "unique": true },
    "company":      { "type": "string", "description": "company name (parsed; 'pending' until enriched)", "default": "pending" },
    "role":         { "type": "string", "description": "job title (parsed)", "default": "pending" },
    "location":     { "type": "string", "description": "location string as posted, e.g. 'Berlin / remote EU'" },
    "salary":       { "type": "string", "description": "salary text if the posting states one, verbatim" },
    "descriptionMd":{ "type": "string", "description": "the posting body, cleaned to markdown by the scout" },
    "requirements": { "type": "json",   "description": "array of extracted requirement strings, used by the tailor for matching" },
    "status":       { "type": "string", "description": "'pending' | 'enriched' | 'fetch-failed' | 'closed'", "default": "pending" },
    "fetchedAt":    { "type": "date",   "description": "when the scout last fetched it" },
    "createdAt":    { "type": "date",   "description": "when the URL was saved", "generated": "now" } },
  "relations": {
    "applications": { "hasMany": "applications", "via": "postingId", "description": "applications made to this posting" } } }
```

```json
// database/applications.json — the pipeline row
{ "title": "Applications",
  "description": "One application to one posting, moving through the pipeline stages. The board on '/' is this table grouped by stage.",
  "columns": {
    "id":        { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "postingId": { "type": "string", "description": "the posting applied to", "required": true,
                   "references": { "table": "postings", "column": "id", "onDelete": "restrict" } },
    "stage":     { "type": "string", "description": "'saved' | 'applied' | 'screening' | 'interview' | 'offer' | 'rejected' | 'accepted' | 'withdrawn'", "default": "saved" },
    "appliedAt": { "type": "date",   "description": "when stage first moved to 'applied'" },
    "closedAt":  { "type": "date",   "description": "when stage entered a terminal state (rejected/accepted/withdrawn)" },
    "notes":     { "type": "string", "description": "free-form user notes on this application, markdown" },
    "createdAt": { "type": "date",   "description": "when the application was created", "generated": "now" } },
  "relations": {
    "posting":    { "belongsTo": "postings",  "via": "postingId",     "description": "the posting" },
    "activities": { "hasMany":  "activities", "via": "applicationId", "description": "the timeline of events" },
    "documents":  { "hasMany":  "documents",  "via": "applicationId", "description": "documents generated for it" } } }
```

```json
// database/activities.json — the application timeline
{ "title": "Activities",
  "description": "One event on an application's timeline: applied, a scheduled interview, a follow-up (drafted by the coach or logged by the user), a response, or a note.",
  "columns": {
    "id":            { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "applicationId": { "type": "string", "description": "the application this event belongs to", "required": true,
                       "references": { "table": "applications", "column": "id", "onDelete": "cascade" } },
    "type":          { "type": "string", "description": "'applied' | 'interview' | 'follow-up' | 'response' | 'note'", "required": true },
    "at":            { "type": "date",   "description": "when the event happened / is scheduled (interviews are future-dated)", "required": true },
    "title":         { "type": "string", "description": "one-line summary shown on the timeline, e.g. 'Tech screen with Dana (CTO)'", "required": true },
    "body":          { "type": "string", "description": "detail, markdown — for coach follow-ups this is the drafted message, ready to copy" },
    "source":        { "type": "string", "description": "'user' | 'agent' — agent = written by the coach", "default": "user" },
    "createdAt":     { "type": "date",   "description": "when the row was written", "generated": "now" } },
  "relations": {
    "application": { "belongsTo": "applications", "via": "applicationId", "description": "the application" } } }
```

```json
// database/documents.json — generated artifacts
{ "title": "Documents",
  "description": "A generated artifact tied to an application: a tailored resume, cover letter, interview prep brief, or thank-you note. Markdown, versioned, copy-out.",
  "columns": {
    "id":            { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "applicationId": { "type": "string", "description": "the application it was generated for", "required": true,
                       "references": { "table": "applications", "column": "id", "onDelete": "cascade" } },
    "kind":          { "type": "string", "description": "'resume' | 'cover-letter' | 'brief' | 'thank-you'", "required": true },
    "title":         { "type": "string", "description": "display title, e.g. 'Resume — Acme Senior Engineer v2'", "required": true },
    "body":          { "type": "string", "description": "the document, markdown", "required": true },
    "version":       { "type": "number", "description": "1-based version per (application, kind); re-tailoring writes a new version, never overwrites", "default": 1 },
    "factIds":       { "type": "json",   "description": "array of profile_facts ids the document drew on — the provenance trail for the no-fabrication rule", "required": true },
    "createdAt":     { "type": "date",   "description": "when it was generated", "generated": "now" } },
  "relations": {
    "application": { "belongsTo": "applications", "via": "applicationId", "description": "the application" } } }
```

```json
// database/settings.json — single row
{ "title": "Settings",
  "description": "Single-row app settings. Seeded on provisioning; edited via the profile page.",
  "columns": {
    "id":            { "type": "string", "description": "always 'settings'", "primaryKey": true },
    "followUpDays":  { "type": "number", "description": "days of silence after 'applied'/'screening' before the coach drafts a follow-up", "default": 7 },
    "targetRoles":   { "type": "json",   "description": "array of role strings the user is hunting for (steers the coach's advice)" },
    "tone":          { "type": "string", "description": "writing voice for generated documents: 'plain' | 'warm' | 'formal'", "default": "plain" },
    "briefLeadHours":{ "type": "number", "description": "how many hours before an interview the brief should exist (drives the brief hook's urgency)", "default": 24 } } }
```

- **`profile_facts` is the integrity anchor** — the tailor's charter permits it to *select, order,
  and reword* facts, never to add. `documents.factIds` records exactly which facts each document
  used, so a user can audit any line back to its source ("where did this claim come from?" has a
  clickable answer).
- **`onDelete` is deliberate**: `applications.postingId` is `restrict` (a posting with applications
  can't vanish under the board) while `activities`/`documents` cascade with their application;
  `postings.url` unique makes re-pasting a URL a no-op at the handler.
- **Terminal stages keep their history** — `rejected`/`accepted`/`withdrawn` set `closedAt` and drop
  off the active board but stay queryable; `careerStats` computes response rate from exactly this.

## Pages (client React, file-based routing)

Data comes from the generated typed client `useApi(name, input)` — no pod-side loaders. Relation
fields arrive typed, so an application page renders its timeline and documents with no extra fetch.

| File | Route | Reads / writes |
|---|---|---|
| `pages/index.tsx` | `/` | `pipeline` (board columns + staleness badges); `updateStage` on drag |
| `pages/postings/index.tsx` | `/postings` | `listPostings`; `addPosting` (paste box) |
| `pages/postings/[id].tsx` | `/postings/:id` | `getPosting`; `createApplication` |
| `pages/applications/[id].tsx` | `/applications/:id` | `getApplication` (include posting, activities, documents); `logActivity`, `tailorDocuments`, `updateStage` |
| `pages/documents/[id].tsx` | `/documents/:id` | `getDocument` (markdown + copy button + provenance fact list) |
| `pages/profile.tsx` | `/profile` | `listFacts`; `addFact`/`updateFact`; `<Chat agent="agency/coach">` dock |

A freshly pasted posting shows `status:'pending'`; `/postings` polls `listPostings` until the scout
flips it to `enriched`, so parsed fields fill in live (the "pages are a live read view" property).
While a tailor run is in flight the application page polls `getApplication` and the new document
versions appear as they land.

```tsx
// pages/index.tsx → "/" — the pipeline board
import type { Output as Pipeline } from '../types/generated'   // pipeline endpoint Output
import { useApi } from '@app/runtime'
import { StageColumn } from '../components/StageColumn'

const STAGES = ['saved', 'applied', 'screening', 'interview', 'offer'] as const

export default function Board() {
  const { data, isLoading } = useApi('pipeline', {})
  if (isLoading) return <Spinner />
  return (
    <div className="board">   {/* grid of columns; stale cards get a badge styled with var(--warning-ish token) */}
      {STAGES.map((stage) => (
        <StageColumn key={stage} stage={stage} cards={data.columns[stage]} />
      ))}
    </div>
  )
}
```

## API (named, typed, Node handlers)

Endpoint = dir, method = filename; each exports `name`/`description`/`Input`/`Output` + default
handler `(input, { db, delegate, apiCall })`. Dual-addressed (HTTP for the browser, `name` for
agents via `apiCall`).

| name | method + route | I/O sketch |
|---|---|---|
| `listPostings` | `GET api/postings` | `{ status? }` → `Posting[]` |
| `addPosting` | `POST api/postings` | `{ url }` → `Posting` (stub; enrich hook fills it) |
| `getPosting` | `GET api/postings/:id` | `{ id }` → `Posting & { applications }` |
| `pipeline` | `GET api/applications` | `{}` → `{ columns: { [stage]: PipelineCard[] } }` |
| `createApplication` | `POST api/applications` | `{ postingId }` → `Application` |
| `getApplication` | `GET api/applications/:id` | `{ id }` → `Application & { posting, activities, documents }` |
| `updateStage` | `PATCH api/applications/:id` | `{ id, stage }` → `Application` (stamps appliedAt/closedAt) |
| `tailorDocuments` | `POST api/applications/:id/tailor` | `{ id, kinds?: ('resume'\|'cover-letter')[] }` → `{ status:'tailoring' }` |
| `logActivity` | `POST api/activities` | `{ applicationId, type, at, title, body? }` → `Activity` |
| `listDocuments` | `GET api/documents` | `{ applicationId? }` → `Document[]` (no body) |
| `getDocument` | `GET api/documents/:id` | `{ id }` → `Document` |
| `listFacts` | `GET api/profile` | `{ kind? }` → `ProfileFact[]` |
| `addFact` | `POST api/profile` | `{ kind, title, body, tags? }` → `ProfileFact` |
| `updateFact` | `PATCH api/profile/:id` | `{ id, title?, body?, tags?, retired? }` → `ProfileFact` |
| `careerStats` | `GET api/stats` | `{}` → `{ active, interviews, offers, responseRate, staleCount }` |

> **Row-type note (engine truth).** The generated row-interface names follow the engine's
> deterministic singularizer (`build/schema.ts`): `activities → Activity` (`…ies → …y`),
> `profile_facts → ProfileFact`, `postings → Posting`, `settings → Setting`. Pages and handlers
> import these from `@app/types`.

```ts
// api/applications/GET.ts → GET .../api/applications ; name "pipeline"
/** The board: active applications grouped by stage, each card carrying computed staleness. */
export const name = 'pipeline'
export const description = 'Active applications grouped by stage, with days-since-last-activity computed per card (the staleness the follow-up cron acts on).'

export interface Input  {}
export interface Output { columns: Record<string, Array<{
  id: string; company: string; role: string; stage: string
  daysSinceActivity: number; stale: boolean; nextInterviewAt?: string }>> }

export default async function handler(_: Input, ctx: { db: AsyncDbApi }): Promise<Output> {
  const settings = (await ctx.db.query('settings', {}))[0]
  // where is equality-only: read active apps wide (terminal stages filtered in JS), include relations.
  const apps = (await ctx.db.query('applications', { include: ['posting', 'activities'] }))
    .filter((a) => !['rejected', 'accepted', 'withdrawn'].includes(a.stage))
  const now = Date.now()
  const columns: Output['columns'] = { saved: [], applied: [], screening: [], interview: [], offer: [] }
  for (const a of apps) {
    const last = a.activities.reduce((m, x) => Math.max(m, Date.parse(x.at)), Date.parse(a.createdAt))
    const days = Math.floor((now - last) / 86400000)
    const upcoming = a.activities
      .filter((x) => x.type === 'interview' && Date.parse(x.at) > now)
      .sort((x, y) => Date.parse(x.at) - Date.parse(y.at))[0]
    columns[a.stage]?.push({
      id: a.id, company: a.posting.company, role: a.posting.role, stage: a.stage,
      daysSinceActivity: days,
      stale: ['applied', 'screening'].includes(a.stage) && days >= settings.followUpDays,
      nextInterviewAt: upcoming?.at,
    })
  }
  return { columns }
}
```

- `pipeline` is the doc's **deterministic centrepiece** — the *same* staleness computation the
  `follow-up` cron's coach uses (it calls `apiCall('pipeline')`), so the badge on the board and the
  drafted follow-up can never disagree about who's stale.
- `tailorDocuments` is **fire-and-forget** (parent-plan `generatePlan` pattern): it delegates
  `agency/tailor#tailor` with the application id and returns; the page polls documents in.
- `updateStage` owns the state machine bookkeeping: first move to `applied` stamps `appliedAt` and
  writes an `applied` activity; a terminal move stamps `closedAt`.

## Hooks

```ts
// hooks/enrich-posting.ts — fetch + parse a pasted posting URL
export default {
  type: 'database',
  on: { table: 'postings', event: 'insert' },
  budget: { maxEpisodes: 8, maxWallClockMs: 300000 },
  handler: async ({ row, delegate }) => {
    await delegate('agency/scout', 'enrich', { input: { postingId: row.id } })
  },
}
```

```ts
// hooks/follow-up.ts — daily sweep for stale applications
export default {
  type: 'cron',
  daily: '09:00',
  trigger: 'agency/coach#nudge',
  budget: { maxEpisodes: 12, maxWallClockMs: 600000 },
}
```

```ts
// hooks/prep-brief.ts — write an interview brief when an interview is scheduled
export default {
  type: 'database',
  on: { table: 'activities', event: 'insert' },
  budget: { maxEpisodes: 10, maxWallClockMs: 600000 },
  handler: async ({ row, delegate }) => {
    // Only future interviews need a brief; every other activity type is a no-op here.
    if (row.type !== 'interview' || Date.parse(row.at) <= Date.now()) return
    await delegate('agency/coach', 'brief', { input: { applicationId: row.applicationId, activityId: row.id } })
  },
}
```

- **The loops are bounded**: the scout *updates* `postings` (hook watches `insert` only — no
  refire). The coach's `nudge` writes `follow-up` activities — which *do* land in the
  `activities:insert` hook, but its handler no-ops on anything that isn't a future-dated
  `interview`, and **self-write exclusion** backstops the coach re-triggering itself; the `brief`
  action writes only `documents` (unwatched). **Per-hook coalesce** collapses a burst of pasted
  URLs into sequential enrich runs without stacking duplicates.
- **`nudge` never sends anything** — it *drafts*: a `follow-up` activity whose `body` is the
  ready-to-copy message. Outbound email is explicitly out of scope (see Notes/Safety); the human
  clicks send in their own mail client.
- Cron timing is the parent plan's **crond → hook-run endpoint** mechanism
  (`POST /api/projects/career/hooks/follow-up/run`); a day missed while the pod was down runs once
  via boot catch-up (the coach dedupes: no second follow-up draft while one is the latest activity);
  local dev uses the in-process fallback tick.

## Chat (the coach's office)

One drop-in `<Chat agent="agency/coach" />` widget on `/profile`, reusing the always-available
multisession WS endpoint (parent plan §Chat) — the binding is a runtime prop, no `chats/` dir:

- **Onboarding**: paste your current resume as text — the coach parses it and files
  `profile_facts` rows (`source:'agent'`), which you then curate on the same page. This kills the
  cold-start chore in one paste.
- "What should I emphasize for the Acme role?" → the coach reads the posting's `requirements`
  against your facts and answers with the overlap and the gaps.
- "Prep me for Thursday's interview" → reads the brief document (or delegates `brief` if missing)
  and runs a Q&A drill from it.
- History persists at `career/spaces/agency/sessions/<id>` (project-session snapshot form,
  resumable). This is the one place the catalog descriptor renderer re-enters the app — pages stay
  real React.

## The `agency` space (agents + capabilities)

Project-scoped at `career/spaces/agency/`. Capabilities are least-privilege per agent — one
config-bearing `capabilities:` frontmatter key, table scope **per verb** (parent plan §"Capability
globals"):

| Agent | `db:read` tables | `db:write` tables | `api:call` allow | `functions` | Role |
|---|---|---|---|---|---|
| **scout** | `postings, settings` | `postings` | — | `webFetch, webSearch` | fetch a posting URL, clean to markdown, extract company/role/salary/requirements; mark `fetch-failed` honestly |
| **tailor** | `profile_facts, postings, applications, documents, settings` | `documents` | — | `[]` (none) | assemble resume/cover letter from facts vs requirements; record `factIds`; never invent |
| **coach** | `applications, postings, activities, documents, profile_facts, settings` | `activities, documents, profile_facts` | `pipeline` | `webSearch, webFetch` | daily nudge drafts, interview briefs (company research), profile onboarding chat |

```yaml
# career/spaces/agency/agents/tailor/instruct.md frontmatter — the integrity wall
capabilities:
  - db:read:  { tables: [profile_facts, postings, applications, documents, settings] }
  - db:write: { tables: [documents] }        # output only; can never edit the fact base it draws on
functions: []                                 # NO web: a tailor that can browse can launder fabrication as "research"
```

```yaml
# career/spaces/agency/agents/coach/instruct.md frontmatter — reads wide, writes the timeline
capabilities:
  - db:read:  { tables: [applications, postings, activities, documents, profile_facts, settings] }
  - db:write: { tables: [activities, documents, profile_facts] }   # facts only via onboarding chat, source:'agent'
  - api:call: { names: [pipeline] }
functions: [webSearch, webFetch]              # company research for briefs
```

- **The tailor's `functions: []` is a design statement, not an omission** — everything it may say
  about you is in `profile_facts`, so cutting the web makes the no-fabrication charter *mechanically
  easier to honor* and auditable via `factIds`. Its charter adds the prose half: select/order/reword
  only; a requirement you don't meet is *addressed honestly* in the cover letter, never papered
  over. (Tool bans live in frontmatter; conduct rules live in the charter — parent plan gotcha.)
- **The tailor's `tailor` tasklist** runs a match step (score facts against `requirements`), then a
  `forEach` over the requested `kinds` (resume, cover-letter) — the host fans out one drafting fork
  per document; the model never writes the loop.
- **The coach reads `pipeline` via `apiCall`, not by reimplementing staleness** — one definition of
  "stale" for board badge, cron draft, and chat answer alike.
- **The scout fails loud** — an unfetchable/paywalled URL becomes `status:'fetch-failed'` with the
  reason in `descriptionMd`, so the UI shows a retry affordance instead of a forever-pending stub.
- **No `db:schema`/`pages:write`/`api:write` here** — the agency *operates* the app. "Track
  negotiation offers side-by-side" is an authoring request → THING → `system-appbuilder`.

## Serving & domains

- **Local CLI**: `localhost:8080/app/career/…` (pages) and `localhost:8080/app/career/api/<name>` —
  the parent plan's mount, `<project>` = `career`.
- **Prod**: served under the **generic authenticated `lmthing.app` domain** at
  `lmthing.app/career/*` → the authenticated user's pod `/app/career/*` (Envoy JWT + per-user
  routing). No pre-existing static SPA to replace; a `lmthing.career` alias is an optional later
  edge-alias.
- **Admin/dev**: `lmthing.studio` manages it via `/api/projects/career/app` (manifest, data
  browser, manual hook run, build status, live preview iframe of `…/app/career/`).

**No public/shared surface** — every route and endpoint is an authenticated, per-user pod
read/write; documents are copy-out artifacts the user sends through their own channels.

## Additional features (more user value)

The core loop wins when documents are truthful and nothing goes stale; these compound it. Each is
**additive** on the same engine.

### Interview debriefs — close the learning loop
- **Flow**: after an interview's `at` passes, the coach's daily nudge asks (via a drafted `note`
  activity) "how did it go?"; the user answers in chat; the coach files a debrief `note` and updates
  `profile_facts` tags for questions that exposed gaps.
- **Agent**: coach only — no new tables.

### Job-feed scouting — postings come to you
- **Data**: `searches` (query string, location, active) — saved hunting queries.
- **Hook**: `scout-feed.ts` cron daily → `agency/scout#hunt`: `webSearch` each active query, insert
  novel postings (the `url` unique dedupes), which the existing enrich hook then parses. Fully
  reuses the paste-a-URL machinery.

### Offer comparison — the endgame page
- **Data**: `offers` (applicationId, base, equity, bonus, benefits json, deadline).
- **API**: `compareOffers` → normalized totals side-by-side (deterministic math in the handler).
- **Agent**: the coach drafts negotiation talking points from the delta — numbers from the handler,
  words from the model.

### Export to PDF-ready HTML — the last mile
- **API**: `exportDocument` → renders a document's markdown into a print-styled HTML page (design
  tokens; print stylesheet) the user prints to PDF from the browser. No new agent; a pure page.

## Round 2 — Interview mastery, market intelligence & the endgame (feature expansion)

Round 1 shipped the pipeline — postings in, truthful documents out, nothing goes stale — and one
`agency` space. Round 2 covers the parts of the search that happen **in the room and at the
finish line**: a **`prep`** space (interviewer · negotiator · market-analyst) runs **mock
interviews** in chat against a per-application **question bank** and scores them against a rubric;
**offers** get deterministic total-comp comparison plus model-drafted negotiation scripts; a weekly
**market brief** keeps the user calibrated on their segment; and the round-1 "Additional features"
**job-feed scouting** and **offer comparison** are promoted to fully-specced work. Everything below
is strictly additive to the round-1 shape — same project-rooted db, same serving, same capability
model — and stays inside the parent plan (data/agents/pages/api/hooks only).

### New database tables (round 2 — 5, bringing the app to 11)

Prose-schema form (descriptions mandatory on table/column/relation, FKs resolve, exactly-one PK):

- **`searches.json`** — a saved hunting query the scout sweeps daily. `id` (pk uuid) · `query`
  (string, required — e.g. `'senior backend engineer'`) · `location` (string) · `remoteOnly`
  (boolean, def false) · `active` (boolean, def true) · `lastRunAt` (date) · `newFoundTotal`
  (number, def 0 — running count, the "is this query earning its keep" signal) · `createdAt`
  (date, now).
- **`questions.json`** — the per-application interview question bank. `id` (pk) · `applicationId`
  (references `applications` onDelete cascade, required) · `kind` (string, required —
  `'behavioral'`|`'technical'`|`'company'`|`'reverse'` — reverse = questions the *user* should ask)
  · `prompt` (string, required) · `angle` (string, required — what the interviewer is really
  probing, one line) · `modelAnswerNotes` (string — bullet notes anchored to `profile_facts`, never
  a script to memorize) · `factIds` (json, required — provenance, same discipline as `documents`) ·
  `askedInMock` (number, def 0) · `createdAt` (date, now). Relation `application` belongsTo
  `applications` via `applicationId`.
- **`mock_sessions.json`** — one scored mock-interview run. `id` (pk) · `applicationId`
  (references `applications` onDelete cascade, required) · `focus` (string, def `'mixed'` — which
  `questions.kind` the drill weighted) · `askedQuestionIds` (json, required) · `scores` (json,
  required — per-dimension rubric `{ structure, specificity, relevance, concision }`, 1–5 each,
  with a one-line justification per score) · `feedback` (string, required — markdown: strongest
  answer, weakest answer, the one habit to fix) · `createdAt` (date, now). Relation `application`
  belongsTo `applications` via `applicationId`.
- **`offers.json`** — the endgame rows. `id` (pk) · `applicationId` (references `applications`
  onDelete restrict, required) · `base` (number, required) · `bonus` (number, def 0) · `equity`
  (string — grant description verbatim) · `equityAnnualized` (number, def 0 — the user's own
  annualized estimate; the app never invents a valuation) · `benefits` (json — named perks with
  user-assigned values) · `currency` (string, required) · `deadline` (date) · `status` (string,
  def `'open'` — `'open'`|`'accepted'`|`'declined'`|`'expired'`) · `notes` (string) · `createdAt`
  (date, now). Relation `application` belongsTo `applications` via `applicationId`.
- **`market_briefs.json`** — the weekly calibration report. `id` (pk) · `weekStart` (date,
  required, unique) · `body` (string, required — markdown: demand signals for the user's
  `targetRoles`, in-demand skills delta vs `profile_facts`, salary ranges *with cited sources*) ·
  `sources` (json, required — array of `{ title, url }` every claim traces to) · `createdAt`
  (date, now).

New columns on round-1 tables (additive `addColumn`): `documents.kind` gains `'negotiation'`
(the negotiator's talking-points scripts live in the existing versioned/provenance pipeline);
`postings.foundBy` (string, def `'user'` — `'user'`|`'search'`, so the pipeline shows which
postings the scout hunted vs the user pasted).

### New API endpoints (round 2 — 11, bringing the app to 27)

| name | method + route | I/O sketch |
|---|---|---|
| `addSearch` | `POST api/searches` | `{ query, location?, remoteOnly? }` → `Search` |
| `listSearches` | `GET api/searches` | `{}` → `Search[]` |
| `updateSearch` | `PATCH api/searches/:id` | `{ id, active?, query?, location? }` → `Search` |
| `listQuestions` | `GET api/applications/:id/questions` | `{ id, kind? }` → `Question[]` |
| `regenerateQuestions` | `POST api/applications/:id/questions` | `{ id, focus? }` → `{ status:'drafting' }` — `spawn`s `prep/interviewer#questions` |
| `listMocks` | `GET api/mocks` | `{ applicationId? }` → `MockSession[]` (scores only, no feedback body) |
| `getMockSession` | `GET api/mocks/:id` | `{ id }` → `MockSession` |
| `addOffer` | `POST api/offers` | `{ applicationId, base, currency, bonus?, equity?, … }` → `Offer` |
| `updateOffer` | `PATCH api/offers/:id` | `{ id, status?, …fields }` → `Offer` |
| `compareOffers` | `GET api/offers/compare` | `{}` → `{ rows: [{ offerId, company, totalComp, perComponent, deadline }] }` — deterministic; converts nothing it wasn't given |
| `getMarketBrief` | `GET api/market/:week` | `{ week }` → `MarketBrief` (plus `listMarketBriefs` `GET api/market` → headers) |

All follow the round-1 rules — equality-only `where`, typed `HttpError` failures, **`spawn` (never
`delegate`) from handlers** for fire-and-forget kick-offs. `compareOffers` is round 2's
deterministic centrepiece: total comp = `base + bonus + equityAnnualized + Σ benefits` in the
offer's own currency (mixed currencies are reported per-currency with a typed note, never silently
converted); the negotiator narrates these numbers, it never computes its own.

### New hooks (round 2 — 3, bringing the app to 6)

- **`scout-feed.ts`** — `cron`, `daily: '07:00'`, `trigger: 'agency/scout#hunt'`, budget — sweep
  each `active` search via `webSearch`, insert novel postings (`url` unique dedupes,
  `foundBy:'search'`), bump `lastRunAt`/`newFoundTotal`.
- **`build-questions.ts`** — `database` `documents:insert`, imperative handler: skip unless
  `row.kind === 'brief'`, else `delegate('prep/interviewer','questions', { input: { applicationId:
  row.applicationId } })` — a fresh interview brief automatically grows its question bank.
- **`weekly-market-brief.ts`** — `cron`, `daily: '08:00'`, Friday-gated in the agent →
  `prep/market-analyst#brief` — the calibration report lands before the weekend.

**Loop-guard sanity.** `scout-feed` inserts `postings` → the round-1 `enrich-posting` hook fires →
the scout *updates* the posting (no hook on update) ⇒ an **intentional depth-2 cascade** that
stops (cap 3) — hunted postings arrive parsed with zero extra wiring. `build-questions` fires on
every `documents:insert` but gates on `kind:'brief'`, so the tailor's resume/cover-letter inserts
and the negotiator's scripts no-op; the interviewer writes `questions` (unwatched) ⇒ stops.
The market-analyst writes `market_briefs` (unwatched) ⇒ stops. Per-hook coalesce collapses a
multi-search hunt burst; **self-write exclusion** keeps the scout's own posting updates from
re-firing anything.

### New pages (round 2 — 5, bringing the app to 11) + components

| File | Route | Reads / writes |
|---|---|---|
| `pages/searches.tsx` | `/searches` | `listSearches`; `addSearch`/`updateSearch` — the hunting queries + their yield |
| `pages/practice.tsx` | `/practice` | `<Chat agent="prep/interviewer">` (the mock room) + `listMocks` history rail |
| `pages/mocks/[id].tsx` | `/mocks/:id` | `getMockSession` — rubric scores + feedback + which questions were asked |
| `pages/offers.tsx` | `/offers` | `compareOffers` matrix; `addOffer`/`updateOffer`; negotiation scripts via `listDocuments kind:'negotiation'` |
| `pages/market.tsx` | `/market` | `listMarketBriefs`/`getMarketBrief` — the weekly briefs with cited sources |

New shared components (design tokens only): `OfferMatrix` (side-by-side total-comp table),
`MockScoreCard` (rubric dial per dimension), `QuestionCard` (prompt + angle + notes, spoiler-style
reveal), `SearchRow` (query + yield sparkline), `BriefView`. The application page
(`/applications/:id`) gains a **Questions** tab (`listQuestions` grouped by kind) and a
**Practice** button deep-linking `/practice` pre-scoped to that application. `_layout.tsx` nav
gains **Practice · Offers · Market**.

### The `prep` space (second project-scoped space, full format)

`career/spaces/prep/` — the in-the-room specialist team, sharing the same project-rooted db as
`agency` (parent plan's multi-space shape). Least-privilege per verb:

| Agent | `db:read` tables | `db:write` tables | `api:call` allow | `functions` | Role |
|---|---|---|---|---|---|
| **interviewer** | `applications, postings, documents, questions, mock_sessions, profile_facts, settings` | `questions, mock_sessions` | — | `[]` (none) | build the question bank from brief+posting+facts; run and score mock drills in chat |
| **negotiator** | `offers, applications, postings, market_briefs, documents, profile_facts, settings` | `documents` | `compareOffers` | `[]` (none) | draft negotiation scripts (kind `'negotiation'`) from the deterministic comp table + market briefs |
| **market-analyst** | `searches, postings, applications, market_briefs, profile_facts, settings` | `market_briefs` | — | `webSearch, webFetch` | the weekly calibration brief; every claim carries a source |

- **Agent-frontmatter features exercised**: the interviewer declares
  `canDelegateTo: [agency/coach#brief]` — a **cross-space** hard allowlist: asked to build
  questions for an application with no brief yet, it first commissions one from the round-1 coach
  (any other delegation throws, naming the allowed target). It also declares `defaultAction: mock`
  so "drill me on the Acme role" freeform delegation lands correctly, and `actions:` for
  `questions` (tasklist `question-bank`) and `mock`. The negotiator's `api:call` allowlist is the
  round-1 pattern: numbers come from `compareOffers`, never model arithmetic.
- **Tasklists**: `question-bank/` — `01-digest.md` (`role: explore`, read-only: brief + posting
  requirements + facts), `02-draft.md` (**`forEach: "digest.kinds"`** — one fork per question
  kind, behavioral/technical/company/reverse; the model never writes the loop), `03-file.md`
  (dedupe against existing bank, write rows with `factIds`). `mock/` — `01-select.md` (pick
  `quizLength`-style slate weighted to low-`askedInMock` + the session `focus`), `02-drill.md`
  (the conversational loop lives in chat; this task defines the rubric contract), `03-score.md`
  (write `mock_sessions` with per-dimension justifications; bump `askedInMock`).
- **Functions** (`functions/*.ts`, deterministic): `totalComp` (the same math `compareOffers`
  uses — one definition, both sides), `staleQuestions` (bank slots asked most / least),
  `rubricAggregate` (dimension scores → session summary), `citeCheck` (a market-brief body →
  the list of claims lacking a `sources` entry — the analyst runs it before writing).
- **Components**: view `MockScorePreview` (chat-rendered rubric after a drill), view
  `OfferSummary`; form `FocusPicker` — an `ask()` sheet the interviewer renders to choose the
  drill focus (behavioral / technical / company / mixed). Design-token-gated.
- **Knowledge** (`knowledge/interviewing/`, each field `index.md` + ≥2 aspects): `mock-method/`
  (`question-selection.md`, `probing-follow-ups.md`, `scoring-honestly.md` — praise is cheap,
  the rubric is the kindness), `answer-craft/` (`star-structure.md`, `specificity-and-numbers.md`,
  `red-flags.md`), `negotiation/` (`anchoring-and-ranges.md`, `total-comp-math.md`,
  `no-bluffing.md` — scripts never claim competing offers that don't exist in `offers`), and
  `market-reading/` (`demand-signals.md`, `source-quality.md`).

### `agency` space-format remediation (round 2)

Round 1 left `agency` as `agents/`-only. Round 2 brings it to the **full space format**:
`charter.md` alongside every `instruct.md` (the tailor's fork-safe no-fabrication rule — its most
important guardrail now injected into every fork; the scout's fail-loud rule; the coach's
dedupe-before-draft rule); tasklists — `tailor/` formalized (`01-match.md` `role: explore` score
facts vs requirements → `02-draft.md` **`forEach: "match.kinds"`** → `03-file.md` versioned write
with `factIds`), `enrich/` for the scout (fetch → parse → verify-or-fail), `nudge/` for the coach
(sweep via `apiCall('pipeline')` → dedupe → draft); `functions/`
(`scoreRequirementMatch`, `stalenessDays` — the same definition `pipeline` uses,
`normalizeSalaryText`, `renderDocumentHeader`); catalog `components/` (`PostingPreview`,
`DocumentPreview` for chat); and **extensive `knowledge/job-search/`** — `tailoring-craft/`
(`resume-principles.md`, `cover-letter-structure.md`, `honesty-under-pressure.md`),
`posting-analysis/` (`requirement-extraction.md`, `reading-between-lines.md`), `outreach/`
(`follow-up-timing.md`, `tone-per-stage.md`).

### Phases & verification additions (round 2)

Ordered on top of the round-1 phases: **(R2-1)** new schemas + columns; **(R2-2)** the `prep`
space full-format + `agency` remediation; **(R2-3)** the 11 endpoints (`compareOffers`/`totalComp`
single-definition check); **(R2-4)** the 3 hooks + loop-guard checks; **(R2-5)** the 5 pages +
components; **(R2-6)** tests.

Verification additions: **(a)** an active search + `scout-feed` → novel postings inserted
(`foundBy:'search'`), each then auto-enriched by the round-1 hook (the depth-2 cascade observed,
then stops); a re-run inserts nothing (url dedupe); **(b)** a coach brief lands →
`build-questions` fires once; a resume-document insert does **not** fire it (kind gate); the bank's
`factIds` all resolve, and `modelAnswerNotes` contain no claim untraceable to a fact (the tailor's
integrity test, extended); **(c)** with no brief present, "build questions for Acme" makes the
interviewer delegate `agency/coach#brief` first (cross-space allowlist observed; any other target
throws); **(d)** a chat mock drill writes one `mock_sessions` row — every scored dimension carries
a justification, `askedInMock` bumps only on asked questions; **(e)** `compareOffers` on two
same-currency offers matches hand math; mixed currencies produce per-currency rows + typed note,
never a silent conversion; the negotiator's script quotes only `compareOffers` numbers and — per
`no-bluffing.md` — references only offers that exist as rows; **(f)** Friday `weekly-market-brief`
→ one `market_briefs` row; `citeCheck` returns empty (every claim sourced); unique `weekStart`
makes a boot-catch-up double-fire a no-op; **(g)** `pnpm lint:tokens` green across the 5 new pages.

## Phases & order

Assumes the parent plan's engine (db + capability globals, api runtime, typed-contract build, pages
build, hooks runtime, chat) exists. Career-specific work on top:

1. **Schemas** — the six `database/*.json`; verify FKs (`applications` → postings; `activities`/
   `documents` → applications), unique `postings.url`, required descriptions pass the fail-loud
   loader; row + relation types generate (`Application & { posting, activities, documents }`).
2. **`agency` space** — the three agents' `instruct.md` (config-bearing `capabilities:`; the
   tailor's `functions: []` wall + charter no-fabrication contract + `factIds` provenance; the
   scout's fail-loud contract; the coach's dedupe contract), plus the tailor's kind-`forEach`
   tasklist.
3. **API** — the sixteen endpoints; `pipeline` as the shared staleness computation; `tailorDocuments`
   fire-and-forget; `updateStage` state-machine stamps.
4. **Hooks** — `enrich-posting` (database:insert), `follow-up` (cron daily), `prep-brief`
   (database:insert, type-gated); confirm boundedness (scout updates ≠ inserts; nudge's own
   activity writes are excluded + type-gated out).
5. **Pages** — board (drag between columns → `updateStage`), postings (paste box + pending poll),
   application timeline + documents, document view with provenance facts, profile + coach chat;
   design-system token gate (no raw colors — stale badge uses a token, not a literal amber).
6. **Serving** — seed each pod's `career` project from the checked-in template; serve under generic
   `lmthing.app/career/*`; Studio manages it under `/api/projects/career/app`.
7. **Additional features** — debriefs, job-feed scouting, offers, export (§above); each additive,
   shippable after the core loop.
8. **Docs** — fold into `SPACE_DEVELOPMENT.md` "Project apps" as the document-pipeline example.

## Verification (end-to-end, local)

1. Load the `career` project → schemas validate (descriptions/FK/relations), `types/generated.d.ts`
   has `ProfileFact`/`Posting`/`Application`/`Activity`/`Document` with relation fields
   (`Application.documents?: Document[]`).
2. `lmthing serve`; `addPosting` with a real URL → stub row `status:'pending'`; the enrich hook
   fires the scout (live model) → `status:'enriched'` with company/role/requirements parsed;
   `/postings` shows fields filling in live. Re-pasting the same URL → handler no-op (unique url),
   **no** second hook fire.
3. `addPosting` with an unreachable URL → scout sets `fetch-failed` + reason; the UI shows retry;
   nothing retries in a loop.
4. Seed ~8 facts; `createApplication` + `tailorDocuments` (mock streamFn) → the tailor's `forEach`
   forks one draft per kind; two `documents` rows land (`version:1`) whose `factIds` all exist in
   `profile_facts`; a claim not traceable to a fact = test failure. Re-tailor → `version:2`, v1
   intact.
5. `updateStage` to `applied` → `appliedAt` stamped + an `applied` activity; move to `rejected` →
   `closedAt` stamped, card leaves the board, `careerStats.responseRate` updates.
6. Backdate the last activity past `followUpDays`; run `follow-up` → one `follow-up` activity with
   a drafted `body`; the board card shows `stale`; run again → **no duplicate** draft (latest
   activity is the pending follow-up). The activity insert did **not** re-fire `prep-brief`
   (type-gate).
7. `logActivity` a future `interview` → `prep-brief` fires; a `brief` document lands citing
   researched company facts; a past-dated interview fires nothing.
8. Capability walls: the tailor calling `webFetch` → typecheck failure (`functions: []`); the tailor
   writing `profile_facts` → host error naming its allowed tables; the scout `apiCall('pipeline')`
   → host error (not allowlisted).
9. Chat: paste a resume into the profile coach dock → `profile_facts` rows appear (`source:'agent'`)
   and are editable on the page; history under `career/spaces/agency/sessions/`.
10. Backup: `app.sql` + schemas + pages + api + hooks + agency space committed; `**/sessions/` not;
    restore rebuilds `app.db` from `app.sql` (documents + factIds provenance intact).

## Notes

- **Reuses the parent engine wholesale** — no career-specific runtime; data + agents + pages + hooks
  on the shared layer. If a mechanism is missing here, it belongs in
  [project-as-application.md](./project-as-application.md), not a career fork.
- **Why it's a good AI-assisted app** — a job search is a sustained campaign of exactly the tasks
  people do worst under stress: tailoring documents (tedious), researching companies (time-boxed),
  and following up (forgotten). The engine's split is ideal: the state machine and staleness are
  deterministic handler code; the writing and research are agents; and the fact-base +
  `factIds` design turns "AI resume" from a fabrication risk into an *auditable assembly*.
- **Truthfulness is enforced structurally, not just prompted** — the tailor has no web
  (`functions: []`), can only read `profile_facts` for claims, and must emit `factIds`. The
  verification step that fails on an untraceable claim makes the guarantee testable.
- **The app drafts; the human sends** — no email/ATS integration in v1. Every outbound artifact is
  copy-out. This keeps the app inside the pod's authz model with zero external write surface, and
  it's the right product call anyway: the user's name is on every message.
- **`db.query` `where` is equality-only** in the shipped engine — active-stage filtering, staleness
  windows, and future-interview checks are query-wide-then-filter-in-JS in `pipeline` and the
  hooks, not SQL predicates. Board-scale data (dozens of applications) makes this a non-issue.
- **No external-binding registry exists in v1** — `webFetch`/`webSearch` are universal globals
  gated per-agent via `functions:` (scout, coach yes; tailor no); `api:call` is reserved for the
  app's own typed endpoints (`pipeline` for the coach).
