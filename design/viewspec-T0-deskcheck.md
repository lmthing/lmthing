# T0 — Desk check: 10 shipped pages as v2 view specs

Agent T0, Wave 0, `system-viewbuilder`. Paper exercise, no engine code. Plan:
`design/appbuilder-viewspec-plan.md` (working copy `~/.claude/plans/glowing-enchanting-twilight.md`),
sections "Context", "B1. Spec schema", "T0 — Desk check".

Everything below was derived by reading each page in full, every endpoint it calls (Input/Output
contracts), and the components it imports. Every claim cites a real file.

---

## 0. Headline

| question | answer |
|---|---|
| **GO / NO-GO** | **GO — conditional.** Passes the express-rate and (c) clauses; **misses the "≤2 new schema features" clause** (needs 3 view-schema features + 1 endpoint-contract annotation). |
| pages expressing cleanly | **9 / 10** (bar: ≥7) |
| pages landing in (c) out-of-scope | **1 / 10** — `homes/searches/[searchId]/compare.tsx` (bar: ≤1) |
| new schema features required | **4** (bar: ≤2) — `list.from`, `poll`, `onSuccess.navigate`, form-field `options` |
| 8th section kind | **`timeline`** — confirmed, 2 pages demand it, 3 more want it |
| client-side transforms audited | **31**; 26 move to an endpoint Output field or a renderer built-in, 2 are pre-accepted losses, **3 cannot move** |
| archetype predictions correct | **4 / 10 exact, 3 partial, 3 fall through all five archetypes** |
| derived app shell == hand-written nav | **0 / 5 apps** — see §5, this is the biggest single prediction finding |

---

## 1. Per-page summary table

| # | page (actual path under `store/projects/`) | section kinds used | new features needed | verdict | flat `item` or component tier | predicted archetype | shipped layout | match? |
|---|---|---|---|---|---|---|---|---|
| 1 | `homes/pages/new.tsx` | `create` | `onSuccess.navigate` | **(b)** | n/a (no list) | **form page** | centered `max-w-2xl` form | ✅ exact |
| 2 | `kitchen/pages/index.tsx` | `stats`×2, `list`, `detail`, `create`×2, `chat`, **`timeline`** | `list.from`, `poll`, `options` | **(b)** w/ 2 losses | component tier (TonightCard, SuggestionCard) | **dashboard** | single-column stack, hero FIRST, stats 4th | ⚠️ partial — predictor reorders |
| 3 | `trips/pages/trips/[tripId]/expenses.tsx` | `create`, `list`×3 | `options` | **(b)** | flat `item` | *(falls through)* | stacked `max-w-3xl` | ❌ no rule for create+list |
| 4 | `blog/pages/feed/[articleId].tsx` | `detail`, `markdown`, `list`×3, `create`, `toolbar` | `list.from`, `poll` | **(b)** | flat `item` ok, component nicer | **detail page** | detail + sticky right rail (2-col) | ⚠️ partial — no rail archetype |
| 5 | `health/pages/medications/[id].tsx` | `detail`, `list`×2, `chat` | `list.from` | **(b)** — cleanest | flat `item` | **detail page** | `max-w-2xl` header + 3 sub-sections + Chat | ✅ exact |
| 6 | `homes/pages/searches/[searchId]/inbox.tsx` | `toolbar`, `create`×2, `list`×2, `chat` | `list.from`, `poll` | **(b)** | flat `item` | *(falls through)* | stacked `max-w-3xl` | ❌ no fallback stated |
| 7 | `blog/pages/preferences.tsx` | `create`×3, `list`×2, `stats` | — (download gap) | **(b)** | flat `item` | *(falls through)* | stacked `max-w-2xl` | ❌ no fallback stated |
| 8 | `kitchen/pages/recipes/index.tsx` | `toolbar`, `create`×3, `list` | **none** | **(b)** — zero-cost | flat `item` | **list page** | toolbar + facet chips + cards grid | ✅ exact |
| 9 | `trips/pages/trips/[tripId]/timeline.tsx` | `stats`×2, `toolbar`, `create`×2, **`timeline`**, `list` | `poll`, `list.from` | **(a) — earns the 8th slot** | component tier (ItineraryCard) | **detail page** | `max-w-3xl` tabs + stack | ✅ exact-ish |
| 10 | `homes/pages/searches/[searchId]/compare.tsx` | — | *(unbuildable)* | **(c) out of scope** | — | *(falls through)* | 2-col picker + wide table | ❌ |

---

## 2. Page-by-page specs and findings

### P1 — `homes/pages/new.tsx` (440-line wizard, AI prefill, array-of-object rows)

Endpoints: `createSearch` (`homes/api/searches/POST.ts`), `extractSearchBrief`
(`homes/api/searches/extract-brief/POST.ts`).

**The single most important finding on this page is a positive one:** `extractSearchBrief`'s `Output`
is field-for-field a subset of `createSearch`'s `Input` (`mode, area, budgetMax, currency, minRooms,
minAreaSqm, mustHaves: string[], commuteTargets: {label,address,mode,maxMinutes}[]`). The plan's
`prefill{endpoint, from, merge:'fill-empty'}` was designed for exactly this and lands on it exactly.
The whole 440 lines collapse to one section.

```ts
{
  route: '/new',
  title: 'Start a new search',
  sections: [
    {
      kind: 'create',
      id: 'newSearch',
      mutation: 'createSearch',                 // fields derived from Input, never declared
      prefill: {
        endpoint: 'extractSearchBrief',
        from: { brief: '$form.brief' },          // button-triggered, best-effort
        merge: 'fill-empty',
      },
      submitLabel: 'Start the hunt',
      invalidates: ['searchList'],
      onSuccess: { navigate: '/searches/$result.id/inbox' },   // ← NEW FEATURE
    },
  ],
}
```

**Client-side transforms and where they go**

| transform in TSX | destination |
|---|---|
| `mustHaves.split(',').map(trim).filter(Boolean)` (L112-115) | renderer built-in — array-of-string form control from the Input schema |
| `commuteTargets` repeating rows + add/remove + `Number(maxMinutes)` (L92-96, L116-123) | renderer built-in — **array-of-object repeater** (B2 already commits to this; this page is its acceptance test) |
| `Number(budgetMax)`, `budgetMin ? Number(...) : undefined` (L107-111) | Input-schema coercion |
| `.trim() \|\| undefined` on every optional (L106-110) | Input-schema policy: empty optional string ⇒ omitted |
| per-field merge policy (mode/currency overwrite, budget/area fill-empty, mustHaves union, commuteTargets dedupe-by-label) (L58-83) | `merge: 'fill-empty'` covers 4/8 exactly. The other 4 degrade. **Not a required feature** — the page's own comment says "Fills fields the user hasn't already set", so `fill-empty` is the *stated* intent; the overwrite/union behaviours are drift. |
| `navigate('/searches/${res.id}/inbox')` (L125) | **cannot move — needs `onSuccess.navigate`** |
| 4 titled fieldsets ("What are you looking for", "Budget & basics", …) | **cosmetic loss** — derived forms have no grouping. Cheap relief: derive field order from JSON-Schema property order; optional `groups: [{title, fields}]` later. |
| `mode === 'rent' ? 'Max monthly budget' : 'Max price'` (L236) | **deliberate loss** — no conditionals by design. Static "Max budget". |

**Verdict (b)** — reshapes into one `create`. **Flat form; no component tier.**
**Archetype: `create-only` ⇒ form page. Shipped: `mx-auto max-w-2xl` centered form. Exact match.**

---

### P2 — `kitchen/pages/index.tsx` (the hardest: 5 queries, 2 dependent, 9 mutations)

Endpoints: `kitchenStats`, `currentPlan`, `listSuggestions`, `planCoverage`(dep), `getPlanNutrition`(dep);
mutations `dismissSuggestion, generatePlan, removeMeal, rateMeal, markCooked, addMeal, updateMeal,
seedStarterRecipes` (+ `improvise` via `ImprovisePanel`).

```ts
{
  route: '/',
  sections: [
    { kind: 'list', id: 'suggestions', query: 'listSuggestions', limit: 3, layout: 'rows',
      item: { use: 'SuggestionCard', props: { s: '$' } },
      rowAction: { mutate: 'dismissSuggestion', input: { id: '$.id' }, label: 'Dismiss' },
      empty: null },

    { kind: 'detail', id: 'tonight', query: 'currentPlan',
      input: { tz: '$client.timezone' },              // client tz as an endpoint param (plan §B1)
      poll: { everyMs: 4000, while: { field: '$.plan.status', in: ['planning'] } },   // ← NEW
      header: { use: 'TonightCard', props: { meal: '$.tonight' } } },  // $.tonight = NEW Output field

    { kind: 'stats', id: 'coverage', query: 'planCoverage',
      input: { id: '$data.currentPlan.plan.id' },      // dependent query (already in B1's budget)
      cards: [ { label: 'Cookable from pantry', value: '$.cookablePct', meter: { max: 100 }, format: 'number' },
               { label: 'To buy', value: '$.itemsToBuy' } ] },

    { kind: 'stats', id: 'kitchenStats', query: 'kitchenStats',
      cards: [ { label: 'Recipes', value: '$.recipes' }, { label: 'Pantry items', value: '$.pantryItems' },
               { label: 'Low stock', value: '$.lowStock' }, { label: 'Planned meals', value: '$.plannedMeals' },
               { label: 'Shopping gaps', value: '$.shoppingGaps' } ] },

    { kind: 'create', id: 'improvise', mutation: 'improvise', async: { note: 'The chef is improvising…', refetchAfter: 2500 } },

    { kind: 'timeline', id: 'week', from: '$data.currentPlan.plan.days',   // ← NEW (list.from), 8th kind
      group: '$.day', groupFormat: 'date',
      item: { title: '$.recipe.title', time: '$.meal', detail: '$.rationale',
              actions: [ { mutate: 'markCooked', input: { id: '$.id' }, label: 'Cooked' },
                         { mutate: 'removeMeal', input: { id: '$.id' }, label: 'Remove' } ] },
      empty: { title: 'No plan yet for this week',
               actions: [ { mutate: 'generatePlan', label: 'Plan this week' },
                          { mutate: 'seedStarterRecipes', label: 'Seed starter recipes' } ] } },

    { kind: 'create', id: 'addMeal', mutation: 'addMeal',
      input: { planId: '$data.currentPlan.plan.id' },
      invalidates: ['currentPlan', 'kitchenStats', 'planCoverage'] },

    { kind: 'chat', agent: 'kitchen/chef' },
  ],
}
```

**Client-side transforms and where they go**

| transform | destination |
|---|---|
| `pickTonight()` — today's dinner else next upcoming else first, using client `todayIso()` (L38-55) | **endpoint Output**: `currentPlan` grows `tonight`; client tz passes as an endpoint param (plan already commits to this) |
| `planNutrition.days.find(d => d.day === tonight.day)` — **cross-query join** (L97-98) | **endpoint Output**: fold macros into `currentPlan.tonight.macros`; kills one dependent query |
| `plan.meals.filter(m => m.meal==='dinner').length` (L99) | **endpoint Output**: `planCoverage.dinnersPlanned` (it already returns `mealsPlanned`/`mealsTarget`) |
| `suggestions.slice(0,3)` (L95) | `limit: 3` built-in ✅ |
| `formatDay(plan.weekStart)` (L187) | `format: 'date'` built-in ✅ |
| `PlanProgress` pct = planned/target (component L28) | `meter` element with `max` binding ✅ |
| `noRecipes = stats.recipes === 0` selecting between two empty states (L100, L161-182) | **no conditionals.** Collapses to ONE empty state offering both actions. Acceptable loss. |
| `setInterval(refetch, 4000)` while `plan.status === 'planning'` (L102-106) | **cannot move — needs `poll`** |
| `cookedOptimistic` local state (L93, L129-133) | **pre-accepted loss** (plan names it: per-row pending treatment) |
| `RecipePicker` modal carrying `(day, slot)` from a clicked empty cell into `addMeal` (L91, L203-213) | **cannot express** — click-context-carrying modal. Reshapes to a plain `create` on `addMeal` with day/meal as form fields. Its `recipeId` field needs **form-field `options`** or it becomes a UUID text box. |
| `WeekGrid` day × meal-slot matrix + **drag-to-reschedule** (`updateMeal`) | drag-and-drop is a **named deliberate exclusion** in the plan. The matrix reshapes to a day-grouped `timeline`. Recorded quality loss on web; note the shipped grid is `min-w-[640px]` with horizontal scroll — **on a phone the timeline is better**, which is the target that matters most here. |

**Verdict (b)** with two recorded losses (week matrix ⇒ day-grouped timeline; optimistic cook).
**Needs the component tier** — `TonightCard` (image + title + prep time + macros + 2 actions + rating)
and `SuggestionCard` (icon + type label + title + body + dismiss) are exactly the `{use, props}` case.

**Archetype: predicted `dashboard` (stats strip on top, responsive grid below). Shipped: a single-column
`max-w-4xl` stack, hero card FIRST, stats strip FOURTH.**
⚠️ **Finding — the archetype must never reorder sections.** Section order is authored (it is the array
order); a "dashboard = stats on top" heuristic that reorders will fight every hand-designed page and
will bury the one card the user actually opened the app for. Recommendation: **archetypes govern
container width / grid / responsive collapse only, never order.**

---

### P3 — `trips/pages/trips/[tripId]/expenses.tsx`

Endpoints: `listExpenses` → `{expenses}`, `listTravelers` → `{travelers}`, `addExpense`, `removeExpense`.

```ts
{
  route: '/trips/:tripId/expenses',
  sections: [
    { kind: 'create', id: 'addExpense', mutation: 'addExpense', input: { id: '$route.tripId' },
      fields: { paidByTravelerId: { options: { query: 'listTravelers', input: { id: '$route.tripId' },
                                               label: '$.name', value: '$.id' } } },   // ← NEW
      invalidates: ['listExpenses', 'tripFinances', 'settlement'] },

    { kind: 'list', id: 'expenses', query: 'listExpenses', input: { id: '$route.tripId' },
      from: '$.expenses', layout: 'rows',
      item: { title: '$.description', badge: '$.category', caption: '$.paidByName',
              value: '$.amount', format: 'currency', suffix: '$.currency' },
      rowAction: { mutate: 'removeExpense', input: { id: '$.id' }, label: 'Remove' },
      empty: { title: 'No expenses yet. Add one above.' } },

    { kind: 'list', id: 'byCategory', query: 'listExpenses', input: { id: '$route.tripId' },
      from: '$.totalsByCategory', title: 'By category', layout: 'rows',
      item: { title: '$.category', value: '$.total', format: 'currency' } },

    { kind: 'list', id: 'byPayer', query: 'listExpenses', input: { id: '$route.tripId' },
      from: '$.totalsByPayer', title: 'By payer', layout: 'rows',
      item: { title: '$.payerName', value: '$.total', format: 'currency' } },
  ],
}
```

| transform | destination |
|---|---|
| `travelerName(id)` — **cross-query join** expense→traveler (L27, L182, L205) | **endpoint Output**: `listExpenses` returns `expenses[].paidByName`. One line in the handler; textbook view-shaped-endpoint. |
| `byCategory` Map-reduce + sort (L33-39) | **endpoint Output**: `listExpenses.totalsByCategory` |
| `byPayer` Map-reduce + sort desc (L41-48) | **endpoint Output**: `listExpenses.totalsByPayer` |
| `amount.toFixed(2)` (L194) | `format: 'currency'` built-in ✅ |
| `paidByTravelerId` `<select>` populated from `listTravelers` (L143-155) | **cannot move — needs form-field `options`.** `addExpense.Input.paidByTravelerId` is a bare `string`; without options the user types a UUID and the whole settlement feature (this app's centrepiece) breaks. |
| `currency.trim().toUpperCase()` (L134) | dropped; the handler already defaults currency from the trip |
| form reset after submit (L63-67) | renderer default |

**Verdict (b)** — clean **conditional on form-field `options`**. **Flat `item` sufficient.**
**Archetype: falls through all five.** `create + several lists on the same entity` is one of the
commonest real page shapes in this catalog (5 of my 10 pages) and the predictor has no rule for it.
Recommended heuristic: **`create + list on the same entity ⇒ list page, the create rendered as a
collapsible header form`** — literally what `kitchen/recipes/index.tsx` hand-builds.

---

### P4 — `blog/pages/feed/[articleId].tsx`

Endpoints: `getArticle` (Output includes `citations[]`), `listAnnotations`, `addAnnotation`,
`removeAnnotation`, `saveArticle`, `markRead`, `logReadingEvent`, `getTakes`/`requestTake`,
`listCollections`/`addToCollection`.

```ts
{
  route: '/feed/:articleId',
  sections: [
    { kind: 'detail', id: 'article', query: 'getArticle', param: 'articleId',
      header: { image: '$.imageUrl', title: '$.title', caption: '$.createdAt', captionFormat: 'relative-time',
                chips: { each: '$.tags', text: '$', navigate: '/tag/$' } },
      actions: [ { mutate: 'saveArticle', input: { id: '$.id' }, label: 'Save' },   // toggle: server-side
                 { navigate: '/feed/$.id/research', label: 'Deep dive & fact-check' } ] },

    { kind: 'markdown', query: 'getArticle', param: 'articleId', source: '$.body' },

    { kind: 'list', id: 'citations', query: 'getArticle', param: 'articleId',
      from: '$.citations', title: 'Sources',                       // ← NEW (list.from)
      item: { quote: '$.quote', link: '$.url', text: '$.label' } }, // $.label = NEW computed Output field

    { kind: 'toolbar', id: 'takes',
      actions: [ { mutate: 'requestTake', input: { id: '$route.articleId', kind: 'tldr' }, label: 'TL;DR' },
                 { mutate: 'requestTake', input: { id: '$route.articleId', kind: 'eli5' }, label: 'Explain simply' },
                 { mutate: 'requestTake', input: { id: '$route.articleId', kind: 'why-me' }, label: 'Why this matters' } ] },

    { kind: 'markdown', id: 'takeBody', query: 'getTakes', param: 'articleId', source: '$.0.body',
      poll: { everyMs: 2500, while: { field: '$.status', in: ['pending'] } } },      // ← NEW (poll)

    { kind: 'create', id: 'addAnnotation', mutation: 'addAnnotation', input: { id: '$route.articleId' },
      invalidates: ['listAnnotations'] },

    { kind: 'list', id: 'annotations', query: 'listAnnotations', param: 'articleId', layout: 'rows',
      item: { quote: '$.quote', caption: '$.note' },
      rowAction: { mutate: 'removeAnnotation', input: { id: '$.id' }, label: 'Remove' },
      empty: { title: 'No annotations yet. Highlight a passage above.' } },

    { kind: 'list', id: 'collections', query: 'listCollections', title: 'Add to collection', layout: 'rows',
      item: { title: '$.title' },
      rowAction: { mutate: 'addToCollection', input: { id: '$.id', articleId: '$route.articleId' }, label: 'Add' } },
  ],
}
```

| transform | destination |
|---|---|
| `Array.isArray(article.tags) ? … : []` (L93) | renderer default (null/non-array binding ⇒ omitted) |
| `relativeTime(createdAt)` (L120) | `format: 'relative-time'` ✅ |
| citation label `c.title \|\| c.source \|\| hostLabel(c.url) \|\| c.url` — 4-way coalesce + URL host parse (L149) | **endpoint Output**: `getArticle` computes `citations[].label` |
| `apiCall('markRead')` on mount (L58-63) | **endpoint layer**: `getArticle` marks read as a side effect of the read. Zero view features. Worth codifying: **view-time side effects belong in the read endpoint.** |
| dwell timer + `pagehide` → `logReadingEvent(dwellMs)` (L67-81) | **CANNOT MOVE.** No clock, no lifecycle hook, no expressions. The dwell signal is **dropped** (the getArticle side effect still records "opened"). Degrades the personalizer's input; does not brick the page. |
| `saveArticle.mutate({ saved: !article.saved })` — boolean **negation** of bound data (L239) | **endpoint layer**: make `saveArticle` a toggle when `saved` is omitted. 2-line handler change. **The viewbuilder's endpoint-planning node must be told this rule** — it is a prompt requirement, not a schema one. Same shape recurs on pin/dismiss/read across all 5 apps. |
| `article.saved ? 'Saved' : 'Save'` + variant swap (L240-247) | **deliberate loss**; state shown as a separate `badge` |
| `AddToCollectionMenu` popover with per-row add + "✓ Added" local state | reshapes to an inline `list` + `rowAction`; the popover-ness and the optimistic ✓ are lost (pre-accepted) |
| `ArticleTakes` polling while `status === 'pending'` | **needs `poll`** (2nd occurrence) |

**Verdict (b).** **Flat `item` works; a component would be nicer for the annotation row.**
**Archetype: `detail + related lists ⇒ detail page`. Shipped: `grid lg:grid-cols-[1fr_20rem]` — a main
column plus a sticky right rail.** ⚠️ No archetype produces a main+rail split (`master-detail` is a
different thing: list+detail on the same data). The rail collapses under the body. Note this loss is
**web-only** — the shipped page is already single-column on a phone, so **the native target loses
nothing**, which is a point in the plan's favour.

---

### P5 — `health/pages/medications/[id].tsx` — the cleanest fit

Endpoint: `getMedication` → `Medication & { doses: AdherenceLog[]; interactions: Interaction[] }`;
mutation `checkInteractions`.

```ts
{
  route: '/medications/:id',
  sections: [
    { kind: 'detail', id: 'med', query: 'getMedication', param: 'id',
      header: { title: '$.name', badge: '$.statusLabel', tone: 'auto' },   // statusLabel = NEW Output field
      keyvalue: [ { label: 'Dose', value: '$.dose' }, { label: 'Schedule', value: '$.schedule' },
                  { label: 'Started', value: '$.startedAt', format: 'date' },
                  { label: 'Ended', value: '$.endedAt', format: 'date' },
                  { label: 'Refills remaining', value: '$.refillsRemaining' },
                  { label: 'Daily reminder', value: '$.reminderTime' },
                  { label: 'Note', value: '$.note' } ],
      actions: [ { navigate: '/medications', label: '← All medications' } ] },

    { kind: 'stats', id: 'adherence', query: 'getMedication', param: 'id', title: 'Adherence',
      cards: [ { label: 'Adherence', value: '$.adherence.pct', meter: { max: 100 }, tone: 'auto',
                 caption: '$.adherence.caption' } ] },       // adherence = NEW Output field

    { kind: 'list', id: 'interactions', query: 'getMedication', param: 'id',
      from: '$.interactions', title: 'Interactions', layout: 'rows',   // ← NEW (list.from)
      item: { title: '$.otherName', badge: '$.severity', tone: 'auto', body: '$.body', status: '$.status' },
      empty: { title: 'No interaction findings yet',
               message: 'Run "Check interactions" and the pharmacist will screen this against your others.' } },

    { kind: 'toolbar', actions: [ { mutate: 'checkInteractions', input: { medicationId: '$route.id' },
                                    label: 'Check interactions' } ] },

    { kind: 'chat', agent: 'pharmacy/pharmacist',
      suggestions: ['Explain this interaction in plain language.'] },   // chat.suggestions — LOW-cost add
  ],
}
```

| transform | destination |
|---|---|
| `AdherenceBar`: `taken/total → pct`, 3 colour thresholds (80/50) | **endpoint Output**: `adherence: {taken, total, pct, caption}`; render as `meter` + `tone:'auto'` |
| `ongoing = !medication.endedAt` — **negation** (component L6) | **endpoint Output**: `statusLabel: 'ongoing' \| 'ended'` |
| `${dose} · ${schedule}` string concat (component L20-23) | `keyvalue` with two rows (better UI anyway) |
| `interactions.map(i => i.status==='pending' ? <AIWorking/> : <InteractionCard/>)` — per-row conditional render (L84-90) | **no conditionals.** Row shows a `badge` bound to `$.status`, `tone:'auto'` ⇒ "pending". Same class as the plan's pre-accepted per-row pending loss. |
| `ExplainPlainly` prompt seed | `chat.suggestions` — one optional field, cosmetic |

**Verdict (b) — cleanest of the ten. Only `list.from` needed.** **Flat `item` sufficient.**
**Archetype: `detail + related lists ⇒ detail page`. Shipped: `max-w-2xl`, header block, three bordered
sub-sections, Chat at the bottom. Exact match — the best archetype hit in the set.**

---

### P6 — `homes/pages/searches/[searchId]/inbox.tsx`

Endpoints: `getSearch` → `{…, sources[]}`, `listCaptures`, `ingestCapture`, `addSource`, `updateSource`,
`pollSource`.

```ts
{
  route: '/searches/:searchId/inbox',
  sections: [
    { kind: 'create', id: 'ingest', mutation: 'ingestCapture', input: { id: '$route.searchId' },
      submitLabel: 'Ingest', invalidates: ['listCaptures'] },

    { kind: 'toolbar', actions: [ { reveals: 'addSource', label: '+ Add source' } ] },
    { kind: 'create', id: 'addSource', hidden: true, mutation: 'addSource',
      input: { id: '$route.searchId' }, invalidates: ['getSearch'] },

    { kind: 'list', id: 'sources', query: 'getSearch', param: 'searchId', from: '$.sources',   // ← list.from
      title: 'Sources', layout: 'rows',
      item: { title: '$.label', badge: '$.kind', caption: '$.url',
              note: '$.blockedNote',                          // null ⇒ omitted (renderer semantics)
              meta: '$.lastPolledAt', metaFormat: 'date',
              actions: [ { mutate: 'pollSource', input: { id: '$.id' }, label: 'Check now',
                           enabled: '$.pollable' } ] },        // enabled: — LOW-cost add
      empty: { title: 'No sources yet — paste something above, or add one.' } },

    { kind: 'list', id: 'captures', query: 'listCaptures', param: 'searchId', layout: 'rows',
      title: 'Captures',
      poll: { everyMs: 3000, while: { field: '$.status', in: ['pending','parsing'] } },   // ← poll
      item: { badge: '$.status', tone: 'auto', meta: '$.capturedAt', metaFormat: 'date',
              body: '$.content', note: '$.error', markdown: '$.summary',
              actions: [ { mutate: 'ingestCapture',
                           input: { id: '$route.searchId', content: '$.content' }, label: 'Retry parsing' } ] },
      empty: { title: 'No captures yet.' } },

    { kind: 'chat', agent: 'intake/clipper' },
  ],
}
```

| transform | destination |
|---|---|
| `polling = captures.some(c => status ∈ {pending,parsing})` → `refetchInterval` (L47-49) | **needs `poll`** (3rd occurrence). Note the predicate is over a LIST's rows, so `poll.while` must mean "any row (or the object) matches". |
| `blockedSources = sources.filter(s => s.blockedReason)` then `.map().join(' · ')` into a banner (L107, L128-139) | **endpoint Output**: `getSearch.blockedSourcesNote: string \| null`; render a `banner` bound to it |
| `s.kind === 'saved_search' ? <poll controls> : null` — per-row conditional controls (L290-312) | **endpoint Output** `sources[].pollable: boolean` + **`enabled: '$.field'`** modifier on the action. Bound boolean ⇒ disabled — same class as the plan's own "unresolved binding means disabled". |
| checkbox toggling `pollEnabled` — **negation** (L296-298) | **endpoint layer**: make `updateSource` toggle when the field is omitted |
| `formatDateTime(lastPolledAt)` (L320) | `format: 'date'` ✅ |
| `showAddSource` toggle (L19, L189, L196) | **`toolbar.reveals` — exact fit.** This page is the toolbar kind earning its slot. |
| retry passing the failed capture's own `content` back to `ingestCapture` (L98-104) | `rowAction` with `input: {content: '$.content'}` ✅ |
| `SearchTabs` count badge = pending captures (L113-118) | **endpoint Output** count field; and see §5 (sub-nav is not covered by the derived shell) |
| `CaptureRow`'s decorative "segmenting → extracting → …" step strip | dropped — pure decoration |

⚠️ **Required renderer semantics surfaced here: a bound element whose binding resolves to null/empty
renders NOTHING.** Without that stated default, every spec page fills with empty chrome (empty
banners, blank captions, orphan labels). It is also what makes `empty` coherent. Not a feature — a
semantics line the schema must state.

**Verdict (b).** **Flat `item` sufficient.**
**Archetype: falls through all five** (create + 2 lists + chat, no stats, not a single list, not a
detail). ⚠️ **The plan lists five archetypes and no default.** The right answer here is a plain
stacked page — which is exactly what the shipped page is (`max-w-3xl` vertical stack). Recommend
**`stack` as the explicit fallback archetype** so the predictor degrades to correct rather than to
mispredicted.

---

### P7 — `blog/pages/preferences.tsx`

Endpoints: `listSources`, `getSettings`/`updateSettings`, `sourceHealth`, `addSource`, `removeSource`,
`importOpml`, `exportOpml`, `ingestRss`.

```ts
{
  route: '/preferences',
  title: 'Preferences',
  sections: [
    { kind: 'stats', id: 'tier', query: 'getSettings',
      cards: [ { label: 'Tier', value: '$.tier' },
               { label: 'Weekly budget', value: '$.weeklyBudgetUsd', format: 'currency' },
               { label: 'Max free sources', value: '$.maxFreeSources' } ] },

    { kind: 'create', id: 'addSource', mutation: 'addSource', title: 'Add source',
      invalidates: ['listSources'] },

    { kind: 'create', id: 'importOpml', mutation: 'importOpml', title: 'Import (OPML)',
      async: { note: 'Importing your feeds…', refetchAfter: 2000 }, invalidates: ['listSources'] },

    { kind: 'create', id: 'delivery', mutation: 'updateSettings', title: 'Newsletter delivery',
      prefill: { endpoint: 'getSettings', merge: 'fill-empty' },   // prefill-on-mount, no `from`
      invalidates: ['getSettings'] },

    { kind: 'list', id: 'sources', query: 'listSources', title: 'Sources', layout: 'rows',
      item: { title: '$.label', caption: '$.value', badge: '$.kind',
              meta: '$.lastFetchedAt', metaFormat: 'relative-time',
              actions: [ { mutate: 'ingestRss', input: { id: '$.id' }, label: 'Fetch now' },
                         { mutate: 'removeSource', input: { id: '$.id' }, label: 'Remove' } ] },
      empty: { title: 'No sources yet',
               message: 'Add an RSS feed or a search query above, or import an OPML file.' } },

    { kind: 'list', id: 'health', query: 'sourceHealth', title: 'Source health', layout: 'rows',
      item: { title: '$.source.label', badge: '$.healthLabel', tone: 'auto',
              value: '$.successRate', meter: { max: 1 }, format: 'number',
              caption: '$.lastError' },
      empty: { title: 'No source health data yet.' } },
  ],
}
```

| transform | destination |
|---|---|
| `useEffect(() => setEmail(settings.deliveryEmail))` — seed a form from a query (L43-45) | **`prefill` with no `from`** = seed on mount from the endpoint's Output by matching field names. ⚠️ **Required semantics, not a feature** — but **5/5 catalog apps have a settings page**, so if the schema doesn't allow it, every settings page in every generated app breaks. |
| `${tier} · $${weeklyBudgetUsd} · Max free sources: ${n}` interpolated line (L128-132) | `stats`/`keyvalue` with 3 rows ✅ (better anyway) |
| `SourceHealthBar.resolveHealth` — 3-way threshold classification from `lastStatus`/`errorCount`/`successRate` | **endpoint Output**: `healthLabel`; render `badge tone:'auto'` + `meter` |
| `onExport` — build a Blob, synthesize an `<a download>`, click it (L75-88) | **CANNOT MOVE.** No download primitive; specs name endpoints, never URLs. → **feature #5 candidate: `action: { download: 'exportOpml', filename: … }`.** Not load-bearing for this page's job (import still works). |
| `ingestStatus` per-row transient "+3 new" from a per-row `apiCall` (L90-108) | reshapes to per-row pending + list refetch showing the real `lastFetchedAt`. Arguably better. |
| `importMsg` (L64-72) | `async.note` ✅ |
| `/402\|upgrade/i.test(error.message)` — regex on an error to show a friendlier message (L169-171) | **endpoint layer**: the handler returns the human message |

**Verdict (b)** — no *required* new feature; the OPML export is the download gap.
**Flat `item` sufficient. Archetype: falls through** (3 creates + 2 lists). Shipped: stacked
`max-w-2xl`. Fallback `stack` again.

---

### P8 — `kitchen/pages/recipes/index.tsx` (independent re-check of the plan's own control)

Endpoint: `listRecipes(tag?)`; mutations `addRecipe`, `importRecipe`, `importRecipeText`.

```ts
{
  route: '/recipes',
  title: 'Recipes',
  sections: [
    { kind: 'toolbar',
      actions: [ { reveals: 'addRecipe', label: 'Add recipe', icon: 'plus' },
                 { reveals: 'importUrl', label: 'Import from URL', icon: 'download' },
                 { reveals: 'importPaste', label: 'Paste', icon: 'clipboard' } ] },

    { kind: 'create', id: 'addRecipe',    hidden: true, mutation: 'addRecipe',        invalidates: ['listRecipes'] },
    { kind: 'create', id: 'importUrl',    hidden: true, mutation: 'importRecipe',     invalidates: ['listRecipes'],
      async: { note: 'Import started — the importer is working in the background.', refetchAfter: 2500 } },
    { kind: 'create', id: 'importPaste',  hidden: true, mutation: 'importRecipeText', invalidates: ['listRecipes'],
      async: { note: 'Extracting your recipe — it will appear here shortly.', refetchAfter: 2500 } },

    { kind: 'list', id: 'recipes', query: 'listRecipes', layout: 'cards',
      facet: { field: '$.tags', input: 'tag', allLabel: 'All' },
      item: { image: '$.imageUrl', title: '$.title', caption: '$.description',
              meta: '$.prepMinutes', metaSuffix: ' min', chips: '$.tags' },
      rowAction: { navigate: '/recipes/$.id' },
      empty: { title: 'No recipes yet. Add, import, or paste one to get started.',
               action: { navigate: '/', label: 'Or seed starter recipes from the Cook tab →' } } },
  ],
}
```

| transform | destination |
|---|---|
| `allTags = unique(flatMap(r.tags)).sort()` (L29-31) | **`facet` built-in** — but note two semantics it must have: (i) facet over an **array-valued** field; (ii) the facet maps to a **query input** (`listRecipes({tag})` re-queries the server), not a client filter — which is the only correct behaviour once `limit` exists. Clarification, not a feature. |
| `tagsInput.split(',')` (L40) | array-of-string form control ✅ |
| 3-way `mode` state showing one of three forms (L10, L51-64) | **`toolbar.reveals` — exact fit**, mutually exclusive as a renderer default |
| `setTimeout(() => refetch(), 2500)` after a background import (L122, L146) | **`async{note, refetchAfter}` — exact fit.** The plan's own feature, confirmed against real shipped code. |
| cards grid `sm:2 lg:3` (L208) | `layout:'cards'` + archetype responsive ✅ |

**Verdict (b) — expresses with ZERO new features.** Independent re-check confirms the plan's desk check.
**Flat `item` sufficient — `RecipeCard` (image, title, prep time, tag chips, link) needs no component tier.**
**Archetype: `single list (+toolbar) ⇒ list page`. Shipped: toolbar row, facet chips, cards grid,
`max-w-4xl`. Exact match.**

---

### P9 — `trips/pages/trips/[tripId]/timeline.tsx` (known-bespoke #1)

Endpoint: `getTrip` → `{…, destinations: [{…, items: ItineraryItem[]}], bookings[]}`; mutations
`addDestination`, `addBooking`, `refreshWeather`; `tripCalendar` (.ics).

```ts
{
  route: '/trips/:tripId/timeline',
  sections: [
    { kind: 'detail', id: 'trip', query: 'getTrip', param: 'tripId',
      poll: { everyMs: 4000, while: { field: '$.status', in: ['planning'] } },        // ← poll
      header: { title: '$.title', caption: '$.brief', badge: '$.status' },
      actions: [ { mutate: 'refreshWeather', input: { id: '$route.tripId' }, label: 'Weather' } ] },

    { kind: 'stats', id: 'budget', query: 'tripBudget', param: 'tripId',
      cards: [ { label: 'Spent', value: '$.spent', format: 'currency', meter: { max: '$.budget' } },
               { label: 'Budget', value: '$.budget', format: 'currency' } ] },

    { kind: 'toolbar', actions: [ { reveals: 'addDest',    label: 'Add destination' },
                                  { reveals: 'addBooking', label: 'Add booking' } ] },
    { kind: 'create', id: 'addDest',    hidden: true, mutation: 'addDestination', input: { id: '$route.tripId' },
      invalidates: ['getTrip'] },
    { kind: 'create', id: 'addBooking', hidden: true, mutation: 'addBooking',     input: { tripId: '$route.tripId' },
      invalidates: ['getTrip', 'tripBudget', 'tripFinances'] },

    { kind: 'timeline', id: 'itinerary', query: 'getTrip', param: 'tripId',
      from: '$.days', title: 'Itinerary',                       // $.days = NEW computed Output field
      group: '$.day', groupFormat: 'date',
      item: { use: 'ItineraryCard', props: { item: '$' } },
      itemTime: '$.startTime', itemEndTime: '$.endTime',
      itemNote: '$.conflictNote',                               // null ⇒ omitted
      empty: { title: 'No destinations yet',
               action: { navigate: '/trips/$route.tripId/plan', label: 'Refine in chat' } } },

    { kind: 'list', id: 'bookings', query: 'getTrip', param: 'tripId', from: '$.bookings',
      title: 'Bookings', layout: 'rows',
      item: { title: '$.provider', badge: '$.kind', caption: '$.confirmation',
              value: '$.cost', format: 'currency' },
      empty: { title: 'No bookings yet' } },

    { kind: 'chat', agent: 'travel/copilot' },
  ],
}
```

| transform | destination |
|---|---|
| `groupByDay(items)` — day-keyed groups, sorted (L24-35) | **endpoint Output** `getTrip.days: [{day, destinationName, items[]}]` (the handler already sorts items by day+startTime) — then the `timeline` kind renders it |
| `DayTimeline`: split timed vs "anytime" items by `startTime` presence (component L29-33) | `timeline` renderer built-in (null time ⇒ untimed tray) |
| `DayTimeline`: **overlap conflict detection** between consecutive items (component L64) | **endpoint Output** `items[].conflictNote: string \| null` — pairwise computation over sorted rows; it is trip logic, and it belongs there |
| `DayTimeline`: **gap markers** ("3h free") ≥180 min (component L66) | **endpoint Output** `items[].gapNote: string \| null` |
| hour gutter labels `label(min)` (component L21-25) | `timeline` renderer built-in via `itemTime` |
| two-level nesting destinations → days → items | **reshaped**: one day-ordered stream, destination as the group subtitle. A trip timeline *is* chronological; destination boundaries become labels. Acceptable, judge-checkable. |
| `setInterval(refetch, 4000)` while `status === 'planning'` (L63-70) | **needs `poll`** (4th occurrence) |
| `.ics` export via Blob + `<a download>` (L116-131) | **CANNOT MOVE** — download gap (2nd of 3) |
| `refreshWeather.data?.note` — display a mutation's *returned* note (L181-183) | `async.note` is authored text; showing `$result.note` is a LOW-cost extension. Static note acceptable. |
| two reveal-forms | `toolbar.reveals` ×2 ✅ |

**Verdict: (a) — this page earns the 8th vocabulary slot for `timeline`.** See §3.
**Component tier needed** (`ItineraryCard`).
**Archetype: `detail + related lists ⇒ detail page`. Shipped: `max-w-3xl` stack under a tab bar. Match**
(the tab bar is a shell problem, §5).

---

### P10 — `homes/pages/searches/[searchId]/compare.tsx` (known-bespoke #2)

Endpoints: `listingFeed(id)` → `Listing[]`; `compareListings(id, ids: string)` → `{titles, rows}`.

**This page cannot be expressed, and it should not be forced.**

The page is: a checkbox multi-select over the listing feed, capped at 2–4, whose selection is joined
into a CSV string and passed as the *input* to a second query, whose `{titles, rows}` result renders
as a pivoted table with the winning cell in each row starred.

- The v1 dependent-query feature binds a query input to **`$data.<query>.<field>`** — *data*-derived.
  Here the input is **user-derived interaction state** (`selected: string[]`, L30) with a min/max
  constraint (L35) and a join to CSV (L39).
- Expressing it would require a genuinely new stateful concept in a deliberately stateless language:
  a `selection` model on `list`, a `$selection.*` binding namespace, cardinality validation, and a
  join policy. That is not one field — it is client state, which is precisely the invariant the whole
  design rests on ("no app-authored code ever executes on the phone", "the spec language is
  deliberately NOT Turing-complete").
- The degraded reshaping does exist — `compareListings(id)` auto-compares the top N by score, rendered
  as a `table` — but it deletes the page's entire stated purpose ("Pick 2 to 4 listings to line up side
  by side"). Calling that "expresses cleanly" would be exactly the procrustean fit the plan sets a
  0-target for.

Two further gaps on the same page: the `★ best cell` computation (`CompareTable.winners()`, a
per-row argmax with a lower/higher direction inferred by regex from the attribute label) would move to
the endpoint Output as `rows[].winnerIndices` and need a cell-highlight modifier on `table`; and "Copy
as markdown" is the download/clipboard gap (3rd of 3).

**Verdict: (c) — genuinely out of scope. `system-appbuilder` is its legitimate home.** This is the
single (c) in the set, within the plan's ≤1 allowance.

---

## 3. The 8th-section-kind verdict

**`timeline` takes the last slot. Confirmed.**

| evidence | weight |
|---|---|
| `trips/.../timeline.tsx` — the page IS a date-grouped, time-ordered stream with per-item time labels and per-item annotations (`DayTimeline`, 101 lines). Nothing else in the vocabulary preserves the day grouping. | **demands it** |
| `kitchen/pages/index.tsx` — `WeekGrid` is a day × slot pivot; without `timeline` it degrades to a flat undifferentiated meal list and the "week" disappears. With `timeline` it degrades only from a matrix to a day-grouped stream — and is **better on a phone** than the shipped `min-w-[640px]` horizontally-scrolling grid. | **demands it** |
| `health/doses.tsx`, `health` medication doses (`scheduledAt`), `homes` captures (`capturedAt`), `blog/digests` — all chronological group-by-day streams currently hand-built | wants it |
| the descriptor renderer **already has a native-tested `timeline` case** (`sdk/org/libs/ui/src/chat/components/render-descriptor.tsx:179-182`, items = `{title, time?, detail?}`) | near-zero renderer cost |

**Why not the alternatives:**
- **`board`/pivot-grid** (for `WeekGrid`) — one occurrence, and its real value came from drag-to-move,
  a named deliberate exclusion. `timeline` absorbs the grouping, which is the part that carries meaning.
- **`compare`/matrix** (for `homes/compare`) — one occurrence, and the section kind is not the blocker;
  the *multi-select state* is. Adding a `compare` kind would not make that page expressible.
- **`map`** — already an *element* (`map`, static image, `homes/StaticMap` precedent); does not need a
  section slot.
- **`form-wizard`** — `create` already covers `homes/new` once `onSuccess.navigate` exists.

**One design note on `timeline`:** it must accept `from` (an embedded array) and `group` (a date-ish
binding) — i.e. it is the group-aware sibling of `list`. That is what makes it earn a *kind* rather
than being an element, and it is what lets it absorb the `groupBy` need that would otherwise have to be
added to `list` separately.

---

## 4. Consolidated missing-feature list, ranked

Ranked by **pages blocked** (of the 10 desk-checked) and by catalog-wide occurrence counts measured
across `store/projects/*/pages` and `*/components`.

| # | feature | shape | pages needing it (of 10) | catalog-wide evidence | verdict |
|---|---|---|---|---|---|
| **1** | **`poll`** — refetch a section while a bound field matches a value set | `poll: { everyMs, while: { field: '$.status', in: ['pending','parsing'] } }`; "any row matches" for list sections | 4 — kitchen/index, blog/article, homes/inbox, trips/timeline | **20 files** across all 5 apps use `refetchInterval`/`setInterval` (13 pages + 7 components) | **REQUIRED.** Not a nicety — the async-agent pattern is the catalog's dominant liveness mechanism. Without it, 20 surfaces look dead while an agent works. |
| **2** | **`list.from` / `timeline.from`** — a section sourced from an embedded array in another section's query Output | `from: '$.citations'` / `from: '$data.getTrip.days'` | 6 — kitchen/index, blog/article, health/med, homes/inbox, trips/expenses, trips/timeline | every `include:[…]` endpoint in the catalog: `article.citations`, `medication.doses`/`.interactions`, `search.sources`, `trip.destinations`/`.bookings`, `plan.meals`, `listExpenses.expenses` | **REQUIRED.** Fully consistent with the view-shaped-endpoint rule (the array *is* in that endpoint's Output) and it *reduces* round trips. The alternative is one extra endpoint per embedded array. |
| **3** | **`create.onSuccess.navigate`** — a route template bound to the mutation's Output | `onSuccess: { navigate: '/searches/$result.id/inbox' }` | 1 — homes/new | **8 `navigate()` call sites** across 4 apps: `homes/new:125`, `trips/new:26`, `health/triage/index:24` (post-create); `blog/collections/[id]:66,78`, `trips/[tripId]:131`, `trips/travelers/[id]:47` (post-delete "go back") | **REQUIRED.** Post-delete is the harder half — deleting the record you are looking at *must* navigate somewhere. Needs to exist on `detail.actions`/`rowAction` too, not only `create`. |
| **4** | **form-field `options` from an endpoint** | best placed in the **Input JSON Schema** as `x-options: {query, label, value}` (`contracts.ts`), *not* in the view schema — the plan already says form fields derive from the Input schema | 2 blocked (trips/expenses payer, kitchen addMeal recipeId) + 1 degraded (blog addToCollection) | every create-with-a-foreign-key; a large fraction of the 139 catalog mutations | **REQUIRED, but placeable outside the view schema.** Without it, foreign-key fields render as UUID text boxes and features like trips' settlement break outright. |
| 5 | **`download` action** | `action: { download: 'exportOpml', filename: '…' }` | 0 blocked, 3 degraded — blog/prefs (OPML), trips/timeline (.ics), homes/compare (markdown) | "export my data" recurs across apps | **RECOMMENDED, not required.** No page's core job dies without it; three real user stories do. |
| 6 | **`enabled: '$.field'`** on an interactive element | bound boolean ⇒ disabled; same class as the plan's own "unresolved binding ⇒ disabled" | 2 — homes/inbox (`pollable`), homes/compare | per-row conditional controls are common | **LOW.** One modifier, declarative, no expressions. |
| 7 | `chat.suggestions?: string[]` | seed prompts | 1 — health/med (`ExplainPlainly`) | 4 assistant docks | **LOW / cosmetic.** |
| 8 | `create.groups?: [{title, fields}]` | fieldset headings + order | 1 — homes/new | every multi-section form | **COSMETIC.** Free relief: derive field order from JSON-Schema property order. |

### Required *semantics* (not features — but the schema must state them, or pages break)

| # | semantics | why it's load-bearing |
|---|---|---|
| S1 | **A bound element whose binding resolves to null/undefined/empty renders NOTHING.** | Without it every page fills with empty chrome. It is also what makes `empty` coherent, and what replaces ~15 `{x ? … : null}` guards found across the 10 pages. |
| S2 | **`prefill` with no `from` = seed the form on mount from the endpoint's Output by matching field names.** | This is the settings/edit-form shape. **5/5 catalog apps have a settings page.** |
| S3 | **Binding namespaces enumerated: `$.` (section data, dotted/nested paths), `$data.<query>.<path>`, `$props.`, `$route.<param>`, `$result.<field>`, `$client.timezone`, `$form.<field>`.** | `$route` and `$result` are used implicitly all over the plan but never named; `$form` is required by `homes/new`'s prefill; `$client.timezone` is required by kitchen's tonight selection. |
| S4 | **`facet` must support array-valued fields and must map to a query input (server re-query), not a client filter.** | `kitchen/recipes` facets on `tags: string[]` and re-queries `listRecipes({tag})`. A client-side facet is wrong once `limit` exists. |
| S5 | **Toggle mutations belong at the endpoint layer** (omit the field ⇒ server flips it). | The spec has no `!`. `saveArticle`, `pinArticle`, `dismissListing`, `updateSource.pollEnabled` are all boolean negations of bound data. This must be an explicit instruction in the viewbuilder's **endpoint-planning** node, or every toggle in every generated app is broken. |
| S6 | **View-time side effects belong in the read endpoint** (`markRead` becomes part of `getArticle`). | Removes the need for any on-mount effect concept. |

### Transforms that CANNOT move (findings, honestly recorded)

| transform | page | consequence |
|---|---|---|
| dwell-time telemetry (client timer + `pagehide` → `logReadingEvent`) | `blog/feed/[articleId]` | the dwell signal is **dropped**; the personalizer loses one input. Page still works. |
| multi-select (2–4) driving a query input | `homes/.../compare` | the page is **(c)**, out of scope |
| client-side file download / clipboard | blog/prefs, trips/timeline, homes/compare | three export stories lost unless feature #5 lands |

Everything else — **26 of 31 audited transforms** — moves cleanly: 12 to a computed endpoint Output
field, 11 to a renderer built-in (`format`, `limit`, `facet`, `meter`, `reveals`, `async.refetchAfter`,
array form controls, null-omission), 3 to the endpoint layer as a behaviour change (toggle, read-side
effect, human error message), and 2 are pre-accepted losses (optimistic UI, drag-and-drop).

---

## 5. Shell / archetype prediction scorecard

### 5a. Derived app shell vs hand-written nav — **0/5 apps reproduce**

The plan's rule: *"top-level pages become nav items; bottom tabs on phone, top bar or sidebar on web,
chosen by nav count."*

| app | hand-written shell (`pages/_layout.tsx`) | what the derived shell would produce | reproduces? | what's missing |
|---|---|---|---|---|
| **kitchen** | 4 task-shaped tabs (`Cook /`, `Recipes`, `Shop`, `Insights`) + 2 icon-only utility links (Pantry, Preferences) + an "Ask" concierge tab; `isActive` **aliases** `/shop`↔`/shopping`↔`/trip` and `/insights`↔`/nutrition`↔`/expiring` | 13 nav items, one per top-level route (`/`, `/expiring`, `/import`, `/insights`, `/nutrition`, `/pantry`, `/plan`, `/preferences`, `/recipes`, `/shop`, `/shopping`, `/trip`) | ❌ | **grouping** (13 routes → 4 tabs); **route aliasing** (several routes under one tab); **primary vs utility** distinction; the chat/concierge entry |
| **blog** | **4 groups × 3-4 items** (`Read`, `Library`, `Signals`, `Settings`), sidebar on web with group headers, bottom tabs by GROUP on phone (each group has a `home` route), + an unread **badge** on Alerts, + a ⌘K assistant launcher, + a "Refreshed 4m ago" newsroom liveness line | 13 flat nav items | ❌ | **two-level nav** (group → item); **per-group phone `home`**; **live badge counts**; the assistant entry |
| **health** | **6 sections** with a **contextual secondary sub-nav bar** that changes with the active section (17 flat pills → 6 sections + sub-items), + a global Disclaimer banner, + an AssistantDock | 21 flat nav items | ❌ | grouping; **contextual sub-nav**; a global always-on banner |
| **homes** | 3 links (Searches, New Search, AlertsBell) + an **in-nav `SearchSwitcher` that appears only on `/searches/:searchId/*`** + a ConciergeDock | 2 nav items (`/`, `/new`) — closest of the five | ⚠️ closest | **route-param-conditional nav element**; the alerts bell; the concierge dock |
| **trips** | 3 links (My Trips, New Trip) — genuinely simple | 3 nav items (`/`, `/new`, `/documents`… ) | ⚠️ near | `/documents/:docId` is not a top-level destination but would be derived as one |

**Findings the derived-shell heuristic must absorb:**

1. **Route count ≫ nav count.** 4/5 apps hand-group 13–21 routes into 4–6 destinations. A flat
   route→nav mapping produces an unusable 13–21-item bottom bar on a phone. **The shell needs an
   optional grouping declaration** (`shell: { groups: [{label, icon, home, routes: […]}] }`) — and if
   grouping is optional, the model will need it on 4/5 real apps, so **the layout-override rate will be
   ~80% on the shell**, which by the plan's own metric means the prediction is wrong rather than the
   model over-specifying. Recommendation: **derive the shell only when route count ≤ 5; above that,
   require the model to declare groups** (a small, finite, validatable object) rather than mispredicting.
2. **Not every route is a destination.** `/searches/:id/compare`, `/plan/:planId`, `/feed/:articleId`,
   `/documents/:docId` are drill-ins, not nav items. The heuristic needs a rule: **parameterized routes
   are never nav items**, and the shell must be able to mark a static route as non-nav.
3. **Sub-nav is a separate, unaddressed layer.** `SearchTabs` (4 tabs, `homes`), `TripTabs`
   (**15 tabs in 3 groups**, `trips`), and health's contextual pill bar are *per-entity* navigation
   under a `:param` route. The derived shell says nothing about it, and 3 of my 10 pages render one.
   Without it, a spec app's per-trip pages are unreachable from each other. **Recommendation: a
   `subnav` concept keyed to a route prefix (`/trips/:tripId/*`), or accept that every such page's
   `toolbar` must carry the navigation itself.** This is the largest un-designed area found by T0.
4. **Live badges in the nav** (blog's unread count, homes' AlertsBell, homes' inbox pending count) mean
   **the shell needs to be able to bind a count to an endpoint** — otherwise every generated app loses
   its "something needs you" signal.
5. **The chat/concierge dock is a shell element, not a page section** in 4/5 apps
   (`ConciergeDock`, `AssistantDock`, `CopilotDock`, blog's ⌘K Editor). The `chat` section kind puts it
   *in* a page. Recommendation: allow `shell: { assistant: { agent } }`.

### 5b. Page-archetype prediction — 4 exact, 3 partial, 3 fall through

| page | predicted | shipped | verdict |
|---|---|---|---|
| homes/new | form page | centered `max-w-2xl` form | ✅ exact |
| kitchen/recipes | list page | toolbar + facets + cards grid | ✅ exact |
| health/medications/[id] | detail page | header + keyvalue + sub-sections + chat | ✅ exact |
| trips/timeline | detail page | `max-w-3xl` stack | ✅ exact-ish (tabs are shell) |
| kitchen/index | dashboard (stats on top, grid below) | single column, **hero first, stats 4th** | ⚠️ **reorders** |
| blog/feed/[articleId] | detail page (single column) | detail + **sticky right rail** | ⚠️ no rail archetype (web only; phone identical) |
| trips/expenses | — | create + list + 2 breakdowns | ❌ no rule for **create + list** |
| homes/inbox | — | plain stack | ❌ no stated fallback |
| blog/preferences | — | plain stack | ❌ no stated fallback |
| homes/compare | — | picker grid + wide table | ❌ (page is (c) anyway) |

**Three heuristic findings:**

- **H1 — archetypes must never reorder sections.** Section order is authored. "Dashboard = stats strip
  on top" would bury kitchen's hero card, the one thing the page exists to show. Archetypes should
  govern **container width, grid columns, and responsive collapse only**.
- **H2 — add a `create + list on the same entity ⇒ list page with a collapsible header form` rule.**
  This is the commonest un-covered shape (5 of 10 pages), and `kitchen/recipes` hand-builds exactly it.
- **H3 — state an explicit fallback archetype (`stack`).** Three pages match no rule; the correct
  rendering for all three is a plain constrained vertical stack, which is what they hand-build. A
  stated fallback turns three misses into three hits at zero cost.
- (H4, minor) `master-detail` was **not exercised by any of the 10 pages** — no shipped page puts a
  list and a detail of the same data side by side. It may be a speculative archetype; worth confirming
  against the remaining 74 pages before building split-pane logic.

---

## 6. GO / NO-GO

**The plan's bar:** *≥7/10 express cleanly with ≤2 new schema features AND ≤1 of 10 lands in (c).*

| clause | result | pass? |
|---|---|---|
| ≥7/10 express cleanly | **9/10** | ✅ |
| ≤1 of 10 in (c) | **1/10** (`homes/.../compare.tsx`) | ✅ |
| ≤2 new schema features | **4 required** (`poll`, `list.from`, `onSuccess.navigate`, form-field `options`) | ❌ **by 2** — or **by 1** if `options` is counted where it belongs (the endpoint's Input schema, per the plan's own "fields derived from the endpoint's Input schema, never declared") |

### Call: **GO — conditional, with the schema amended by the 4 ranked additions.**

I am stating the miss plainly rather than shaving the count: on the strictest reading this is a
**formal NO-GO on the feature-count clause**. My recommendation is nonetheless GO, on this reasoning:

1. **The clause's purpose is to detect a wrong medium — and the evidence points the other way.** The
   real health signal is where the *computation* went: **26 of 31 audited client-side transforms move
   cleanly** to a computed endpoint Output field or a renderer built-in, exactly as the view-shaped-
   endpoint rule predicts, and in most cases the endpoint version is *better* (`travelerName` join,
   `citations[].label`, `adherence.pct`, day grouping). Only 3 cannot move, and only 1 of those
   (multi-select) costs a page. A DSL that is the wrong medium fails this test loudly; this one didn't.
2. **None of the 4 additions is an escape hatch, and none adds expression power.** `poll` is a
   declarative predicate over one field and a finite value set. `list.from` is a path into an Output the
   section already fetches. `onSuccess.navigate` is one route template. `options` is a contract
   annotation the api author writes. The language stays non-Turing-complete, and "no app-authored code
   ever executes on the phone" is untouched.
3. **Two of the four are not optional in any honest sense.** `poll` is used by **20 files across all 5
   apps** — refusing it does not buy schema minimalism, it buys 20 surfaces that look dead while an
   agent works, in an app suite whose entire premise is background agents. `list.from` is demanded by
   every `include:[…]` endpoint in the catalog; refusing it forces one extra endpoint per embedded
   array, which inflates the api layer the plan explicitly wants to leave alone.
4. **The two clauses that actually measure the vocabulary's honesty both passed comfortably** — 9/10
   express, and the single (c) is a page whose blocker (interactive multi-select state) is precisely the
   invariant the design is built to defend. That is the vocabulary being honest at its edge, which is
   the behaviour the plan asks for.

**If the ≤2 clause is treated as inviolable**, the honest sub-bar result is: with only `poll` +
`list.from`, **6–7 of 10 express cleanly** (trips/expenses and kitchen/index's add-meal both degrade to
UUID text boxes; homes/new strands the user on a submitted form) — i.e. *also* at or below the ≥7 line.
There is no 2-feature configuration that clears the express-rate bar. **The design therefore does not
return to the drawing board; it returns with a 4-item amendment.** That is the decision for the
orchestrator to ratify before the schema is pinned.

### Schema amendments to hand to Agent SCHEMA

1. 8th section kind = **`timeline`** — `{query|from, group, groupFormat, item, itemTime, itemEndTime, itemNote, empty}`.
2. Add **`poll: { everyMs, while: { field, in: [...] } }`** to every query-bearing section.
3. Add **`from: '$.path' | '$data.<query>.<path>'`** to `list` and `timeline`.
4. Add **`onSuccess: { navigate: '<route template with $result.*> ' }`** to `create`, `detail.actions`
   and `rowAction`.
5. Add **`x-options: { query, input?, label, value }`** to the endpoint **Input** JSON Schema
   (`contracts.ts`) — not to the view schema — and have the schema-form honour it.
6. Write S1–S6 (§4) into the schema doc as normative semantics; write S5 into the viewbuilder's
   **endpoint-planning** node prompt.
7. Recommended (not blocking): `action: {download}`, `enabled: '$.field'`, `chat.suggestions`.
8. Layout prediction: **archetypes never reorder sections**; add the `create + list ⇒ list page` rule;
   state `stack` as the fallback; derive the shell only when top-level route count ≤ 5 and never from
   parameterized routes; design a `subnav` concept for `/:param/*` route families.
