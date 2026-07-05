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

## Round 3 — The career ledger: skills, network, debriefs & strategy (feature expansion)

Round 1 ran the pipeline (`agency`); round 2 covered the room and the endgame (`prep`). Round 3
plays the **long game — the career between searches**: an **accomplishments ledger** you feed in
one chat sentence (which keeps `profile_facts` permanently warm, killing the next search's
cold-start), a **skills matrix** with deterministic gap analysis against what your target market
actually asks for, a lightweight **network** of people-at-companies (who referred you, who you
owe a coffee), structured **rejection debriefs** that turn lost applications into patterns, and a
**quarterly strategy review** that reads all of it. A third specialist team (**`chronicle`** —
scribe · connector · strategist) does this work. Everything below is strictly additive to the
round-1/2 shape — same project-rooted db, same serving, same capability model — and stays inside
the parent plan (data/agents/pages/api/hooks only).

### New database tables (round 3 — 5, bringing the app to 16)

- **`accomplishments.json`** — one dated win, logged as it happens. `id` (pk uuid) · `at` (date,
  required) · `title` (string, required) · `detail` (string, required — what/how, markdown) ·
  `metrics` (string — the numbers, verbatim: "cut p95 from 900ms to 210ms") · `tags` (json) ·
  `promotedFactId` (string — the `profile_facts` row the scribe promoted this into; null until
  promoted) · `source` (string, def `'chat'`) · `createdAt` (date, now).
- **`skills.json`** — the living skill inventory. `id` (pk) · `name` (string, required, unique) ·
  `level` (number, required, 1–5 — self-assessed, evidence-linked) · `targetLevel` (number, def
  0 — 0 = not targeted) · `evidenceFactIds` (json, def `[]` — facts/accomplishments backing the
  level; a level without evidence is flagged, not trusted) · `demandScore` (number, def 0 — how
  often active-market postings ask for it; refreshed from briefs/postings) · `lastUsedAt` (date)
  · `createdAt` (date, now).
- **`connections.json`** — a person at a company (deliberately light — this is not the `people`
  app; it tracks professional context only). `id` (pk) · `name` (string, required) · `company`
  (string, required) · `role` (string) · `relation` (string, required — `'former-colleague'`|
  `'referrer'`|`'interviewer'`|`'recruiter'`|`'met-at-event'`) · `applicationId` (references
  `applications` onDelete setNull — the application they're connected to, if any) · `lastTouch`
  (date) · `owes` (string — `'you-owe'`|`'owes-you'`|`''` — the coffee ledger) · `notes` (string)
  · `createdAt` (date, now). Relation `application` belongsTo `applications` via `applicationId`.
- **`debriefs.json`** — a structured post-mortem on a terminal application. `id` (pk) ·
  `applicationId` (references `applications` onDelete cascade, required, unique — one debrief per
  application) · `outcome` (string, required — `'rejected'`|`'withdrawn'`|`'accepted'`) · `stageReached`
  (string, required) · `signals` (json, required — `{ signal, evidence }` list: what the process
  actually told you) · `lessons` (string, required — markdown) · `patternTags` (json, def `[]` —
  normalized tags the strategist aggregates: `'stalled-at-screening'`, `'missing-skill:<x>'`…) ·
  `createdAt` (date, now). Relation `application` belongsTo `applications` via `applicationId`.
- **`strategy_reviews.json`** — the quarterly read. `id` (pk) · `quarter` (string, required,
  unique) · `body` (string, required — markdown: pipeline conversion, debrief patterns, skill
  gaps closed/opened, network moves, the 3 next-quarter moves) · `stats` (json, required — from
  the deterministic `careerQuarterStats` math) · `createdAt` (date, now).

New columns on earlier tables (additive `addColumn`): `applications.debriefed` (boolean, def
false — the scribe's high-water mark); `profile_facts.accomplishmentId` (string — back-ref when a
fact was promoted from the ledger, closing the provenance loop in both directions).

### New API endpoints (round 3 — 11, bringing the app to 38)

| name | method + route | I/O sketch |
|---|---|---|
| `logAccomplishment` | `POST api/ledger` | `{ title, detail, metrics?, at?, tags? }` → `Accomplishment` |
| `listAccomplishments` | `GET api/ledger` | `{ tag?, year? }` → `Accomplishment[]` |
| `promoteAccomplishment` | `POST api/ledger/:id/promote` | `{ id }` → `{ factId }` — files it as an `achievement` `profile_facts` row (both back-refs set) |
| `listSkills` / `upsertSkill` | `GET/POST api/skills` | skill CRUD; `level` changes require ≥1 `evidenceFactIds` entry or land `flagged` |
| `skillGaps` | `GET api/skills/gaps` | `{}` → `{ rows: [{ skill, level, targetLevel, demandScore, gap }] }` — deterministic: demand aggregated from active postings' `requirements` + latest brief |
| `addConnection` / `listConnections` | `POST/GET api/network` | connection CRUD; list grouped by company |
| `touchConnection` | `PATCH api/network/:id` | `{ id, note? }` → `Connection` (stamps `lastTouch`) |
| `getDebrief` | `GET api/debriefs/:applicationId` | `{ applicationId }` → `Debrief` (plus `listDebriefs` → headers with `patternTags`) |
| `patternReport` | `GET api/debriefs/patterns` | `{}` → `{ rows: [{ tag, count, applications }] }` — deterministic aggregation the strategist narrates |
| `getStrategyReview` | `GET api/strategy/:quarter` | `{ quarter }` → `StrategyReview` (plus `listStrategyReviews` → headers) |

All follow the established rules — equality-only `where`, typed `HttpError`, **`spawn` from
handlers**. `skillGaps` and `patternReport` are round 3's deterministic centrepieces: demand and
pattern counts are handler aggregations; the strategist and scribe narrate them, never recount
them. `careerStats` gains `ledgerCount` and `debriefCoverage` (debriefed / terminal).

### New hooks (round 3 — 3, bringing the app to 9)

- **`debrief-on-close.ts`** — `database` **`applications:update`** (the app's first
  update-event hook), imperative handler: skip unless the update moved `stage` into
  `rejected`/`withdrawn`/`accepted` and `debriefed` is false, else
  `delegate('chronicle/scribe','debrief', { input: { applicationId: row.id } })` — the scribe
  drafts the debrief skeleton from the timeline (stage reached, days per stage, mock scores if
  any), asks the two questions only the user can answer via its chat thread, files the row, flips
  `debriefed`.
- **`refresh-demand.ts`** — `database` `market_briefs:insert`, imperative handler:
  `delegate('chronicle/strategist','demand',{})` — re-derive every skill's `demandScore` from
  active postings + the fresh brief (a cross-ROUND cascade: the round-2 Friday cron's brief
  insert drives round-3 demand refresh with zero new scheduling).
- **`quarterly-strategy.ts`** — `cron`, `daily: '08:45'`, quarter-start-gated in the agent →
  `chronicle/strategist#review` — write the quarter's `strategy_reviews` row from
  `careerQuarterStats` + `patternReport` + `skillGaps`.

**Loop-guard sanity.** `applications:update` → scribe writes `debriefs` + flips `debriefed` —
that flip is itself an `applications:update`, but the stage-transition + `debriefed:false` gate
makes the re-entry a no-op and **self-write exclusion** backstops it ⇒ stops at depth 1 (the gate
is pinned by a test, same discipline as money's `flag-deductibles`). `market_briefs:insert` →
strategist updates `skills` (unwatched) ⇒ stops at depth 2 counting from the Friday cron.
The quarterly review writes `strategy_reviews` (unwatched) ⇒ stops. Per-hook coalesce collapses a
bulk stage-cleanup session into one debrief pass (the scribe drains all undebriefed terminals in
that run).

### New pages (round 3 — 5, bringing the app to 16) + components

| File | Route | Reads / writes |
|---|---|---|
| `pages/ledger.tsx` | `/ledger` | `listAccomplishments`; `logAccomplishment`/`promoteAccomplishment`; `<Chat agent="chronicle/scribe">` dock ("shipped the migration today, zero downtime") |
| `pages/skills.tsx` | `/skills` | `listSkills` + `skillGaps` matrix (level vs target vs demand); `upsertSkill` |
| `pages/network.tsx` | `/network` | `listConnections` by company; `addConnection`/`touchConnection`; the coffee ledger |
| `pages/debriefs.tsx` | `/debriefs` | `listDebriefs` + `patternReport` (the patterns panel); links into each `getDebrief` |
| `pages/strategy.tsx` | `/strategy` | `listStrategyReviews`/`getStrategyReview` — the quarterly reads |

New shared components (design tokens only): `SkillMatrix` (level/target/demand tri-bar rows),
`PatternChip` (tag + count, drill-through), `LedgerEntry`, `ConnectionCard` (company-grouped,
owes-state badge), `StrategyView`. `_layout.tsx` nav gains **Ledger · Skills · Strategy**; the
application page links its debrief once one exists; `/profile` shows promoted facts with their
ledger back-refs (provenance visible in both directions).

### The `chronicle` space (third project-scoped space, full format)

`career/spaces/chronicle/` — the long-game team. Least-privilege per verb:

| Agent | `db:read` tables | `db:write` tables | `api:call` allow | `functions` | Role |
|---|---|---|---|---|---|
| **scribe** | `accomplishments, profile_facts, applications, activities, mock_sessions, debriefs, settings` | `accomplishments, profile_facts, debriefs, applications` | — | `[]` | ledger chat intake; promote wins to facts; draft + file debriefs (flip `debriefed`) |
| **connector** | `connections, applications, postings, activities, settings` | `connections, activities` | — | `[]` | keep the network warm: infer connections from logged interviews, surface owes/staleness |
| **strategist** | everything above + `skills, market_briefs, postings, strategy_reviews, offers` | `skills, strategy_reviews` | `skillGaps, patternReport, pipeline` | `[]` | demand refresh; the quarterly review; 3 concrete next-quarter moves |

- **Agent-frontmatter features exercised**: the strategist declares
  `canDelegateTo: [prep/market-analyst#brief]` — before a quarterly review, if the latest brief
  is > 2 weeks old it commissions a fresh one (cross-space allowlist; anything else throws). The
  scribe declares `defaultAction: log` (freeform "add to my ledger: …" lands right) plus
  `actions:` for `log`, `promote`, and `debrief` (tasklist `debrief`). The connector declares
  `defaultAction: touch`.
- **Tasklists**: `debrief/` — `01-timeline.md` (`role: explore`, `output: { stages: 'json',
  daysPerStage: 'json', mockScores: 'json' }` — typed output the next task binds),
  `02-signals.md` (`dependsOn: [timeline]` — derive `{signal, evidence}` candidates; evidence
  must cite an activity/mock row), `03-user-input.md` (`optional: true` — the two
  only-the-user-knows questions, asked in the scribe's chat thread when the debrief was
  user-initiated; skipped on hook-driven runs, which file `signals` only), `04-file.md`
  (`dependsOn: [signals]` — write the row, normalize `patternTags`, flip `debriefed`).
  `quarterly/` for the strategist — stats (`role: explore` via the three `apiCall`s) → patterns →
  moves (**`forEach: "patterns.themes"`** — one fork per dominant theme drafts one concrete
  move) → write.
- **Functions** (`functions/*.ts`, deterministic): `careerQuarterStats` (the quarter aggregation
  `strategy_reviews.stats` must equal), `demandFromPostings` (requirements[] aggregation →
  per-skill demand — the same math `skillGaps` uses), `normalizePatternTag` (free-text lesson →
  canonical tag, so `patternReport` counts don't fragment), `staleBrief` (latest brief age check).
- **Components**: view `SkillGapPreview` (chat-rendered top-3 gaps), view `QuarterCard`; form
  `DebriefIntake` — the `ask()` sheet for `03-user-input.md`'s two questions (what did they say
  no to? what would you do differently?).
- **Knowledge** (`knowledge/career-strategy/`, each field `index.md` + ≥2 aspects):
  `ledger-craft/` (`capture-while-fresh.md`, `metrics-not-adjectives.md`,
  `promotion-into-facts.md` — a promoted fact must stay verifiable, same bar as round 1),
  `pattern-reading/` (`signal-vs-noise.md`, `stage-funnel-analysis.md`,
  `rejection-without-story.md` — most rejections carry no signal; the scribe says so rather than
  inventing one), `network-hygiene/` (`light-touch-crm.md`, `owes-ledger.md` — this is
  professional context, not the `people` app; keep it thin), `strategy/`
  (`three-moves-not-ten.md`, `evidence-backed-planning.md`).

### Phases & verification additions (round 3)

Ordered on top of rounds 1–2: **(R3-1)** new schemas + columns; **(R3-2)** the `chronicle` space
full-format; **(R3-3)** the 11 endpoints (`skillGaps`/`demandFromPostings` and
`careerQuarterStats` single-definition checks); **(R3-4)** the 3 hooks incl. the update-event
gate test; **(R3-5)** the 5 pages + components; **(R3-6)** tests.

Verification additions: **(a)** move an application to `rejected` → `debrief-on-close` fires
once; the scribe's debrief cites real timeline rows in `signals.evidence`; the `debriefed` flip
does **not** re-fire the hook (gate + self-write pinned); a second stage edit on the same
application fires nothing; **(b)** hook-driven debriefs skip `03-user-input.md`
(`optional: true` observed); a user-initiated "debrief the Acme one" runs it and renders the
`DebriefIntake` `ask()` form; **(c)** `promoteAccomplishment` → one `achievement` fact with both
back-refs; the round-1 tailor can now draw on it (provenance chain: ledger → fact → document
`factIds` — walked end-to-end in a test); **(d)** Friday's brief insert → `refresh-demand`
recomputes `demandScore` equal to `demandFromPostings` run by hand (single definition); the
cross-round cascade observed and terminating; **(e)** `upsertSkill` raising a level with no
evidence lands `flagged` state, with evidence passes; `skillGaps.gap` math matches fixture;
**(f)** quarter start → one `strategy_reviews` row; `stats` equals `careerQuarterStats`; with a
3-week-old brief the strategist first delegates `prep/market-analyst#brief` (cross-space
allowlist observed); exactly 3 moves, each naming its evidence; **(g)** `patternReport` counts
don't fragment across tag spellings (`normalizePatternTag` pinned); **(h)** `pnpm lint:tokens`
green across the 5 new pages.

## Round 4 — Landing well: the first 90 days, review season & the public record (feature expansion)

Rounds 1–3 find the job, win the room, and learn from the misses. Round 4 covers the truth every
job-changer discovers too late: **the search doesn't end at "accepted" — that's when the risky
part starts.** New roles fail in the first 90 days for preventable reasons (unclear expectations,
no early wins, no relationship map), review season arrives with your best work forgotten, the
reference you need hasn't heard from you in two years, and between searches you're invisible. A
fourth specialist team (**`podium`** — onboarder · advocate · publicist) closes the loop: a
**transition plan** with weekly checkpoints spins up the moment an offer flips to accepted; a
**review/promotion packet** assembles itself from the round-3 ledger when your company's review
season nears; a **referee kit** keeps your vouchers warm and consent-checked; and **public-record
drafts** (bio, profile summary, post drafts) are generated from *promoted accomplishments only* —
the tailor's no-fabrication wall, extended to your public voice. Everything below is strictly
additive — same project-rooted db, same capability model — and stays inside the parent plan
(data/agents/pages/api/hooks only).

### New database tables (round 4 — 5, bringing the app to 21)

- **`transitions.json`** — one new-role landing. `id` (pk uuid) · `offerId` (references `offers`
  onDelete restrict, required, unique) · `startDate` (date, required) · `plan` (json, required —
  the 30/60/90 frame: `{ phase, focus, earlyWins:[…], relationships:[{who, why}], risks:[…] }`
  per phase, drafted by the onboarder from the posting + interview record) · `status` (string,
  def `'planned'` — `'planned'`|`'active'`|`'landed'`|`'rocky'`|`'closed'`) · `createdAt` (date,
  now). Relations: `offer` belongsTo `offers` via `offerId`; `checkpoints` hasMany `checkpoints`
  via `transitionId`.
- **`checkpoints.json`** — one weekly transition check-in. `id` (pk) · `transitionId`
  (references `transitions` onDelete cascade, required) · `weekStart` (date, required) ·
  `prompts` (json, required — the 3 questions this week's phase asks) · `answers` (json — the
  user's chat answers, verbatim) · `signals` (json, def `[]` — `{ kind:
  'win'|'risk'|'expectation-gap', note }` distilled by the onboarder) · `status` (string, def
  `'pending'` — `'pending'`|`'done'`|`'skipped'`) · `createdAt` (date, now). Relation
  `transition` belongsTo `transitions` via `transitionId`.
- **`packets.json`** — a review-season artifact. `id` (pk) · `kind` (string, required —
  `'self-review'`|`'promotion-case'`) · `periodStart`/`periodEnd` (dates, required) · `body`
  (string, required — markdown, structured to `settings.reviewTemplate` when set) ·
  `accomplishmentIds` (json, required — every claim traces to a ledger row; the packet is
  **assembled**, not written from vibes) · `gapsCalledOut` (json, def `[]` — targets the period
  missed, stated plainly; a packet that hides misses reads as spin and fails review) · `version`
  (number, def 1) · `createdAt` (date, now).
- **`referees.json`** — a person who can vouch. `id` (pk) · `connectionId` (references
  `connections` onDelete setNull) · `name` (string, required) · `vouchesFor` (json, required —
  which skills/periods they can actually speak to, mapped to `skills`/`accomplishments`) ·
  `consent` (string, def `'unasked'` — `'unasked'`|`'asked'`|`'granted'`|`'declined'`|`'stale'`
  — granted consent goes `stale` after `settings.refereeStaleDays` without contact) ·
  `lastTouch` (date) · `askDraft` (string — the copy-out consent ask, warm, specific about what
  they'd be vouching for) · `createdAt` (date, now).
- **`posts.json`** — a public-record draft. `id` (pk) · `kind` (string, required —
  `'bio'`|`'profile-summary'`|`'post'`|`'talk-abstract'`) · `title` (string, required) · `body`
  (string, required — markdown, copy-out) · `accomplishmentIds` (json, required — the provenance
  wall: public claims come from promoted, verifiable ledger rows only) · `status` (string, def
  `'draft'` — `'draft'`|`'published'`|`'discarded'`, user-reported) · `version` (number, def 1)
  · `createdAt` (date, now).

New columns on earlier tables (additive `addColumn`): `settings.reviewMonths` (json, def `[]` —
the company's review-cycle months, e.g. `[3, 9]`); `settings.reviewTemplate` (string — the
company's self-review headings, pasted once); `settings.refereeStaleDays` (number, def 180);
`accomplishments.visibility` (string, def `'private'` — `'private'`|`'public-ok'` — the user's
per-win consent gate the publicist must respect).

### New API endpoints (round 4 — 11, bringing the app to 49)

| name | method + route | I/O sketch |
|---|---|---|
| `getTransition` / `listTransitions` | `GET api/transitions/:id` / `GET` | plan + checkpoints; readiness of the landing |
| `updateTransition` | `PATCH api/transitions/:id` | `{ id, status }` → `Transition` (`landed`/`rocky` are user verdicts) |
| `answerCheckpoint` | `PATCH api/checkpoints/:id` | `{ id, answers }` → `Checkpoint` (onboarder distills `signals` via `spawn`) |
| `buildPacket` | `POST api/packets` | `{ kind, periodStart, periodEnd }` → `{ status:'assembling' }` — `spawn`s `podium/advocate#packet` |
| `getPacket` / `listPackets` | `GET api/packets/:id` / `GET` | the artifact + its ledger provenance |
| `upsertReferee` / `listReferees` | `POST/GET api/referees` | referee CRUD; list surfaces `stale` consents first |
| `touchReferee` | `PATCH api/referees/:id` | `{ id, consent?, note? }` → `Referee` (stamps `lastTouch`) |
| `draftPost` | `POST api/posts` | `{ kind, focus? }` → `{ status:'drafting' }` — `spawn`s `podium/publicist#draft` |
| `listPosts` / `updatePost` | `GET api/posts` / `PATCH api/posts/:id` | drafts; `published`/`discarded` user-reported |

Deterministic centrepiece: `refereeCoverage` (inside `listReferees`) — which target skills have
zero granted-consent referees, pure set math the advocate narrates. All established rules hold —
equality-only `where`, typed `HttpError`, **`spawn` from handlers**.

### New hooks (round 4 — 3, bringing the app to 12)

- **`start-transition.ts`** — `database` **`offers:update`**, imperative handler: skip unless
  the update set `status:'accepted'` and no transition exists for the offer, else
  `delegate('podium/onboarder','plan', { input: { offerId: row.id } })` — the 30/60/90 plan is
  drafted from what the process already knows (posting requirements, interview activities, mock
  weak spots, the debrief if one exists) before day one.
- **`weekly-checkpoint.ts`** — `cron`, `daily: '08:20'`, Monday-gated in the agent →
  `podium/onboarder#checkpoint` — during an `active` transition, write the week's checkpoint row
  (phase-appropriate prompts) + one agenda-style activity nudge; skipped weeks are recorded
  `skipped`, never nagged twice.
- **`review-season.ts`** — `cron`, `daily: '08:50'`, gated in the agent to 6 weeks before any
  `settings.reviewMonths` entry → `podium/advocate#season` — one heads-up per season: the packet
  period, the ledger's coverage of it (thin months named), and referee consents going stale —
  so the packet is assembled from a full ledger, not a panic reconstruction.

**Loop-guard sanity.** `offers:update(accepted)` → onboarder writes `transitions`/`checkpoints`
(unwatched) ⇒ stops at depth 1; the one-transition-per-offer gate + **self-write exclusion** pin
re-entry (the round-3 discipline). The two crons write unwatched tables ⇒ stop.
`answerCheckpoint` updates `checkpoints` (no update hook) ⇒ stops. Nothing round 4 adds watches
`accomplishments`/`posts`/`packets`/`referees` — the public-record pipeline is pull-only by
design (publishing cadence is a human choice, not an automation).

### New pages (round 4 — 5, bringing the app to 21) + components

| File | Route | Reads / writes |
|---|---|---|
| `pages/landing.tsx` | `/landing` | the active transition: 30/60/90 board, this week's checkpoint, signals rail; `answerCheckpoint`; `<Chat agent="podium/onboarder">` dock |
| `pages/packets.tsx` | `/packets` | `buildPacket` (kind + period); `listPackets`; provenance-linked packet view |
| `pages/referees.tsx` | `/referees` | `listReferees` (stale-first) + coverage gaps; `upsertReferee`/`touchReferee`; copy-out ask drafts |
| `pages/public.tsx` | `/public` | `draftPost` intake; `listPosts`/`updatePost` — the public-record drafts with per-claim provenance |
| `pages/transitions/[id].tsx` | `/transitions/:id` | a past landing in full: plan vs signals vs verdict — the retrospective read |

New shared components (design tokens only): `PhaseBoard` (30/60/90 columns), `CheckpointCard`,
`SignalChip` (win/risk/expectation-gap as semantic tokens), `CoverageGapRow`, `ProvenanceLine`
(claim → ledger row, on packets and posts alike), `ConsentBadge`. `_layout.tsx` nav gains
**Landing · Packets · Public**; `/ledger` entries gain the `visibility` toggle; `/strategy`
links the latest transition verdict into the quarterly read.

### The `podium` space (fourth project-scoped space, full format)

`career/spaces/podium/` — the landing-and-leverage team. Least-privilege per verb:

| Agent | `db:read` tables | `db:write` tables | `api:call` allow | `functions` | Role |
|---|---|---|---|---|---|
| **onboarder** | `transitions, checkpoints, offers, postings, applications, activities, mock_sessions, debriefs, profile_facts, settings` | `transitions, checkpoints, activities` | `pipeline` | `[]` | the 30/60/90 plan; weekly prompts; distill signals; flag `rocky` early with evidence |
| **advocate** | `packets, accomplishments, profile_facts, skills, referees, connections, settings` | `packets, referees` | `skillGaps` | `[]` | assemble packets (claims = ledger rows; gaps stated); referee kit + consent asks |
| **publicist** | `posts, accomplishments, profile_facts, skills, settings` | `posts` | — | `[]` | public-record drafts from `visibility:'public-ok'` accomplishments only |

- **Agent-frontmatter features exercised**: the advocate declares
  `canDelegateTo: [chronicle/scribe#promote]` — a packet-worthy accomplishment that never got
  promoted to a fact gets promoted through the round-3 owner of that pipeline (cross-space
  allowlist). The onboarder declares `defaultAction: checkpoint`; the publicist
  `defaultAction: draft`. The publicist has **no web and reads no market data** — the public
  record is built from what you did, not what performs.
- **Tasklists**: `plan-landing/` — `01-record.md` (`role: explore`, `output: { expectations:
  'json', weakSpots: 'json', relationships: 'json' }` — mined from posting/interviews/mocks/
  debrief), `02-phases.md` (`dependsOn: [record]` — **`forEach: "record.phases"`** over
  30/60/90), `03-file.md`. `packet/` — `01-harvest.md` (`role: explore` — period ledger rows +
  gaps vs targets), `02-promote.md` (`optional: true`, **task-level `canDelegateTo:
  [chronicle/scribe#promote]`** — only this task may promote), `03-assemble.md` (template-
  structured, claims bound to `accomplishmentIds`), `04-gaps.md` (`dependsOn: [harvest]` — the
  honest-misses section). `public-draft/` — select (`role: explore`, `visibility` filter is a
  hard gate) → draft → provenance-check (`functions: [provenanceCheck]`).
- **Functions** (`functions/*.ts`, deterministic): `refereeCoverage` (target skills × granted
  consents → gaps — the same math `listReferees` serves), `periodLedger` (date-window ledger
  slice + thin-month detection), `provenanceCheck` (a draft body → claims lacking an
  `accomplishmentIds` anchor; the publicist and advocate both run it before filing),
  `phasePrompts` (transition phase → the week's 3 questions).
- **Components**: view `LandingSnapshot` (chat-rendered phase + signals), view `PacketOutline`;
  form `CheckpointSheet` — the `ask()` form the onboarder uses in chat for the weekly 3 questions
  (answers land verbatim in `checkpoints.answers`).
- **Knowledge** (`knowledge/landing-and-leverage/`, each field `index.md` + ≥2 aspects):
  `first-90-days/` (`expectation-alignment.md`, `early-wins-that-count.md`,
  `relationship-mapping.md`, `rocky-signals.md`), `review-craft/` (`assembled-not-written.md`,
  `gaps-stated-plainly.md`, `template-fidelity.md`), `references/` (`consent-first.md`,
  `specific-asks.md`, `staleness-and-warmth.md`), `public-voice/` (`provenance-or-silence.md`,
  `no-engagement-bait.md` — the publicist writes the true version, not the viral one).

### Phases & verification additions (round 4)

**(R4-1)** schemas + columns; **(R4-2)** `podium` full-format; **(R4-3)** the 11 endpoints
(`refereeCoverage` single-definition); **(R4-4)** the 3 hooks incl. the offers:update gate test;
**(R4-5)** the 5 pages; **(R4-6)** tests. Verification: **(a)** flipping an offer to `accepted`
→ one transition whose plan cites the real record (posting requirements + a mock weak spot
appear in `risks`); a second flip on the same offer fires nothing (gate pinned); **(b)** Monday
checkpoint → phase-appropriate prompts; answering via the `CheckpointSheet` `ask()` lands
verbatim answers + distilled signals, each `signals.evidence`-style note traceable; a skipped
week records `skipped` and is not re-nagged; **(c)** `buildPacket` over a period with an
unpromoted win → `02-promote.md` delegates `chronicle/scribe#promote` (task-level allowlist;
typecheck failure from any other task), the packet's every claim resolves to a ledger row, and
`gapsCalledOut` is non-empty on the seeded thin period (honesty pinned); **(d)** a `private`
accomplishment never appears in any post draft (adversarially seeded: the juiciest win is
private — `provenanceCheck` + visibility gate both hold); **(e)** referee consent goes `stale`
after `refereeStaleDays`; coverage gaps match hand math; ask drafts name what's being vouched
for; **(f)** the review-season heads-up fires once per season, six weeks early, naming thin
months; **(g)** `pnpm lint:tokens` green across the 5 new pages.

## Round 5 — The compass: fit intelligence, the story bank & the daily brief (feature expansion)

Rounds 1–4 built the machinery; round 5 adds the judgment layer — the three places where model
intelligence, not workflow, is the entire value. **Fit intelligence**: the biggest waste in any
search is applying to everything, so every enriched posting now gets a **decoded read** — what
the role actually is beneath the listing-speak, a fit score with per-requirement evidence from
YOUR facts, red flags (zombie posting, seniority mismatch, salary vs the market brief), and a
recommendation: *apply / network-first / skip, with reasons*. **The story bank**: interviews are
won with five great stories told well, not fifty facts — a `storyteller` mines your
accomplishments and facts into canonical STAR stories, each provenance-anchored, each tagged
with the question families it answers; the round-2 interviewer drills them, the tailor
references them. **The daily brief**: one morning read that fuses pipeline, practice, and
transition into "the three things that matter today", each deep-linked and draft-attached. A
fifth team (**`compass`** — decoder · storyteller · aide) owns it — and deliberately **db-only**
(`functions: []` all three): the postings are already fetched, the market briefs already cited,
your record already structured; this round is pure synthesis. Strictly additive;
data/agents/pages/api/hooks only.

### New database tables (round 5 — 3, bringing the app to 24)

- **`fit_reports.json`** — the decoded read of one posting. `id` (pk uuid) · `postingId`
  (references `postings` onDelete cascade, required, unique) · `decoded` (string, required —
  markdown: what this role actually is, seniority reality-check, what the day-to-day likely
  looks like, reading between the lines of the requirements) · `fitScore` (number, required,
  0–100 — from the deterministic `fitScore` requirement-vs-facts math; the model interprets it,
  never invents it) · `requirementMatch` (json, required — per requirement `{ requirement, met:
  'strong'|'partial'|'missing', factIds }` — evidence or `missing`, no wishful matching) ·
  `redFlags` (json, def `[]` — `{ flag, evidence }`: reposted-for-months, salary below the
  market brief's range, title/scope mismatch, requirement soup) · `recommendation` (string,
  required — `'apply'`|`'network-first'`|`'skip'`) · `why` (string, required — three sentences
  max) · `createdAt` (date, now). Relation `posting` belongsTo `postings` via `postingId`.
- **`stories.json`** — one canonical interview story. `id` (pk) · `title` (string, required —
  "the zero-downtime migration") · `situation`/`task`/`action`/`result` (strings, required —
  the STAR body, written in the user's register from `settings.tone`) · `factIds` (json,
  required — every beat anchored to facts/accomplishments; the tailor's wall applied to
  storytelling) · `questionKinds` (json, required — which families it answers:
  `'leadership'`|`'conflict'`|`'failure'`|`'impact'`|`'ambiguity'`|`'technical-depth'`…) ·
  `strength` (string, def `'draft'` — `'draft'`|`'solid'`|`'signature'` — moves up only through
  mock-drill performance, `mock_sessions` evidence) · `timesDrilled` (number, def 0) ·
  `userEdited` (boolean, def false — an edited story is never regenerated, only re-tagged) ·
  `createdAt` (date, now).
- **`daily_briefs.json`** — the morning read. `id` (pk) · `day` (date, required, unique) ·
  `body` (string, required — markdown, three items max, each with its deep-link and, where one
  exists, its ready draft) · `actions` (json, required — `[{ label, route, draftDocumentId? }]`
  — auditable against the body, same discipline as money's briefing `inputs`) · `createdAt`
  (date, now).

New columns (additive `addColumn`): `applications.fitScoreAtApply` (number — frozen from the
fit report when stage first moves to `applied`, so the strategist can later correlate fit
scores with outcomes — the data that makes NEXT search's recommendations smarter);
`questions.storyId` (string — the interviewer links bank questions to the story that answers
them).

### New API endpoints (round 5 — 9, bringing the app to 58)

| name | method + route | I/O sketch |
|---|---|---|
| `getFitReport` | `GET api/fit/:postingId` | `{ postingId }` → `FitReport` |
| `applyQueue` | `GET api/queue` | `{}` → `{ apply: QueueRow[], networkFirst: QueueRow[], skip: QueueRow[] }` — active postings bucketed by recommendation, fit-ranked; each row carries score + top red flag |
| `redecodePosting` | `POST api/fit/:postingId` | `{ postingId }` → `{ status:'decoding' }` — after a profile change ("I just added three facts — re-score everything relevant") |
| `listStories` / `getStory` | `GET api/stories` / `GET api/stories/:id` | the bank, by questionKind/strength |
| `reviseStory` | `PATCH api/stories/:id` | `{ id, situation?, …, questionKinds? }` → `Story` (sets `userEdited`) |
| `mineStories` | `POST api/stories/mine` | `{}` → `{ status:'mining' }` — on-demand pass over unmined material |
| `getDailyBrief` / `listDailyBriefs` | `GET api/brief/:day` / `GET api/brief` | the read + archive |
| `fitOutcomes` | `GET api/fit/outcomes` | `{}` → `{ rows: [{ scoreBand, applied, interviews, offers }] }` — deterministic: frozen `fitScoreAtApply` vs actual stage outcomes — does the decoder's judgment predict anything? Shown to the user, honestly. |

`fitScore` and `fitOutcomes` are round 5's deterministic centrepieces — and `fitOutcomes` is the
round's honesty mechanism: the app measures its own decoder against reality and shows the
calibration curve rather than asking for faith. Established rules hold (equality-only `where`,
typed `HttpError`, `spawn` from handlers).

### New hooks (round 5 — 3, bringing the app to 15)

- **`decode-posting.ts`** — `database` **`postings:update`**, imperative handler: skip unless
  the update set `status:'enriched'` and no fit report exists, else
  `delegate('compass/decoder','decode', { input: { postingId: row.id } })` — completing the
  round-1 cascade into a three-step pipeline: **paste a URL → enriched → decoded**, so by the
  time you look at a posting the app already has an opinion with evidence.
- **`mine-stories.ts`** — `cron`, `daily: '07:05'`, Sunday-gated in the agent →
  `compass/storyteller#mine` — sweep unmined `achievement` facts + reviewed accomplishments;
  draft ≤2 new stories a week (a bank of forty is worse than a bank of eight); propose merges
  when a new win strengthens an existing story instead of duplicating it.
- **`daily-brief.ts`** — `cron`, `daily: '06:55'`, `trigger: 'compass/aide#brief'` — fuse
  `pipeline` (stale + upcoming interviews), the practice state (signature-story coverage of
  Thursday's interview kinds), the active transition checkpoint, and the queue's top mover into
  three items max. On a day with nothing that matters: "nothing needs you today" — and no row
  is written (silence is a feature, pinned by test).

**Loop-guard sanity.** `postings:update(enriched)` → decoder writes `fit_reports` (unwatched) ⇒
the full paste-to-decoded cascade runs insert → enrich(update) → decode → stop at depth 3 —
exactly the engine cap, documented and pinned as the catalog's deepest intentional chain (each
step's gate tested: re-enrich without a status flip fires nothing, a second `enriched` update
with an existing report fires nothing). The two crons write unwatched tables ⇒ stop.
**Self-write exclusion** backstops.

### New pages (round 5 — 4, bringing the app to 25) + components

| File | Route | Reads / writes |
|---|---|---|
| `pages/queue.tsx` | `/queue` | `applyQueue` — the ranked triage board; `redecodePosting`; apply/skip actions straight into round-1 flows |
| `pages/fit/[postingId].tsx` | `/fit/:postingId` | the decoded read: requirement match rows with fact links, red flags with evidence, the recommendation + `fitOutcomes` calibration footer |
| `pages/stories.tsx` | `/stories` | the bank by question family; `reviseStory`; strength badges with their mock evidence; `<Chat agent="compass/storyteller">` ("help me tighten the migration story") |
| `pages/brief.tsx` | `/brief` | today's three things + archive |

New components (design tokens only): `QueueColumn` (apply/network-first/skip), `MatchRow`
(strong/partial/missing as semantic tokens + fact links), `RedFlagChip` (evidence popover),
`StoryCard` (STAR-collapsed, question-family tags, strength badge), `BriefCard` (item +
deep-link + attached draft), `CalibrationStrip` (the fitOutcomes bands). The postings list
shows each row's score + recommendation inline; the application page shows `fitScoreAtApply`;
the round-2 practice page filters the bank to the upcoming interview's question kinds.

### The `compass` space (fifth project-scoped space, full format)

`career/spaces/compass/` — the judgment team, deliberately db-only:

| Agent | `db:read` tables | `db:write` tables | `api:call` allow | `functions` | Role |
|---|---|---|---|---|---|
| **decoder** | `postings, fit_reports, profile_facts, skills, market_briefs, applications, settings` | `fit_reports` | — | `[]` | decode the role; score with evidence; flag honestly; recommend with reasons |
| **storyteller** | `stories, accomplishments, profile_facts, mock_sessions, questions, settings` | `stories, questions` | — | `[]` | mine/merge stories; anchor every beat; promote strength only on drill evidence |
| **aide** | `daily_briefs, applications, activities, documents, transitions, checkpoints, stories, fit_reports, settings` | `daily_briefs` | `pipeline, applyQueue` | `[]` | three things max; drafts attached; silence when nothing matters |

- **Frontmatter features**: the storyteller declares `canDelegateTo:
  [prep/interviewer#questions]` — a new `signature` story warrants refreshing the question
  banks that could use it (hard allowlist); the aide declares `canDelegateTo:
  [agency/coach#nudge]` for the one case where the brief surfaces a stale application whose
  follow-up draft doesn't exist yet. `defaultAction: decode` / `mine` / `brief`.
- **Tasklists**: `decode/` — `01-evidence.md` (`role: explore`, `output: { matches: 'json',
  flags: 'json' }` — `fitScore` + `redFlagScan` outputs, typed), `02-read.md` (`dependsOn:
  [evidence]` — the decoded narrative; may not contradict the evidence table),
  `03-recommend.md` (one of three verdicts; `why` ≤ 3 sentences enforced by review). `mine/` —
  harvest (`role: explore` — unmined material + existing bank), draft (**`forEach:
  "harvest.candidates"`** — one fork per story, each emitting STAR + factIds + kinds), merge
  (dedupe against the bank; propose merges, never silently overwrite; `userEdited` stories are
  untouchable). `brief/` — gather (`role: explore` via the two `apiCall`s + transition state) →
  select (three max; the task fails on four) → write.
- **Functions** (deterministic): `fitScore` (requirements × facts/skills → 0–100 with
  per-requirement met levels — the same math the handler serves), `redFlagScan` (posting age /
  repost detection via `fetchedAt` history, salary-vs-brief range check, title-seniority
  heuristics — candidates only; the model judges which are real), `storyCoverage` (question
  kinds × bank → the gaps the miner prioritizes), `briefInputs` (the day's raw material,
  typed).
- **Components**: view `FitSummary` (chat-rendered score + top matches/flags), view
  `StoryOutline`; form `StoryIntake` — the `ask()` sheet when the storyteller needs the human
  half ("what was the actual hard part here? what number can you stand behind?") — the model
  structures, the user supplies truth.
- **Knowledge** (`knowledge/judgment/`): `decoding/` (`listing-speak.md`,
  `seniority-reality.md`, `red-flag-taxonomy.md`, `recommend-with-reasons.md`), `story-craft/`
  (`five-great-beats-fifty-facts.md`, `star-without-formula-smell.md`,
  `numbers-carry-stories.md`, `merge-dont-multiply.md`), `briefing/` (`three-things.md`,
  `silence-is-a-feature.md`, `draft-attached-or-it-didnt-help.md`).

### Phases & verification additions (round 5)

**(R5-1)** schemas + columns; **(R5-2)** `compass` full-format; **(R5-3)** the 9 endpoints
(`fitScore`/`fitOutcomes` single-definition); **(R5-4)** the 3 hooks + the depth-3 cascade
test; **(R5-5)** the 4 pages + inline surfacing; **(R5-6)** tests. Verification: **(a)** paste
a URL → enriched → decoded with no further action (the three-step cascade observed end-to-end
and terminating at depth 3; each gate's no-refire case pinned); every `requirementMatch` entry
is `missing` or carries resolving `factIds` (no wishful matching — adversarially seeded with a
near-miss requirement); **(b)** a below-market salary vs the latest brief lands in `redFlags`
with the brief cited; a fresh posting yields no repost flag (candidates-only pinned);
**(c)** `applyQueue` buckets match recommendations; applying freezes `fitScoreAtApply`;
`fitOutcomes` bands equal hand math on a seeded history — and render even when unflattering;
**(d)** Sunday mining on a bank with a near-duplicate win proposes a merge, not a new story;
`userEdited` stories survive mining byte-identical; strength never rises without
`mock_sessions` evidence; every STAR beat's `factIds` resolve; **(e)** the brief holds three
items with resolving routes and attached drafts where promised; a genuinely quiet fixture day
writes no row; the missing-follow-up case delegates `agency/coach#nudge` (allowlist observed);
**(f)** `pnpm lint:tokens` green across the 4 new pages.

## Round 6 — The radar: living dossiers, market signals & conversation (feature expansion)

Everything the app knows about a company it learned once — at enrichment, at brief time — and
then let rot. Round 6 makes company and market knowledge **living, curated, db-stored
content**: a sixth space (**`radar`** — watcher · dossierist · opener) keeps a daily watch on
the companies that matter to you (everything in your pipeline, everyone you might return to),
distills raw findings into deduplicated, cited **signals** (funding, layoffs, launches,
leadership changes, hiring waves), and folds them into a **living dossier** per company — the
one page you read before any call, always current, every claim sourced and dated. Signals are
also *timing*: the round-5 brief learns to say "Acme announced the launch you asked about in
your interview — today is the day to follow up", and the catalog's **conversation-starter**
surface arrives in career — bounded, dismissible chips where an agent opens with something
worth acting on *and the draft already attached*. Curated market insight that proves durable
gets promoted into space knowledge through the authoring path (the trips-app precedent) — the
radar makes every future brief and interview prep smarter. Strictly additive;
data/agents/pages/api/hooks only.

### New database tables (round 6 — 4, bringing the app to 28)

- **`watch_targets.json`** — one company or theme under watch. `id` (pk uuid) · `kind`
  (string, required — `'company'`|`'theme'` — themes are market threads like "EU remote
  hiring") · `name` (string, required, unique) · `reason` (string, required — why it's
  watched: "active application", "referee works there", "target-role market") · `source`
  (string, def `'auto'` — `'auto'`|`'user'`; every application's company is auto-watched by
  the `createApplication` handler, deterministically — no agent needed to start caring) ·
  `active` (boolean, def true — closing all applications at a company sets it inactive after
  `settings.watchCooldownDays`) · `lastSweptAt` (date) · `createdAt` (date, now). Relation
  `signals` hasMany `signals` via `targetId`.
- **`signals.json`** — one curated finding. `id` (pk) · `targetId` (references `watch_targets`
  onDelete cascade, required) · `kind` (string, required — `'funding'`|`'layoffs'`|`'launch'`|
  `'leadership'`|`'hiring'`|`'press'`|`'other'`) · `headline` (string, required — one line, the
  watcher's words) · `summary` (string, required — 2–3 sentences, what it means for YOU:
  "hiring wave in your target org — referrals land better in the first two weeks") · `sources`
  (json, required — `{ title, url, publishedAt }[]`) · `fingerprint` (string, required, unique
  — normalized event key; the same story from five outlets is one signal) · `weight` (string,
  def `'notable'` — `'notable'`|`'actionable'` — only `actionable` signals may become starters
  or brief items) · `createdAt` (date, now). Relation `target` belongsTo `watch_targets` via
  `targetId`.
- **`dossiers.json`** — the living company page. `id` (pk) · `targetId` (references
  `watch_targets` onDelete cascade, required, unique) · `body` (string, required — markdown,
  sectioned: what they do · money & momentum · org & leadership · how they hire · your history
  with them (from YOUR rows: applications, activities, connections, debriefs) · talking
  points) · `claimSources` (json, required — per-section source anchors; a dossier claim
  without a source or a your-rows reference fails the dossierist's own gate) · `freshAsOf`
  (date, required) · `createdAt` (date, now).
- **`starters.json`** — the conversation-opener surface (the money-app round-6 shape,
  identical bounds). `id` (pk) · `agent` · `hook` ("Acme raised a Series B — your referrer
  would love to hear from you; draft attached") · `seed` · `reason` (json — the signal /
  brief item behind it) · `draftDocumentId` (string — career's twist: a starter arrives with
  its draft already in `documents`) · `status` (`'open'`|`'engaged'`|`'dismissed'`|`'expired'`)
  · `expiresAt` · `createdAt`. **Handler-enforced: ≤2 open, fingerprint dedupe, terminal
  dismissal.**

New columns (additive `addColumn`): `settings.watchCooldownDays` (number, def 60);
`daily_briefs.signalIds` (json, def `[]` — the brief's timing items trace to real signals).

### New API endpoints (round 6 — 8, bringing the app to 66)

| name | method + route | I/O sketch |
|---|---|---|
| `listWatchTargets` / `watchTarget` | `GET/POST api/radar` | the watchlist; add a manual target or theme |
| `updateWatchTarget` | `PATCH api/radar/:id` | `{ id, active }` → mute/unmute |
| `listSignals` | `GET api/radar/signals` | `{ targetId?, weight? }` → `Signal[]` (newest first) |
| `getDossier` | `GET api/radar/dossier/:targetId` | the living page + `freshAsOf` |
| `refreshDossier` | `POST api/radar/dossier/:targetId` | `{ targetId }` → `{ status:'updating' }` — on-demand before a call |
| `listStarters` / `engageStarter` | `GET/PATCH api/starters` | the chips; engage opens the pre-seeded chat, dismiss is terminal |

Deterministic centrepieces: the **auto-watch rule** (application → target, handler-side) and
the signal `fingerprint` dedupe. The round-2 coach's `brief` action now **reads dossiers
instead of re-researching from scratch** — prep gets faster *and* deeper as the radar
accumulates; its own web pass only fills what the dossier lacks. Established rules hold.

### New hooks (round 6 — 3, bringing the app to 18)

- **`sweep-signals.ts`** — `cron`, `daily: '06:15'`, `trigger: 'radar/watcher#sweep'` — per
  active target (staleness-ordered, budget-capped per run): search, distill, fingerprint-dedupe,
  weigh; write only what a person would mention to you — the charter's bar for `notable`, and
  "you should do something about this" for `actionable`.
- **`update-dossier.ts`** — `database` `signals:insert` (coalesced), imperative handler:
  `delegate('radar/dossierist','fold',{})` — fold the burst into the affected dossiers
  (section-targeted edits, `freshAsOf` bump), never a full rewrite (stability makes the page
  readable daily).
- **`open-starters.ts`** — `cron`, `daily: '08:15'`, `trigger: 'radar/opener#starters'` — from
  yesterday's `actionable` signals + round-5 brief leftovers: ≤1 new starter/day within the
  ≤2-open bound, each with its draft pre-written into `documents` (via the round-1 pipeline's
  own versioned shape) and its chat pointed at the right agent (`agency/coach` for outreach,
  `prep/negotiator` when the signal moves an open offer's leverage).

**Loop-guard sanity.** `signals:insert` → dossierist writes `dossiers` (unwatched) ⇒ stops at
depth 1. The sweep writes `signals` — which fires `update-dossier`, an intentional depth-2
chain ⇒ stops (cap 3). The opener writes `starters` + `documents` — `documents:insert` DOES
fire the round-2 `build-questions` hook, whose `kind:'brief'` gate makes a starter draft a
no-op ⇒ stops at depth 2 (the gate gains a round-6 pin). **Self-write exclusion** backstops;
per-target sweep budgets keep a big watchlist inside the hook budget (partial sweeps resume
next day by `lastSweptAt` order).

### New pages (round 6 — 3, bringing the app to 24) + components

| File | Route | Reads / writes |
|---|---|---|
| `pages/radar/index.tsx` | `/radar` | watchlist + latest signals stream; mute/add; weight filter |
| `pages/radar/[targetId].tsx` | `/radar/:targetId` | the living dossier + its signal history; `refreshDossier`; `<Chat agent="radar/dossierist">` ("what changed since last month?") |
| `pages/signals.tsx` | `/signals` | the cross-target stream, `actionable` first — the morning-read companion to `/brief` |

New components (design tokens only): `StarterChips` (on `/brief` and the board — engage opens
the chat with the draft attached), `SignalRow` (kind badge + headline + sources), `DossierView`
(sectioned, per-claim source anchors, `freshAsOf`), `WatchRow`. The application page links its
company's dossier; interview prep (round 2) shows "dossier-backed" on brief sections that came
from the radar.

### The `radar` space (sixth project-scoped space, full format)

`career/spaces/radar/` — the market-intelligence team:

| Agent | `db:read` tables | `db:write` tables | `api:call` allow | `functions` | Role |
|---|---|---|---|---|---|
| **watcher** | `watch_targets, signals, settings` | `signals, watch_targets` | — | `webSearch, webFetch` | the daily sweep: distill, dedupe, weigh; a quiet day writes nothing |
| **dossierist** | `watch_targets, signals, dossiers, applications, activities, connections, debriefs, postings, settings` | `dossiers` | — | `webFetch` | fold signals + YOUR history into the living page; section edits, sourced claims |
| **opener** | `signals, starters, daily_briefs, applications, offers, connections, settings` | `starters, documents` | `pipeline` | `[]` | ≤1/day: the right moment, the right agent, the draft attached |

- **Frontmatter features**: the opener declares `canDelegateTo: [agency/coach#nudge,
  prep/negotiator]` — the draft attached to a starter is written by the agent who owns that
  craft, not by the opener (cross-space allowlist; the opener composes moments, not prose).
  The watcher declares `defaultAction: sweep`; the dossierist `defaultAction: fold` plus a
  `refresh` action bound to the on-demand tasklist. Durable market insight (a theme signal
  pattern that has held for months) is flagged for **space-knowledge promotion** through the
  authoring path — THING → `system-appbuilder` folds it into `radar/knowledge/` (runtime
  agents never write `knowledge/` files; the trips precedent, now standard across the
  catalog).
- **Tasklists**: `sweep/` — `01-targets.md` (`role: explore`, `output: { queue: 'json' }` —
  staleness-ordered, budget-sized), `02-hunt.md` (**`forEach: "targets.queue"`** — one fork
  per target; `functions: [webSearch, webFetch]` scoped here), `03-file.md`
  (`functions: [fingerprintSignal]` — dedupe, weigh, write). `fold/` — affected
  (`role: explore` — which dossiers the burst touches), edit (**`forEach:
  "affected.targets"`**, section-targeted), stamp. `starters/` — candidates (`role: explore`)
  → pick-one (fails on two) → draft-via-delegation (**task-level `canDelegateTo:
  [agency/coach#nudge, prep/negotiator]`** — only this task delegates) → open.
- **Functions** (deterministic): `fingerprintSignal` (event-key normalization — the dedupe the
  handler's unique column backstops), `sweepQueue` (staleness + budget → today's targets),
  `dossierSections` (the canonical section list + which signal kinds feed which section),
  `starterBounds` (the shared ≤2-open/fingerprint rule).
- **Components**: view `SignalDigest` (chat-rendered day's signals), view `DossierDelta`
  ("what changed since you last read this" — the dossierist's chat answer, rendered); form
  `WatchIntake` — the `ask()` sheet when a theme watch arrives vague ("which market, which
  geography, what would make a finding useful to you?").
- **Knowledge** (`knowledge/market-intelligence/`): `signal-craft/`
  (`would-a-person-mention-it.md`, `actionable-is-rare.md`, `five-outlets-one-event.md`),
  `dossier-craft/` (`living-not-rewritten.md`, `your-history-is-half-the-page.md`,
  `sourced-or-silent.md`), `timing/` (`moments-beat-reminders.md`,
  `draft-attached-or-it-didnt-help.md` — shared bar with the round-5 aide).

### Phases & verification additions (round 6)

**(R6-1)** schemas + columns (auto-watch in `createApplication` pinned); **(R6-2)** the
`radar` space full-format; **(R6-3)** the 8 endpoints; **(R6-4)** the 3 hooks + the
`build-questions` gate re-pin; **(R6-5)** the 3 pages + StarterChips + dossier links;
**(R6-6)** tests. Verification: **(a)** creating an application auto-watches its company
(handler, no agent run); closing the last application flips inactive after the cooldown;
**(b)** a seeded five-outlet story lands as ONE signal (fingerprint pinned); a quiet-day
sweep writes zero rows (would-a-person-mention-it pinned); sweep resumes by `lastSweptAt`
under a too-big watchlist (partial-sweep budget observed); **(c)** a signal burst folds into
section-targeted dossier edits — untouched sections byte-identical (living-not-rewritten
pinned); every dossier claim carries a source or a your-rows anchor; `refreshDossier` before
a fixture call date updates `freshAsOf`; **(d)** the round-2 coach's brief on a
dossier-backed company cites the dossier and only web-fills the gaps (faster-and-deeper
observed as fewer web calls in the trace); **(e)** starters: the bound/dedupe/terminal-
dismissal suite (shared with money); the draft is authored by the delegated owner
(`agency/coach` trace) and the starter's `documents` insert no-ops `build-questions` (gate
pinned); engaging opens the right agent with the draft in context; **(f)** an `actionable`
signal surfaces in the round-5 brief with `signalIds` tracing (timing-fusion observed);
**(g)** `pnpm lint:tokens` green.

## Round 7 — The sparring room, the coherence audit & the Friday retro (feature expansion)

Round 7 adds three interactions only a model can hold — **no new space**; each lands inside
the team that owns the craft. **The sparring room**: scripts (round 2) tell you what to say;
sparring makes you able to say it under pressure. The negotiator plays the hiring manager —
armed with the *real* offer numbers and the *real* market brief, deploying the real tactics
(the exploding deadline, the "we don't negotiate at this level", the long silence) — and the
debrief scores anchoring, silence-tolerance, and concession discipline against the same rubric
machinery mocks use. **The coherence audit**: by round 6 you have a resume per application, a
story bank, public posts, review packets — all making claims. People notice contradictions;
now the app notices first. A monthly cross-artifact audit finds contradictions, drift
(the same project described three increasingly grand ways), and stale claims, each finding
citing both artifacts. **The Friday retro**: five minutes of conversation ("what actually
happened this week?") that the scribe turns into ledger candidates and a week note — the
lowest-friction path yet into the round-3 ledger that feeds everything else. Strictly
additive; data/agents/pages/api/hooks only.

### New database tables (round 7 — 3, bringing the app to 31)

- **`rehearsals.json`** — one sparring session. `id` (pk uuid) · `kind` (string, required —
  `'salary-negotiation'`|`'screening-call'`|`'resignation'`|`'raise-ask'`) · `offerId`
  (references `offers` onDelete setNull — armed with the real numbers when one exists) ·
  `applicationId` (references `applications` onDelete setNull) · `scenario` (string, required
  — the counterpart the negotiator played, tactics included) · `transcriptSummary` (string,
  required — the arc, honest about where composure broke) · `scores` (json, required —
  `{ anchoring, silenceTolerance, concessionDiscipline, composure }`, 1–5 each with a
  one-line justification — the `mock_sessions` rubric shape, reused) · `debrief` (string,
  required — the strongest move, the tell, the one line to practice) · `createdAt` (date,
  now).
- **`coherence_reports.json`** — one cross-artifact audit. `id` (pk) · `scanAt` (date,
  required) · `artifactsScanned` (json, required — counts per kind: documents, stories,
  posts, packets, facts) · `findings` (json, required — `{ kind:
  'contradiction'|'drift'|'stale-claim'|'orphan-claim', severity: 'fix-now'|'worth-knowing',
  detail, artifacts: [{ table, id, quote }] }[]` — every finding quotes BOTH sides; an
  orphan-claim is a public statement whose backing fact was retired) · `status` (string, def
  `'open'` — `'open'`|`'reviewed'`) · `createdAt` (date, now).
- **`week_notes.json`** — one Friday retro's distillate. `id` (pk) · `weekStart` (date,
  required, unique) · `body` (string, required — the week in three sentences, the user's
  words compressed honestly) · `ledgerCandidates` (json, def `[]` — accomplishment-shaped
  moments the scribe spotted; each becomes a real ledger row only on user confirm) · `energy`
  (string — `'up'`|`'level'`|`'down'`, self-reported; the strategist's quarterly read gets a
  human trendline, not just pipeline math) · `createdAt` (date, now).

New columns (additive `addColumn`): `stories.lastAuditedAt` (date); `posts.lastAuditedAt`
(date) — the audit's high-water marks, so monthly scans read deltas, not the world.

### New API endpoints (round 7 — 7, bringing the app to 73)

| name | method + route | I/O sketch |
|---|---|---|
| `startSpar` | `POST api/spar` | `{ kind, offerId? }` → opens the negotiator chat in spar mode, numbers + market brief loaded |
| `listRehearsals` / `getRehearsal` | `GET api/spar` / `GET api/spar/:id` | history; one session's scores + debrief |
| `runCoherenceScan` | `POST api/coherence` | `{}` → `{ status:'scanning' }` — on-demand before a big interview or a packet submission |
| `getCoherenceReport` / `listCoherenceReports` | `GET api/coherence/:id` / `GET` | findings with both-sides quotes; mark `reviewed` |
| `getWeekNote` / `listWeekNotes` | `GET api/retro/:week` / `GET api/retro` | the Friday distillates + energy trendline |

Deterministic centrepiece: `claimIndex` (below) — the extraction pass that makes the audit
tractable is a function; the model judges only candidate pairs. Established rules hold.

### New hooks (round 7 — 2, bringing the app to 20)

- **`coherence-scan.ts`** — `cron`, `daily: '05:50'`, first-Saturday-of-month-gated →
  `compass/storyteller#audit` — the storyteller owns the material and the no-fabrication
  culture, so it owns the contradiction hunt. Delta-scan via the `lastAuditedAt` marks; a
  clean scan writes a report with zero findings (the all-clear is information too).
- **`friday-retro.ts`** — `cron`, `daily: '16:30'`, Friday-gated → `chronicle/scribe#invite`
  — open ONE retro starter ("five minutes on the week?") through the shared round-6 starter
  surface and bounds (the scribe writes the starter; `starterBounds` is the shared function —
  if two are already open, the retro waits for next Friday rather than crowding). The retro
  itself is chat; the `week_notes` row is a session-end write.

**Loop-guard sanity.** Both crons write unwatched tables (`coherence_reports`, `starters`,
`week_notes` at session end) ⇒ stop at depth 1. Confirming a `ledgerCandidate` flows through
the round-3 `logAccomplishment` path — the same provenance pipeline, no new cascade.
Rehearsal rows are session-end writes (no hook on `rehearsals`).

### New pages (round 7 — 3, bringing the app to 27) + components

| File | Route | Reads / writes |
|---|---|---|
| `pages/spar.tsx` | `/spar` | `startSpar` intake (kind + live offer picker); the sparring chat; history with score trajectories |
| `pages/coherence.tsx` | `/coherence` | latest report; findings with both-sides quotes and fix links (each artifact's edit page); `runCoherenceScan` |
| `pages/retro.tsx` | `/retro` | the week notes archive + energy trendline; pending `ledgerCandidates` confirm/dismiss |

New components (design tokens only): `SparScoreTrend` (the four rubric dimensions across
sessions — practice visibly working), `FindingCard` (kind + severity + the two quotes
side-by-side + fix links), `EnergyLine` (the human trendline, quiet styling), `CandidateChip`
(confirm-into-ledger). The offers page gains "spar before you answer" beside the comparison
matrix; the packets flow runs `runCoherenceScan` as a pre-submit suggestion; the strategist's
quarterly review reads the energy trendline.

### Space extensions (round 7 — no new space)

- **`prep/negotiator`** gains the `spar` action (tasklist `spar/`): `01-arm.md`
  (`role: explore` — the real offer via `apiCall('compareOffers')`, the latest market brief,
  the user's stated floor if one was set), `02-play.md` (the counterpart contract: real
  tactics, one pressure escalation, no cartoon villainy AND no pushover — calibrated to the
  market brief's actual leverage picture; **never reveals a "budget" number as if real** —
  the sim is honest that it's a sim), `03-score.md` (the rubric write; reuses
  `rubricAggregate` from round 2). New knowledge field `sparring/`
  (`real-tactics-catalog.md`, `pressure-calibration.md`, `debrief-the-tell.md`).
- **`compass/storyteller`** gains the `audit` action (tasklist `audit/`): `01-index.md`
  (`role: explore`, `functions: [claimIndex]` — extract dated, quantified claims from
  documents/stories/posts/packets/facts into a comparable index; `output` typed),
  `02-judge.md` (**`forEach: "index.candidatePairs"`** — one fork per suspicious pair:
  contradiction, drift, or fine), `03-report.md` (findings with both quotes; severity per the
  `fix-now` bar: anything an interviewer could catch). New function `claimIndex`; new
  knowledge aspects under `story-craft/` (`one-truth-many-tellings.md` — the same project may
  be told at different depths but never with different facts; `drift-detection.md`).
- **`chronicle/scribe`** gains the `retro` action (the Friday chat: three questions, five
  minutes, the user's words; candidates proposed via the existing `ask()` patterns) and the
  `invite` action (the starter write within shared bounds). New knowledge aspects under
  `ledger-craft/` (`friday-five-minutes.md`, `energy-is-data.md`).

### Phases & verification additions (round 7)

**(R7-1)** schemas + columns; **(R7-2)** the space extensions; **(R7-3)** the 7 endpoints;
**(R7-4)** the 2 hooks; **(R7-5)** the 3 pages + cross-surface links; **(R7-6)** tests.
Verification: **(a)** a spar armed with a seeded offer: the counterpart's numbers trace to
`compareOffers` and the market brief (no invented leverage — trace-audited); scores carry
justifications; the trend renders across three seeded sessions; **(b)** the audit on a
seeded corpus containing one contradiction (two documents claiming different team sizes),
one drift (a project growing across three posts), and one orphan (a post backed by a retired
fact) finds exactly those three, each with both-sides quotes resolving to real rows; a clean
corpus yields a zero-findings report (all-clear pinned); delta-scanning skips unchanged
artifacts (`lastAuditedAt` observed); **(c)** Friday: one starter within shared bounds (a
full board defers it — bound test); the retro writes one `week_notes` row; confirming a
candidate creates a real ledger row via `logAccomplishment` (provenance chain intact),
dismissing writes nothing; **(d)** the quarterly strategy review cites the energy trendline
when it moves; **(e)** `pnpm lint:tokens` green across the 3 new pages.

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
