# lmthing.people as a Project-Application — the `people` project

> A concrete instantiation of [project-as-application.md](./project-as-application.md) for a
> **personal CRM / relationship keeper**: you tell it about the people in your life in plain
> sentences ("had coffee with Anna — she's moving to Berlin in September"), a **`circle`** space of
> agents files the interaction, extracts durable facts and key dates, and every morning hands you a
> short agenda — who's overdue, whose birthday is coming, and a drafted personal check-in message
> for each, referencing what actually matters to them. The `people` project owns the app —
> `database/` (contacts, interactions, facts, key dates, nudges, settings), `pages/` (client React
> agenda / contacts / dossier), `api/` (named typed Node endpoints), `hooks/` (a `database`
> fact-extraction hook + a daily agenda cron), and the project-scoped `circle` space. Read the
> parent plan first for the shared mechanisms (capability globals, typed-contract pipeline,
> serving); this file is the people-specific shape. Paths are relative to the org repo root.

## Context

Everyone has relationships they value and quietly neglect — the mentor you meant to update, the
friend whose big interview you forgot to ask about, the birthday you remembered a day late.
Professional CRMs solve this for salespeople with forms nobody would inflict on a friendship. This
app solves it with a sentence. You log encounters the way you'd tell a partner about your day —
chat is the **primary input surface**, not an add-on — and the `biographer` turns those sentences
into structure: durable facts ("daughter Mia, born 2019", "training for a marathon in April") and
key dates, attached to the right person. Cadences are per-relationship ("Anna: monthly, mom:
weekly"); every morning the `outreach` agent computes who's slipped and **drafts** the check-in you
should send — personal, specific, referencing their actual life, never generic. Before you meet
someone, the dossier page is your two-minute brief: last conversations, open threads, their kids'
names. **The value is being the person who remembers** — thoughtfulness, systematized, with the app
drafting and you always the one who sends. (There is no `people/` domain today — it's a net-new
project-application, served under the generic `lmthing.app/<project>/` mount.)

## The project

- **Project id**: `people`. One per user pod (your relationships = the most personal dataset in the
  catalog; per-user, private, never leaves the pod except model calls).
- **Project-scoped space**: `people/spaces/circle/` — the specialists that maintain the app
  (`secretary`, `biographer`, `outreach`). Because the db is **project-rooted**, all three
  read/write the **same** tables and feed the **same** pages (the multi-agent-application shape).
- **THING** builds/evolves the app by delegating to `system-appbuilder` (parent plan
  §"system-appbuilder") — "track gift ideas per person", "add a groups page for my book club" are
  authoring requests. **Runtime** work is the `circle` agents, driven by one hook, one cron, and
  chat — not THING.
- **Provisioning**: v1 seeds the `people` project from a checked-in template materialized into the
  pod's `<root>/people/`, empty except the settings row and an onboarding card ("tell the secretary
  about three people you don't want to lose touch with"). In a **later phase** it becomes
  **installable from lmthing.store** as a project app (parent plan §Risks "Distribution").
- **v1 boundary — the app never contacts anyone.** No email/messaging integration, no send button.
  Nudges carry drafts the user copies into their own channel; `status:'sent'` is user-reported.
  This is a hard product line, not a missing feature (see Notes/Safety).

## Directory layout

```
people/
├── package.json              # react, @tanstack/react-router, @lmthing/{ui,css}, lucide-react …
├── database/
│   ├── contacts.json         # a person, their relationship, and the cadence you owe them
│   ├── interactions.json     # one logged encounter (the raw input stream)
│   ├── facts.json            # durable extracted facts about a person
│   ├── key_dates.json        # birthdays / anniversaries / one-off important dates
│   ├── nudges.json           # the agenda rows: overdue/key-date prompts with drafted messages
│   └── settings.json         # single row: lookahead horizon, daily nudge cap
├── pages/                    # client-side React SPA
│   ├── _app.tsx              # QueryClient + design-system theme provider
│   ├── _layout.tsx           # nav chrome: Today · People  (+ the secretary chat dock, global)
│   ├── index.tsx             # "/"               → the agenda (nudges + upcoming dates) + chat dock
│   ├── people/
│   │   ├── index.tsx         # "/people"         → contact list (overdue-first)
│   │   └── [id].tsx          # "/people/:id"     → the dossier (facts, timeline, dates, cadence)
│   └── settings.tsx          # "/settings"       → horizon, caps, data export
├── components/               # NudgeCard, ContactRow, FactChip, TimelineEntry, KeyDateBadge, DraftBox…
├── api/
│   ├── agenda/GET.ts                 # agenda        (the deterministic centrepiece)
│   ├── contacts/
│   │   ├── GET.ts                    # listContacts  (overdue-first ordering computed in JS)
│   │   ├── POST.ts                   # addContact
│   │   ├── [id]/GET.ts               # getContact    (the dossier: include interactions, facts, dates)
│   │   └── [id]/PATCH.ts             # updateContact (cadence, relationship, archive)
│   ├── interactions/
│   │   └── POST.ts                   # logInteraction (also bumps contacts.lastInteractionAt)
│   ├── facts/
│   │   └── [id]/PATCH.ts             # updateFact    (correct / deactivate an extraction)
│   ├── dates/
│   │   ├── POST.ts                   # addKeyDate
│   │   └── [id]/DELETE.ts            # removeKeyDate
│   ├── nudges/
│   │   └── [id]/PATCH.ts             # resolveNudge  (sent / dismissed / snoozed)
│   └── stats/GET.ts                  # peopleStats   (kept-up count, overdue count, streak)
├── hooks/
│   ├── extract-facts.ts      # database interactions:insert → circle/biographer#extract
│   └── daily-agenda.ts       # cron daily 07:30 → circle/outreach#draft
├── spaces/
│   └── circle/               # project-scoped space (agents / tasklists / knowledge)
│       └── agents/{secretary,biographer,outreach}/instruct.md
├── types/generated.d.ts      # GENERATED — row + endpoint I/O types (incl. relation fields)
└── .data/
    ├── app.db                # SQLite (WAL)
    ├── app.sql               # backup dump
    └── hooks-state.json      # cron last-run / pending queue
```

## Database (schemas — descriptions mandatory, FKs + relations)

People is the **unstructured-in, structured-out** example: `interactions` is the raw stream (a
sentence, a paragraph), and `facts`/`key_dates` are what the biographer distills from it — each
fact pointing back at the interaction it was `learnedFrom`, so every extraction is traceable to
what you actually said. Every table and column carries a required `description`; the loader fails
loud on any missing one.

```json
// database/contacts.json
{ "title": "Contacts",
  "description": "A person the user wants to stay close to, with the cadence they intend for the relationship.",
  "columns": {
    "id":                { "type": "string",  "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "name":              { "type": "string",  "description": "the person's name as the user says it; dedupe key for the secretary's matching", "required": true, "unique": true },
    "relationship":      { "type": "string",  "description": "'family' | 'friend' | 'colleague' | 'mentor' | 'acquaintance' — colors the drafts' register", "required": true },
    "cadenceDays":       { "type": "number",  "description": "intended days between touches; 0 = no cadence (never nudged, still tracked)", "default": 0 },
    "location":          { "type": "string",  "description": "where they live, e.g. 'Berlin' — context for drafts and visits" },
    "context":           { "type": "string",  "description": "one-line who-they-are, e.g. 'ex-teammate from Acme, climbing partner'" },
    "handles":           { "type": "json",    "description": "how the user reaches them, e.g. { \"signal\": \"…\", \"email\": \"…\" } — display only, the app never sends" },
    "lastInteractionAt": { "type": "date",    "description": "denormalized date of the latest interaction; maintained by the logInteraction handler, read by the agenda" },
    "archived":          { "type": "boolean", "description": "hidden from agenda and lists when true", "default": false },
    "createdAt":         { "type": "date",    "description": "when the contact was added", "generated": "now" } },
  "relations": {
    "interactions": { "hasMany": "interactions", "via": "contactId", "description": "the logged encounters" },
    "facts":        { "hasMany": "facts",        "via": "contactId", "description": "what's known about them" },
    "keyDates":     { "hasMany": "key_dates",    "via": "contactId", "description": "their birthdays/anniversaries/one-offs" },
    "nudges":       { "hasMany": "nudges",       "via": "contactId", "description": "agenda prompts about them" } } }
```

```json
// database/interactions.json — the raw input stream
{ "title": "Interactions",
  "description": "One logged encounter, in the user's own words. The biographer's source material — never edited by agents.",
  "columns": {
    "id":        { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "contactId": { "type": "string", "description": "who it was with", "required": true,
                   "references": { "table": "contacts", "column": "id", "onDelete": "cascade" } },
    "at":        { "type": "date",   "description": "when it happened (defaults to now; the user can backdate)", "required": true },
    "channel":   { "type": "string", "description": "'in-person' | 'call' | 'video' | 'message' | 'other'", "default": "in-person" },
    "summary":   { "type": "string", "description": "what happened / what they said, markdown, verbatim from the user", "required": true },
    "source":    { "type": "string", "description": "'chat' (via the secretary) | 'manual' (dossier form)", "default": "chat" },
    "createdAt": { "type": "date",   "description": "when the row was written", "generated": "now" } },
  "relations": {
    "contact": { "belongsTo": "contacts", "via": "contactId", "description": "who it was with" } } }
```

```json
// database/facts.json — the biographer's distillate
{ "title": "Facts",
  "description": "One durable fact about a person, extracted from an interaction (or entered by hand). What the outreach agent personalizes drafts with, and the dossier's substance.",
  "columns": {
    "id":          { "type": "string",  "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "contactId":   { "type": "string",  "description": "who the fact is about", "required": true,
                     "references": { "table": "contacts", "column": "id", "onDelete": "cascade" } },
    "kind":        { "type": "string",  "description": "'life-event' | 'family' | 'work' | 'preference' | 'plan' | 'thread' — 'plan' has a future date attached, 'thread' is an open loop worth asking about", "required": true },
    "body":        { "type": "string",  "description": "the fact, one sentence, e.g. 'starting a new job at Vitesse in September'", "required": true },
    "happensAt":   { "type": "date",    "description": "for 'plan'/'life-event': when it happens — lets the agenda surface 'ask how X went'" },
    "learnedFrom": { "type": "string",  "description": "the interaction this was extracted from; null for hand-entered",
                     "references": { "table": "interactions", "column": "id", "onDelete": "restrict" } },
    "active":      { "type": "boolean", "description": "false when superseded or wrong (facts are deactivated, not deleted — the trail stays)", "default": true },
    "createdAt":   { "type": "date",    "description": "when the fact was recorded", "generated": "now" } },
  "relations": {
    "contact":     { "belongsTo": "contacts",     "via": "contactId",   "description": "who it's about" },
    "interaction": { "belongsTo": "interactions", "via": "learnedFrom", "description": "where it was learned" } } }
```

```json
// database/key_dates.json
{ "title": "Key dates",
  "description": "A date that matters for a person: birthday, anniversary, or a one-off (surgery, exam, big move). Recurring dates roll yearly; one-offs fire once.",
  "columns": {
    "id":           { "type": "string",  "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "contactId":    { "type": "string",  "description": "whose date it is", "required": true,
                      "references": { "table": "contacts", "column": "id", "onDelete": "cascade" } },
    "label":        { "type": "string",  "description": "what it is, e.g. 'birthday', 'Mia starts school'", "required": true },
    "month":        { "type": "number",  "description": "1-12", "required": true },
    "day":          { "type": "number",  "description": "1-31", "required": true },
    "year":         { "type": "number",  "description": "for one-offs and for computing ages; null when unknown" },
    "recursYearly": { "type": "boolean", "description": "true = birthday-style (fires every year); false = one-off (fires once, then done)", "default": true },
    "createdAt":    { "type": "date",    "description": "when it was recorded", "generated": "now" } },
  "relations": {
    "contact": { "belongsTo": "contacts", "via": "contactId", "description": "whose date" } } }
```

```json
// database/nudges.json — the agenda rows
{ "title": "Nudges",
  "description": "One agenda prompt: a contact is overdue, a key date is near, or an open thread is ripe to ask about — with a drafted, personal message the user can copy. The app NEVER sends; status 'sent' is user-reported.",
  "columns": {
    "id":        { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "contactId": { "type": "string", "description": "who to reach out to", "required": true,
                   "references": { "table": "contacts", "column": "id", "onDelete": "cascade" } },
    "reason":    { "type": "string", "description": "'overdue' | 'key-date' | 'thread' — why this surfaced today", "required": true },
    "dueAt":     { "type": "date",   "description": "the day this belongs on the agenda", "required": true },
    "headline":  { "type": "string", "description": "one line for the card, e.g. 'Anna — 6 weeks since you talked; she starts the new job Monday'", "required": true },
    "draft":     { "type": "string", "description": "the drafted check-in message, markdown, written in the user's register for this relationship — ready to copy, meant to be edited", "required": true },
    "factIds":   { "type": "json",   "description": "array of facts ids the draft references — the personalization provenance", "required": true },
    "status":    { "type": "string", "description": "'pending' | 'sent' | 'dismissed' | 'snoozed'", "default": "pending" },
    "snoozedTo": { "type": "date",   "description": "when a snoozed nudge re-enters the agenda" },
    "createdAt": { "type": "date",   "description": "when the outreach agent wrote it", "generated": "now" } },
  "relations": {
    "contact": { "belongsTo": "contacts", "via": "contactId", "description": "who to reach" } } }
```

```json
// database/settings.json — single row
{ "title": "Settings",
  "description": "Single-row app settings. Seeded on provisioning; edited via the settings page.",
  "columns": {
    "id":            { "type": "string", "description": "always 'settings'", "primaryKey": true },
    "horizonDays":   { "type": "number", "description": "how many days ahead key dates surface on the agenda", "default": 7 },
    "dailyNudgeCap": { "type": "number", "description": "max new nudges the outreach agent writes per day (a wall of guilt helps nobody)", "default": 3 },
    "graceRatio":    { "type": "number", "description": "a contact counts overdue at cadenceDays * graceRatio (1.0 = strict) — softens the cadence into an intention, not an alarm", "default": 1.25 } } }
```

- **`facts.learnedFrom` is the provenance spine** — every extracted fact links to the interaction
  it came from; the dossier renders facts with a "from: 'had coffee with Anna…'" affordance, and a
  wrong extraction is corrected at the fact (deactivate/edit) while the raw interaction stays
  untouched. `onDelete: restrict` on `learnedFrom` keeps the trail intact.
- **`nudges.factIds` mirrors the career app's document provenance** — a draft that mentions Mia's
  school start cites the fact rows it used, so "why did it say this?" always has an answer.
- **`contacts.lastInteractionAt` is deliberately denormalized** — the agenda computes overdue-ness
  for *every* contact daily; one indexed-by-nature column read beats re-scanning `interactions`
  per contact, and exactly one code path (`logInteraction`) maintains it.
- **`onDelete` is deliberate**: everything about a person cascades with the contact (delete = full
  forget, a privacy feature); `facts.learnedFrom` is `restrict` (see above).

## Pages (client React, file-based routing)

Data comes from the generated typed client `useApi(name, input)` — no pod-side loaders. Relation
fields arrive typed, so the dossier renders timeline + facts + dates from one `getContact` call.

| File | Route | Reads / writes |
|---|---|---|
| `pages/index.tsx` | `/` | `agenda`; `resolveNudge` per card; the secretary chat dock |
| `pages/people/index.tsx` | `/people` | `listContacts` (overdue-first); `addContact` |
| `pages/people/[id].tsx` | `/people/:id` | `getContact` (include interactions, facts, keyDates); `logInteraction`, `updateContact`, `updateFact`, `addKeyDate` |
| `pages/settings.tsx` | `/settings` | settings read/write; export |

The `_layout.tsx` mounts the secretary chat dock **globally** (the parent plan's multisession WS
endpoint) — logging must be one keystroke away everywhere, because friction is what kills personal
CRMs. After the secretary logs an interaction from chat, the open dossier/agenda re-poll and the
new entry (and, moments later, the biographer's extracted facts) appear live — the "pages are a
live read view" property, here visible as *structure growing out of your own sentence*.

```tsx
// pages/people/[id].tsx → "/people/:id" — the dossier
import type { Contact, Interaction, Fact, KeyDate } from '../../types/generated'
import { useApi } from '@app/runtime'
import { FactChip, TimelineEntry, KeyDateBadge } from '../../components'

type Dossier = Contact & { interactions: Interaction[]; facts: Fact[]; keyDates: KeyDate[] }

export default function PersonPage({ params }: { params: { id: string } }) {
  const { data: person, isLoading } = useApi('getContact', { id: params.id })  // typed Dossier
  if (isLoading) return <Spinner />
  return (
    <article>
      <header>
        <h1>{person.name}</h1>
        <p>{person.context} · {person.location}</p>
        {person.keyDates.map((d) => <KeyDateBadge key={d.id} date={d} />)}
      </header>
      <section>{/* what to know before you meet them */}
        {person.facts.filter((f) => f.active).map((f) => <FactChip key={f.id} fact={f} />)}
      </section>
      <section>{/* the relationship, newest first */}
        {person.interactions.map((i) => <TimelineEntry key={i.id} entry={i} />)}
      </section>
    </article>
  )
}
```

## API (named, typed, Node handlers)

Endpoint = dir, method = filename; each exports `name`/`description`/`Input`/`Output` + default
handler `(input, { db, delegate, apiCall })`. Dual-addressed (HTTP for the browser, `name` for
agents via `apiCall`).

| name | method + route | I/O sketch |
|---|---|---|
| `agenda` | `GET api/agenda` | `{}` → `{ nudges: (Nudge & { contact })[], upcoming: (KeyDate & { contact, inDays })[], overdueCount }` |
| `listContacts` | `GET api/contacts` | `{}` → `(Contact & { overdueDays })[]` (overdue-first) |
| `addContact` | `POST api/contacts` | `{ name, relationship, cadenceDays?, context?, location? }` → `Contact` |
| `getContact` | `GET api/contacts/:id` | `{ id }` → `Contact & { interactions, facts, keyDates }` |
| `updateContact` | `PATCH api/contacts/:id` | `{ id, cadenceDays?, relationship?, archived?, … }` → `Contact` |
| `logInteraction` | `POST api/interactions` | `{ contactId, summary, at?, channel? }` → `Interaction` (bumps `lastInteractionAt`) |
| `updateFact` | `PATCH api/facts/:id` | `{ id, body?, kind?, active? }` → `Fact` |
| `addKeyDate` | `POST api/dates` | `{ contactId, label, month, day, year?, recursYearly? }` → `KeyDate` |
| `removeKeyDate` | `DELETE api/dates/:id` | `{ id }` → `{ ok }` |
| `resolveNudge` | `PATCH api/nudges/:id` | `{ id, status, snoozedTo? }` → `Nudge` (`sent` also logs a `message` interaction) |
| `peopleStats` | `GET api/stats` | `{}` → `{ tracked, keptUp, overdue, nudgesSentThisMonth }` |

> **Row-type note (engine truth).** The generated row-interface names follow the engine's
> deterministic singularizer (`build/schema.ts`): `key_dates → KeyDate`, `nudges → Nudge`
> (trailing `s` after `e` is stripped), `facts → Fact`, `settings → Setting`. Pages and handlers
> import these from `@app/types`.

```ts
// api/agenda/GET.ts → GET .../api/agenda ; name "agenda"
/** Today's agenda: pending nudges plus key dates inside the horizon. Overdue math lives HERE, once. */
export const name = 'agenda'
export const description = "Pending/unsnoozed nudges with their contacts, key dates within settings.horizonDays, and the overdue count — the single definition of 'who needs you'."

export interface Input  {}
export interface Output {
  nudges: Array<Nudge & { contact: Contact }>
  upcoming: Array<KeyDate & { contact: Contact; inDays: number }>
  overdueCount: number
}

export default async function handler(_: Input, ctx: { db: AsyncDbApi }): Promise<Output> {
  const s = (await ctx.db.query('settings', {}))[0]
  const now = Date.now()
  // where is equality-only: read wide, compute windows in JS (parent-plan pattern).
  const nudges = (await ctx.db.query('nudges', { include: ['contact'] }))
    .filter((n) => n.status === 'pending' || (n.status === 'snoozed' && Date.parse(n.snoozedTo ?? '') <= now))
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
  const upcoming = (await ctx.db.query('key_dates', { include: ['contact'] }))
    .map((d) => ({ ...d, inDays: daysUntilNext(d, now) }))            // yearly roll / one-off math
    .filter((d) => d.inDays >= 0 && d.inDays <= s.horizonDays && !d.contact.archived)
    .sort((a, b) => a.inDays - b.inDays)
  const overdueCount = (await ctx.db.query('contacts', { where: { archived: false } }))
    .filter((c) => c.cadenceDays > 0 && c.lastInteractionAt &&
      (now - Date.parse(c.lastInteractionAt)) / 86400000 > c.cadenceDays * s.graceRatio).length
  return { nudges, upcoming, overdueCount }
}
```

- `agenda` is the doc's **deterministic centrepiece** — overdue-ness (`cadenceDays * graceRatio` vs
  `lastInteractionAt`) and the key-date horizon are computed in exactly one place. The outreach
  agent consumes the same math via `apiCall('agenda')` before drafting, so the cron can never nag
  about someone the page says is fine.
- `resolveNudge` with `status:'sent'` **closes the loop**: it also writes a `channel:'message'`
  interaction ("sent the drafted check-in"), which bumps `lastInteractionAt` — so acting on a nudge
  immediately un-overdues the contact everywhere.
- `logInteraction` is the one maintainer of `lastInteractionAt` (agents log through it via
  `apiCall`, see capabilities — the denormalized column has a single writer, same discipline as
  learn's scheduler).

## Hooks

```ts
// hooks/extract-facts.ts — distill structure from each logged encounter
export default {
  type: 'database',
  on: { table: 'interactions', event: 'insert' },
  budget: { maxEpisodes: 8, maxWallClockMs: 300000 },
  handler: async ({ row, delegate }) => {
    await delegate('circle/biographer', 'extract', { input: { interactionId: row.id } })
  },
}
```

```ts
// hooks/daily-agenda.ts — the morning sweep
export default {
  type: 'cron',
  daily: '07:30',
  trigger: 'circle/outreach#draft',
  budget: { maxEpisodes: 12, maxWallClockMs: 600000 },
}
```

- **The loop is bounded**: the biographer writes `facts`/`key_dates` (unwatched tables) and never
  writes `interactions`; the outreach agent writes `nudges` (unwatched). The one intentional cycle
  — `resolveNudge('sent')` writes an interaction, which fires the biographer once more — is
  harmless (the extraction of "sent them the check-in" is a cheap no-op-ish run) and **finite** (the
  biographer's writes fire nothing). **Self-write exclusion** backstops the agents; **per-hook
  coalesce** collapses a chatty multi-log session into one extraction run covering the batch.
- Cron timing is the parent plan's **crond → hook-run endpoint** mechanism
  (`POST /api/projects/people/hooks/daily-agenda/run`); a morning missed while the pod was down
  runs once via boot catch-up; the outreach agent's dedupe contract (below) makes a double-fire
  write nothing new; local dev uses the in-process fallback tick.

## Chat (the secretary — the front door)

The `<Chat agent="circle/secretary" />` dock is mounted in `_layout.tsx` — **global**, because chat
is this app's primary input, reusing the always-available multisession WS endpoint (parent plan
§Chat); the binding is a runtime prop, no `chats/` dir:

- "Had coffee with Anna — she's stressed about the Vitesse start, and Mia lost her first tooth" →
  the secretary matches "Anna" against `contacts.name` (asking, not guessing, on ambiguity — two
  Annas is a question, never a coin flip), logs the interaction via `apiCall('logInteraction')`,
  and confirms in one line. Seconds later the extract hook has the biographer file the facts.
- "Ran into someone new at the climbing gym, Tomás, we should climb together" → no match → the
  secretary offers to create the contact (`addContact`), asks the one question that matters
  (cadence?), and logs the first interaction.
- "When did I last talk to my mom? What's going on with her?" → reads the dossier tables and
  answers from them.
- "What should I talk about with Ben tomorrow?" → assembles the brief from Ben's `thread`/`plan`
  facts and recent timeline — the dossier page's content, conversationally.
- History persists at `people/spaces/circle/sessions/<id>` (project-session snapshot form,
  resumable). This is the one place the catalog descriptor renderer re-enters the app — pages stay
  real React.

## The `circle` space (agents + capabilities)

Project-scoped at `people/spaces/circle/`. Capabilities are least-privilege per agent — one
config-bearing `capabilities:` frontmatter key, table scope **per verb** (parent plan §"Capability
globals"):

| Agent | `db:read` tables | `db:write` tables | `api:call` allow | `functions` | Role |
|---|---|---|---|---|---|
| **secretary** | `contacts, interactions, facts, key_dates, nudges, settings` | `contacts` | `logInteraction, addContact, resolveNudge` | `[]` (none) | the chat front door: match names, log via the API, answer from the dossier; asks on ambiguity |
| **biographer** | `contacts, interactions, facts, key_dates` | `facts, key_dates` | — | `[]` (none) | extract durable facts + dates from new interactions; supersede (deactivate) stale facts; never editorialize |
| **outreach** | `contacts, interactions, facts, key_dates, nudges, settings` | `nudges` | `agenda` | `[]` (none) | morning drafts: overdue + key-date + ripe-thread nudges, capped, deduped, personal |

```yaml
# people/spaces/circle/agents/secretary/instruct.md frontmatter — writes through the API
capabilities:
  - db:read:  { tables: [contacts, interactions, facts, key_dates, nudges, settings] }
  - db:write: { tables: [contacts] }           # cadence/context edits by conversation
  - api:call: { names: [logInteraction, addContact, resolveNudge] }   # logging goes through the single lastInteractionAt writer
functions: []
```

```yaml
# people/spaces/circle/agents/outreach/instruct.md frontmatter — reads everything, writes one table
capabilities:
  - db:read:  { tables: [contacts, interactions, facts, key_dates, nudges, settings] }
  - db:write: { tables: [nudges] }
  - api:call: { names: [agenda] }
functions: []
```

- **The whole space is db-only** (`functions: []` on all three) — like the money app, a mechanical
  privacy statement: nothing about your relationships can flow into a web call, no matter the
  prompt. (Frontmatter, never prose — parent plan gotcha.)
- **The secretary logs via `apiCall('logInteraction')`, not `db.insert`** — so the denormalized
  `lastInteractionAt` keeps its single writer even when the writer is an agent. Its charter:
  confirm the match ("logged for Anna Keller ✓"), *ask* when two contacts could match, and never
  invent a contact silently.
- **The biographer extracts, it doesn't narrate** — one-sentence facts in the contact's terms,
  `kind` discipline (`plan` gets `happensAt`; a new job supersedes the old `work` fact →
  deactivate + insert), and a **birthday mentioned in passing becomes a `key_dates` row** — the
  single highest-value extraction in the app.
- **The outreach agent's `draft` tasklist**: read `apiCall('agenda')`-adjacent state, pick at most
  `dailyNudgeCap` contacts (priority: hard key-dates > ripe `thread`/`plan` facts (`happensAt`
  just passed — "ask how the interview went") > longest-overdue), then a `forEach` over the picks
  — the host fans out one drafting fork per contact; the model never writes the loop. Dedupe
  contract: skip any contact with a `pending`/`snoozed` nudge already open — guilt must not stack.
- **Draft craft lives in the charter** — reference one or two *specific* facts (cite `factIds`),
  match the relationship's register (mom ≠ mentor), no manufactured warmth, short enough to
  actually send, and always meant to be edited by the human whose name is on it.
- **No `db:schema`/`pages:write`/`api:write` here** — the circle *operates* the app. "Track gift
  ideas" or "a shared-with-partner family view" is an authoring request → THING →
  `system-appbuilder`.

## Serving & domains

- **Local CLI**: `localhost:8080/app/people/…` (pages) and `localhost:8080/app/people/api/<name>` —
  the parent plan's mount, `<project>` = `people`.
- **Prod**: served under the **generic authenticated `lmthing.app` domain** at
  `lmthing.app/people/*` → the authenticated user's pod `/app/people/*` (Envoy JWT + per-user
  routing). No pre-existing static SPA to replace; a `lmthing.people` alias is an optional later
  edge-alias.
- **Admin/dev**: `lmthing.studio` manages it via `/api/projects/people/app` (manifest, data
  browser, manual hook run, build status, live preview iframe of `…/app/people/`).

**No public/shared surface** — every route and endpoint is an authenticated, per-user pod
read/write. For a database of other people's lives, pod isolation isn't just the default posture —
it's the ethical floor (see Notes/Safety).

## Additional features (more user value)

The core loop wins the day it surfaces one birthday you'd have missed; these deepen the memory.
Each is **additive** on the same engine.

### Pre-meeting briefs on the agenda — the two-minute superpower
- **Data**: none new — a `meetings`-shaped fact already exists as `kind:'plan'` with `happensAt`.
- **Agent**: the outreach agent's morning pass also writes a `reason:'thread'` nudge for any
  contact with a `plan` fact dated today/tomorrow, whose `draft` is a *brief*, not a message:
  open threads, recent facts, the thing to congratulate.

### Import a contacts file — cold-start in one drop
- **API**: `importContacts` `POST api/contacts/import` `{ vcardOrCsv }` — parse deterministically,
  insert with `cadenceDays: 0` (imported ≠ committed-to; the user opts people into cadences).
  Birthdays in the vCard land straight into `key_dates`.

### Reconnection suggestions — the long tail
- **Hook**: a monthly-gated extension of the morning cron — the outreach agent proposes (as
  `reason:'thread'` nudges) up to 3 `cadenceDays: 0` contacts not touched in 6+ months whose facts
  suggest an easy opener. Off by default (`settings.reconnectMonthly: false`) — this one must be
  opted into, not endured.

### A "what did I promise?" view — threads as first-class
- **Pages**: `/threads` — all active `kind:'thread'` facts across contacts ("said I'd send Ben the
  climbing video"), each resolvable (deactivate) from the page. Pure page + existing endpoints.

## Round 2 — Gatherings, gifts & the long view (feature expansion)

Round 1 shipped the memory-and-timing core — log in a sentence, extract facts, draft the daily
check-ins — and one `circle` space. Round 2 covers the parts of a social life that involve **more
than one person at a time and more than one day at a time**: **groups** (the book club, the family,
the old team) and **gatherings** with guest lists and RSVP tracking, planned by a `planner` that
drafts the invites and the checklist; a **gift** lifecycle where a `gifter` turns extracted facts
into concrete, on-time gift ideas ahead of key dates; and a quarterly **retrospective** where an
`archivist` shows you the long view of how your relationships are actually doing. A second
specialist team (**`host`** — planner · gifter · archivist) does this work; `circle` keeps owning
the daily loop. The round-1 privacy invariant — `functions: []` everywhere, the app never sends
anything — extends unchanged to the new space. Everything below is strictly additive to the
round-1 shape — same project-rooted db, same serving, same capability model — and stays inside the
parent plan (data/agents/pages/api/hooks only).

### New database tables (round 2 — 6, bringing the app to 12)

Prose-schema form (descriptions mandatory on table/column/relation, FKs resolve, exactly-one PK).
Round 2 adds the app's two many-to-manys (`group_members`, `gathering_guests`) — the kitchen-style
join shape, here joining people to circles and events:

- **`groups.json`** — a named circle of contacts. `id` (pk uuid) · `name` (string, required,
  unique) · `kind` (string, required — `'family'`|`'friends'`|`'club'`|`'work'`|`'other'`) ·
  `description` (string) · `cadenceDays` (number, def 0 — a group-level "we should all get
  together" intention, 0 = none) · `lastGatheredAt` (date — denormalized, maintained by the
  gathering-completion handler) · `archived` (boolean, def false) · `createdAt` (date, now).
  Relations: `members` hasMany `group_members` via `groupId`; `gatherings` hasMany `gatherings`
  via `groupId`.
- **`group_members.json`** — the contacts ⇄ groups join. `id` (pk) · `groupId` (references
  `groups` onDelete cascade, required) · `contactId` (references `contacts` onDelete cascade,
  required) · `role` (string, def `'member'` — `'member'`|`'organizer'`) · `createdAt` (date,
  now). Relations: `group` belongsTo `groups` via `groupId`; `contact` belongsTo `contacts` via
  `contactId`.
- **`gatherings.json`** — one planned event. `id` (pk) · `groupId` (references `groups` onDelete
  restrict — a gathering can also be group-less; null allowed) · `title` (string, required) · `at`
  (date, required) · `place` (string) · `status` (string, def `'planning'` —
  `'planning'`|`'invited'`|`'confirmed'`|`'happened'`|`'cancelled'`) · `checklist` (json, def `[]`
  — `{ item, done }` rows the planner drafts and the user ticks) · `notes` (string) · `createdAt`
  (date, now). Relations: `group` belongsTo `groups` via `groupId`; `guests` hasMany
  `gathering_guests` via `gatheringId`.
- **`gathering_guests.json`** — the contacts ⇄ gatherings join with RSVP state. `id` (pk) ·
  `gatheringId` (references `gatherings` onDelete cascade, required) · `contactId` (references
  `contacts` onDelete cascade, required) · `rsvp` (string, def `'pending'` —
  `'pending'`|`'yes'`|`'no'`|`'maybe'`, user-reported as replies come in) · `inviteDraft` (string
  — the planner's personal invite for THIS guest, referencing their facts; copy-out like every
  draft in the app) · `createdAt` (date, now). Relations: `gathering` belongsTo `gatherings` via
  `gatheringId`; `contact` belongsTo `contacts` via `contactId`.
- **`gifts.json`** — the idea-to-given lifecycle. `id` (pk) · `contactId` (references `contacts`
  onDelete cascade, required) · `occasion` (string, required — e.g. `'birthday 2027'`,
  `'housewarming'`) · `keyDateId` (references `key_dates` onDelete setNull — the date it's aimed
  at, when there is one) · `idea` (string, required — the gift, one line) · `why` (string,
  required — which fact makes it *them*) · `factIds` (json, required — provenance, the round-1
  discipline) · `status` (string, def `'idea'` — `'idea'`|`'shortlisted'`|`'bought'`|`'given'`|
  `'discarded'`) · `givenAt` (date) · `createdAt` (date, now). Relations: `contact` belongsTo
  `contacts` via `contactId`; `keyDate` belongsTo `key_dates` via `keyDateId`.
- **`retros.json`** — the quarterly long view. `id` (pk) · `quarter` (string, required, unique —
  `'2026-Q3'`) · `body` (string, required — markdown: who you kept up with, who quietly slipped,
  which groups actually gathered, gifts that landed; written kindly — the archivist's charter
  forbids guilt framing) · `stats` (json, required — `{ interactions, keptUpCount, slippedCount,
  gatheringsHeld, giftsGiven, perRelationship: [{kind, kept, slipped}] }` from the deterministic
  `retroStats` math) · `createdAt` (date, now).

New columns on round-1 tables (additive `addColumn`): `nudges.reason` gains `'invite'` and
`'gift'` (the planner's invite drafts and the gifter's buy-reminders ride the existing agenda
surface, cap and dedupe included); `settings.giftLeadDays` (number, def 21 — how far before a key
date gift ideas should exist); `settings.reconnectQuarterly` (boolean, def false — the promoted
opt-in reconnection pass, folded into the archivist's quarter run).

### New API endpoints (round 2 — 11, bringing the app to 22)

| name | method + route | I/O sketch |
|---|---|---|
| `createGroup` | `POST api/groups` | `{ name, kind, cadenceDays?, memberIds? }` → `Group` |
| `listGroups` | `GET api/groups` | `{}` → `(Group & { memberCount, lastGatheredAt })[]` |
| `getGroup` | `GET api/groups/:id` | `{ id }` → `Group & { members: (GroupMember & { contact })[], gatherings }` |
| `setGroupMembers` | `PUT api/groups/:id/members` | `{ id, contactIds }` → `{ ok }` (diff-and-write the join) |
| `createGathering` | `POST api/gatherings` | `{ title, at, groupId?, place?, guestIds? }` → `Gathering` (plan hook fires) |
| `getGathering` | `GET api/gatherings/:id` | `{ id }` → `Gathering & { guests: (GatheringGuest & { contact })[] }` |
| `rsvpGuest` | `PATCH api/gatherings/guests/:id` | `{ id, rsvp }` → `GatheringGuest` |
| `completeGathering` | `PATCH api/gatherings/:id` | `{ id, status }` → `Gathering` (`happened` logs one group interaction per `yes` guest + bumps `lastGatheredAt`) |
| `listGifts` | `GET api/gifts` | `{ contactId?, status? }` → `(Gift & { contact })[]` |
| `upsertGift` | `POST api/gifts` | `{ id?, contactId, occasion, idea, why, status? }` → `Gift` (user edits/advances the lifecycle) |
| `getRetro` | `GET api/retros/:quarter` | `{ quarter }` → `Retro` (plus `listRetros` `GET api/retros` → stats-only headers) |

All follow the round-1 rules — equality-only `where`, typed `HttpError` failures, **`spawn`
(never `delegate`) from handlers**. `completeGathering` is the round-2 closing-the-loop
centrepiece: marking a gathering `happened` writes a `channel:'in-person'` interaction for every
`yes` guest through the round-1 `logInteraction` path — one evening un-overdues eight people at
once, and the extract hook mines the gathering `notes` once for everyone. `retroStats` (inside
`getRetro`'s builder path) is the deterministic quarter math the archivist narrates.

### New hooks (round 2 — 3, bringing the app to 5)

- **`plan-gathering.ts`** — `database` `gatherings:insert`, imperative handler:
  `delegate('host/planner','plan', { input: { gatheringId: row.id } })` — draft the checklist and
  a **personal** invite per guest (into `gathering_guests.inviteDraft`), flip status to
  `'invited'`, and surface one `reason:'invite'` nudge pointing at the gathering page.
- **`gift-radar.ts`** — `cron`, `daily: '07:45'`, `trigger: 'host/gifter#scan'`, budget — for key
  dates entering `giftLeadDays`, ensure 2–3 `idea` gifts exist (skip contacts who already have
  open ideas for that occasion) and surface one `reason:'gift'` nudge; escalate `shortlisted`-
  but-unbought a week out.
- **`quarterly-retro.ts`** — `cron`, `daily: '08:15'`, quarter-start-gated in the agent →
  `host/archivist#retro` — write the quarter's `retros` row from `retroStats`; when
  `reconnectQuarterly` is on, append up to 3 opt-in reconnection suggestions as `reason:'thread'`
  nudges (the promoted round-1 feature, now quarterly and inside the cap).

**Loop-guard sanity.** `gatherings:insert` → planner writes `gathering_guests`/`nudges`
(unwatched) ⇒ stops at depth 1. `completeGathering` → `logInteraction` per yes-guest →
`interactions:insert` fires the round-1 `extract-facts` hook once (coalesced across the whole
guest burst) → biographer writes `facts`/`key_dates` (unwatched) ⇒ an **intentional depth-2
cascade** that stops (cap 3) — and a new key date the biographer mines from the gathering notes
is exactly what tomorrow's `gift-radar` cron (not a database hook — no further cascade) acts on.
The gifter writes `gifts`/`nudges` (unwatched) ⇒ stops. **Self-write exclusion** backstops all
three agents; the nudge cap + open-nudge dedupe hold because invites and gift reminders ride the
same `nudges` table as round 1.

### New pages (round 2 — 5, bringing the app to 9) + components

| File | Route | Reads / writes |
|---|---|---|
| `pages/groups/index.tsx` | `/groups` | `listGroups`; `createGroup` — circles with last-gathered staleness |
| `pages/groups/[id].tsx` | `/groups/:id` | `getGroup` (members + past gatherings); `setGroupMembers`; "plan a gathering" → `createGathering` |
| `pages/gatherings/[id].tsx` | `/gatherings/:id` | `getGathering` — RSVP board, per-guest invite drafts (copy-out), checklist ticking; `rsvpGuest`, `completeGathering`; `<Chat agent="host/planner">` dock |
| `pages/gifts.tsx` | `/gifts` | `listGifts` grouped by upcoming occasion; `upsertGift` lifecycle moves |
| `pages/retros.tsx` | `/retros` | `listRetros`/`getRetro` — the quarterly long view |

New shared components (design tokens only): `RSVPBoard` (pending/yes/no/maybe columns),
`GuestChip` (contact + rsvp state), `InviteDraftBox` (copy-out, edit-first framing), `GiftCard`
(idea → given lifecycle stepper), `RetroView`, `GroupStalenessBadge`. `_layout.tsx` nav gains
**Groups · Gifts · Retros**; the round-1 agenda page renders the new `'invite'`/`'gift'` nudge
reasons with their own card treatments; the dossier gains a **Gifts** tab (that contact's
lifecycle rows).

### The `host` space (second project-scoped space, full format)

`people/spaces/host/` — the more-than-one-person team, sharing the same project-rooted db as
`circle` (parent plan's multi-space shape). Least-privilege per verb; **`functions: []` on every
agent** — the round-1 privacy invariant is project-wide (gift ideas come from *their facts*, not
from shopping the web; a browsing gifter would leak the most intimate table in the catalog):

| Agent | `db:read` tables | `db:write` tables | `api:call` allow | Role |
|---|---|---|---|---|
| **planner** | `contacts, facts, key_dates, groups, group_members, gatherings, gathering_guests, nudges, settings` | `gatherings, gathering_guests, nudges` | — | checklist + per-guest personal invites; date-conflict check against key dates |
| **gifter** | `contacts, facts, key_dates, gifts, nudges, settings` | `gifts, nudges` | — | fact-grounded gift ideas ahead of key dates; buy-reminder escalation |
| **archivist** | `contacts, interactions, facts, key_dates, nudges, groups, group_members, gatherings, gathering_guests, gifts, retros, settings` | `retros, nudges` | `agenda` | the quarterly long view; opt-in reconnection suggestions |

- **Agent-frontmatter features exercised**: the planner declares
  `canDelegateTo: [circle/biographer#extract]` — a **cross-space** hard allowlist: when the user
  dumps post-gathering notes into the planner's chat dock, it hands them to the round-1
  biographer rather than extracting facts itself (any other delegation throws, naming the allowed
  target). The gifter declares `defaultAction: scan`; the planner `defaultAction: plan` with
  `actions:` for `plan` (tasklist `plan-gathering`) and the archivist `defaultAction: retro`.
- **Tasklists**: `plan-gathering/` — `01-roster.md` (`role: explore`, read-only: resolve the
  guest list — group members or explicit ids — with each guest's facts + key-date conflicts),
  `02-invites.md` (**`forEach: "roster.guests"`** — one fork per guest writes that guest's
  `inviteDraft`, personal and register-matched; the model never writes the loop),
  `03-checklist.md` (venue/food/logistics checklist from the gathering shape; write + status
  `'invited'` + the one agenda nudge). `retro/` — `01-stats.md` (`role: explore` +
  `functions: [retroStats]` — the deterministic quarter numbers), `02-narrate.md` (the kind
  long-view write-up; `functions: []`), `03-reconnect.md` (`optional: true` — runs only when
  `reconnectQuarterly`; picks ≤3 easy-opener reconnections).
- **Functions** (`functions/*.ts`, deterministic): `retroStats` (the quarter aggregation —
  the same numbers `getRetro` serves), `daysUntilNext` (shared key-date roll math, identical to
  the round-1 `agenda` handler's), `overdueScore` (cadence × grace ordering, one definition),
  `rsvpSummary` (guest rows → pending/yes/no/maybe counts for chat).
- **Components**: view `GatheringPreview` (chat-rendered RSVP snapshot via `rsvpSummary`), view
  `GiftShortlist`; form `GuestPicker` — an `ask()` sheet the planner renders when "plan a dinner"
  arrives without a guest list (group or hand-picked contacts). Design-token-gated.
- **Knowledge** (`knowledge/hosting/`, each field `index.md` + ≥2 aspects): `gathering-craft/`
  (`guest-mix.md`, `invite-register.md`, `checklist-method.md`), `gift-craft/`
  (`fact-to-gift.md`, `timing-and-lead.md`, `taste-vs-projection.md` — a gift reflects *their*
  facts, not the model's taste), `long-view/` (`relationship-seasons.md`,
  `reading-drift-kindly.md` — slipped ≠ failed; the retro reports, it never scolds).

### `circle` space-format remediation (round 2)

Round 1 left `circle` as `agents/`-only. Round 2 brings it to the **full space format**:
`charter.md` alongside every `instruct.md` (the secretary's fork-safe ask-on-ambiguity rule; the
biographer's extract-don't-editorialize rule; the outreach agent's no-guilt-stacking rule);
tasklists — `draft/` formalized for the outreach agent (`01-sweep.md` `role: explore` via
`apiCall('agenda')` → `02-pick.md` cap/dedupe/priority → `03-write.md`
**`forEach: "pick.contacts"`** one personal draft per pick) and `extract/` for the biographer
(read batch → distill → supersede-then-insert); `functions/` (`daysUntilNext` + `overdueScore`
shared with `host`, `dedupeFacts`, `draftLengthCheck` — drafts must stay sendable-short);
catalog `components/` (`ContactCard`, `NudgePreview` for chat); and **extensive
`knowledge/relationships/`** — `fact-extraction/` (`what-counts-as-durable.md`,
`supersedence.md`), `outreach-craft/` (`register-matching.md`, `brevity-and-editability.md`),
`cadence-design/` (`relationship-tiers.md`, `grace-not-alarms.md`).

### Phases & verification additions (round 2)

Ordered on top of the round-1 phases: **(R2-1)** new schemas + columns (the two joins resolve
both directions); **(R2-2)** the `host` space full-format + `circle` remediation; **(R2-3)** the
11 endpoints (`completeGathering` → `logInteraction` fan-in; `retroStats` single definition);
**(R2-4)** the 3 hooks + loop-guard checks; **(R2-5)** the 5 pages + components; **(R2-6)** tests.

Verification additions: **(a)** `createGathering` for a 6-member group → planner fires once, six
`inviteDraft`s land — each referencing only that guest's facts (cross-guest leakage = test
failure, the round-1 provenance test extended to the `forEach`), plus checklist + exactly one
`'invite'` nudge; **(b)** `GuestPicker`: "plan a dinner" in chat with no guests → the planner
`ask()`s with the form component instead of guessing; **(c)** `completeGathering('happened')`
with 4 `yes` guests → four interactions via `logInteraction` (single-writer holds),
`lastInteractionAt` bumps for all four, **one** coalesced biographer run mines the notes, and
`lastGatheredAt` updates; **(d)** a birthday 20 days out (`giftLeadDays: 21`) → `gift-radar`
writes 2–3 ideas whose `factIds` resolve to that contact, one `'gift'` nudge, and a re-run adds
**nothing** (open-idea dedupe); the week-out escalation fires only for `shortlisted` unbought;
**(e)** quarter start → one `retros` row whose `stats` equal `retroStats` exactly; with
`reconnectQuarterly` off, zero reconnection nudges; on, ≤3 and inside the daily cap; unique
`quarter` makes a boot-catch-up double-fire a no-op; **(f)** post-gathering notes pasted into the
planner's dock → it delegates `circle/biographer#extract` (cross-space allowlist observed;
anything else throws); **(g)** any `host` agent calling `webFetch` → typecheck failure
(`functions: []` project-wide); the gifter writing `facts` → host error naming its tables;
**(h)** deleting a contact still cascades cleanly through the new joins (`group_members`,
`gathering_guests`, `gifts`) — the full-forget check extended; **(i)** `pnpm lint:tokens` green
across the 5 new pages.

## Round 3 — The salon: introductions, moments & the year in people (feature expansion)

Round 1 built memory and timing (`circle`); round 2 built the more-than-one-person layer
(`host`). Round 3 builds the **connective and commemorative** layer: **introductions** — a
`matchmaker` spots pairs of your people who should know each other and drafts double-opt-in
intros that never leak a private fact; a **moments timeline** — a `chronicler` promotes the
interactions that were actually memorable into a life timeline with "on this day" resurfacing;
**traditions** — recurring rituals (the monthly dinner, the annual trip) tracked as first-class
intentions with lapse-watching; and the **yearbook** — a `celebrant`'s year-in-people annual
review. A third specialist team (**`salon`** — matchmaker · chronicler · celebrant) does this
work. The project invariant is untouched: `functions: []` everywhere, every draft is copy-out,
the app never sends. Everything below is strictly additive to the round-1/2 shape and stays
inside the parent plan (data/agents/pages/api/hooks only).

### New database tables (round 3 — 5, bringing the app to 17)

- **`intros.json`** — a suggested introduction between two of your people. `id` (pk uuid) ·
  `contactAId` (references `contacts` onDelete cascade, required) · `contactBId` (references
  `contacts` onDelete cascade, required) · `rationale` (string, required — the shared ground, in
  terms both sides already know publicly) · `sharedFactIds` (json, required — the facts the
  rationale rests on; **every one must pass the disclosure rule**, see the space section) ·
  `draftForA` (string — the copy-out message to A proposing the intro) · `draftForB` (string —
  written only after A said yes; double-opt-in is sequential, not parallel) · `status` (string,
  def `'suggested'` — `'suggested'`|`'asked-a'`|`'asked-b'`|`'made'`|`'declined'`|`'dismissed'`)
  · `createdAt` (date, now). Relations: `contactA`/`contactB` belongTo `contacts` via the two
  FKs.
- **`moments.json`** — a memorable event on the life timeline. `id` (pk) · `at` (date, required)
  · `title` (string, required — "Anna's wedding", "the Dolomites trip") · `body` (string —
  markdown, the story as the user told it) · `interactionId` (references `interactions` onDelete
  setNull — the log entry it was promoted from) · `promotedBy` (string, def `'agent'` —
  `'agent'`|`'user'`; user promotions always stick, agent ones are suggestions until confirmed) ·
  `confirmed` (boolean, def false — unconfirmed agent promotions render as suggestions, never as
  memories) · `createdAt` (date, now). Relations: `interaction` belongsTo `interactions` via
  `interactionId`; `people` hasMany `moment_contacts` via `momentId`.
- **`moment_contacts.json`** — the moments ⇄ contacts join. `id` (pk) · `momentId` (references
  `moments` onDelete cascade, required) · `contactId` (references `contacts` onDelete cascade,
  required). Relations: `moment` belongsTo `moments` via `momentId`; `contact` belongsTo
  `contacts` via `contactId`.
- **`traditions.json`** — a recurring ritual worth protecting. `id` (pk) · `name` (string,
  required, unique — "first-Friday dinner with the old team") · `groupId` (references `groups`
  onDelete setNull) · `contactIds` (json, def `[]` — participants when there's no group) ·
  `cadenceDays` (number, required) · `lastHeldAt` (date) · `timesHeld` (number, def 0) ·
  `status` (string, def `'alive'` — `'alive'`|`'lapsing'`|`'dormant'` — set by the deterministic
  lapse math, never by vibes) · `createdAt` (date, now). Relation `group` belongsTo `groups` via
  `groupId`.
- **`yearbooks.json`** — the year in people. `id` (pk) · `year` (number, required, unique) ·
  `body` (string, required — markdown: the people who defined the year, moments, traditions
  held/lapsed, intros made, gifts that landed; kind, specific, zero guilt) · `stats` (json,
  required — from the deterministic `yearStats` math) · `createdAt` (date, now).

New columns on earlier tables (additive `addColumn`): `nudges.reason` gains `'intro'` and
`'tradition'` (both ride the round-1 agenda surface, cap and dedupe included);
`settings.introMonthly` (boolean, def **false** — the matchmaker is opt-in, like round 2's
reconnections: proposing people to each other is a feature you turn on, not endure).

### New API endpoints (round 3 — 11, bringing the app to 33)

| name | method + route | I/O sketch |
|---|---|---|
| `listIntros` | `GET api/intros` | `{ status? }` → `(Intro & { contactA, contactB })[]` |
| `advanceIntro` | `PATCH api/intros/:id` | `{ id, status }` → `Intro` — the double-opt-in state machine; `asked-a → asked-b` triggers the matchmaker to write `draftForB`; `made` logs a `message` interaction for both sides |
| `listMoments` | `GET api/moments` | `{ contactId?, year? }` → `(Moment & { people })[]` (confirmed first) |
| `confirmMoment` | `PATCH api/moments/:id` | `{ id, confirmed, title?, body? }` → `Moment` (user edits stick; declining deletes the suggestion) |
| `addMoment` | `POST api/moments` | `{ title, at, body?, contactIds }` → `Moment` (`promotedBy:'user'`, confirmed) |
| `onThisDay` | `GET api/on-this-day` | `{}` → `{ moments: Moment[], yearsAgo: number[] }` — deterministic month/day match across years |
| `contactTimeline` | `GET api/contacts/:id/timeline` | `{ id }` → interleaved interactions + moments + gifts + gatherings for one person — the dossier's fourth dimension |
| `addTradition` / `listTraditions` | `POST/GET api/traditions` | CRUD; list carries computed next-due + status |
| `holdTradition` | `PATCH api/traditions/:id/held` | `{ id, at?, gatheringId? }` → `Tradition` (bumps `lastHeldAt`/`timesHeld`; when linked to a gathering the round-2 completion flow already logged the interactions — no double-logging) |
| `getYearbook` | `GET api/yearbooks/:year` | `{ year }` → `Yearbook` (plus `listYearbooks` → headers) |

All follow the established rules — equality-only `where`, typed `HttpError`, **`spawn` from
handlers**. `onThisDay`, the traditions lapse math, and `yearStats` are round 3's deterministic
centrepieces; agents narrate them. The round-1 agenda page gains an **On this day** strip
(`onThisDay`) — resurfacing is a read, not a nudge: it never counts against the daily cap.

### New hooks (round 3 — 4, bringing the app to 9)

- **`suggest-intros.ts`** — `cron`, `daily: '08:00'`, first-Monday-of-month-gated in the agent,
  **no-op unless `settings.introMonthly`** → `salon/matchmaker#scan` — score contact pairs on
  shared ground (facts/groups/gatherings co-attendance), write ≤2 `suggested` intros with
  `draftForA` only, one `'intro'` nudge each (inside the daily cap).
- **`curate-moments.ts`** — `database` `interactions:insert` (the **second** hook on this table
  — multi-hook fan-out is a first-class engine shape; each hook coalesces independently),
  imperative handler: `delegate('salon/chronicler','curate',{})` — the chronicler drains recent
  unreviewed interactions and promotes the genuinely memorable few (weddings, births, big moves,
  once-a-decade trips) as **unconfirmed** moment suggestions; its charter forbids promoting
  routine coffees (a timeline of everything is a timeline of nothing).
- **`tradition-watch.ts`** — `cron`, `daily: '07:40'`, `trigger: 'salon/celebrant#watch'` —
  recompute each tradition's status from `lastHeldAt + cadenceDays` (grace-ratio'd like round-1
  cadences); on `alive → lapsing` transitions only, write one `'tradition'` nudge with a drafted
  "shall we get one on the calendar?" message to the organizer-most contact.
- **`yearbook.ts`** — `cron`, `daily: '09:00'`, Dec-28-through-Jan-6-gated in the agent (runs
  once; unique `year` makes retries no-ops) → `salon/celebrant#yearbook`.

**Loop-guard sanity.** `interactions:insert` now fans to TWO hooks — `extract-facts` (round 1)
and `curate-moments` — which run independently, each once per coalesced burst; the chronicler
writes `moments`/`moment_contacts` (unwatched) ⇒ stops. The round-2 `completeGathering` fan-in
therefore now costs exactly two agent runs total (one biographer, one chronicler) regardless of
guest count — pinned by test. `advanceIntro('made')` logs interactions → the same two hooks fire
once more and terminate identically. The matchmaker and celebrant write only unwatched tables +
`nudges` ⇒ stop at depth 1. **Self-write exclusion** backstops all three agents.

### New pages (round 3 — 5, bringing the app to 14) + components

| File | Route | Reads / writes |
|---|---|---|
| `pages/timeline.tsx` | `/timeline` | `listMoments` (the life view, by year); `addMoment`; confirm/decline suggestions |
| `pages/people/[id]/timeline.tsx` | `/people/:id/timeline` | `contactTimeline` — one person's whole arc (interactions · moments · gifts · gatherings interleaved) |
| `pages/intros.tsx` | `/intros` | `listIntros`; `advanceIntro` — the double-opt-in board with copy-out drafts per stage |
| `pages/traditions.tsx` | `/traditions` | `listTraditions`; `addTradition`/`holdTradition` — status, streaks, next-due |
| `pages/yearbook.tsx` | `/yearbook` | `listYearbooks`/`getYearbook` — the annual reads |

New shared components (design tokens only): `TimelineRail` (year-grouped moments),
`MomentSuggestionCard` (confirm/edit/decline), `IntroBoard` (sequential opt-in stages),
`TraditionCard` (streak + status as semantic tokens), `YearbookView`, `OnThisDayStrip` (mounted
on the round-1 agenda page). `_layout.tsx` nav gains **Timeline · Intros · Traditions**; the
dossier links its person-timeline tab.

### The `salon` space (third project-scoped space, full format)

`people/spaces/salon/` — the connective-and-commemorative team. Least-privilege per verb;
`functions: []` on every agent (project invariant):

| Agent | `db:read` tables | `db:write` tables | `api:call` allow | Role |
|---|---|---|---|---|
| **matchmaker** | `contacts, facts, groups, group_members, gatherings, gathering_guests, intros, nudges, settings` | `intros, nudges` | — | monthly opt-in scan; sequential double-opt-in drafts; the disclosure rule above all |
| **chronicler** | `contacts, interactions, moments, moment_contacts, gatherings, settings` | `moments, moment_contacts` | — | promote the memorable few as suggestions; never confirm its own suggestions |
| **celebrant** | everything `circle`/`host` reads + `traditions, yearbooks` | `traditions, yearbooks, nudges` | `agenda` | tradition lapse-watching (deterministic status, drafted revival notes); the yearbook |

- **The disclosure rule is the space's load-bearing guardrail** (charter + mechanically
  testable): an intro `rationale`/draft may only reference a fact about A that B could already
  know — public-sphere facts (`work`, declared interests, co-attendance at YOUR events) qualify;
  `health`, `family`, private `plan`/`thread` facts never do. `sharedFactIds` records exactly
  what was used; the verification step fails on any non-qualifying kind. Sequential opt-in means
  B's draft is written only after A agrees — B never receives a message about an intro A
  declined.
- **Agent-frontmatter features exercised**: the celebrant declares
  `canDelegateTo: [circle/outreach#draft]` — a lapsed tradition's revival note is drafted by the
  round-1 outreach specialist (register-matched, cap-respecting) rather than duplicating that
  craft (cross-space allowlist; anything else throws). The matchmaker declares
  `defaultAction: scan`; the chronicler `defaultAction: curate`.
- **Tasklists**: `scan-intros/` — `01-pairs.md` (`role: explore`, `output: { candidates: 'json' }`
  — pair scores from shared ground), `02-disclosure.md` (`dependsOn: [pairs]` — filter every
  candidate's facts through the disclosure rule; a pair with no clean shared ground is dropped,
  never laundered), `03-draft.md` (**`forEach: "disclosure.cleared"`** — one fork per cleared
  pair writes `draftForA`). `yearbook/` — `01-stats.md` (`role: explore`,
  `functions: [yearStats]`), `02-narrate.md` (`dependsOn: [stats]` — the kind year read),
  `03-traditions.md` (`optional: true` — the December tradition-planning postscript, only when
  any tradition is `lapsing`/`dormant`).
- **Functions** (`functions/*.ts`, deterministic): `yearStats` (the year aggregation
  `yearbooks.stats` must equal), `traditionStatus` (lastHeldAt + cadence + grace → status — the
  same rule `listTraditions` serves), `pairSharedGround` (co-groups/co-gatherings/fact-overlap
  scoring), `disclosureCheck` (fact kinds → qualifying subset — the mechanical half of the
  disclosure rule).
- **Components**: view `IntroCandidateCard` (chat-rendered pair + rationale), view
  `TraditionStreak`; form `IntroConsent` — the `ask()` sheet when the user reviews a suggestion
  in chat ("propose it to Anna? / edit the rationale / drop it").
- **Knowledge** (`knowledge/weaving/`, each field `index.md` + ≥2 aspects): `introductions/`
  (`shared-ground.md`, `disclosure-ethics.md`, `sequential-opt-in.md`), `memory-keeping/`
  (`what-makes-a-moment.md`, `suggestion-not-assertion.md` — the chronicler proposes, the human
  remembers), `rituals/` (`tradition-lifecycle.md`, `revival-without-guilt.md`), `year-review/`
  (`kindness-and-truth.md`, `stats-as-seasoning.md`).

### Phases & verification additions (round 3)

Ordered on top of rounds 1–2: **(R3-1)** new schemas + columns (both new joins resolve);
**(R3-2)** the `salon` space full-format; **(R3-3)** the 11 endpoints (`onThisDay`,
`traditionStatus`, `yearStats` single-definition checks); **(R3-4)** the 4 hooks incl. the
multi-hook fan-out test; **(R3-5)** the 5 pages + components; **(R3-6)** tests.

Verification additions: **(a)** with `introMonthly` off the matchmaker never runs; on, ≤2
suggestions whose `sharedFactIds` ALL pass `disclosureCheck` — seeding a tempting pair whose only
shared ground is a `health` fact yields **no** suggestion (the disclosure test, adversarially
seeded); **(b)** the double-opt-in sequence: `draftForB` is null until `asked-a → asked-b`;
declining at `asked-a` leaves B with zero trace; `made` logs one interaction per side through
`logInteraction`; **(c)** a gathering completion with 6 guests still costs exactly two agent runs
(biographer + chronicler, coalesced fan-out pinned); the chronicler's promotions land
`confirmed:false` and render as suggestions; `confirmMoment` edits stick; a declined suggestion
deletes; **(d)** `onThisDay` matches month/day across years deterministically and never writes a
nudge; **(e)** tradition `alive → lapsing` fires exactly one revival nudge, drafted via
`circle/outreach#draft` (cross-space allowlist observed); `holdTradition` linked to a gathering
double-logs nothing; status equals `traditionStatus` on fixtures; **(f)** the yearbook window
runs once (unique `year`; retry no-op); `stats` equals `yearStats`; the body names zero
guilt-framings (charter review test) and `03-traditions.md` runs only when something is lapsed
(`optional` observed); **(g)** any `salon` agent calling `webSearch`/`webFetch` → typecheck
failure (project invariant); the chronicler writing `facts` → host error naming its tables;
**(h)** contact deletion cascades through `moment_contacts`/`intros` (full-forget extended);
**(i)** `pnpm lint:tokens` green across the 5 new pages.

## Phases & order

Assumes the parent plan's engine (db + capability globals, api runtime, typed-contract build, pages
build, hooks runtime, chat) exists. People-specific work on top:

1. **Schemas** — the six `database/*.json`; verify FKs (everything → contacts; `facts.learnedFrom`
   → interactions `restrict`), required descriptions pass the fail-loud loader; row + relation
   types generate (the `Dossier` include shape: `Contact & { interactions, facts, keyDates }`).
2. **API** — `agenda` (the shared overdue/horizon math incl. yearly key-date roll), `logInteraction`
   (single `lastInteractionAt` writer), `resolveNudge` (`sent` → interaction), the dossier reads.
3. **`circle` space** — the three agents' `instruct.md` (config-bearing `capabilities:` — the
   secretary's api-logging + ask-on-ambiguity charter, the biographer's supersede/extract
   discipline, the outreach agent's cap/dedupe/priority contract + per-contact `forEach` draft
   tasklist), `functions: []` space-wide.
4. **Hooks** — `extract-facts` (database:insert on interactions, coalesced) + `daily-agenda` (cron
   daily); confirm boundedness (the one `sent`→interaction→extract cycle terminates; nothing
   watches facts/key_dates/nudges).
5. **Pages** — agenda (nudge cards with copyable drafts + upcoming dates), contacts list
   (overdue-first), dossier (facts with provenance, timeline, dates, cadence editor), settings;
   the **global** secretary dock in `_layout.tsx`; design-system token gate (no raw colors —
   overdue state is a semantic token, not a literal red).
6. **Serving** — seed each pod's `people` project from the checked-in template; serve under generic
   `lmthing.app/people/*`; Studio manages it under `/api/projects/people/app`.
7. **Additional features** — briefs, vCard import, opt-in reconnections, threads view (§above);
   each additive, shippable after the core loop.
8. **Docs** — fold into `SPACE_DEVELOPMENT.md` "Project apps" as the chat-as-primary-input +
   extraction-pipeline example.

## Verification (end-to-end, local)

1. Load the `people` project → schemas validate (descriptions/FK/relations),
   `types/generated.d.ts` has `Contact`/`Interaction`/`Fact`/`KeyDate`/`Nudge` with relation
   fields, including the dossier include shape.
2. `lmthing serve`; `addContact` ×3 with cadences; `GET localhost:8080/app/people/people/<id>`
   renders the dossier from a **single** `getContact` include call (no per-section fetch in the
   network log).
3. Chat (mock streamFn): "had coffee with Anna — she starts at Vitesse in September, and her
   birthday's March 3rd" → the secretary calls `logInteraction` (not `db.insert` — assert via
   trace); `lastInteractionAt` bumps; the extract hook fires **once**; the biographer writes a
   `work`/`plan` fact with `learnedFrom` set **and** a `key_dates` row (3/3, `recursYearly`).
4. Log a second interaction contradicting a fact ("actually she turned Vitesse down") → the old
   fact flips `active:false`, a new one appears — both visible in the dossier trail.
5. Ambiguity: with two contacts named Anna, the same chat line makes the secretary **ask**, not
   pick (mock-scripted assertion).
6. Backdate a contact's `lastInteractionAt` past `cadenceDays * graceRatio`; run `daily-agenda` →
   at most `dailyNudgeCap` nudges; each `draft` references facts whose ids are all in `factIds`
   and that belong to that contact (cross-contact leakage = test failure). Re-run → **no
   duplicates** (open-nudge dedupe).
7. Add a key date 5 days out (`horizonDays: 7`) → it appears in `agenda.upcoming` with correct
   `inDays`; a one-off (`recursYearly:false`) in the past never resurfaces.
8. `resolveNudge` `sent` → a `message` interaction lands, `lastInteractionAt` bumps, the contact
   drops out of `overdueCount`, and the follow-on extract run terminates (the bounded cycle).
9. Capability walls: the outreach agent writing `facts` → host error naming its allowed tables;
   any `circle` agent calling `webSearch` → typecheck failure (`functions: []`); the biographer
   `apiCall('agenda')` → host error (not allowlisted).
10. Snooze a nudge to tomorrow → gone from today's `agenda`, back tomorrow (`snoozedTo` check).
11. Backup: `app.sql` + schemas + pages + api + hooks + circle space committed; `**/sessions/`
    not; restore rebuilds `app.db` from `app.sql` (learnedFrom/factIds provenance intact); deleting
    a contact cascades everything about them (the full-forget check).

## Notes

- **Reuses the parent engine wholesale** — no people-specific runtime; data + agents + pages +
  hooks on the shared layer. If a mechanism is missing here, it belongs in
  [project-as-application.md](./project-as-application.md), not a people fork.
- **Why it's a good AI-assisted app** — the reason personal CRMs die is data entry; the reason
  they'd matter is memory + timing. The engine splits it perfectly: a sentence in chat is the
  entire input cost (secretary), extraction turns it into queryable structure (biographer, the
  fuzzy half), and cadence/horizon math is deterministic (agenda handler). Drafting the check-in —
  specific, warm, in your register — is the part only a model can do and the part users dread most.
- **Safety: the human sends, always.** The app holds `handles` for display but has no send path,
  no messaging integration, and `functions: []` space-wide means no agent can even fetch a URL.
  Drafts are explicitly "meant to be edited"; `status:'sent'` is self-reported. Automating the
  *appearance* of caring would poison the product's entire point — this line is load-bearing.
- **This is data about third parties** — people who never consented to being in a database. Pod
  isolation, no outbound calls (beyond the model), cascade-delete-as-full-forget, and no sharing
  surface in v1 are the floor. Any future shared/household view is a parent-plan-level decision.
- **`db.query` `where` is equality-only** in the shipped engine — overdue windows, the key-date
  yearly roll, snooze expiry, and ripe-thread checks are query-wide-then-filter-in-JS in `agenda`
  and the agents, not SQL predicates. A personal circle (a few hundred contacts) is trivially
  in-memory.
- **No external-binding registry exists in v1** — and like money, this app wants none:
  `functions: []` space-wide. `api:call` is reserved for the app's own typed endpoints, and the
  secretary's `logInteraction` allowlist is the pattern proof: even the conversational front door
  respects the single-writer discipline.
