# lmthing.learn as a Project-Application — the `learn` project

> A concrete instantiation of [project-as-application.md](./project-as-application.md) for a
> **spaced-repetition tutor**: you name a topic (or paste your own material), a **`tutor`** space
> generates a deck of cards for it, a deterministic SM-2-style scheduler in handler code decides
> what you review each day, and a conversational examiner quizzes you and explains what you miss.
> The `learn` project owns the app — `database/` (topics, cards, reviews, digests, settings),
> `pages/` (client React today-queue / topics / stats), `api/` (named typed Node endpoints —
> including the scheduler), `hooks/` (a `database` deck-drafting hook + a weekly digest cron), and
> the project-scoped `tutor` space. Read the parent plan first for the shared mechanisms
> (capability globals, typed-contract pipeline, serving); this file is the learn-specific shape.
> Paths are relative to the org repo root.

## Context

Spaced repetition is the most evidence-backed way to actually retain anything — and almost everyone
who tries it quits, for two reasons: **making good cards is hard work**, and a deck of bare
flashcards can't explain *why* you got something wrong. This app removes both. Say "I'm learning
Rust ownership" or paste a chapter, and the `cardsmith` writes the deck — atomic prompts, cloze
deletions, and application questions, not definition-parroting. Each day the app hands you a queue
computed by a **deterministic scheduler** (the same SM-2 family Anki uses, implemented in handler
code so the math is exact and auditable). And when you'd rather be quizzed than flip cards, the
`examiner` runs a conversational drill — it asks, you answer in your own words, it grades **through
the app's own typed API** so the scheduler stays the single source of truth, and it *explains* the
gap when you miss. On Sundays the `curator` writes a digest — retention per topic, your weak spots,
and fresh re-drill cards aimed exactly at them. **The value is Anki-grade retention without
Anki-grade card-authoring labor, plus a tutor who explains** — the app grows with whatever you're
learning. (There is no `learn/` domain today — it's a net-new project-application, served under the
generic `lmthing.app/<project>/` mount.)

## The project

- **Project id**: `learn`. One per user pod (your learning = per-user data; your review history is
  the whole asset).
- **Project-scoped space**: `learn/spaces/tutor/` — the specialists that maintain the app
  (`cardsmith`, `examiner`, `curator`). Because the db is **project-rooted**, all three read/write
  the **same** tables and feed the **same** pages (the multi-agent-application shape).
- **THING** builds/evolves the app by delegating to `system-appbuilder` (parent plan
  §"system-appbuilder") — "add image-occlusion cards", "track my exam dates" are authoring
  requests. **Runtime** work is the `tutor` agents, driven by one hook, one cron, and chat — not
  THING.
- **Provisioning**: v1 seeds the `learn` project from a checked-in template materialized into the
  pod's `<root>/learn/`, with one small demo topic ("How this app schedules reviews" — the deck
  teaches its own algorithm, which doubles as onboarding). In a **later phase** it becomes
  **installable from lmthing.store** as a project app (parent plan §Risks "Distribution").

## Directory layout

```
learn/
├── package.json              # react, @tanstack/react-router, @lmthing/{ui,css}, lucide-react …
├── database/
│   ├── topics.json           # a thing being learned (with optional pasted source material)
│   ├── cards.json            # one prompt/answer card + its scheduling state (ease/interval/due)
│   ├── reviews.json          # one graded review event (the append-only history)
│   ├── digests.json          # the curator's weekly progress write-ups
│   └── settings.json         # single row: daily caps, quiz length, grading scale prefs
├── pages/                    # client-side React SPA
│   ├── _app.tsx              # QueryClient + design-system theme provider
│   ├── _layout.tsx           # nav chrome: Today · Topics · Quiz · Stats
│   ├── index.tsx             # "/"               → today's queue (flip + grade)
│   ├── topics/
│   │   ├── index.tsx         # "/topics"         → topic list (+ add-a-topic box)
│   │   └── [id].tsx          # "/topics/:id"     → the deck (browse/edit/suspend cards)
│   ├── quiz.tsx              # "/quiz"           → the examiner chat (conversational drill)
│   └── stats.tsx             # "/stats"          → streak, retention, digests
├── components/               # CardFace, GradeBar, TopicCard, DeckTable, RetentionChart, DigestView…
├── api/
│   ├── topics/
│   │   ├── GET.ts                    # listTopics
│   │   ├── POST.ts                   # addTopic       (insert → draft-cards hook fires)
│   │   ├── [id]/GET.ts               # getTopic       (include cards)
│   │   └── [id]/cards/POST.ts        # regenerateCards (delegates the cardsmith for more/harder)
│   ├── queue/GET.ts                  # dueCards       (the deterministic scheduler read)
│   ├── reviews/POST.ts               # submitReview   (the deterministic scheduler write — SM-2 step)
│   ├── cards/
│   │   ├── POST.ts                   # addCard        (manual authoring stays first-class)
│   │   └── [id]/PATCH.ts             # updateCard     (edit faces / suspend / unsuspend)
│   ├── digests/
│   │   ├── GET.ts                    # listDigests
│   │   └── [week]/GET.ts             # getDigest
│   └── stats/GET.ts                  # learnStats     (streak, due counts, retention per topic)
├── hooks/
│   ├── draft-cards.ts        # database topics:insert → tutor/cardsmith#draft
│   └── weekly-digest.ts      # cron daily 07:00; the curator no-ops unless it's Sunday
├── spaces/
│   └── tutor/                # project-scoped space (agents / tasklists / knowledge)
│       └── agents/{cardsmith,examiner,curator}/instruct.md
├── types/generated.d.ts      # GENERATED — row + endpoint I/O types (incl. relation fields)
└── .data/
    ├── app.db                # SQLite (WAL)
    ├── app.sql               # backup dump
    └── hooks-state.json      # cron last-run / pending queue
```

## Database (schemas — descriptions mandatory, FKs + relations)

Learn is the **deterministic-algorithm** example: the scheduling state lives *on* the card
(`ease`/`intervalDays`/`dueAt`), is mutated by exactly one code path (`submitReview`), and
`reviews` is the append-only audit trail that makes retention computable and the algorithm
replayable. Agents write card *content*; they never touch scheduling fields. Every table and column
carries a required `description`; the loader fails loud on any missing one.

```json
// database/topics.json
{ "title": "Topics",
  "description": "One thing the user is learning. May carry pasted source material the cardsmith drafts from; without material the cardsmith researches the topic itself.",
  "columns": {
    "id":        { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "title":     { "type": "string", "description": "what's being learned, e.g. 'Rust ownership & borrowing'; dedupe key", "required": true, "unique": true },
    "goal":      { "type": "string", "description": "why / to what depth, e.g. 'pass the CKA exam in March' — steers card difficulty" },
    "material":  { "type": "string", "description": "optional pasted source text (markdown) the deck is drafted from" },
    "status":    { "type": "string", "description": "'drafting' while the cardsmith writes the deck, 'ready' after, 'archived' to retire", "default": "drafting" },
    "createdAt": { "type": "date",   "description": "when the topic was added", "generated": "now" } },
  "relations": {
    "cards": { "hasMany": "cards", "via": "topicId", "description": "the deck for this topic" } } }
```

```json
// database/cards.json — content + scheduling state in one row
{ "title": "Cards",
  "description": "One reviewable card: a prompt, an answer, and its scheduling state. Scheduling fields (ease, intervalDays, dueAt, reps, lapses) are mutated ONLY by the submitReview handler — never by agents or pages directly.",
  "columns": {
    "id":           { "type": "string",  "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "topicId":      { "type": "string",  "description": "the topic this card drills", "required": true,
                      "references": { "table": "topics", "column": "id", "onDelete": "cascade" } },
    "front":        { "type": "string",  "description": "the prompt, markdown — a question, cloze, or scenario", "required": true },
    "back":         { "type": "string",  "description": "the answer, markdown — short, atomic, with a one-line 'why' where it helps", "required": true },
    "kind":         { "type": "string",  "description": "'basic' | 'cloze' | 'application' — application cards pose a scenario, not a definition", "default": "basic" },
    "ease":         { "type": "number",  "description": "SM-2 ease factor; starts 2.5, floor 1.3; moved only by submitReview", "default": 2.5 },
    "intervalDays": { "type": "number",  "description": "current inter-review interval in days; 0 = learning (due same day)", "default": 0 },
    "dueAt":        { "type": "date",    "description": "when the card is next due; the queue is dueAt <= now", "required": true },
    "reps":         { "type": "number",  "description": "successful review count since last lapse", "default": 0 },
    "lapses":       { "type": "number",  "description": "times the card was failed after being learned — the weakness signal the curator drills", "default": 0 },
    "suspended":    { "type": "boolean", "description": "excluded from the queue when true (leeches, duplicates)", "default": false },
    "source":       { "type": "string",  "description": "'agent' | 'user' | 'redrill' — redrill = written by the curator against a weak spot", "default": "agent" },
    "createdAt":    { "type": "date",    "description": "when the card was created", "generated": "now" } },
  "relations": {
    "topic":   { "belongsTo": "topics",  "via": "topicId", "description": "the topic" },
    "history": { "hasMany":  "reviews",  "via": "cardId",  "description": "every graded review of this card" } } }
```

```json
// database/reviews.json — append-only grading history
{ "title": "Reviews",
  "description": "One graded review event. Append-only: written by submitReview alongside the card's scheduling update, so history and state can never drift.",
  "columns": {
    "id":            { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "cardId":        { "type": "string", "description": "the card graded", "required": true,
                       "references": { "table": "cards", "column": "id", "onDelete": "cascade" } },
    "grade":         { "type": "number", "description": "0 again · 1 hard · 2 good · 3 easy", "required": true },
    "gradedAt":      { "type": "date",   "description": "when the review happened", "generated": "now" },
    "elapsedDays":   { "type": "number", "description": "days since the previous review (0 for the first)", "required": true },
    "intervalAfter": { "type": "number", "description": "the interval submitReview assigned as a result — makes the algorithm replayable from history", "required": true },
    "mode":          { "type": "string", "description": "'review' (queue page) | 'quiz' (examiner drill via apiCall)", "default": "review" } },
  "relations": {
    "card": { "belongsTo": "cards", "via": "cardId", "description": "the card graded" } } }
```

```json
// database/digests.json
{ "title": "Digests",
  "description": "The curator's weekly write-up: what was reviewed, retention per topic, weak spots, and what it did about them (re-drill cards).",
  "columns": {
    "id":        { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "weekStart": { "type": "date",   "description": "Monday of the digested week; one digest per week", "required": true, "unique": true },
    "body":      { "type": "string", "description": "the digest, markdown — narrative over the deterministic stats", "required": true },
    "stats":     { "type": "json",   "description": "machine-readable week stats: { reviewed, correctRate, perTopic: [{topicId, retention}], redrillsAdded }", "required": true },
    "createdAt": { "type": "date",   "description": "when the curator wrote it", "generated": "now" } } }
```

```json
// database/settings.json — single row
{ "title": "Settings",
  "description": "Single-row app settings. Seeded on provisioning; edited via the stats page.",
  "columns": {
    "id":             { "type": "string", "description": "always 'settings'", "primaryKey": true },
    "dailyNewCards":  { "type": "number", "description": "max never-reviewed cards introduced into the queue per day", "default": 10 },
    "dailyReviewCap": { "type": "number", "description": "max total cards in a day's queue (protects against backlog avalanches after a break)", "default": 60 },
    "quizLength":     { "type": "number", "description": "cards per examiner drill session", "default": 8 },
    "deckSize":       { "type": "number", "description": "target card count the cardsmith drafts for a new topic", "default": 20 } } }
```

- **One writer for scheduling state** — `ease`/`intervalDays`/`dueAt`/`reps`/`lapses` change in
  `submitReview` and nowhere else. Agents create/edit card *faces* and `suspended`; the examiner
  grades **only** via `apiCall('submitReview')`. This is what keeps the review math trustworthy no
  matter who's driving.
- **`reviews.intervalAfter` makes the algorithm auditable** — replaying history through the SM-2
  step must reproduce every card's current state; the verification section tests exactly that.
- **`onDelete` is deliberate**: cards cascade with their topic, reviews cascade with their card —
  archiving is the non-destructive path (`topics.status:'archived'`, `cards.suspended`), deletion
  is the real thing.

## Pages (client React, file-based routing)

Data comes from the generated typed client `useApi(name, input)` — no pod-side loaders. Relation
fields arrive typed, so the deck table renders per-card history counts without a second fetch.

| File | Route | Reads / writes |
|---|---|---|
| `pages/index.tsx` | `/` | `dueCards`; `submitReview` per grade tap |
| `pages/topics/index.tsx` | `/topics` | `listTopics`; `addTopic` (title/goal/material box) |
| `pages/topics/[id].tsx` | `/topics/:id` | `getTopic` (include cards); `updateCard`, `regenerateCards` |
| `pages/quiz.tsx` | `/quiz` | `<Chat agent="tutor/examiner" />` (the drill) |
| `pages/stats.tsx` | `/stats` | `learnStats` + `listDigests`/`getDigest` |

A freshly added topic shows `status:'drafting'`; `/topics/:id` polls `getTopic` so cards appear
live as the cardsmith writes them (the "pages are a live read view" property). The Today page is a
keyboard-first flip-and-grade surface: space to flip, 1–4 to grade, each grade an immediate
`submitReview` (optimistic; the queue shrinks card by card).

```tsx
// pages/index.tsx → "/" — today's queue
import { useApi, useApiMutation } from '@app/runtime'
import { CardFace, GradeBar } from '../components'

export default function Today() {
  const { data, refetch } = useApi('dueCards', {})       // typed: { cards: DueCard[], newIntroduced, capped }
  const grade = useApiMutation('submitReview')
  const card = data?.cards[0]
  if (!card) return <AllDone streak={data?.streak} />
  return (
    <section>
      <CardFace front={card.front} back={card.back} />   {/* flip state local; tokens only */}
      <GradeBar onGrade={(g) => grade.mutate({ cardId: card.id, grade: g }, { onSuccess: refetch })} />
    </section>
  )
}
```

## API (named, typed, Node handlers)

Endpoint = dir, method = filename; each exports `name`/`description`/`Input`/`Output` + default
handler `(input, { db, delegate, apiCall })`. Dual-addressed (HTTP for the browser, `name` for
agents via `apiCall`).

| name | method + route | I/O sketch |
|---|---|---|
| `listTopics` | `GET api/topics` | `{}` → `(Topic & { dueCount, cardCount })[]` |
| `addTopic` | `POST api/topics` | `{ title, goal?, material? }` → `Topic` (status `drafting`) |
| `getTopic` | `GET api/topics/:id` | `{ id }` → `Topic & { cards: Card[] }` |
| `regenerateCards` | `POST api/topics/:id/cards` | `{ id, focus? }` → `{ status:'drafting' }` (fire-and-forget) |
| `dueCards` | `GET api/queue` | `{}` → `{ cards: DueCard[], newIntroduced, capped, streak }` |
| `submitReview` | `POST api/reviews` | `{ cardId, grade, mode? }` → `{ card: Card, intervalAfter }` |
| `addCard` | `POST api/cards` | `{ topicId, front, back, kind? }` → `Card` |
| `updateCard` | `PATCH api/cards/:id` | `{ id, front?, back?, suspended? }` → `Card` |
| `listDigests` | `GET api/digests` | `{}` → `Digest[]` (stats only, no body) |
| `getDigest` | `GET api/digests/:week` | `{ week }` → `Digest` |
| `learnStats` | `GET api/stats` | `{}` → `{ streak, dueToday, reviewedToday, retention7d, perTopic[] }` |

> **Row-type note (engine truth).** The generated row-interface names follow the engine's
> deterministic singularizer (`build/schema.ts`): `topics → Topic`, `cards → Card`,
> `reviews → Review`, `digests → Digest`, `settings → Setting`. Pages and handlers import these
> from `@app/types`.

```ts
// api/reviews/POST.ts → POST .../api/reviews ; name "submitReview"
/** Grade a card: the ONLY code path that mutates scheduling state. SM-2-lite, exact and replayable. */
export const name = 'submitReview'
export const description = 'Apply a grade (0 again · 1 hard · 2 good · 3 easy) to a card: update ease/interval/dueAt and append the review row.'

export interface Input  { cardId: string; /** 0|1|2|3 */ grade: number; /** 'review' | 'quiz' */ mode?: string }
export interface Output { card: Card; intervalAfter: number }

export default async function handler(input: Input, ctx: { db: AsyncDbApi }): Promise<Output> {
  const card = (await ctx.db.query('cards', { where: { id: input.cardId } }))[0]
  const last = (await ctx.db.query('reviews', { where: { cardId: card.id }, orderBy: 'gradedAt', limit: 1 }))[0]
  const elapsedDays = last ? Math.max(0, (Date.now() - Date.parse(last.gradedAt)) / 86400000) : 0

  let { ease, intervalDays, reps, lapses } = card
  if (input.grade === 0) {                          // again → lapse: relearn today, ease down
    lapses += 1; reps = 0; intervalDays = 0
    ease = Math.max(1.3, ease - 0.2)
  } else {
    reps += 1
    ease = Math.max(1.3, ease + [0, -0.15, 0, 0.15][input.grade])
    intervalDays = reps === 1 ? 1
      : reps === 2 ? 3
      : Math.round(intervalDays * ease * [0, 0.8, 1, 1.3][input.grade])
  }
  const dueAt = new Date(Date.now() + intervalDays * 86400000).toISOString()

  const updated = await ctx.db.update('cards', card.id, { ease, intervalDays, dueAt, reps, lapses })
  await ctx.db.insert('reviews', {
    cardId: card.id, grade: input.grade, elapsedDays,
    intervalAfter: intervalDays, mode: input.mode ?? 'review',
  })
  return { card: updated, intervalAfter: intervalDays }
}
```

- `submitReview` + `dueCards` are the doc's **deterministic centrepiece**: `dueCards` reads all
  unsuspended cards, filters `dueAt <= now` in JS (equality-only `where` — see Notes), orders
  lapsed-first-then-oldest-due, introduces at most `dailyNewCards` never-reviewed cards, and caps
  the queue at `dailyReviewCap` (reporting `capped: true` so the UI can say "60 of 214 — backlog
  mode"). The Today page, the examiner's drill, and the curator's stats all consume these two —
  nobody reimplements the math.
- `regenerateCards` is **fire-and-forget** (parent-plan `generatePlan` pattern): it delegates
  `tutor/cardsmith#draft` with an optional focus ("harder", "more application questions") and
  returns; the deck page polls new cards in.

## Hooks

```ts
// hooks/draft-cards.ts — write the deck when a topic is added
export default {
  type: 'database',
  on: { table: 'topics', event: 'insert' },
  budget: { maxEpisodes: 12, maxWallClockMs: 600000 },
  handler: async ({ row, delegate }) => {
    await delegate('tutor/cardsmith', 'draft', { input: { topicId: row.id } })
  },
}
```

```ts
// hooks/weekly-digest.ts — Sunday retrospective + targeted re-drills
export default {
  type: 'cron',
  daily: '07:00',                                   // fires daily; the curator no-ops unless it's Sunday
  trigger: 'tutor/curator#digest',
  budget: { maxEpisodes: 12, maxWallClockMs: 600000 },
}
```

- **The loop is bounded**: the cardsmith writes `cards` and flips its topic to `ready` — the hook
  watches `topics:insert` only, so its own `topics` *update* doesn't re-fire, and no hook watches
  `cards` or `reviews` at all (grading is a pure handler path — an agent hook per review would be
  both wasteful and wrong). The curator writes `digests` (unwatched) and re-drill `cards`
  (unwatched). **Self-write exclusion** backstops all of it; **per-hook coalesce** collapses a
  paste-five-topics burst into sequential drafts without duplication.
- Cron timing is the parent plan's **crond → hook-run endpoint** mechanism
  (`POST /api/projects/learn/hooks/weekly-digest/run`); a Sunday missed while the pod was down runs
  once via boot catch-up (unique `weekStart` makes a double-fire a no-op); local dev uses the
  in-process fallback tick.

## Chat (the examiner's drill)

One drop-in `<Chat agent="tutor/examiner" />` widget IS the `/quiz` page, reusing the
always-available multisession WS endpoint (parent plan §Chat) — the binding is a runtime prop, no
`chats/` dir:

- "Quiz me" → the examiner pulls `quizLength` cards from `dueCards` (weak/lapsed first), asks the
  prompts conversationally, and accepts free-text answers — you answer in your own words, not by
  self-grading a flip.
- After each answer it judges the grade, **submits it via `apiCall('submitReview', { mode:'quiz' })`**,
  tells you the grade it gave and why, and — on a miss — explains the actual answer and where your
  answer diverged. The explanation is the thing flashcards can't do.
- "Why do I keep missing this one?" → it reads the card's `history` and answers from the pattern
  (e.g. "you always swap the two directions — here's a mnemonic").
- History persists at `learn/spaces/tutor/sessions/<id>` (project-session snapshot form,
  resumable). This is the one place the catalog descriptor renderer re-enters the app — pages stay
  real React.

## The `tutor` space (agents + capabilities)

Project-scoped at `learn/spaces/tutor/`. Capabilities are least-privilege per agent — one
config-bearing `capabilities:` frontmatter key, table scope **per verb** (parent plan §"Capability
globals"):

| Agent | `db:read` tables | `db:write` tables | `api:call` allow | `functions` | Role |
|---|---|---|---|---|---|
| **cardsmith** | `topics, cards, settings` | `cards, topics` | — | `webSearch, webFetch` | draft `deckSize` atomic cards from material (or research the topic); flip topic to `ready`; never touch scheduling fields |
| **examiner** | `topics, cards, reviews, settings` | — (none) | `dueCards, submitReview` | `[]` (none) | the conversational drill: ask, judge free-text answers, grade via the API, explain misses |
| **curator** | `topics, cards, reviews, digests, settings` | `digests, cards` | `learnStats` | `[]` (none) | Sunday digest: narrative over the stats; write `redrill` cards for high-lapse spots; suspend leeches |

```yaml
# learn/spaces/tutor/agents/examiner/instruct.md frontmatter — acts ONLY through the app's API
capabilities:
  - db:read:  { tables: [topics, cards, reviews, settings] }
  # no db:write at all — grading goes through submitReview so the scheduler stays the single writer
  - api:call: { names: [dueCards, submitReview] }
functions: []
```

```yaml
# learn/spaces/tutor/agents/cardsmith/instruct.md frontmatter
capabilities:
  - db:read:  { tables: [topics, cards, settings] }
  - db:write: { tables: [cards, topics] }   # card faces + topic status; scheduling fields belong to submitReview
functions: [webSearch, webFetch]            # research the topic when no material was pasted
```

- **The examiner is the catalog's purest `api:call` showcase** — an agent with **zero** `db:write`
  whose every state change flows through the app's own typed endpoints. `apiCall('submitReview',
  { cardId, grade: '2' })` with a string grade fails the DTS overload at typecheck; the scheduler's
  invariants hold no matter what the drill conversation does.
- **The cardsmith's `draft` tasklist uses a `forEach` over material sections** — a first task
  splits `material` (or its researched outline) into sections; the host fans out one drafting fork
  per section (parallel, within the fork cap) and collects the cards; the model never writes the
  loop. Its charter encodes card craft: atomic (one fact per card), prompts that force retrieval
  (no yes/no), application cards that pose scenarios, and *no duplicates* against the existing deck
  (it reads `cards` first).
- **The curator turns weakness into work** — high-`lapses` cards get a fresh `redrill` card
  attacking the same concept from a different angle (`source:'redrill'`), and true leeches
  (lapses ≥ 8) get `suspended: true` with a digest mention, mirroring Anki's leech handling but
  with an explanation attached.
- **No `db:schema`/`pages:write`/`api:write` here** — the tutor *operates* the app. "Add exam
  countdowns" or "share a deck with my study group" is an authoring request → THING →
  `system-appbuilder`.

## Serving & domains

- **Local CLI**: `localhost:8080/app/learn/…` (pages) and `localhost:8080/app/learn/api/<name>` —
  the parent plan's mount, `<project>` = `learn`.
- **Prod**: served under the **generic authenticated `lmthing.app` domain** at `lmthing.app/learn/*`
  → the authenticated user's pod `/app/learn/*` (Envoy JWT + per-user routing). No pre-existing
  static SPA to replace; a `lmthing.learn` alias is an optional later edge-alias.
- **Admin/dev**: `lmthing.studio` manages it via `/api/projects/learn/app` (manifest, data browser,
  manual hook run, build status, live preview iframe of `…/app/learn/`).

**No public/shared surface** — every route and endpoint is an authenticated, per-user pod
read/write. (Deck *sharing* is a real future want — it belongs to the lmthing.store distribution
phase, not a v1 authz exception.)

## Additional features (more user value)

The core loop earns its place when the queue is honest and the cards are good; these raise the
ceiling. Each is **additive** on the same engine.

### Exam mode — a deadline changes the math
- **Data**: add `examAt` (nullable date) to `topics`.
- **Handler**: `dueCards` pulls a topic's cards forward when `examAt` is near (compress intervals
  so everything gets ≥2 more reps before the date) — still fully deterministic.
- **Agent**: the curator's digest counts down and calls out what won't be ready in time.

### Ingest a document or URL — decks from real sources
- **API**: `importMaterial` `POST api/topics/import` `{ url? , text? }` → creates the topic with
  `material` filled (the cardsmith `webFetch`es a URL first when given one). Kills the
  copy-paste-formatting chore; the existing draft hook does the rest.

### Explain-this button — the tutor inside the review
- **Flow**: a "explain" affordance on the Today page opens the examiner chat pre-seeded with the
  current card ("I don't get why this is the answer") — pure chat wiring, no new capability.

### Retention forecast — see the payoff
- **Handler**: `learnStats` gains a `forecast` — cards due per day for the next 14 days computed
  from current intervals (pure math). The stats page charts it (design-token chart colors), which
  is also the honest "how big is tomorrow's session" answer.

## Phases & order

Assumes the parent plan's engine (db + capability globals, api runtime, typed-contract build, pages
build, hooks runtime, chat) exists. Learn-specific work on top:

1. **Schemas** — the five `database/*.json`; verify FKs (`cards` → topics, `reviews` → cards),
   unique `topics.title`/`digests.weekStart`, required descriptions pass the fail-loud loader; row
   + relation types generate (`Card & { history: Review[] }`).
2. **Scheduler** — `submitReview` (the SM-2 step, exactly as specced) + `dueCards`
   (filter/order/new-cap/day-cap) with unit tests replaying grade sequences to known
   ease/interval outcomes — the algorithm is table-driven-testable before any agent exists.
3. **`tutor` space** — the three agents' `instruct.md` (config-bearing `capabilities:` — the
   examiner's zero-write/api-only shape, the cardsmith's craft charter + section-`forEach` draft
   tasklist, the curator's redrill/leech contract).
4. **API** — the remaining endpoints; `regenerateCards` fire-and-forget; `learnStats` retention
   math from `reviews`.
5. **Hooks** — `draft-cards` (database:insert on topics) + `weekly-digest` (cron daily,
   Sunday-gated); confirm boundedness (no hook on `cards`/`reviews`; topic update ≠ insert).
6. **Pages** — Today (keyboard flip/grade), topics + deck table (drafting poll), quiz (=examiner
   chat), stats (retention + digests); design-system token gate (no raw colors — grade buttons use
   semantic tokens, not literal green/red).
7. **Serving** — seed each pod's `learn` project from the checked-in template (with the
   self-describing demo deck); serve under generic `lmthing.app/learn/*`; Studio manages it under
   `/api/projects/learn/app`.
8. **Additional features** — exam mode, material import, explain-this, forecast (§above); each
   additive, shippable after the core loop.
9. **Docs** — fold into `SPACE_DEVELOPMENT.md` "Project apps" as the deterministic-algorithm +
   api-only-agent example.

## Verification (end-to-end, local)

1. Load the `learn` project → schemas validate (descriptions/FK/relations), `types/generated.d.ts`
   has `Topic`/`Card`/`Review`/`Digest` with relation fields (`Card.history?: Review[]`).
2. **Scheduler unit truth** (no agents): a fresh card graded `2,2,2` lands on intervals `1,3,~8`
   (2.5 ease); grading `0` sets `intervalDays:0`, bumps `lapses`, floors ease at ≥1.3 after
   repeats; replaying any card's `reviews` history through the SM-2 step reproduces its current
   `ease/intervalDays` exactly (`intervalAfter` chain).
3. `lmthing serve`; `addTopic` with pasted material (mock streamFn) → the draft hook fires **once**;
   the cardsmith's section-`forEach` writes ~`deckSize` cards; topic flips `ready`; the deck page
   showed cards appearing live. Adding 3 topics in a burst → 3 drafts, no duplicates, no re-fire
   from the cardsmith's own topic update.
4. `dueCards` honors the caps: with 200 due, returns `dailyReviewCap` and `capped:true`; with 30
   fresh cards, introduces only `dailyNewCards` of them; lapsed cards sort first.
5. Grade through the Today page → each tap = one `submitReview`, queue shrinks, `learnStats.streak`
   increments at the day boundary.
6. Quiz: the examiner (live model) drills `quizLength` cards; every grade it issues arrives as a
   `reviews` row with `mode:'quiz'`; the card states move **identically** to page-graded cards.
   `apiCall('submitReview', { cardId, grade: 'good' })` fails the agent typecheck (DTS overload);
   the examiner attempting `db.update('cards', …)` → host error (no `db:write` at all).
7. Sunday `weekly-digest` → one `digests` row whose `stats` match `learnStats` for the week;
   high-lapse cards gained `redrill` siblings (`source:'redrill'`); a leech got `suspended:true`
   and a digest mention; restart that day → boot catch-up doesn't duplicate (unique `weekStart`).
8. Chat continuity: "why do I keep missing the borrow-checker card?" → the examiner cites that
   card's actual `history`; session persists under `learn/spaces/tutor/sessions/`.
9. Backup: `app.sql` + schemas + pages + api + hooks + tutor space committed; `**/sessions/` not;
   restore rebuilds `app.db` from `app.sql` (review history intact → stats/replay still exact).

## Notes

- **Reuses the parent engine wholesale** — no learn-specific runtime; data + agents + pages + hooks
  on the shared layer. If a mechanism is missing here, it belongs in
  [project-as-application.md](./project-as-application.md), not a learn fork.
- **Why it's a good AI-assisted app** — spaced repetition's two failure modes are exactly the
  engine's two halves: card authoring is fuzzy generative work (agent), scheduling is exact math
  that must never be vibes (handler). The examiner adds the piece no flashcard app has — judging
  free-text answers and *explaining* misses — while the api-only capability shape guarantees the
  drill can't corrupt the schedule.
- **The scheduler is deliberately SM-2-lite, not FSRS** — four grades, transparent constants, fully
  replayable from `reviews`. A smarter scheduler is a drop-in handler change later (the `reviews`
  log is scheduler-agnostic evidence); shipping v1 with auditable math beats shipping a black box.
- **`db.query` `where` is equality-only** in the shipped engine — `dueAt <= now`, week windows,
  lapse thresholds, and per-topic retention are all query-wide-then-filter-in-JS in handlers/agent
  prompts, not SQL predicates. A personal deck (thousands of cards) stays trivially in-memory.
- **No external-binding registry exists in v1** — `webSearch`/`webFetch` are universal globals
  gated per-agent via `functions:` (cardsmith yes; examiner/curator no — the drill and the digest
  work only from what's in the db); `api:call` is reserved for the app's own typed endpoints, and
  the examiner is the proof of how far that alone can carry an agent.
- **Grades are the app's only self-report** — the examiner *judges* free-text answers, which is a
  model call with model fallibility; its charter requires it to state the grade it gave and why, so
  a user can immediately contest ("that was right, actually" → it re-grades via the same API). The
  audit trail (`mode:'quiz'` rows) keeps examiner grading measurable against page grading.
