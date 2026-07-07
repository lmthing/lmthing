# lmthing.health — Product Ideas & Roadmap

A forward-looking proposal document for the **health** project-application. It grounds every
proposal in what the app *actually is today* — its 20 tables, ~17 pages, ~19 endpoints, 12 hooks,
and 5 spaces (`clinic`, `care`, `coaching`, `pharmacy`, `records`) — and in the runtime primitives
available to a project-app (client React via `@app/runtime`, worker-isolated Node `api/` handlers,
cron/db `hooks/`, capability-gated agents that `spawn`/`fork`/`delegate`/`webSearch`, and the
`<Chat agent="space/agent" />` widget).

**This is a design document. It proposes; it does not implement.** Nothing here overrides the
product's core stance: *not medical advice* — every AI surface summarises the user's own data and
the literature, cites sources, and never diagnoses or prescribes. `settings.acceptedDisclaimer`
still gates first use.

Priorities use **Now / Next / Later** (P0 = highest-leverage, ships first).

---

## Where the app is today (baseline)

- **Data**: `metrics`, `lab_results`, `symptoms`, `medications` + `adherence_logs`, `interactions`,
  `appointments` + `visit_briefs`, `documents` + `document_extractions`, `research`,
  `triage_assessments`, `insights`, `knowledge_notes`, `goals`, `followups`, `care_contacts`,
  `care_shares`, `sources`, `settings`.
- **Pages** (`_layout.tsx` flat top-nav of 17 pills): `/` Dashboard, `/labs`, `/symptoms`,
  `/triage`, `/medications`, `/doses`, `/interactions`, `/appointments`, `/visits`, `/documents`,
  `/insights`, `/knowledge`, `/goals`, `/followups`, `/contacts`, `/shares`, `/settings`.
- **Agents & Chat**: five `<Chat>` docks already exist — `coaching/coach` (Goals),
  `care/triage-nurse` (Triage detail), `pharmacy/pharmacist` (Medication detail),
  `clinic/researcher` (Research detail), `care/coordinator` (Appointment detail).
- **Automation**: cron (`daily-digest` 08:00, `dose-reminders`, `appointment-reminders`,
  `followup-reminders`, `goal-checkin`) + db-triggered (`interpret-new-lab`, `analyze-document`,
  `research-deep-dive`, `triage-symptom`, `check-interactions`, `compile-care-share`,
  `prepare-visit-brief`). All db-triggered hooks are declarative "reconcile now" signals — the
  agent self-queries `pending` rows.
- **Tiering**: `settings.tier` (`free` | `subscription`) gates deep research; triage is
  deliberately free (safety is never paywalled).

The bones are strong. The gaps are: (1) the UI is a long flat nav of list pages with weak
information hierarchy and thin empty/loading/error states; (2) LLMs run mostly in the background —
there's little *inline, streaming* intelligence where the user is looking; (3) there are zero
external integrations, so every metric/lab/med is hand-typed; (4) there's no single conversational
surface that can drive the *whole* app — the five `<Chat>` docks are each scoped to one detail page.

---

# 1. Modern, well-thought UX

## 1.1 Information architecture — collapse 17 pills into 5 sections (P0, Now)

The current `_layout.tsx` renders 17 equal-weight nav pills that wrap onto multiple rows. That's a
flat menu, not an information architecture. Group them to match the mental model and the spaces that
own them:

| Section (nav group) | Pages it contains | Owning space |
|---|---|---|
| **Today** | `/` Dashboard | — |
| **Vitals** | `/labs`, `/symptoms`, metrics (dashboard), `/insights` | `clinic` |
| **Meds** | `/medications`, `/doses`, `/interactions` | `pharmacy` |
| **Care** | `/appointments`, `/visits`, `/contacts`, `/shares`, `/triage` | `care` |
| **Goals** | `/goals`, `/followups` | `coaching` |
| **Records** | `/documents`, `/knowledge` | `records` |
| (utility) | `/settings` | — |

Implement as a two-level nav: a primary bar of 6 sections + a secondary contextual sub-nav shown
only inside the active section. On mobile this becomes a bottom tab bar (Today / Vitals / Meds /
Care / More) with a sheet for the overflow. This alone makes the app feel like a product rather
than an admin panel, and it maps 1:1 to the space that answers questions about each area.

## 1.2 The Dashboard ("Today") is the product — rebuild it (P0, Now)

Today `pages/index.tsx` shows: a `HealthStats` count row, three fixed `MetricChart`s (weight,
resting_hr, sleep_hours), and a log-a-measurement form. It's a decent start but it buries the two
things a health app must answer first: *what needs my attention* and *what's due today*.

Proposed layout (top → bottom), all reading from existing endpoints/hooks:

1. **"Needs attention" banner row** — a horizontally-scrollable strip of *action cards* synthesised
   from data the app already computes:
   - flagged labs (`lab_results.flag !== 'normal'`) → "3 results outside range"
   - due follow-ups (`followups` where `!done && dueAt <= now`) → from `followup-reminders`
   - due/missed doses today (`adherence_logs` status `pending`/`missed`) → from `dose-reminders`
   - imminent appointments (next 7 days) → from `appointment-reminders`
   - urgent triage results (`triage_assessments.urgency` in `urgent`/`emergency`)

   Each card is tappable → deep-links to the relevant page. Empty state: a calm "All clear — nothing
   needs attention today" with a subtle check glyph (inline SVG). This needs one new endpoint,
   `getAttention` (aggregates the five queries server-side so the client makes one call), or can be
   assembled client-side from existing `useApi` calls.

2. **Today's plan** — a compact checklist: doses to confirm (with a one-tap "Taken" that hits
   `logDose`), follow-ups due, appointments today. This turns the dashboard into something you
   *return to daily*, not just read once.

3. **Trends** — keep `MetricChart`, but make the tracked kinds user-configurable (persist a
   `settings.pinnedMetrics` array) instead of the hardcoded `TRACKED_KINDS = ['weight','resting_hr',
   'sleep_hours']`. Add a sparkline + delta badge (▲/▼ %, from the existing `computeTrend`/
   `metricTrends` functions) to each chart header.

4. **Latest insight** — surface the newest `insights` row (the `daily-digest` output) as a quiet
   card with a "See all" link to `/insights`, instead of leaving `/insights` an island.

5. **Quick log** — keep the measurement form but move it into a collapsible "＋ Log" affordance /
   floating action button so it doesn't dominate the fold.

## 1.3 Empty, loading, and error states everywhere (P0, Now)

Right now most pages render `<Spinner />` while loading and (implicitly) blank when empty. Every
list page (`/labs`, `/symptoms`, `/medications`, `/documents`, `/insights`, `/goals`, …) should get:

- **Skeleton loaders** matching the row shape (not a centered spinner) — perceived performance.
- **First-run empty states** that teach: e.g. `/labs` empty → "No lab results yet. Upload a lab PDF
  in Documents, or add one manually." with two buttons. `/medications` empty → "Add your first
  medication to track doses and check interactions."
- **Error states** with a retry that calls the hook's `refetch`. Today `logMetric.error` is
  surfaced as raw `{message}`; standardise a small `<ErrorNote onRetry>` component.
- **Pending/optimistic states** for async agent work: a `documents` row `status:'analyzing'`, an
  `interactions`/`research`/`triage`/`care_shares`/`visit_briefs` row `status:'pending'` should all
  render a consistent **"AI is working…"** shimmer card with an honest "usually ~30s" hint and the
  agent's avatar/name, so the user understands *why* the row is empty and that something is running.

## 1.4 Key screen redesigns

- **`/labs` → a longitudinal analyte view (P1, Next).** Today labs are a flat list of readings.
  Pivot to *per-analyte* cards: for each analyte (LDL, HbA1c, …) show the latest value with its
  in/out-of-range chip, a sparkline over all `takenAt` history, and the personal-baseline band
  (`personalLow`/`personalHigh` already cached by `clinic/interpreter`). Tapping opens
  `/labs/[id]` with the full trend, the reference range visualised as a band, any linked
  `research`/`knowledge_notes`/`followups`, and the `<Chat agent="clinic/interpreter">` dock for
  "what does this mean for me?".
- **`/medications` (P1, Next).** Combine the med list, today's adherence ring (from
  `pharmacy` `adherenceRate`), and interaction badges into one card per med. Add a visible
  `reminderTime` editor and `refillsRemaining` with a low-refill warning chip.
- **`/triage` (P0, Now — safety-critical polish).** Urgency must be unmissable: color the whole
  card by `urgency` using semantic tokens (`emergency`/`urgent` → `bg-destructive`/warning tokens,
  `routine`/`self_care` → muted), lead with the "if X, seek care now" line pulled to the top, and
  never hide the disclaimer. Add a persistent "Call your care contact" / emergency-number affordance
  sourced from `care_contacts` with `role:'emergency'`.
- **`/shares` (P1, Next).** The care-summary export should render as a genuinely *printable* page
  (`@media print` styles, a "Print / Save PDF" button) — this is the artifact a user physically
  hands a clinician, so it deserves clinician-grade typography and a header with name/date/scope.

## 1.5 Micro-interactions & visual polish (P2, Later)

- One-tap dose confirmation with an optimistic checkmark + subtle haptic-style scale animation.
- Flag/severity/urgency badges unified into one token-driven `<StatusChip level=…>` (today
  `FlagBadge`, `SeverityBadge`, `UrgencyBadge` are separate).
- Streaming markdown: when an agent writes `body` (research/visit-brief/interaction), reveal it with
  a typewriter/fade-in rather than a hard swap from spinner → full text.
- Consistent iconography via a single inline-SVG icon set (`components/icons.tsx`) — npm icon packs
  don't resolve in the app build sandbox, so keep them inline and token-colored.

## 1.6 Accessibility & responsive (P1, Next)

- All status conveyed by color must also carry text/ARIA (`aria-current` is already used in nav —
  extend the discipline). Urgency/flag chips need an accessible label, not just a hue.
- Charts (`MetricChart`) need an accessible table fallback / `aria-label` summarising the trend.
- Target sizes ≥44px for the dose-confirm and log actions (mobile-first).
- Respect `prefers-reduced-motion` for the new shimmer/typewriter animations.
- Full keyboard nav for the two-level menu and the command palette (§4.5).

---

# 2. Better use of LLMs

The app already uses agents well for *background reconcile* (interpret labs, analyze documents,
research dives, triage, interactions, care summaries). The opportunity is **inline, user-facing,
streaming intelligence** and **smarter synthesis** — plus right-sizing the model tier per task.

### Model-tier guidance (Azure/lmthing.cloud XS/S/M/L + reasoning variants)

| Task shape | Tier | Why |
|---|---|---|
| Extraction / classification / short rewrite (parse a lab PDF, detect doc kind, structure a symptom sentence) | **XS–S** | High volume, schema-constrained; cheap + fast wins |
| Daily digest, goal check-in, care-summary compile, dose reminder phrasing | **S–M** | Summarisation over the user's own rows; latency is background so tolerate M |
| Literature research w/ `webSearch`, visit-brief synthesis, interaction findings | **M–L (reasoning)** | Multi-source synthesis + citation discipline; correctness matters, runs in a hook so latency is hidden |
| Triage | **M reasoning**, knowledge-grounded only (never open web) | Safety-critical; conservatism > breadth |

## 2.1 Natural-language logging ("just tell it") (P0, Now)

The single biggest UX win. Instead of the `kind/value/unit` form, let the user type or dictate:
*"slept 6.5h, weight 82kg, took my atorvastatin, mild headache since lunch."* A new endpoint
`quickLog` (`api/quick-log/POST.ts`) does the parse with an **XS/S** model via `ctx.spawn` to a new
`clinic/logger`-style structuring action (a `records`/`clinic` agent already exists as `logger`),
returning a *preview* of structured writes across `metrics`, `medications`, `adherence_logs`,
`symptoms`. Crucially: **show the parse for confirmation before writing** (see §4 safety) — the user
taps to accept, then the rows are inserted. This is inline (fast model, single turn), not a hook.

## 2.2 "Explain this like I'm not a doctor" everywhere (P0, Now)

Every clinical artifact — a flagged lab, an interaction finding, a research report, a triage note —
should have an inline **"Explain plainly"** button that streams a 2–3 sentence lay summary. Use the
existing `<Chat>` infra but seed it with the row context so it's one-click, not "type your
question". Tier **S**. This directly serves the product's core promise ("plain language, walk in
informed instead of anxious").

## 2.3 Smarter insights: correlation & anomaly synthesis (P1, Next)

`daily-digest` currently emits mostly `kind:'trend'` insights from `computeTrend`. Upgrade the
`clinic/interpreter#digest` action to do genuine **cross-signal synthesis**: correlate `metrics`
(sleep, steps, resting_hr, weight) with `symptoms` timing and `adherence_logs` gaps — e.g. "resting
HR trended up ~8% in the two weeks your sleep averaged under 6h" (`kind:'correlation'`), or
"headaches cluster on days you missed the evening dose" (`kind:'anomaly'`). The math stays in
functions (`computeTrend`, `metricTrends`, plus a new `correlate` function); the **M** model only
phrases the plausible, caveated observation. Keep it observational, never causal/diagnostic.

## 2.4 A weekly narrative digest (P1, Next)

Add a `weekly-digest` cron hook (`daily: '08:00'` gated to Mondays, or a 7d cron) that has the
interpreter write a short **narrative** "Your week in health" `insights` row (or a new
`digests` table) — a paragraph the user actually reads, synthesising the week's flagged labs, goal
progress (`coaching` `goalProgress`), adherence rate, and any new research. Streams into a hero card
on the dashboard. Tier **M**.

## 2.5 Research quality & grounding (P1, Next)

- **Citations-first prompting**: the `clinic/researcher` already writes with citations via
  `webSearch` (Tavily) and honours `sources` trust weights. Strengthen it by (a) requiring every
  claim to map to a cited source or be dropped, (b) preferring `sources` with `kind:'guideline'`
  and high `trust`, and (c) writing a machine-readable citation list into `knowledge_notes` so
  future analyses reuse it (the app already has this table + a `records/librarian`).
- **Dedup research**: before spawning a dive, check `knowledge_notes` by `analyte`/`topic` — if a
  recent cited note exists, synthesise from it (cheaper **S**) and only hit the web when stale.

## 2.6 Document understanding upgrades (P1, Next)

`analyze-document` + `records/analyst` already extract structured rows from pasted text. Extend:

- **Vision/PDF ingest** (see §3.3) — OCR/extract from an actual uploaded lab PDF or photo, not just
  pre-pasted text. The extraction agent then parses the OCR text as today.
- **Confidence-surfaced review**: `document_extractions.confidence` exists but isn't shown. Render a
  review screen where low-confidence extractions (`< 0.6`) are flagged for the user to confirm/edit
  before they're trusted — an LLM-assisted human-in-the-loop, not silent writes.

## 2.7 Where each primitive fits (design rule of thumb)

- **Inline `apiCall` + `spawn` (fast, single-turn)** → quick-log parse, "explain plainly", the
  command agent's read/create actions. User is waiting → **XS–S**, stream tokens.
- **`<Chat>` dock** → open-ended, per-page Q&A grounded in one row (already used well). Keep these.
- **Hooks (`cron`/`database`) → `delegate`/`trigger` agents** → all the heavy background synthesis
  (digest, research, interactions, briefs, care summaries). Latency hidden → **M–L reasoning**.
- **`fork` (within an agent)** → parallel per-analyte research or per-medication interaction lookups
  under one hook run (the `forEach` map node), collecting results without the model writing loops.

---

# 3. Integrations with other services

Today every row is hand-typed. Integrations are the difference between a diary and a system of
record. Each below names the service, the exact data flow, the tables/endpoints/hooks it touches,
the user value, and the concrete connection mechanism available to a project-app (OAuth + REST poll
from a Node `api/` handler or a `cron` hook; inbound webhook to an `api/` POST route; Tavily
`webSearch` from an agent; client-side file upload to an `api/` handler).

## 3.1 Apple Health / Google Fit / Fitbit — wearable & phone metrics (P0, Now)

- **Service**: Apple HealthKit export (client-side), Fitbit Web API, Google Fit REST.
- **Data in**: steps, resting HR, sleep hours/stages, weight, HRV, blood oxygen, workouts.
- **Flow**: OAuth 2.0 to Fitbit/Google (token stored in a new `integrations` table:
  `{provider, accessToken, refreshToken, expiresAt, lastSyncAt, scopes}`), then a `cron` hook
  `sync-wearables` (`every: '1h'`) whose **imperative handler** calls the provider REST API via
  `fetch` in the Node handler, maps each reading to a `metrics` row (`source: 'fitbit'`), and
  dedupes by `(kind, recordedAt, source)`. Apple Health has no cloud API, so support its **export
  file**: the user drops the Health export (or a Health Auto Export CSV) into `/documents`, and the
  existing `metrics/import` endpoint + `records/analyst` (`parseCsv`, `wearable-csv` knowledge)
  ingest it — this path *already half-exists*.
- **Touches**: new `integrations` table, `metrics` table, `metrics/import` endpoint, new
  `sync-wearables` hook, new `api/integrations/*` OAuth-callback routes.
- **Value**: the dashboard trends and every correlation insight become real without manual logging.

## 3.2 Patient portals via FHIR / Apple Health Records — labs & meds (P1, Next)

- **Service**: SMART-on-FHIR endpoints (Epic MyChart, Cerner) or Apple Health Records (which
  aggregates FHIR from many providers).
- **Data in**: `Observation` (lab results w/ LOINC codes + reference ranges), `MedicationRequest`
  (active meds), `Condition`, `AllergyIntolerance`.
- **Flow**: SMART OAuth → an `api/fhir/import/POST.ts` handler pulls `Observation`/`MedicationRequest`
  bundles, maps `Observation.valueQuantity` + `referenceRange` → `lab_results`
  (`value/unit/refLow/refHigh/analyte/panel/takenAt`), `MedicationRequest` → `medications`. Inserts
  fire `interpret-new-lab` and `check-interactions` automatically — the flagging/interaction
  pipeline runs with zero extra wiring.
- **Touches**: `lab_results`, `medications`, `interactions` (via existing hooks),
  `document_extractions` (provenance: `targetTable`+`rowId` pointing at the FHIR bundle doc).
- **Value**: real labs from the actual provider, with real reference ranges, auto-flagged.

## 3.3 File & photo ingest — Tesseract/OCR + PDF (P0, Now)

- **Service**: client-side PDF.js (text-layer extraction) + a cloud OCR (Azure AI Document
  Intelligence, same Azure tenant as the models) for scanned/photo labs.
- **Data in/out**: user uploads a lab PDF or a photo of a med label; OCR text → `documents.content`;
  `analyze-document` hook → `records/analyst` extracts `lab_results`/`medications`/`metrics`.
- **Flow**: `api/documents/POST.ts` accepts the file, runs text extraction (PDF text layer inline;
  fall back to Azure Document Intelligence REST for images), stores text in `documents.content`
  (`kind` auto-detected by `records/detectKind`). Everything downstream already works.
- **Touches**: `documents`, `document_extractions`, `metrics/import`, `analyze-document` hook.
- **Value**: closes the "I have a paper lab report" gap that today requires manual retyping.

## 3.4 Pharmacy refills & drug data — RxNorm / openFDA (P1, Next)

- **Service**: NIH RxNorm API (normalise drug names/strengths), openFDA drug label + adverse-event
  API — both free, keyless REST.
- **Data in/out**: on `medications` insert, an imperative hook `enrich-medication` calls RxNorm to
  canonicalise `name`/`dose` and fetch the RxCUI, then openFDA for the official label; writes a
  cited `knowledge_notes` row and pre-seeds `interactions` candidates for the `pharmacy/pharmacist`
  to research.
- **Touches**: `medications`, `knowledge_notes`, `interactions`, `check-interactions` hook.
- **Value**: interaction checks are grounded in canonical drug identity, not free-text names; fewer
  misses from "Tylenol" vs "acetaminophen".

## 3.5 Calendar — appointments in/out (P1, Next)

- **Service**: Google Calendar API / Microsoft Graph (Outlook), or a plain `.ics` export.
- **Data flow (out)**: on `appointments` insert, push an event to the user's calendar with the
  visit-brief link in the notes. **(in)**: poll for events tagged/categorised "health" → create
  `appointments`. `.ics` export needs no OAuth (a `getAppointmentIcs` endpoint returns a downloadable
  file) — ship that first.
- **Touches**: `appointments`, `visit_briefs`, `appointment-reminders` hook.
- **Value**: appointments live where the user already looks; the visit brief is one tap away.

## 3.6 Notifications — email / push / Telegram (P0, Now)

- **Service**: the `cloud/` gateway's existing mail path (or Resend/SendGrid), Web Push, or a
  Telegram bot.
- **Data out**: the reminder crons (`dose-reminders`, `followup-reminders`, `appointment-reminders`,
  `daily-digest`) currently only `display()` in-app. Route their output through a `notify` helper
  that sends the actual reminder to the user's channel of choice (persist in `settings`).
- **Touches**: all four reminder hooks, `settings` (channel prefs).
- **Value**: a dose reminder that only shows when you open the app is not a reminder. This is what
  makes adherence tracking real.

## 3.7 Literature sources — already integrated, deepen it (P2, Later)

- **Service**: Tavily `webSearch` (in the runtime) + optionally PubMed E-utilities (keyless REST)
  for structured citations.
- **Flow**: the `clinic/researcher` already searches; add a PubMed fetch in the research hook for
  DOIs/PMIDs so `knowledge_notes` citations are canonical and de-duplicated by identifier. Respect
  `sources.trust` weighting.
- **Touches**: `research`, `knowledge_notes`, `sources`.

## 3.8 Export / backup — the user owns their data (P2, Later)

- A `GET /api/export` (Node handler) that streams the full record as JSON + a printable PDF (reuse
  the `/shares` print styling). Optional push to the user's own storage. Reinforces trust — critical
  for a health product.

---

# 4. Its own agent chat to control the whole application

Today there are five *scoped* `<Chat>` docks, each bolted to one detail page and one specialist.
There is no single place to *drive the app conversationally* — "log my weight", "when's my next
appointment", "prep me a visit brief for Thursday", "show my flagged labs". Propose a new
first-class **Health Assistant**: a persistent, app-wide conversational agent that can read and act
across the whole database, complementing (never duplicating) the specialist docks.

## 4.1 The agent: `care/assistant` (a new coordinator-level agent) (P0, Now)

Add an agent under the existing `care` space (it already owns cross-cutting coordination):

```
spaces/care/agents/assistant/{charter.md,instruct.md}
```

**Charter** (fork-safe identity): *"You are the Health Assistant for lmthing.health. You help the
user navigate and update their own health record through conversation — logging measurements,
answering 'what/when/where' questions about their data, and kicking off the specialists' work. You
never diagnose, prescribe, or give medical advice; for clinical interpretation you defer to the
interpreter, pharmacist, and triage-nurse. You always confirm before creating, changing, or deleting
anything."*

**Capabilities** (frontmatter — this is what makes it *control* the app; enforced at injection, not
prose):

```yaml
capabilities:
  - db:read:  { tables: [metrics, lab_results, symptoms, medications, adherence_logs, interactions,
                appointments, visit_briefs, documents, insights, knowledge_notes, goals, followups,
                care_contacts, care_shares, triage_assessments, research, settings] }   # read everything
  - db:write: { tables: [metrics, symptoms, medications, adherence_logs, appointments, goals,
                followups, care_contacts] }        # direct writes ONLY for low-risk user-owned records
  - api:call                                        # to trigger the pending-row pipelines below
canDelegateTo:
  - clinic/interpreter#interpret
  - clinic/researcher#deep-dive
  - care/triage-nurse#assess
  - care/coordinator#compile
  - pharmacy/pharmacist#review
  - coaching/coach#checkin
```

Deliberate scoping: the assistant can **directly write** the safe, user-authored tables (log a
metric, add a symptom, add a med, confirm a dose, set a goal, add a follow-up, add a care contact).
It does **not** hold `db:write` on the *AI-authored* tables (`insights`, `research`, `interactions`,
`triage_assessments`, `visit_briefs`, `care_shares`, `lab_results.flag`, `knowledge_notes`) — those
are only produced by their owning specialist. To get one of those, the assistant **creates a
`pending` row via `api:call`** (e.g. `requestTriage`, `requestResearch`, `requestVisitBrief`,
`requestShare`, `requestInteractionReview`), which fires the existing db hook and lets the right
specialist do the work. This keeps every clinical artifact authored by exactly one accountable
agent, and the assistant is an orchestrator, not a second author.

## 4.2 The UI: a persistent assistant surface + command palette (P0/P1)

- **Persistent dock (P0)**: a right-side (desktop) / bottom-sheet (mobile) `<Chat agent="care/assistant" />`
  reachable from anywhere via a header "Ask" button. Mirrors the studio THING dock pattern the user
  already knows.
- **Command palette (P1)**: ⌘K opens a hybrid palette — free-text goes to the assistant; typed
  slash-commands (`/log`, `/labs`, `/prep`, `/share`) are deterministic shortcuts. Best of both:
  fast for power users, conversational for everyone else.
- **Result rendering**: the assistant should return **structured results the page renders as cards**,
  not walls of text. When it reads appointments, it emits an appointment card; when it logs a
  metric, it shows the same optimistic row the manual form would. The catalog descriptor renderer
  inside `<Chat>` supports rich component output — reuse `AppointmentCard`, `LabRow`,
  `MedicationRow`, `InsightCard`, etc. so answers look native.

## 4.3 Example conversations

```
User: log weight 81.2 kg and that I slept 6 hours
Assistant: I'll log two measurements:
           • Weight 81.2 kg (today)
           • Sleep 6 h (today)
           [Confirm] [Cancel]
User: [Confirm]
Assistant: Done. Your weight is down 0.8 kg over the last month. ↘  (renders MetricChart card)

User: when's my next appointment and am I ready?
Assistant: Cardiology follow-up with Dr. Lee, next Thursday 2:30pm.
           No prep brief yet — want me to prepare one?  [Prepare brief]
User: yes
Assistant: Requested — the interpreter is compiling it now (~30s). I'll show it here when ready.
           (creates a pending visit_briefs row via requestVisitBrief → prepare-visit-brief hook)

User: what changed in my labs recently?
Assistant: 2 results are outside range: LDL 190 mg/dL (high) and Vitamin D 18 ng/mL (low).
           (renders two LabRows)  Want the interpreter's plain-language read on either?

User: I've had chest tightness climbing stairs
Assistant: That's something I'll pass to triage right away — I don't assess symptoms myself.
           (creates triage_assessments via requestTriage; if red-flag, surfaces the emergency
            banner immediately per §1.4)  ⚠ If it's severe or with shortness of breath, seek care now.
```

## 4.4 Safety & confirmation model (P0 — non-negotiable)

- **Confirm-before-write for every mutation.** The assistant proposes a structured change and the UI
  renders explicit Confirm/Cancel; the write only happens on confirm. Implement via a *two-step*
  pattern: the agent returns a `proposedActions` payload; the page calls the actual endpoint only on
  user confirmation (the agent's `db:write` is used for the commit, but gated behind the UI step).
- **Destructive actions (delete a med, remove an appointment) require typed/explicit confirm** and
  are logged. Prefer *soft* actions where the schema allows (`medications.endedAt`,
  `goals.status:'archived'`, `appointments.status:'cancelled'`) over hard `db.remove`.
- **Never a diagnosis.** Anything clinical is *routed*, not answered: symptom concern → triage;
  "should I stop this drug?" → refuses + points to the clinician and the interaction findings. The
  charter + the capability scoping (no write to clinical tables) enforce this structurally.
- **Disclaimer surfacing** stays on every AI turn; the assistant respects `settings.tier` (offers
  research only when subscribed, exactly like `requestResearch` does today).

## 4.5 How it complements the existing docks (not duplicate)

| Surface | Scope | Owner |
|---|---|---|
| **`care/assistant`** (new) | app-wide read + safe writes + orchestration | navigation, logging, "what/when", kicking off specialists |
| `clinic/interpreter` dock | one lab / the digest | clinical interpretation of results |
| `clinic/researcher` dock | one research report | literature deep-dives |
| `pharmacy/pharmacist` dock | one medication | interactions & adherence |
| `care/triage-nurse` dock | one symptom/question | conservative urgency read |
| `coaching/coach` dock | goals | behaviour-change coaching |

The assistant is the **front door and the router**; the specialists remain the **experts**. A user
never has to know which of five agents to talk to — they talk to the assistant, which either answers
from data it can read or hands off to the right specialist (via `canDelegateTo` or by creating a
`pending` row). This is the single highest-leverage feature in this document.

---

# Consolidated roadmap

### Now (P0) — foundation & the two highest-leverage bets
1. IA regroup: 17 pills → 6 sections + mobile bottom nav (§1.1)
2. Dashboard rebuild: "Needs attention" + "Today's plan" + pinned trends (§1.2)
3. Empty/loading/error/pending states across all list pages (§1.3)
4. Triage safety polish — unmissable urgency + emergency contact (§1.4)
5. Natural-language `quickLog` with confirm-before-write (§2.1)
6. "Explain plainly" inline everywhere (§2.2)
7. Wearable/phone metrics import (Fitbit/Google Fit OAuth + Apple export CSV) (§3.1)
8. File & photo/PDF OCR ingest (§3.3)
9. Real notifications for the reminder crons (§3.6)
10. **The `care/assistant` app-wide agent + persistent dock, with confirm-before-write (§4)**

### Next (P1) — depth
- Longitudinal per-analyte labs view (§1.4); medications adherence-ring card (§1.4); printable shares (§1.4)
- Accessibility & responsive pass (§1.6)
- Correlation/anomaly insight synthesis (§2.3); weekly narrative digest (§2.4)
- Research grounding + dedup via `knowledge_notes` (§2.5); confidence-surfaced extraction review (§2.6)
- FHIR / patient-portal labs & meds import (§3.2); RxNorm/openFDA drug enrichment (§3.4); calendar (§3.5)
- ⌘K command palette (§4.2)

### Later (P2) — polish & completeness
- Micro-interactions, unified `<StatusChip>`, streaming markdown reveal, icon set (§1.5)
- Deepened PubMed citations (§3.7); full data export/backup (§3.8)

---

## Guardrails that constrain every idea above

- **Not medical advice** — observations + citations only; no diagnosis/prescription; clinical
  interpretation stays with the owning specialist agent.
- **Capability model is structural** — the assistant's power is exactly its frontmatter grants;
  clinical tables stay single-author via the pending-row + hook pattern.
- **Design tokens only** in `pages/` (`@lmthing/css`), inline-SVG icons — same hard gate as every
  web surface.
- **Idempotent hooks** — any new db-triggered hook self-queries `pending` rows and self-write-
  excludes, per the pattern every current hook follows.
- **Tiering respected** — deep research stays subscription-gated; safety (triage, reminders) stays free.
</content>
</invoke>
