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

## Round 2 — From decks to a study program: sources, plans & open-ended practice (feature expansion)

Round 1 shipped the retention engine — decks, the deterministic scheduler, the drill — and one
`tutor` space. Round 2 turns `learn` from a card app into a **study program**: drop in **sources**
(URLs, pasted documents) and a `librarian` distills them into topics that flow straight into the
round-1 card pipeline; a `syllabist` builds and weekly-adjusts a **multi-week study plan** with
milestones against a real exam date; and a `grader` closes the gap flashcards can't cover —
**open-ended practice**: rubric-scored free-writing prompts with real feedback. A second
specialist team (**`academy`** — librarian · syllabist · grader) does this work; `tutor` keeps
owning cards and the drill. The round-1 "Additional features" **exam mode** and **material
import** are promoted to fully-specced work here. Everything below is strictly additive to the
round-1 shape — same project-rooted db, same serving, same capability model — and stays inside the
parent plan (data/agents/pages/api/hooks only).

### New database tables (round 2 — 5, bringing the app to 10)

Prose-schema form (descriptions mandatory on table/column/relation, FKs resolve, exactly-one PK):

- **`sources.json`** — an ingested study source. `id` (pk uuid) · `kind` (string, required —
  `'url'`|`'text'`) · `url` (string — unique when present; re-adding a URL is a handler no-op) ·
  `title` (string, def `'pending'` — the librarian fills it) · `content` (string — pasted text, or
  the librarian's cleaned extraction) · `status` (string, def `'pending'` —
  `'pending'`|`'ingested'`|`'fetch-failed'`) · `topicIds` (json, def `[]` — the topics distilled
  from it, the provenance of where a deck came from) · `createdAt` (date, now).
- **`study_plans.json`** — one active program. `id` (pk) · `title` (string, required) · `goal`
  (string, required — e.g. `'pass the CKA on March 14'`) · `examAt` (date — drives round-1 exam
  mode: `dueCards` compresses intervals for this plan's topics as it nears) · `topicIds` (json,
  required — the topics in scope) · `status` (string, def `'active'` —
  `'active'`|`'completed'`|`'abandoned'`) · `rationale` (string, required — the syllabist's
  ordering logic, markdown) · `createdAt` (date, now). Relation `milestones` hasMany `milestones`
  via `planId`.
- **`milestones.json`** — one week of the program. `id` (pk) · `planId` (references `study_plans`
  onDelete cascade, required) · `weekStart` (date, required) · `focusTopicIds` (json, required) ·
  `targets` (json, required — `{ newCards, reviews, attempts, minRetention }`) · `actuals` (json,
  def `{}` — the syllabist's weekly check-in fills from `learnStats`) · `status` (string, def
  `'planned'` — `'planned'`|`'on-track'`|`'behind'`|`'done'`) · `note` (string — the check-in's
  one-line read) · `createdAt` (date, now). Relation `plan` belongsTo `study_plans` via `planId`.
- **`prompts.json`** — an open-ended practice prompt. `id` (pk) · `topicId` (references `topics`
  onDelete cascade, required) · `prompt` (string, required — explain/derive/apply, never
  yes-or-no) · `rubric` (json, required — 3–5 named criteria with what "good" looks like, written
  when the prompt is authored so grading is anchored *before* any answer exists) · `difficulty`
  (string, def `'core'` — `'core'`|`'stretch'`) · `source` (string, def `'agent'`) · `createdAt`
  (date, now). Relations: `topic` belongsTo `topics` via `topicId`; `attempts` hasMany `attempts`
  via `promptId`.
- **`attempts.json`** — one graded free-writing attempt. `id` (pk) · `promptId` (references
  `prompts` onDelete cascade, required) · `answer` (string, required — the user's writing,
  verbatim, never edited) · `scores` (json — per-criterion `{ score: 1–5, evidence }` where
  `evidence` **quotes the answer**; null until graded) · `feedback` (string — what was right, what
  was missing, the one thing to redo; null until graded) · `status` (string, def `'submitted'` —
  `'submitted'`|`'graded'`) · `gradedAt` (date) · `createdAt` (date, now). Relation `prompt`
  belongsTo `prompts` via `promptId`.

New columns on round-1 tables (additive `addColumn`): `topics.sourceId` (string — the source a
topic was distilled from, null for hand-added); `cards.planWeight` (number, def 1 — the
exam-mode compression factor `dueCards` applies; set only by the deterministic handler path).

### New API endpoints (round 2 — 10, bringing the app to 21)

| name | method + route | I/O sketch |
|---|---|---|
| `addSource` | `POST api/sources` | `{ url? , text?, title? }` → `Source` (stub; ingest hook fills it) |
| `listSources` | `GET api/sources` | `{}` → `Source[]` |
| `createPlan` | `POST api/plans` | `{ title, goal, examAt?, topicIds? }` → `{ planId, status:'planning' }` — `spawn`s `academy/syllabist#plan` |
| `getPlan` | `GET api/plans/:id` | `{ id }` → `StudyPlan & { milestones: Milestone[] }` |
| `planProgress` | `GET api/plans/:id/progress` | `{ id }` → `{ perMilestone: [{ milestoneId, targets, actuals, delta }] }` — deterministic, from `reviews`/`attempts` |
| `updateMilestone` | `PATCH api/milestones/:id` | `{ id, targets?, status? }` → `Milestone` |
| `listPrompts` | `GET api/prompts` | `{ topicId?, difficulty? }` → `Prompt[]` |
| `generatePrompts` | `POST api/topics/:id/prompts` | `{ id, difficulty? }` → `{ status:'drafting' }` — `spawn`s `academy/grader#author` |
| `submitAttempt` | `POST api/attempts` | `{ promptId, answer }` → `Attempt` (status `submitted`; grade hook fires) |
| `getAttempt` | `GET api/attempts/:id` | `{ id }` → `Attempt & { prompt }` (plus `listAttempts` `GET api/attempts` → headers) |

All follow the round-1 rules — equality-only `where`, typed `HttpError` failures, **`spawn` (never
`delegate`) from handlers**. `planProgress` is round 2's deterministic centrepiece: actuals are
counted from `reviews`/`attempts` rows in the milestone's week window — the same numbers the
syllabist's check-in writes into `actuals`, so the page and the agent can never disagree.
Round-1 `dueCards` gains the promoted **exam mode**: when an active plan's `examAt` is within
`2 × intervalDays` for a scoped card, the handler compresses that card's effective due date via
`planWeight` — pure handler math, agents never touch scheduling (the round-1 invariant holds).

### New hooks (round 2 — 3, bringing the app to 5)

- **`ingest-source.ts`** — `database` `sources:insert`, imperative handler:
  `delegate('academy/librarian','ingest', { input: { sourceId: row.id } })` — fetch/clean the
  source, distill it into 1–4 `topics` (with `material` filled and `sourceId` back-refs), mark the
  source `ingested` (or `fetch-failed` with the reason).
- **`weekly-plan-checkin.ts`** — `cron`, `daily: '07:15'`, Monday-gated in the agent →
  `academy/syllabist#adjust` — fill last week's `actuals` from `learnStats`, set
  `on-track`/`behind`, rebalance the coming weeks' `targets` (never past ones), write the
  one-line `note`.
- **`grade-attempt.ts`** — `database` `attempts:insert`, imperative handler:
  `delegate('academy/grader','grade', { input: { attemptId: row.id } })` — score against the
  prompt's pre-authored rubric, quote evidence, write feedback, flip `graded`.

**Loop-guard sanity.** `sources:insert` → librarian writes `topics` → the round-1 `draft-cards`
hook fires → cardsmith writes `cards` (no hook) ⇒ an **intentional cross-space depth-2 cascade**
that stops (cap 3): *drop a URL, get a deck* with zero new wiring. `attempts:insert` → grader
*updates* the attempt (no hook on update) ⇒ stops. The syllabist writes
`study_plans`/`milestones` (unwatched) ⇒ stops. Per-hook coalesce collapses a paste-several-
sources burst; **self-write exclusion** keeps the librarian's own source-status updates and the
grader's attempt updates from re-firing anything.

### New pages (round 2 — 5, bringing the app to 10) + components

| File | Route | Reads / writes |
|---|---|---|
| `pages/plan.tsx` | `/plan` | `getPlan` + `planProgress` (milestone track, targets vs actuals); `createPlan`, `updateMilestone` |
| `pages/sources.tsx` | `/sources` | `listSources`; `addSource` (URL box + paste zone); status fills in live |
| `pages/write.tsx` | `/write` | `listPrompts` (pick one) → attempt editor → `submitAttempt`; grading status polls in |
| `pages/attempts/[id].tsx` | `/attempts/:id` | `getAttempt` — the answer side-by-side with per-criterion scores, quoted evidence, feedback |
| `pages/prompts.tsx` | `/prompts` | `listPrompts` by topic/difficulty; `generatePrompts` |

New shared components (design tokens only): `MilestoneTrack` (week rail with on-track/behind
states as semantic tokens), `SourceRow` (status + distilled-topics chips), `PromptCard`,
`RubricScores` (per-criterion bars with evidence popovers), `AttemptEditor`. `_layout.tsx` nav
gains **Plan · Write · Sources** alongside Today · Topics · Quiz · Stats; the Today page shows the
current milestone's delta strip (from `planProgress`) so the daily queue carries its "why".

### The `academy` space (second project-scoped space, full format)

`learn/spaces/academy/` — the program-level team, sharing the same project-rooted db as `tutor`
(parent plan's multi-space shape). Least-privilege per verb:

| Agent | `db:read` tables | `db:write` tables | `api:call` allow | `functions` | Role |
|---|---|---|---|---|---|
| **librarian** | `sources, topics, settings` | `sources, topics` | — | `webFetch` | fetch/clean a source, distill topics with `material`, honest `fetch-failed` |
| **syllabist** | `topics, cards, reviews, study_plans, milestones, digests, settings` | `study_plans, milestones` | `learnStats, dueCards` | `[]` (none) | build the program; weekly check-in: actuals, status, rebalance forward weeks |
| **grader** | `prompts, attempts, topics, cards, settings` | `prompts, attempts` | — | `[]` (none) | author prompts *with rubrics up front*; grade attempts against them with quoted evidence |

- **Agent-frontmatter features exercised**: the syllabist declares
  `canDelegateTo: [tutor/cardsmith#draft]` — a **cross-space** hard allowlist: when plan-building
  finds a scoped topic with a thin deck (< `deckSize/2` cards), it commissions more cards from the
  round-1 cardsmith rather than writing any itself (any other delegation throws, naming the
  allowed target). The grader declares `defaultAction: grade` and `actions:` for `author`
  (tasklist `author-prompts`) and `grade`; the librarian declares `defaultAction: ingest`.
- **Tasklists**: `build-plan/` — `01-audit.md` (`role: explore`, read-only: scoped topics, deck
  depth, current retention via `apiCall('learnStats')`), `02-sequence.md` (order topics
  prerequisite-first; write `study_plans` with `rationale`), `03-milestones.md`
  (**`forEach: "sequence.weeks"`** — one fork per program week writes that week's `milestones`
  row; the model never writes the loop). `author-prompts/` — `01-survey.md` (`role: explore`:
  the topic's cards + existing prompts, to avoid duplication), `02-author.md` (write prompts
  **with rubrics**; `functions: []`). `grade/` — `01-read.md` (`role: explore`: attempt + prompt
  + rubric only — deliberately *not* other students' answers; there are none, but the discipline
  is the point), `02-score.md` (per-criterion scores with quoted evidence), `03-feedback.md`
  (write the feedback; update the attempt).
- **Functions** (`functions/*.ts`, deterministic): `chunkMaterial` (split a cleaned source into
  candidate topic sections), `weekWindows` (examAt + start → the week list `03-milestones` fans
  over), `progressDelta` (targets vs actuals — the same math `planProgress` uses),
  `rubricComplete` (a prompt's rubric → the criteria lacking a "what good looks like"; the grader
  runs it before filing).
- **Components**: view `MilestonePreview` (chat-rendered week card), view `RubricPreview`; form
  `PlanIntake` — an `ask()` sheet the syllabist renders when `createPlan` arrives underspecified
  (exam date? hours/week? which topics in scope?). Design-token-gated.
- **Knowledge** (`knowledge/learning-science/`, each field `index.md` + ≥2 aspects):
  `program-design/` (`sequencing-prerequisites.md`, `load-balancing.md`,
  `behind-is-information.md` — a behind milestone rebalances forward, it never guilt-trips),
  `assessment/` (`rubric-design.md`, `evidence-quoting.md`, `feedback-that-teaches.md`),
  `source-distillation/` (`what-makes-a-topic.md`, `extraction-fidelity.md` — distill what the
  source says, never what the model knows about the subject).

### `tutor` space-format remediation (round 2)

Round 1 left `tutor` as `agents/`-only. Round 2 brings it to the **full space format**:
`charter.md` alongside every `instruct.md` (the cardsmith's fork-safe atomicity/no-duplicates
rule; the examiner's grade-via-API-only + state-the-grade rule; the curator's
redrill-not-guilt rule); tasklists — `draft/` formalized for the cardsmith (`01-split.md`
`role: explore` → `02-write.md` **`forEach: "split.sections"`** → `03-file.md` dedupe + write +
flip topic `ready`) and `digest/` for the curator (stats → weak-spots → redrills → write);
`functions/` (`computeRetention` — the same math `learnStats` uses, `pickWeakCards`,
`formatCloze`, `dedupeCardFronts`); catalog `components/` (`CardPreview`, `QuizScore` for chat);
and **extensive `knowledge/card-craft/`** — `atomicity/` (`one-fact-per-card.md`,
`prompt-forces-retrieval.md`), `cloze-design/` (`what-to-blank.md`, `context-sufficiency.md`),
`drill-method/` (`socratic-follow-ups.md`, `explaining-misses.md`).

### Phases & verification additions (round 2)

Ordered on top of the round-1 phases: **(R2-1)** new schemas + columns; **(R2-2)** the `academy`
space full-format + `tutor` remediation; **(R2-3)** the 10 endpoints (+ exam-mode math in
`dueCards`, `planProgress`/`progressDelta` single definition); **(R2-4)** the 3 hooks +
loop-guard checks; **(R2-5)** the 5 pages + components; **(R2-6)** tests.

Verification additions: **(a)** `addSource` with a URL → librarian ingests, 1–4 topics land with
`sourceId` + `material`, then the round-1 hook drafts their decks (the cross-space cascade
observed end-to-end: *URL in, cards out*), and a bad URL lands `fetch-failed` with a reason, no
retry loop; **(b)** `createPlan` with a thin-deck topic → the syllabist delegates
`tutor/cardsmith#draft` (cross-space allowlist observed; anything else throws) and writes one
milestone row per week via the `forEach`; **(c)** Monday `weekly-plan-checkin` → last week's
`actuals` equal `planProgress` exactly (single-definition check), forward weeks rebalance, past
weeks never change; **(d)** `submitAttempt` → grader fires once; every criterion score carries
`evidence` that is a verbatim substring of the answer (checked mechanically); the attempt's
`answer` is byte-identical after grading; **(e)** with `examAt` near, `dueCards` pulls scoped
cards forward via `planWeight` — replaying `reviews` history still reproduces card state (the
round-1 invariant survives exam mode); **(f)** the grader attempting `db.update('cards', …)` →
host error (not in its tables); the librarian calling `webSearch` → typecheck failure (only
`webFetch` granted); **(g)** `pnpm lint:tokens` green across the 5 new pages.

## Round 3 — The arena: mock exams, teach-back & the knowledge map (feature expansion)

Round 1 built retention (`tutor`); round 2 built the program around it (`academy`). Round 3
builds the **proving ground**: timed, mixed-topic **mock exams** assembled and graded by a
`proctor` (essay sections graded by the round-2 grader — reuse, not reinvention), **teach-back**
sessions where you explain a topic in your own words and a `listener` probes Feynman-style until
the gaps show, and a **concept map** a `cartographer` maintains across everything you're learning
— surfacing orphan concepts and weak islands the flat deck view can't see. A third specialist
team (**`arena`** — proctor · listener · cartographer) does this work. Everything below is
strictly additive to the round-1/2 shape — same project-rooted db, same serving, same capability
model — and stays inside the parent plan (data/agents/pages/api/hooks only).

### New database tables (round 3 — 5, bringing the app to 15)

- **`exams.json`** — a mock exam definition. `id` (pk uuid) · `title` (string, required) ·
  `planId` (references `study_plans` onDelete setNull — scoped to a program when present) ·
  `topicIds` (json, required) · `blueprint` (json, required — the section plan: `{ kind:
  'recall'|'application'|'essay', count, minutes }[]`, assembled by the proctor from cards +
  prompts) · `questionRefs` (json, required — `{ section, sourceType:'card'|'prompt', sourceId }[]`
  — every exam question traces to an existing card or prompt; the proctor authors nothing new) ·
  `totalMinutes` (number, required) · `createdAt` (date, now). Relation `sittings` hasMany
  `exam_sittings` via `examId`.
- **`exam_sittings.json`** — one timed run. `id` (pk) · `examId` (references `exams` onDelete
  cascade, required) · `startedAt` (date, required) · `deadlineAt` (date, required — startedAt +
  totalMinutes; the page enforces it, the grader trusts only `submittedAt`) · `submittedAt`
  (date) · `answers` (json, def `{}` — per-questionRef user answers, saved as they type) ·
  `status` (string, def `'in-progress'` — `'in-progress'`|`'submitted'`|`'graded'`|`'abandoned'`)
  · `sectionScores` (json — per-section `{ correct, total, notes }`; essay sections carry the
  grader's rubric verdicts) · `analysis` (string — the proctor's read: readiness, weakest
  section, what to drill before the real thing) · `createdAt` (date, now). Relation `exam`
  belongsTo `exams` via `examId`.
- **`teachbacks.json`** — one Feynman session's distillate. `id` (pk) · `topicId` (references
  `topics` onDelete cascade, required) · `transcriptSummary` (string, required — what you said,
  compressed honestly, not improved) · `gaps` (json, required — `{ concept, whatWasMissing,
  severity: 'shaky'|'missing'|'wrong' }[]`) · `strengths` (json, def `[]` — what you explained
  well; the listener's charter requires naming at least one when true) · `redrillTopicFocus`
  (string — the focus string handed to the cardsmith for gap cards) · `createdAt` (date, now).
  Relation `topic` belongsTo `topics` via `topicId`.
- **`concepts.json`** — a node in the knowledge map. `id` (pk) · `name` (string, required,
  unique) · `topicIds` (json, required — the topics this concept appears in; cross-topic concepts
  are the map's whole point) · `cardIds` (json, def `[]` — the cards drilling it) · `retention`
  (number, def 0 — the cluster's 30-day retention, from the deterministic `conceptRetention`
  math) · `status` (string, def `'healthy'` — `'healthy'`|`'weak'`|`'orphan'` — orphan = no cards
  drill it) · `createdAt` (date, now).
- **`concept_links.json`** — a directed edge. `id` (pk) · `fromConceptId` (references `concepts`
  onDelete cascade, required) · `toConceptId` (references `concepts` onDelete cascade, required)
  · `kind` (string, required — `'prerequisite'`|`'contrast'`|`'applies-to'`) · `rationale`
  (string, required — one line, e.g. "borrowing presupposes ownership") · `createdAt` (date,
  now). Relations: `from` belongsTo `concepts` via `fromConceptId`; `to` belongsTo `concepts` via
  `toConceptId`.

New columns on earlier tables (additive `addColumn`): `topics.lastTeachbackAt` (date — the
listener stamps it; the syllabist's check-in treats a scoped topic with high retention but no
teach-back as "fluent-looking, unproven"); `study_plans.readiness` (number, def 0 — the latest
sitting's blended score for this plan's exam, set by the proctor's grading pass).

### New API endpoints (round 3 — 11, bringing the app to 32)

| name | method + route | I/O sketch |
|---|---|---|
| `createExam` | `POST api/exams` | `{ title, topicIds, planId?, minutes? }` → `{ examId, status:'assembling' }` — `spawn`s `arena/proctor#assemble` |
| `getExam` / `listExams` | `GET api/exams/:id` / `GET api/exams` | definition + past sittings headers |
| `startSitting` | `POST api/exams/:id/sit` | `{ id }` → `ExamSitting` (stamps `startedAt`/`deadlineAt`; refuses if one is `in-progress`) |
| `saveAnswers` | `PATCH api/sittings/:id/answers` | `{ id, answers }` → `{ ok }` (refused after `deadlineAt` — typed `HttpError`) |
| `submitSitting` | `PATCH api/sittings/:id` | `{ id }` → `ExamSitting` (status `submitted`; grade hook fires) |
| `getSitting` / `listSittings` | `GET api/sittings/:id` / `GET api/sittings` | scores + analysis once graded |
| `conceptMap` | `GET api/map` | `{}` → `{ nodes: Concept[], links: (ConceptLink & { from, to })[] }` |
| `weakIslands` | `GET api/map/weak` | `{}` → `{ clusters: [{ conceptIds, avgRetention, cardCount }] }` — deterministic graph-cluster math over `conceptRetention` |
| `teachbackHistory` | `GET api/teachbacks` | `{ topicId? }` → `Teachback[]` (plus `getTeachback` `GET api/teachbacks/:id`) |

All follow the established rules — equality-only `where`, typed `HttpError`, **`spawn` from
handlers**. Round-1 invariants hold under exam pressure: exam grading writes
`sectionScores`/`analysis` — it **never** touches card scheduling (an exam is a measurement, not
a review; cards only move through `submitReview`). `weakIslands`/`conceptRetention` are round 3's
deterministic centrepieces — the cartographer narrates them, the map page renders them, one
definition.

### New hooks (round 3 — 3, bringing the app to 8)

- **`grade-sitting.ts`** — `database` **`exam_sittings:update`** (the app's first update-event
  hook), imperative handler: skip unless the update set `status:'submitted'`, else
  `delegate('arena/proctor','grade', { input: { sittingId: row.id } })` — recall/application
  sections are checked against card backs / prompt rubrics; essay sections are **delegated per
  section to the round-2 grader** (see the tasklist's task-level `canDelegateTo`); the proctor
  blends section scores, writes `analysis`, sets `study_plans.readiness`, flips `graded`.
- **`redrill-teachback.ts`** — `database` `teachbacks:insert`, imperative handler: skip when
  `row.gaps` is empty, else `delegate('tutor/cardsmith','draft', { input: { topicId: row.topicId,
  focus: row.redrillTopicFocus } })` — a hook-driven **cross-space** delegation (no
  `canDelegateTo` needed at the hook layer — hooks are host code): gaps become cards by tomorrow.
- **`refresh-map.ts`** — `cron`, `daily: '07:45'`, Saturday-gated in the agent →
  `arena/cartographer#map` — re-derive concepts from topics/cards (new cards join their concepts;
  `conceptRetention` recomputed), reconcile links, set `weak`/`orphan` statuses, and file one
  digest-style note into the week's curator digest input (the curator's Sunday run reads the
  fresh map instead of rediscovering weakness from scratch).

**Loop-guard sanity.** `exam_sittings:update(submitted)` → proctor updates the sitting to
`graded` — the same-table re-entry is gated (`submitted` only) and **self-write excluded** ⇒
stops at depth 1 (gate pinned by test, the money/career discipline). `teachbacks:insert` →
cardsmith writes `cards` (unwatched) ⇒ stops at depth 1 — and deliberately does NOT route through
`topics:insert`, so the round-2 ingest cascade is not re-entered. The cartographer writes
`concepts`/`concept_links` (unwatched) ⇒ stops. Saturday map → Sunday digest is a **cron-to-cron
handoff through data**, not a hook chain — no cascade at all, just fresher input.

### New pages (round 3 — 5, bringing the app to 15) + components

| File | Route | Reads / writes |
|---|---|---|
| `pages/exams/index.tsx` | `/exams` | `listExams`; `createExam` (topics + minutes form); readiness per plan |
| `pages/exams/[id]/sit.tsx` | `/exams/:id/sit` | the timed room: `startSitting`, autosave via `saveAnswers`, countdown, `submitSitting`; deadline enforced client-side, verified server-side |
| `pages/sittings/[id].tsx` | `/sittings/:id` | `getSitting` — section scores, essay rubric verdicts, the proctor's analysis |
| `pages/map.tsx` | `/map` | `conceptMap` + `weakIslands` — the graph (token-styled SVG: node fill by status, edges by kind); click-through to cards |
| `pages/teach.tsx` | `/teach` | `<Chat agent="arena/listener" />` (the teach-back room) + `teachbackHistory` rail |

New shared components (design tokens only): `ExamTimer` (countdown, deadline states as semantic
tokens), `SectionScoreBar`, `ConceptGraph` (the map SVG — no raw colors; `status` maps to
tokens), `GapList` (severity-badged), `ReadinessDial`. `_layout.tsx` nav gains **Exams · Map ·
Teach**; the plan page shows `readiness` beside the exam date; the Today page links a weak
island's cards when one exists ("your weakest cluster today: lifetimes").

### The `arena` space (third project-scoped space, full format)

`learn/spaces/arena/` — the proving-ground team. Least-privilege per verb:

| Agent | `db:read` tables | `db:write` tables | `api:call` allow | `functions` | Role |
|---|---|---|---|---|---|
| **proctor** | `exams, exam_sittings, cards, prompts, topics, study_plans, settings` | `exams, exam_sittings, study_plans` | — | `[]` | assemble from existing cards/prompts only; grade objectively; readiness verdicts with evidence |
| **listener** | `topics, cards, concepts, concept_links, teachbacks, settings` | `teachbacks, topics` | — | `[]` | the Feynman room: probe, don't lecture; distill gaps honestly; stamp `lastTeachbackAt` |
| **cartographer** | `topics, cards, reviews, concepts, concept_links, digests, settings` | `concepts, concept_links` | `learnStats` | `[]` | derive/maintain the map; weak islands + orphans; feed the curator |

- **Agent-frontmatter features exercised**: the proctor declares `defaultAction: assemble` and
  `actions:` for `assemble` (tasklist `assemble-exam`) and `grade` (tasklist `grade-sitting`);
  the listener declares `defaultAction: session`. The listener holds **no web and no card
  writes** — its entire output is the `teachbacks` row; the redrill hook, not the listener,
  decides that gaps become cards (separation of measurement from remediation, mechanically).
- **Tasklists**: `assemble-exam/` — `01-inventory.md` (`role: explore`, `output: { pool: 'json' }`
  — eligible cards/prompts per topic, typed), `02-blueprint.md` (`dependsOn: [inventory]` —
  sections sized to the pool; refuse-with-reason when a topic can't fill its section),
  `03-select.md` (**`forEach: "blueprint.sections"`** — one fork per section picks its
  `questionRefs`, low-`askedInMock`-style rotation). `grade-sitting/` — `01-objective.md`
  (`role: explore` — score recall/application against card backs; `output: { sectionScores:
  'json' }`), `02-essays.md` (`optional: true`, **task-level `canDelegateTo:
  [academy/grader#grade]`** — one delegation per essay section, reusing the round-2 rubric
  machinery verbatim; the task runs only when the blueprint has essay sections),
  `03-verdict.md` (`dependsOn: [objective]` — blend, write `analysis` + `readiness`, flip
  `graded`). `map/` — derive (`role: explore`) → reconcile → flag (`forEach` over changed
  clusters).
- **Functions** (`functions/*.ts`, deterministic): `conceptRetention` (cluster 30-day retention
  from `reviews` — the same math `weakIslands` uses), `blendScores` (section scores → the one
  readiness number, weights fixed and documented), `deadlineCheck` (the same rule
  `saveAnswers` enforces), `clusterIslands` (graph connectivity over weak nodes).
- **Components**: view `SittingSummary` (chat-rendered section bars + readiness), view
  `MapDelta` (what changed this week); form `ExamIntake` — the `ask()` sheet the proctor renders
  when `createExam` arrives underspecified (which plan? how long? essay section or not?).
- **Knowledge** (`knowledge/assessment-craft/`, each field `index.md` + ≥2 aspects):
  `exam-design/` (`blueprint-balance.md`, `reuse-not-authoring.md` — measurement questions come
  from the corpus so results map back to cards; `time-pressure-calibration.md`),
  `proctoring/` (`objective-grading.md`, `readiness-honesty.md` — "not ready" with evidence
  beats comfort), `feynman-method/` (`probing-questions.md`, `gap-taxonomy.md`,
  `strengths-first.md`), `mapping/` (`concept-granularity.md`, `edge-kinds.md`,
  `orphans-and-islands.md`).

### Phases & verification additions (round 3)

Ordered on top of rounds 1–2: **(R3-1)** new schemas + columns; **(R3-2)** the `arena` space
full-format; **(R3-3)** the 11 endpoints (deadline + single-definition checks); **(R3-4)** the 3
hooks incl. the update-event gate test; **(R3-5)** the 5 pages + components; **(R3-6)** tests.

Verification additions: **(a)** `createExam` → the proctor assembles **only** from existing
cards/prompts (`questionRefs` all resolve; zero new rows in `cards`/`prompts` — reuse pinned
mechanically); an underspecified request renders the `ExamIntake` `ask()` form; a topic too thin
for its section refuses with a reason instead of padding; **(b)** `saveAnswers` after
`deadlineAt` → typed error (server-side `deadlineCheck`, not just UI); `submitSitting` →
`grade-sitting` fires once; the `graded` flip does not re-fire (gate + self-write pinned);
**(c)** an essay-section sitting delegates `academy/grader#grade` from `02-essays.md` ONLY — a
delegation attempt from `01-objective.md` fails typecheck (task-level allowlist observed); a
no-essay blueprint skips the task (`optional: true`); **(d)** grading a sitting changes **zero**
card scheduling state (the measurement/review wall, asserted over the whole cards table);
`readiness` equals `blendScores` on the fixture; **(e)** a teach-back with gaps → one cardsmith
run with the `focus` string, new cards land on the topic, empty-gaps sessions fire nothing; the
listener's `strengths` is non-empty when the transcript warrants (charter test); **(f)** Saturday
map run → `weak`/`orphan` statuses match `conceptRetention`/`clusterIslands` fixtures; Sunday's
curator digest cites the fresh map (cron-to-cron handoff observed through data); **(g)** the map
page renders with zero raw colors (`pnpm lint:tokens` green across the 5 new pages).

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
