# lmthing.trips — Product & Design Proposal (IDEAS)

> A forward-looking, implementation-informing proposal for the **`trips`** project-application.
> This is a design document, not a change: nothing here is built yet. Every proposal is grounded in
> what the app *actually is today* — its tables, pages, api handlers, hooks, and its five agent
> spaces — and in what the pod runtime can actually do (`useApi`/`useApiMutation`/`apiCall`,
> `<Chat agent="…">`, `spawn`/`delegate`, cron/database hooks, synchronous `db` in the sandbox +
> async `AsyncDbApi` in Node, `webSearch` via Tavily, model tiers XS/S/M/L + reasoning variants).
> Hard constraints carried through every idea: **design tokens only** (no raw colors), **inline SVG
> icons** (npm icon packs don't resolve in the app build sandbox), and **additive-lenient schema
> evolution** (new tables/columns only; no rename/drop/type-change).

## 0. Where the app is today (the ground truth)

**Data model (16 tables).** `trips` → `destinations` → `itinerary_items`; `bookings`,
`transit_legs`, `packing_items`; the party layer `travelers` + `traveler_preferences`; the money
layer `expenses` + `expense_shares` + `deals` + `currency_rates`; the ingest/knowledge layer
`documents` + `document_extractions` + `knowledge_notes` + `research`.

**Agent spaces (5).** `concierge` (planner → researcher + scheduler), `companions` (host),
`finance` (deal-hunter + treasurer), `logistics` (navigator + packer), `records` (analyst). Each is
full-format: charter+instruct, knowledge, functions, tasklists, view components.

**Surfaces.** A flat trip list (`pages/index.tsx`), a free-text new-trip form (`pages/new.tsx`),
and a per-trip shell with an **11-tab** bar (`components/TripTabs.tsx`): Timeline, Plan, Packing,
Logistics, Documents, Reminders, Travelers, Expenses, Finances, Settlement, Deals. The Plan tab is
the only conversational surface (`<Chat agent="concierge/planner" />`).

**Automation.** 10 hooks: `research-new-destination`, `plan-transit-on-destination`,
`split-new-expense`, `reconcile-traveler`, `analyze-document`, `regenerate-packing` (database
triggers) and `hunt-deals`, `watch-booking-prices`, `refresh-currency-rates`, `to-book-reminders`
(cron).

**The strongest thing about the app** is its depth: the schema, agents, and hooks already model a
serious multi-traveler, multi-currency, document-ingesting planner. **The weakest thing** is that
the UI is a stack of eleven parallel tabs of flat lists and forms, most work is invisible until it
finishes, and the one conversational entry point (`concierge/planner`) can't touch most of the app.
The proposals below attack exactly that gap.

---

# 1. Modern, well-thought UX

The app is functionally rich but *architecturally flat*: eleven sibling tabs, list-and-form on each,
and long-running agent work that the user can't see. The redesign has three themes — **collapse the
navigation into a spatial model of the trip**, **make agent work visible and live**, and
**standardize the empty/loading/error/skeleton vocabulary** across every page.

## P0 — Now (highest leverage, low runtime risk)

### 1.1 Replace the 11-tab bar with a 3-group segmented nav + a trip "Overview" home
`components/TripTabs.tsx` scrolls horizontally on desktop and is unusable on a phone. Eleven equal
tabs also imply eleven equal priorities, which is false. Regroup into **three** clusters and make
each trip's landing page an **Overview** dashboard rather than the raw Timeline.

- **Plan** — Overview, Timeline, Plan (chat), Research
- **Logistics** — Packing, Transit (rename "Logistics"), Documents, Reminders
- **People & Money** — Travelers, Expenses, Finances, Settlement, Deals

Structure: a primary segmented control (3 groups) + a secondary contextual tab row that only shows
the active group's tabs. On mobile the secondary row becomes a bottom sheet or a `<select>`. Keep
the existing `sticky top-0 … backdrop-blur` treatment and `bg-primary text-primary-foreground`
active token from the current `TripTabs`.

New **`pages/trips/[tripId]/index.tsx` → Overview**: a dashboard that answers "what's the state of
this trip?" at a glance, composed of existing endpoints — no new backend:
- **Trip header card**: title, `formatDateRange(startDate, endDate)`, status chip, party avatars
  (initials), a countdown ("in 24 days"). Reuse `BudgetStrip` (`getTripBudget`/`tripBudget`).
- **Next up**: the 3 nearest `itinerary_items` by `day`/`startTime` (from `getTrip`).
- **Needs attention**: a merged feed of `to-book-reminders` output (`reminders` endpoint), active
  `deals` (`getTripDeals`), documents with `status:'analyzing'|'error'`, and unsettled
  `expense_shares` (`getSettlement`). This is the single most valuable screen we don't have.
- **Money at a glance**: `FinanceBar` for booked+spent vs budget (from `tripFinances`).

### 1.2 A real Timeline, not a stack of day lists
`pages/trips/[tripId].tsx` groups `itinerary_items` by `day` into `DayColumn`s inside per-destination
sections — but it reads top-to-bottom with no sense of *time of day* or *gaps*. Redesign into a
**vertical day timeline** with a left time-gutter:
- Left rail = hours; items positioned by `startTime`/`endTime`; flexible (null-time) items float in
  an "anytime" tray at the top of the day.
- Color the left border of each `ItineraryCard` by `kind` using semantic tokens
  (`activity`/`meal`/`transit`/`lodging`) — add these as *tokens* in
  `sdk/org/libs/css/src/tokens/tokens.json`, never inline hex.
- **Show gaps and conflicts inline**: if two items overlap, or a transit leg (`transit_legs`) lands
  between two destinations without time to make it, render a subtle inline warning row. This is
  where the app's rich schema (`durationMinutes`, `bookByDate`, `needsBooking`) finally pays off
  visually.
- **`needsBooking` items get a persistent chip** ("Book by Oct 2") that links to the booking flow —
  today that data exists (`itinerary_items.needsBooking`/`bookByDate`) but is only surfaced on the
  Reminders tab.

### 1.3 A shared state vocabulary: skeletons, empties, errors, optimistic writes
Right now each page hand-rolls `<Spinner />`, a bordered `text-destructive` box, and a
`bg-card … text-center text-muted-foreground` empty box (see `finances.tsx`, `index.tsx`,
`[tripId].tsx`). Standardize into three reusable components in `components/`:
- **`Skeleton.tsx`** — token-driven shimmer blocks (`bg-muted`), used instead of a bare centered
  spinner so the page keeps its shape while loading. Especially important for Overview/Timeline.
- **`EmptyState.tsx`** — icon + headline + one-line hint + a primary CTA. Every empty list gets a
  *next action* ("No bookings yet — add one, or let the concierge suggest flights"), not a dead end.
- **`ErrorState.tsx`** — the destructive box + a **Retry** button wired to `useApi().refetch`
  (today `getTrip` exposes `refetch` but no page uses it). Errors should be recoverable, not final.

Make writes **optimistic** where safe. The add-destination / add-booking / status-select flows in
`[tripId].tsx` await the mutation then clear the form; wrap `useApiMutation` with an optimistic
cache update + rollback on error so the UI feels instant. Toggles (packing `packed`, share
`settled`, deal `status`) especially benefit.

### 1.4 Live agent progress (the single biggest perceived-quality win)
Today after `createTrip` fires `concierge/planner#plan-trip` fire-and-forget, the timeline just
shows a static banner "The concierge is planning your trip…" and polls `getTrip` every 4s
(`refetchInterval`). The user has no idea whether it's working, stuck, or nearly done. Introduce a
**visible run model**:
- New table **`agent_runs`** `{ id, tripId, kind, label, status:'running'|'done'|'error', detail,
  startedAt, endedAt }` (additive — a new table is allowed). Every `spawn`/`delegate` writes a
  `running` row at start and finalizes it in the `onError`/completion path (the `createTrip` handler
  and hooks already have the hook points).
- New endpoint `getTripActivity` streaming the recent runs; a **`RunStrip.tsx`** component shows
  live pills ("Researching Lisbon…", "Laying out days…", "Hunting deals…") on Overview/Timeline,
  driven by the same `refetchInterval` polling already used.
- This turns *five specialist agent spaces working in the background* from an invisible backend into
  the product's most impressive visible feature.

## P1 — Next

### 1.5 Map view for destinations & transit
A `pages/trips/[tripId]/map.tsx` that plots `destinations` and draws `transit_legs` between them.
Because the sandbox CSP blocks external tiles, do a **token-styled inline SVG "schematic map"**
first (ordered nodes on a route line, `RouteIcon` motif reused from `TripTabs`), each node linking
to its research/timeline. A real tile map is deferred to §3 (needs a maps integration + relaxed CSP
or server-proxied static tiles).

### 1.6 Settlement redesign — "who pays whom", visualized
`pages/trips/[tripId]/settlement.tsx` + `SettlementRow.tsx` compute the minimized debt graph
(`finance/functions/settleDebts.ts`). Present it as a clear **directed list of payments** ("Ana →
Bob €42") with a single **"Mark paid"** action per edge (patches the underlying
`expense_shares.settled`), a progress ring for "% settled", and a "Remind" affordance (§3 email).
Show per-traveler net balance chips (owed/owing) using `expensesPaid`/`shares` relations.

### 1.7 Documents as a drop-zone, not a paste box
`DocumentUploadForm.tsx` today captures pasted text (`documents.content`). Upgrade to a proper
**drag-and-drop** card with a live **extraction preview**: after `analyze-document` runs, show the
`document_extractions` it produced as reviewable rows ("Created booking: TAP LIS→OPO — Accept /
Edit / Discard") backed by the provenance model already in `records`. This makes the ingest pipeline
trustworthy and correctable instead of a black box.

### 1.8 Micro-interactions & polish
- Drag-to-reorder destinations (writes `destinations.orderIndex`) and drag items between days
  (writes `itinerary_items.day`) — the README already promises "drag items"; deliver it.
- Status transitions animate the timeline banner in/out; deal/reminder pills use a gentle pulse
  while `status:'planning'`.
- Currency amounts everywhere flow through `format.ts::formatMoney`; add a compact `~` prefix for
  *estimated* (unbooked) figures so "planned" vs "committed" reads at a glance (Finances already
  distinguishes `estimatedPlanned`).

## P2 — Later

- **Trip presence/collaboration cues** once sharing exists (§3): show which traveler last edited an
  item.
- **Print / export a clean day-by-day PDF-ish view** (a token-styled print stylesheet on Timeline).
- **Accessibility pass** (carry through all P0/P1): every icon-only button in `[tripId].tsx`
  (delete, add) needs an `aria-label` (some only have `title`); the tab bar needs
  `role="tablist"`/`aria-selected`; the timeline needs a logical heading order and focus-visible
  rings on cards; color-by-`kind` must never be the *only* signal (pair with a `kind` label/icon);
  respect `prefers-reduced-motion` for the new pulses/shimmers.

---

# 2. Better use of LLMs

The app already uses agents well for the *cold-start* (planner tasklist) and for *reactive ingest*
(document analysis, expense split). The opportunity is to (a) make generation **streaming and
interactive** instead of fire-and-forget, (b) add a handful of **high-value net-new AI features**,
and (c) **right-size the model tier** per task so cost/latency stay sane.

**Tiering heuristic used below** (Azure/lmthing.cloud XS/S/M/L + reasoning variants):
- **XS/S** — classification, extraction into a known schema, short rewrites, single-field
  normalization. Cheap, fast, run inline or in DB hooks.
- **M** — grounded prose with web search (research reports, deal descriptions, summaries). The
  workhorse for most `concierge`/`finance`/`records` work.
- **L / reasoning** — multi-constraint planning where correctness matters: laying out a
  budget-and-preference-constrained itinerary, minimizing a settlement graph edge-case, resolving
  conflicting party preferences. Use sparingly; these are the expensive turns.

## P0 — Now

### 2.1 Stream the plan instead of polling a banner
The `plan-trip` tasklist runs headless and the UI polls `getTrip`. Instead, let the **Plan tab's
`<Chat agent="concierge/planner">`** be the primary planning surface for a *new* trip too: the
new-trip form (`pages/new.tsx`) should hand the brief to the chat and let the planner **narrate as
it works** ("Proposing 3 stops… researching Lisbon… here's a draft — want it slower?"). The chat
widget already renders streamed agent output and view components (`DestinationProposal.tsx`). Pair
with the `RunStrip` (§1.4) so background steps are visible even when the user navigates away.
*Tier: planner orchestration stays M; the lay-out step (§2.2) escalates to L.*

### 2.2 Make itinerary lay-out preference- and budget-aware (quality, not new surface)
`concierge/scheduler#lay-out` already exists, and `traveler_preferences` (diet/mobility/interest/
pace/budget with `weight`) and `trips.budgetUsd` are all modeled. Ensure the lay-out prompt
**actually consumes** the party's reconciled "Party preferences & constraints"
`knowledge_notes` (written by `companions/host`) and the per-day `estimatedCost` roll-up so it
paces days for the slowest traveler, honors hard constraints (`weight>=1` allergies/mobility), and
trims to `budgetUsd`. This is the flagship "L/reasoning" turn — correctness under multiple
constraints is exactly what a reasoning model buys you. Add an explicit **"why this plan" rationale**
written to a `knowledge_note` so the choices are inspectable.

### 2.3 Natural-language expense capture (new, cheap, delightful)
Add `POST /api/trips/[id]/expenses/parse` that takes a free-text line — *"€48 dinner at Ramiro, I
paid, split with Ana and Bob"* — and returns a structured draft (`category`, `amount`, `currency`,
`paidByTravelerId`, suggested split) for one-tap confirm. This is a **single inline XS/S call**
(`ctx.spawn` a tiny `finance` action, or an inline model call), grounded by the trip's `travelers`
list for name resolution. It removes the app's most tedious form. The existing `split-new-expense`
hook then fans out the shares as it already does.

### 2.4 Per-destination "ask anything", grounded in its research
`pages/trips/[tripId]/research/[destId].tsx` shows a research report. Add a `<Chat
agent="concierge/researcher">` beneath it scoped to that `destinationId`, so follow-ups ("is the
castle worth it with kids?", "rainy-day alternative to Sintra?") are answered *grounded in the
existing `research` body + `knowledge_notes`*, only hitting `webSearch` when the note doesn't cover
it. *Tier: M with web search; XS when answerable from the stored report.*

## P1 — Next

### 2.5 Trip summarization & "personalized daily brief"
A cron hook `daily-brief` (rides the existing cron infra like `to-book-reminders`) that, for trips
in progress, writes a short **"today" summary** — weather note, what's planned, what needs booking,
current spend vs budget — as a `knowledge_note` surfaced on Overview. *Tier: S/M; grounded entirely
in existing rows, minimal/no web search.*

### 2.6 Smarter deal descriptions & de-duplication
`finance/deal-hunter` writes `deals`. Improve the `hunt-deals` prompt to (a) always cite sources in
`deals.description` (the schema wants "cited sources"), (b) express savings **in the trip's
`homeCurrency`** via `currency_rates`, and (c) **not re-surface** a deal already `taken`/`expired`.
*Tier: M with web search.*

### 2.7 Document extraction quality + confidence gating
`records/analyst` already has a provenance/confidence model (`document_extractions.confidence`,
"low-confidence bookings become notes"). Formalize: XS/S classify (`classifyKind`), M extract, and
**always** write a `document_extractions` row with `confidence`; the UI (§1.7) shows anything below
a threshold as a *suggestion* the user confirms rather than a silently-created booking.

### 2.8 Packing regeneration that reads the real forecast
`regenerate-packing` + `logistics/packer` generate `packing_items` with a `reason`. Once a weather
integration exists (§3.2), the packer should cite the *actual* forecast per destination/day and set
`itinerary_items.weatherNote`, closing the loop the schema already anticipates. *Tier: S/M.*

## P2 — Later

- **Photo/e-ticket vision extraction** — `documents.kind` already includes `ticket_image`;
  once multimodal upload lands, extract from images, not just pasted text.
- **"Trip retrospective"** — at `status:'complete'`, an L-tier pass that writes a narrative recap
  (route, spend breakdown, highlights from `research`/`knowledge_notes`) — shareable via §3.
- **Cost/latency guardrails** — reuse the per-hook `budget: { maxEpisodes, maxWallClockMs }` pattern
  (see `watch-booking-prices`) on every new agent action; prefer inline XS calls over `spawn` for
  anything user-blocking; cache anything researched into `research`/`knowledge_notes` so a second
  ask is free.

---

# 3. Integrations with other external services

Each integration below names the **service**, the **data in/out**, the **tables/endpoints/hooks it
touches**, the **user value**, and **how it connects** under pod constraints. Two hard realities
shape everything: (a) the agent sandbox reaches the web via **`webSearch` (Tavily)** and `fetch`;
(b) real server-side API calls with secrets belong in **`api/` Node handlers** or **cron hooks**
(worker-isolated Node, `AsyncDbApi`), not in the client SPA (CSP-restricted). API keys live in the
pod env (`PUT /api/compute/env`), so credentialed calls happen pod-side.

## P0 — Now (highest value / lowest friction)

### 3.1 Currency / FX rates — **exchangerate.host or Open Exchange Rates**
- **Service & surface:** `exchangerate.host` (free, no key) or Open Exchange Rates (`/latest.json`),
  REST GET of base→quote rates.
- **In/out:** in = latest rates for currencies present on the trip; out = rows in **`currency_rates`**
  `{ base, quote, rate, source, fetchedAt }`.
- **Touches:** replace the `webSearch`-scraped rate in the `refresh-currency-rates` **cron hook**
  with a real REST call from the Node handler; `tripFinances`/`tripBudget` and
  `finance/functions/convertAmount.ts` consume it.
- **Value:** accurate, auditable multi-currency roll-ups instead of an LLM-guessed FX rate.
- **How:** cron hook → `fetch()` in the Node handler → `db.insert('currency_rates', …)`. No OAuth.

### 3.2 Weather forecast — **Open-Meteo**
- **Service & surface:** Open-Meteo (free, no key) `/v1/forecast?latitude=…&longitude=…&daily=…`.
- **In/out:** in = destination lat/long + trip dates; out = per-day forecast written to
  **`itinerary_items.weatherNote`** and used by the packer.
- **Touches:** a new cron hook `refresh-forecast` (or extend `regenerate-packing`); needs
  destination coordinates — add nullable `lat`/`lng` columns to `destinations` (additive), populated
  by geocoding (§3.3).
- **Value:** packing lists and day plans that react to real weather ("rain in Sintra Thu → indoor
  alt"), exactly what `packing_items.reason` and `weatherNote` were designed for.
- **How:** cron/DB hook → `fetch()` pod-side.

### 3.3 Geocoding & places — **OpenStreetMap Nominatim + Overpass** (free) → optional **Google Places**
- **Service & surface:** Nominatim `/search` (place → lat/lng), Overpass for POIs; upgrade path to
  Google Places Details (ratings, hours, price level) if a key is provided.
- **In/out:** in = `destinations.name` / `itinerary_items.location`; out = `lat`/`lng` (new columns),
  and enrichment (`itinerary_items.notes`: hours, "reserve ahead", price band).
- **Touches:** `research-new-destination` and `plan-transit-on-destination` hooks; enables §1.5 map
  and §3.2 weather.
- **Value:** geographic truth for maps, transit sanity-checks, and "is it open when we're there".
- **How:** Node handler `fetch()` with a polite rate limit; results cached to avoid re-geocoding.

### 3.4 Calendar export — **iCalendar (.ics) + Google Calendar**
- **Service & surface:** generate an **RFC-5545 .ics** feed of `itinerary_items` + `bookings` +
  `transit_legs`; optionally push to **Google Calendar API** (OAuth) if connected.
- **In/out:** out = VEVENTs (title, `day`+`startTime`/`endTime`, `location`, notes); a stable
  subscribe URL means edits in-app propagate to the user's phone.
- **Touches:** new `GET /api/trips/[id]/calendar.ics` Node handler reading `getTrip`; no schema
  change for export.
- **Value:** the itinerary lives on the traveler's real calendar with reminders — huge for adoption.
- **How:** .ics needs no auth (a signed feed URL). Google push = OAuth stored in pod env.

## P1 — Next

### 3.5 Flights & fares — **Amadeus Self-Service** (or Kiwi/Tequila, Skyscanner RapidAPI)
- **Service & surface:** Amadeus `Flight Offers Search` / `Flight Inspiration`, REST + OAuth2 client
  credentials.
- **In/out:** in = origin/destination IATA + dates + `party_size`; out = candidate fares written as
  **`deals`** (`kind:'flight'`, `estimatedSavings`, `url`, `expiresAt`) — advisory only, never
  auto-booked (the schema is explicit: "never a confirmed booking").
- **Touches:** the `hunt-deals` cron hook (`finance/deal-hunter`) and `POST …/deals/find`;
  `watch-booking-prices` can re-price a saved flight and flag drops.
- **Value:** real fares and real "book by" windows, replacing web-searched estimates.
- **How:** Node handler holds the Amadeus key + does the OAuth2 token dance pod-side.

### 3.6 Rail & ground transit — **Rome2Rio / Trainline / national rail APIs**
- **Service & surface:** Rome2Rio (multi-modal routing) for `transit_legs` duration/mode/cost.
- **In/out:** in = from/to destinations (coords from §3.3); out = `transit_legs`
  (`mode`, `durationMinutes`, `estimatedCost`, `bookByDate`, cited `notes`).
- **Touches:** `plan-transit-on-destination` hook + `POST …/transit/plan` (`logistics/navigator`).
- **Value:** grounded leg planning ("Lisbon→Porto: train 2h55, €12 if booked 3wk out") instead of
  model estimates; feeds the Timeline gap/conflict detection (§1.2).

### 3.7 Lodging — **Booking.com / Expedia affiliate APIs or Google Hotels**
- **In/out:** in = destination + dates + budget band; out = `deals` (`kind:'hotel'`) and a prefilled
  add-booking flow. Advisory links only.
- **Touches:** `hunt-deals`; the Timeline "needs lodging" gap detector can trigger a targeted search.

### 3.8 Sharing & notifications — **Resend/SendGrid (email)** and **the platform's bug-report style GitHub/pod bridge**
- **Service & surface:** transactional email (Resend) for: settlement reminders ("Ana, you owe Bob
  €42"), "book by" deadlines from `to-book-reminders`, and a read-only trip share link.
- **In/out:** out = emails to `travelers.email` (already modeled!); in = none.
- **Touches:** the `to-book-reminders` cron hook and a new `POST …/settlement/remind`; uses the
  existing pod→gateway pattern for outbound side effects.
- **Value:** the party actually *gets* the reminders instead of only seeing them in-app.

## P2 — Later

- **Maps tiles — Mapbox/Google Static Maps** for a real §1.5 map (needs CSP relaxation or a
  pod-proxied static-image endpoint so tiles come from same-origin).
- **Email ingest — a forwarding address** ("plans@…") that drops forwarded confirmations straight
  into `documents` for the `records/analyst` pipeline — the killer feature for the paste-box today.
- **Wise/Revolut** deep links for actually settling debts computed by `settleDebts`.
- **Travel advisories/visas — government feeds** to ground `logistics` Schengen/visa
  `knowledge_notes` against `travelers.homeCountry`.

---

# 4. An in-app agent that can drive the whole application — the **Trip Copilot**

Today the only chat is `concierge/planner`, and by design it holds **`db:read` on just
`{trips, destinations, knowledge_notes}`** and can only delegate planning. There is **no single
agent that can operate the whole app** — add expenses, split them, add travelers, mark shares
settled, generate packing, find deals, ingest a document. That is the gap this section fills.

Propose a new space **`copilot`** with one agent **`copilot/assistant`**, surfaced as a persistent
**`<Chat agent="copilot/assistant" />`** dock available on *every* trip page (a collapsible right
rail on desktop, a full-screen sheet on mobile), always seeded with the current `tripId`.

## 4.1 Why a new agent (and not just widen the planner)
Keep least-privilege intact: the planner stays read-only and planning-focused. The copilot is the
**write-capable orchestrator** — it *routes* to the existing specialists rather than duplicating
them, and it is the only agent granted `api:call` + broad `db` access. This complements pages, it
doesn't replace them: pages are for *browsing and precise edits*; the copilot is for *"just do it"*
across tables and for actions that would otherwise mean visiting three tabs.

## 4.2 Capabilities (frontmatter — enforced by the host at injection, not prose)
```yaml
# spaces/copilot/agents/assistant/instruct.md (frontmatter sketch)
title: Trip copilot
defaultAction: assist
capabilities:
  - db:read:  { tables: [trips, destinations, itinerary_items, bookings, transit_legs,
                          travelers, traveler_preferences, expenses, expense_shares,
                          deals, documents, knowledge_notes, research, packing_items] }
  - db:write: { tables: [expenses, packing_items, itinerary_items, bookings] }   # direct, low-risk edits
  - api:call                                                                       # the safe path for the rest
canDelegateTo:
  - concierge/planner#plan-trip
  - concierge/scheduler#lay-out
  - concierge/researcher#dive
  - finance/treasurer#split-expense
  - finance/deal-hunter#hunt-deals
  - logistics/packer#build-packing
  - logistics/navigator#plan-transit
  - companions/host#reconcile
```
The copilot prefers **`apiCall('createExpense', …)` / `apiCall('addBooking', …)`** over raw
`db.insert` wherever a typed endpoint exists — endpoints carry ajv validation and trigger the DB
hooks (e.g. `split-new-expense`), so calling them keeps the automation intact. It uses `db.query`
(sync in the sandbox) to *read and ground itself* before acting, and `delegate` for anything a
specialist already does better (planning, deal-hunting, reconciling preferences).

## 4.3 What it can do (mapped to real endpoints/hooks/tables)
| User intent | Copilot action | Backing surface |
|---|---|---|
| "Add €48 dinner at Ramiro, I paid, split 3 ways" | parse → `apiCall('createExpense')` → `split-new-expense` hook fans out shares | `expenses`, `expense_shares` |
| "Who owes what?" | `apiCall('getSettlement')`, render summary | `expense_shares` (`settleDebts`) |
| "Mark Ana's share of the dinner paid" | `apiCall('patchExpenseShare', {settled:true})` | `expense_shares` |
| "Add Bob, he's vegetarian and hates early starts" | `apiCall('addTraveler')` + `addPreference` → `reconcile-traveler` hook | `travelers`, `traveler_preferences` |
| "Make day 3 slower / add a food stop in the south" | `delegate('concierge/scheduler#lay-out')` | `itinerary_items` |
| "Find cheaper flights for these dates" | `delegate('finance/deal-hunter#hunt-deals')` | `deals` |
| "Pack for this trip" | `delegate('logistics/packer#build-packing')` | `packing_items` |
| "Here's my hotel confirmation: <paste>" | `apiCall('uploadDocument')` → `analyze-document` hook | `documents`, `document_extractions` |
| "What's Porto like in October?" | answer from `research`/`knowledge_notes`; else `delegate researcher#dive` | `research` |
| "Are we over budget?" | `apiCall('tripFinances')`, explain | `expenses`, `bookings` |

## 4.4 Surfacing results in the UI
- The chat streams narration + renders **view components** (the `<Chat>` renderer already supports
  descriptor components like `DestinationProposal`, `SettlementSummary`, `DealCard`). The copilot
  returns a compact result card ("Added expense €48 · split Ana/Bob/you €16 each →
  [Open Expenses]") that deep-links into the relevant page.
- Every write the copilot makes should **invalidate the same query keys** the pages use
  (`getTrip`, `tripFinances`, `tripBudget`, `getSettlement`, …) so the open page updates live. Wire
  this via the app runtime's cache invalidation (the same `invalidates:` mechanism `useApiMutation`
  uses) triggered on chat action completion, or by having pages subscribe to the `agent_runs` feed
  (§1.4) and refetch on `done`.
- Long actions (planning, deal-hunting) show as `RunStrip` pills (§1.4) rather than blocking the
  chat.

## 4.5 Safety & confirmation (this is a write-capable agent)
- **Confirm-before-destructive.** Deletes (`deleteTrip`, `deleteBooking`, `deleteExpense`) and
  bulk/irreversible changes are **never executed directly** — the copilot proposes an action card
  with an explicit **Confirm** button that fires the mutation client-side. Mirror the existing
  `confirm('Delete this trip…')` guard in `[tripId].tsx`, but as a first-class chat affordance.
- **No fabricated bookings.** Carry over the planner's hard rule: the copilot **never invents a
  confirmation number or auto-books** anything; booking-type deals are advisory links only (matches
  the `deals`/`bookings` schema intent).
- **Grounding before acting.** The instruct file mandates a `db.query` read to resolve names
  (traveler by name, expense by description) before any write, and to *echo what it's about to do*
  in a comment/summary — no silent multi-row writes.
- **Capability boundary is real, not prose.** Anything outside the frontmatter grant simply isn't
  injected and fails typecheck — so `db:schema`/`pages:write`/`hooks:write` are deliberately withheld
  (the copilot operates the app, it doesn't rebuild it).
- **Scope to the current trip.** The chat is always seeded with `tripId`; the instruct file requires
  every query/write to be filtered by it, so the copilot can't accidentally touch another trip.

## 4.6 Example conversation
```
User:  we spent €62 on a taxi from the airport, I paid, split with everyone
Copilot: (reads travelers for this trip → 3 people)
         Logging €62 transit, paid by you, split 3 ways (€20.67 each).
         [Confirm]  [Edit split]
User:  confirm
Copilot: ✓ Added. Ana and Bob each owe you €20.67.  [Open Settlement]
         Heads up — you're now at €1,840 of your €2,000 budget (92%).
User:  find me a cheaper way to get to Porto
Copilot: On it — checking rail and flight options for Lisbon→Porto…  ⟳ (RunStrip pill)
         (delegates logistics/navigator#plan-transit + finance/deal-hunter#hunt-deals)
         Best value: train, 2h55, ~€12 if booked by Oct 2 (vs €55 flight). Saved as a deal.
         [Open Deals]  [Add train to timeline]
```

## 4.7 Rollout
- **Now:** ship `copilot/assistant` with read-all + write on `expenses`/`packing_items` + `api:call`
  + delegation; dock it on Overview/Timeline. This alone covers the top intents (expense capture,
  settlement, packing, "am I over budget").
- **Next:** add the confirm-card UX for destructive actions and the `agent_runs`/live-invalidation
  wiring so open pages update as the copilot acts.
- **Later:** let the copilot proactively open the conversation from Overview's "Needs attention"
  ("3 items need booking this week — want me to hunt fares?").

---

# Appendix — Priority summary

| # | Proposal | Priority | New backend? |
|---|---|---|---|
| 1.1 | 3-group nav + Overview dashboard | P0 | No (composes existing endpoints; +`Overview` page) |
| 1.2 | Real time-gutter Timeline w/ gap/conflict warnings | P0 | No (+ `kind` color tokens) |
| 1.3 | Skeleton/Empty/Error + optimistic writes | P0 | No |
| 1.4 | Live agent progress (`agent_runs` + `RunStrip`) | P0 | Yes (1 table, 1 endpoint, hook writes) |
| 2.1 | Streaming plan via Plan chat | P0 | No (reuse `<Chat>`) |
| 2.2 | Preference/budget-aware lay-out (reasoning tier) | P0 | No (prompt/knowledge wiring) |
| 2.3 | NL expense capture | P0 | Yes (1 parse endpoint) |
| 2.4 | Grounded per-destination research chat | P0 | No |
| 3.1 | FX rates (exchangerate.host) | P0 | Yes (cron hook rewrite) |
| 3.2 | Weather (Open-Meteo) | P0 | Yes (hook + `lat`/`lng` cols) |
| 3.3 | Geocoding/places (Nominatim→Google) | P0 | Yes (handler) |
| 3.4 | Calendar .ics export | P0 | Yes (1 endpoint) |
| 4.x | **Trip Copilot** (`copilot/assistant`) | P0→P1 | Yes (1 space; reuses endpoints) |
| 1.5–1.8 | Map, settlement redesign, doc drop-zone, drag/polish | P1 | Mostly no |
| 2.5–2.8 | Daily brief, better deals, extraction confidence, weather-aware packing | P1 | Some |
| 3.5–3.8 | Flights (Amadeus), rail (Rome2Rio), lodging, email/share | P1 | Yes |
| 1.x/2.x/3.x P2 | Collaboration, print/export, a11y deepening, vision extraction, retrospective, tiles, email ingest | P2 | Varies |

**North star:** turn a deep-but-flat, mostly-invisible planner into a **live, spatial, conversational
trip workspace** — where the eleven specialist behaviors already in the codebase are visible while
they run, grounded in real external data, and drivable end-to-end from one Trip Copilot chat.
