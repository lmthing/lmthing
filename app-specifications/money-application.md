# lmthing.money as a Project-Application — the `money` project

> A concrete instantiation of [project-as-application.md](./project-as-application.md) for a
> **personal finance copilot**: you paste bank/card CSV exports, a **`ledger`** space of agents
> categorizes every transaction, learns deterministic rules so it stops being needed, watches for
> subscriptions and anomalies, and writes you a plain-language monthly review. The `money` project
> owns the app — `database/` (accounts, transactions, categories, rules, budgets, recurring charges,
> alerts, monthly reviews, settings), `pages/` (client React dashboard / transactions / budgets /
> subscriptions / reviews), `api/` (named typed Node endpoints), `hooks/` (a `database` categorizer
> hook + daily watchdog cron + monthly review cron), and the project-scoped `ledger` space. Read the
> parent plan first for the shared mechanisms (capability globals, typed-contract pipeline, serving);
> this file is the money-specific shape. Paths are relative to the org repo root.

## Context

Everyone means to know where their money goes; almost nobody does the bookkeeping. The chore is
categorizing hundreds of cryptic bank descriptors (`SQ *BLUE BOTTLE 4821`, `AMZN MKTP EU`), noticing
the subscription that quietly went from €9.99 to €12.99, and sitting down once a month to actually
look. This app does exactly that work. You paste a CSV export from your bank; the `bookkeeper`
categorizes what the rules table can't, **and writes a new rule each time so the same merchant never
needs an agent again** — the app literally automates itself out of the hot path. The `watchdog` runs
daily: it detects recurring charges, flags price increases, new subscriptions, budget-pace overruns
and unusually large transactions as dismissible alerts. On the 1st, the `analyst` writes last month's
review in plain language — what changed, what drove it, what to look at. **The value is a categorized
ledger, a subscription audit, and a readable monthly review for the cost of pasting a CSV** — the
insight of a bookkeeper without hiring one, and with all data staying in your own pod. (There is no
`money/` domain today — it's a net-new project-application, served under the generic
`lmthing.app/<project>/` mount.)

## The project

- **Project id**: `money`. One per user pod (your finances = per-user, maximally private data — the
  strongest case in the catalog for the pod isolation model).
- **Project-scoped space**: `money/spaces/ledger/` — the specialists that maintain the app
  (`bookkeeper`, `watchdog`, `analyst`). Because the db is **project-rooted**, all three read/write
  the **same** tables and feed the **same** pages (the multi-agent-application shape).
- **THING** builds/evolves the app by delegating to `system-appbuilder` (parent plan
  §"system-appbuilder") — "track a shared household account", "add a savings-goals page" are
  authoring requests. **Runtime** work is the `ledger` agents, driven by one `database` hook, two
  crons, and chat — not THING.
- **Provisioning**: v1 seeds the `money` project from a checked-in template materialized into the
  pod's `<root>/money/`, pre-loaded with a standard category set (groceries, eating out, transport,
  housing, subscriptions, income, transfers…). In a **later phase** it becomes **installable from
  lmthing.store** as a project app (parent plan §Risks "Distribution").
- **v1 boundary — no bank connections.** Import is paste/upload of CSV exports only. No Plaid/OAuth
  aggregator, no credentials, nothing leaves the pod except model calls. This is deliberate: it keeps
  v1 inside the parent plan's authz model with zero new trust surface.

## Directory layout

```
money/
├── package.json              # react, @tanstack/react-router, @lmthing/{ui,css}, lucide-react …
├── database/
│   ├── accounts.json           # a bank/card/cash account transactions belong to
│   ├── categories.json         # the spend/income taxonomy (seeded, user- and agent-extendable)
│   ├── transactions.json       # one ledger line (signed amount; the core table)
│   ├── rules.json              # merchant-pattern → category (the self-automation table)
│   ├── budgets.json            # a per-category monthly limit
│   ├── recurring_charges.json  # detected subscriptions / repeating bills
│   ├── alerts.json             # watchdog findings the dashboard surfaces (dismissible)
│   ├── monthly_reviews.json    # the analyst's written month reviews
│   └── settings.json           # single row: currency, review day, alert thresholds
├── pages/                    # client-side React SPA
│   ├── _app.tsx              # QueryClient + design-system theme provider
│   ├── _layout.tsx           # nav chrome: Dashboard · Transactions · Budgets · Subscriptions · Reviews
│   ├── index.tsx             # "/"               → month dashboard (budget bars, alerts, recent)
│   ├── transactions.tsx      # "/transactions"   → ledger list + CSV import + recategorize
│   ├── budgets.tsx           # "/budgets"        → per-category limits vs current pace
│   ├── subscriptions.tsx     # "/subscriptions"  → recurring charges, annual cost, status
│   ├── reviews/
│   │   ├── index.tsx         # "/reviews"        → past monthly reviews
│   │   └── [month].tsx       # "/reviews/:month" → one review (markdown)
│   └── settings.tsx          # "/settings"       → currency, thresholds, review day
├── components/               # BudgetBar, TransactionRow, AlertCard, SubscriptionRow, ImportDrop…
├── api/
│   ├── transactions/
│   │   ├── GET.ts                    # listTransactions (month/account/category filters in JS)
│   │   ├── import/POST.ts            # importTransactions (CSV → dedupe → rules → insert)
│   │   └── [id]/PATCH.ts             # updateTransaction  (recategorize; optional "always" → rule)
│   ├── budgets/
│   │   ├── status/GET.ts             # budgetStatus (the deterministic centrepiece)
│   │   └── PUT.ts                    # setBudget
│   ├── categories/
│   │   ├── GET.ts                    # listCategories
│   │   └── POST.ts                   # addCategory
│   ├── accounts/
│   │   ├── GET.ts                    # listAccounts
│   │   └── POST.ts                   # addAccount
│   ├── recurring/
│   │   ├── GET.ts                    # listRecurring (with computed annual cost)
│   │   └── [id]/PATCH.ts             # updateRecurring (mark cancelled / acknowledge price change)
│   ├── alerts/
│   │   ├── GET.ts                    # listAlerts (unread first)
│   │   └── [id]/PATCH.ts             # dismissAlert
│   ├── reviews/
│   │   ├── GET.ts                    # listReviews
│   │   └── [month]/GET.ts            # getReview
│   └── stats/GET.ts                  # moneyStats (dashboard counts + month totals)
├── hooks/
│   ├── categorize.ts         # database transactions:insert → ledger/bookkeeper#categorize
│   ├── watch.ts              # cron daily 08:00 → ledger/watchdog#sweep
│   └── monthly-review.ts     # cron daily 09:00; runs analyst only on settings.reviewDay
├── spaces/
│   └── ledger/               # project-scoped space (agents / tasklists / knowledge)
│       └── agents/{bookkeeper,watchdog,analyst}/instruct.md
├── types/generated.d.ts      # GENERATED — row + endpoint I/O types (incl. relation fields)
└── .data/
    ├── app.db                # SQLite (WAL)
    ├── app.sql               # backup dump
    └── hooks-state.json      # cron last-run / pending queue
```

## Database (schemas — descriptions mandatory, FKs + relations)

Money is the **volume + self-automation** example: `transactions` is the one high-cardinality table
in the catalog (thousands of rows/year), which forces the deterministic-first design — `rules` handle
the repeat merchants in handler code, and the agent only ever sees the *unmatched remainder*. Every
table and column carries a required `description`; the loader fails loud on any missing one.

```json
// database/accounts.json
{ "title": "Accounts",
  "description": "A money account transactions belong to — a bank account, credit card, or cash.",
  "columns": {
    "id":        { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "name":      { "type": "string", "description": "display name, e.g. 'N26 checking'", "required": true, "unique": true },
    "kind":      { "type": "string", "description": "'checking' | 'savings' | 'credit' | 'cash'", "required": true },
    "currency":  { "type": "string", "description": "ISO currency code the account is denominated in, e.g. 'EUR'", "required": true },
    "archived":  { "type": "boolean", "description": "hidden from pickers and stats when true", "default": false },
    "createdAt": { "type": "date",   "description": "when the account was added", "generated": "now" } },
  "relations": {
    "transactions": { "hasMany": "transactions", "via": "accountId", "description": "ledger lines on this account" } } }
```

```json
// database/categories.json
{ "title": "Categories",
  "description": "The spend/income taxonomy. Seeded with a standard set; the bookkeeper may add one when nothing fits.",
  "columns": {
    "id":     { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "name":   { "type": "string", "description": "category name, e.g. 'eating out'; dedupe key", "required": true, "unique": true },
    "kind":   { "type": "string", "description": "'spend' | 'income' | 'transfer' — transfers are excluded from spend totals", "required": true },
    "icon":   { "type": "string", "description": "lucide icon name for the UI, e.g. 'utensils'" },
    "createdBy": { "type": "string", "description": "'seed' | 'user' | 'agent' — provenance of the category", "default": "seed" } },
  "relations": {
    "transactions": { "hasMany": "transactions", "via": "categoryId", "description": "lines filed under this category" },
    "rules":        { "hasMany": "rules",        "via": "categoryId", "description": "merchant rules that file into this category" },
    "budgets":      { "hasMany": "budgets",      "via": "categoryId", "description": "monthly limits set for this category" } } }
```

```json
// database/transactions.json — the core high-volume table
{ "title": "Transactions",
  "description": "One ledger line from an import or manual entry. Signed amount: negative = money out, positive = money in.",
  "columns": {
    "id":          { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "accountId":   { "type": "string", "description": "the account this line is on", "required": true,
                     "references": { "table": "accounts", "column": "id", "onDelete": "cascade" } },
    "date":        { "type": "date",   "description": "booking date from the bank export", "required": true },
    "amount":      { "type": "number", "description": "signed amount in the account currency; negative = spend", "required": true },
    "merchant":    { "type": "string", "description": "raw bank descriptor, e.g. 'SQ *BLUE BOTTLE 4821'", "required": true },
    "merchantLabel": { "type": "string", "description": "clean display name, e.g. 'Blue Bottle Coffee' (set by rule or bookkeeper)" },
    "categoryId":  { "type": "string", "description": "the category this line is filed under; null until categorized",
                     "references": { "table": "categories", "column": "id", "onDelete": "restrict" } },
    "status":      { "type": "string", "description": "'pending-category' | 'categorized' — the bookkeeper's queue is status='pending-category'", "default": "pending-category" },
    "note":        { "type": "string", "description": "optional user note on the line" },
    "dedupeKey":   { "type": "string", "description": "accountId|date|amount|merchant fingerprint; re-imports of overlapping CSVs skip existing keys", "required": true, "unique": true },
    "recurringChargeId": { "type": "string", "description": "the recurring charge this line was matched to, if any",
                     "references": { "table": "recurring_charges", "column": "id", "onDelete": "restrict" } },
    "source":      { "type": "string", "description": "'import' | 'manual'", "default": "import" },
    "createdAt":   { "type": "date",   "description": "when the row was inserted", "generated": "now" } },
  "relations": {
    "account":   { "belongsTo": "accounts",          "via": "accountId",         "description": "the account" },
    "category":  { "belongsTo": "categories",        "via": "categoryId",        "description": "the category filed under" },
    "recurring": { "belongsTo": "recurring_charges", "via": "recurringChargeId", "description": "the matched subscription/bill" } } }
```

```json
// database/rules.json — the self-automation table
{ "title": "Rules",
  "description": "A deterministic merchant-pattern → category mapping. importTransactions applies rules BEFORE any agent runs; the bookkeeper writes a new rule whenever it categorizes an unmatched merchant, so each merchant costs one agent call ever.",
  "columns": {
    "id":            { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "pattern":       { "type": "string", "description": "lowercase substring matched against the raw merchant descriptor, e.g. 'blue bottle'", "required": true, "unique": true },
    "merchantLabel": { "type": "string", "description": "clean display name applied to matching lines", "required": true },
    "categoryId":    { "type": "string", "description": "the category matching lines are filed under", "required": true,
                       "references": { "table": "categories", "column": "id", "onDelete": "cascade" } },
    "createdBy":     { "type": "string", "description": "'agent' | 'user' — user rules win on overlap (checked longest-pattern-first, user-first)", "default": "agent" },
    "hits":          { "type": "number", "description": "how many lines this rule has categorized (maintained by importTransactions)", "default": 0 },
    "createdAt":     { "type": "date",   "description": "when the rule was created", "generated": "now" } },
  "relations": {
    "category": { "belongsTo": "categories", "via": "categoryId", "description": "the target category" } } }
```

```json
// database/budgets.json
{ "title": "Budgets",
  "description": "A monthly spending limit for one category. One row per category+month; setBudget upserts (query-then-update) since uniqueness is per-column only.",
  "columns": {
    "id":         { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "categoryId": { "type": "string", "description": "the category the limit applies to", "required": true,
                    "references": { "table": "categories", "column": "id", "onDelete": "cascade" } },
    "month":      { "type": "string", "description": "the month 'YYYY-MM' the limit applies to", "required": true },
    "amount":     { "type": "number", "description": "the limit for the month, positive, in settings.currency", "required": true },
    "createdAt":  { "type": "date",   "description": "when the limit was set", "generated": "now" } },
  "relations": {
    "category": { "belongsTo": "categories", "via": "categoryId", "description": "the limited category" } } }
```

```json
// database/recurring_charges.json — detected subscriptions & repeating bills
{ "title": "Recurring charges",
  "description": "A subscription or repeating bill the watchdog detected from transaction history (same merchant, steady cadence and amount).",
  "columns": {
    "id":             { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "merchantLabel":  { "type": "string", "description": "clean merchant name, e.g. 'Netflix'; dedupe key", "required": true, "unique": true },
    "categoryId":     { "type": "string", "description": "the category its lines are filed under",
                        "references": { "table": "categories", "column": "id", "onDelete": "restrict" } },
    "cadence":        { "type": "string", "description": "'weekly' | 'monthly' | 'yearly'", "required": true },
    "expectedAmount": { "type": "number", "description": "the typical charge amount (negative), updated as new lines arrive", "required": true },
    "firstSeen":      { "type": "date",   "description": "date of the earliest matched transaction", "required": true },
    "lastSeen":       { "type": "date",   "description": "date of the latest matched transaction", "required": true },
    "nextExpected":   { "type": "date",   "description": "lastSeen + cadence; drives the 'gone quiet' check" },
    "status":         { "type": "string", "description": "'active' | 'price-changed' | 'gone' | 'cancelled' — 'cancelled' is user-set and stops alerts", "default": "active" } },
  "relations": {
    "category":     { "belongsTo": "categories",   "via": "categoryId",        "description": "the category" },
    "transactions": { "hasMany":  "transactions",  "via": "recurringChargeId", "description": "matched ledger lines" } } }
```

```json
// database/alerts.json — the watchdog's findings, surfaced on the dashboard
{ "title": "Alerts",
  "description": "One dismissible finding from the watchdog: a price increase, a new subscription, budget pace overrun, or an unusually large transaction.",
  "columns": {
    "id":        { "type": "string",  "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "kind":      { "type": "string",  "description": "'price-increase' | 'new-subscription' | 'over-budget-pace' | 'large-transaction' | 'gone-quiet'", "required": true },
    "message":   { "type": "string",  "description": "one-sentence plain-language finding shown on the card", "required": true },
    "relatedId": { "type": "string",  "description": "id of the related row (transaction / recurring charge / budget), for the card's link" },
    "month":     { "type": "string",  "description": "the month 'YYYY-MM' the finding belongs to", "required": true },
    "dismissed": { "type": "boolean", "description": "hidden from the dashboard when true", "default": false },
    "createdAt": { "type": "date",    "description": "when the watchdog raised it", "generated": "now" } } }
```

```json
// database/monthly_reviews.json
{ "title": "Monthly reviews",
  "description": "The analyst's written review of one closed month: totals, biggest movers vs the prior month, and what to look at.",
  "columns": {
    "id":        { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "month":     { "type": "string", "description": "the reviewed month 'YYYY-MM'; one review per month", "required": true, "unique": true },
    "body":      { "type": "string", "description": "the review, markdown — narrative first, numbers as evidence", "required": true },
    "totals":    { "type": "json",   "description": "machine-readable month totals: { income, spend, net, byCategory: {name: amount} }", "required": true },
    "createdAt": { "type": "date",   "description": "when the analyst wrote it", "generated": "now" } } }
```

```json
// database/settings.json — single row
{ "title": "Settings",
  "description": "Single-row app settings. Seeded on provisioning; edited via the settings page.",
  "columns": {
    "id":                  { "type": "string", "description": "always 'settings'", "primaryKey": true },
    "currency":            { "type": "string", "description": "display currency code, e.g. 'EUR'", "default": "EUR" },
    "reviewDay":           { "type": "number", "description": "day of month (1-28) the monthly review is written for the prior month", "default": 1 },
    "largeTxnThreshold":   { "type": "number", "description": "absolute amount above which a single line raises a 'large-transaction' alert", "default": 250 },
    "paceAlertRatio":      { "type": "number", "description": "raise 'over-budget-pace' when month-to-date spend / budget exceeds elapsed-month fraction by this ratio", "default": 1.25 } } }
```

- **`dedupeKey` makes re-import idempotent** — bank exports overlap; `importTransactions` computes
  `accountId|date|amount|merchant` per row and skips keys that already exist (the column-level
  `unique` backstops a race). Pasting last month's CSV twice inserts nothing.
- **`rules` is checked user-first, longest-pattern-first** — a user correction ("always file
  'bahn' under transport") beats an agent rule on overlap. `hits` gives the settings page a
  "your rules did 94% of the work" number — the visible payoff of the self-automation loop.
- **`onDelete` is deliberate**: `transactions.categoryId` is `restrict` (a category with filed lines
  can't vanish under them) while `rules.categoryId` is `cascade` (deleting a category drops its
  rules); `transactions.accountId` is `cascade` (removing an account removes its lines).
- **`kind:'transfer'` categories are excluded from spend totals** in `budgetStatus`/`moneyStats`/the
  analyst's totals — moving money between your own accounts is not spending. This lives in handler
  code so UI and agents agree.

## Pages (client React, file-based routing)

Data comes from the generated typed client `useApi(name, input)` — no pod-side loaders. Relation
fields arrive typed, so the transactions list renders category names without a second fetch.

| File | Route | Reads / writes |
|---|---|---|
| `pages/index.tsx` | `/` | `moneyStats` + `budgetStatus` + `listAlerts`; `dismissAlert` |
| `pages/transactions.tsx` | `/transactions` | `listTransactions` (include category); `importTransactions` (paste/drop CSV); `updateTransaction` |
| `pages/budgets.tsx` | `/budgets` | `budgetStatus`; `setBudget` |
| `pages/subscriptions.tsx` | `/subscriptions` | `listRecurring`; `updateRecurring` |
| `pages/reviews/index.tsx` | `/reviews` | `listReviews` |
| `pages/reviews/[month].tsx` | `/reviews/:month` | `getReview` (markdown body) |
| `pages/settings.tsx` | `/settings` | settings read/write + rules list with `hits` |

While an import's unmatched remainder is being categorized (`status:'pending-category'` rows exist),
`/transactions` polls `listTransactions` so categories fill in live as the bookkeeper works — the
same "pages are a live read view" property as the other catalog apps.

```tsx
// pages/budgets.tsx → "/budgets"
import { useApi } from '@app/runtime'
import { BudgetBar } from '../components/BudgetBar'

export default function BudgetsPage() {
  const { data, isLoading } = useApi('budgetStatus', {})   // typed: { month, rows: BudgetStatusRow[] }
  if (isLoading) return <Spinner />
  return (
    <section>
      <h1>Budgets — {data.month}</h1>
      {data.rows.map((r) => (
        <BudgetBar key={r.categoryId} name={r.category} spent={r.spent}
                   budget={r.budget} pace={r.pace} />   /* tokens only: bar uses var(--agent)/var(--destructive) states */
      ))}
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
| `importTransactions` | `POST api/transactions/import` | `{ accountId, csv }` → `{ inserted, skippedDuplicates, autoCategorized, needsReview }` |
| `listTransactions` | `GET api/transactions` | `{ month?, accountId?, categoryId? }` → `(Transaction & { category? })[]` |
| `updateTransaction` | `PATCH api/transactions/:id` | `{ id, categoryId?, note?, always? }` → `Transaction` (`always:true` also writes a user `rules` row) |
| `budgetStatus` | `GET api/budgets/status` | `{ month? }` → `{ month, rows: [{ categoryId, category, budget, spent, pace }] }` |
| `setBudget` | `PUT api/budgets` | `{ categoryId, month, amount }` → `Budget` (upsert) |
| `listCategories` | `GET api/categories` | `{}` → `Category[]` |
| `addCategory` | `POST api/categories` | `{ name, kind, icon? }` → `Category` |
| `listAccounts` | `GET api/accounts` | `{}` → `Account[]` |
| `addAccount` | `POST api/accounts` | `{ name, kind, currency }` → `Account` |
| `listRecurring` | `GET api/recurring` | `{}` → `(RecurringCharge & { annualCost })[]` |
| `updateRecurring` | `PATCH api/recurring/:id` | `{ id, status }` → `RecurringCharge` |
| `listAlerts` | `GET api/alerts` | `{ month? }` → `Alert[]` (undismissed first) |
| `dismissAlert` | `PATCH api/alerts/:id` | `{ id }` → `{ ok }` |
| `listReviews` | `GET api/reviews` | `{}` → `MonthlyReview[]` (totals only, no body) |
| `getReview` | `GET api/reviews/:month` | `{ month }` → `MonthlyReview` |
| `moneyStats` | `GET api/stats` | `{}` → `{ monthSpend, monthIncome, pendingCategory, activeSubscriptions, openAlerts }` |

> **Row-type note (engine truth).** The generated row-interface names follow the engine's
> deterministic singularizer (`build/schema.ts`): `categories → Category` (`…ies → …y`),
> `recurring_charges → RecurringCharge`, `monthly_reviews → MonthlyReview`, `settings → Setting`
> (trailing `s` after a normal consonant is stripped). Pages and handlers import these from
> `@app/types`.

```ts
// api/budgets/status/GET.ts → GET .../api/budgets/status ; name "budgetStatus"
/** Month-to-date spend per category vs its budget, with a pace ratio for the alert logic. */
export const name = 'budgetStatus'
export const description = 'Per-category month-to-date spend against the monthly budget, with pace (spend fraction / month-elapsed fraction).'

export interface Input  { /** month 'YYYY-MM'; defaults to the current month */ month?: string }
export interface Output { month: string
  rows: Array<{ categoryId: string; category: string; budget: number; spent: number; pace: number }> }

export default async function handler(input: Input, ctx: { db: AsyncDbApi }): Promise<Output> {
  const month = input.month ?? new Date().toISOString().slice(0, 7)
  // where is equality-only: read the month's candidates wide, filter/aggregate in JS.
  const txns = (await ctx.db.query('transactions', { include: ['category'] }))
    .filter((t) => t.date.startsWith(month) && t.amount < 0 && t.category?.kind === 'spend')
  const budgets = (await ctx.db.query('budgets', { where: { month }, include: ['category'] }))
  const daysIn = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate()
  const elapsed = Math.min(1, new Date().getDate() / daysIn)
  const rows = budgets.map((b) => {
    const spent = -txns.filter((t) => t.categoryId === b.categoryId).reduce((s, t) => s + t.amount, 0)
    return { categoryId: b.categoryId, category: b.category.name, budget: b.amount,
             spent, pace: b.amount > 0 && elapsed > 0 ? (spent / b.amount) / elapsed : 0 }
  })
  return { month, rows }
}
```

- `importTransactions` is the **rules-first pipeline**: parse CSV → compute `dedupeKey` → skip
  existing → apply `rules` (user-first, longest-pattern-first; bump `hits`; set `merchantLabel` +
  `categoryId` + `status:'categorized'`) → insert. Only rows **no rule matched** land as
  `pending-category` — and only those wake the bookkeeper (see Hooks). Over time
  `needsReview → 0` and imports become fully deterministic.
- `updateTransaction` with `always:true` writes a **user** rule from the corrected line — user
  corrections permanently outrank the agent's guesses.
- `budgetStatus` is the doc's **deterministic centrepiece** — the same numbers the watchdog uses for
  pace alerts and the analyst embeds in reviews, so UI and agents can never disagree about totals.

## Hooks

```ts
// hooks/categorize.ts — categorize whatever the rules couldn't
export default {
  type: 'database',
  on: { table: 'transactions', event: 'insert' },
  budget: { maxEpisodes: 12, maxWallClockMs: 300000 },
  handler: async ({ delegate }) => {
    // The bookkeeper reads its own queue (status='pending-category'), so a coalesced burst needs no row payload.
    await delegate('ledger/bookkeeper', 'categorize', {})
  },
}
```

```ts
// hooks/watch.ts — daily sweep: recurring detection + anomaly alerts
export default {
  type: 'cron',
  daily: '08:00',
  trigger: 'ledger/watchdog#sweep',
  budget: { maxEpisodes: 12, maxWallClockMs: 600000 },
}
```

```ts
// hooks/monthly-review.ts — write last month's review on settings.reviewDay
export default {
  type: 'cron',
  daily: '09:00',                                   // fires daily; the analyst no-ops unless today is reviewDay
  trigger: 'ledger/analyst#review',
  budget: { maxEpisodes: 15, maxWallClockMs: 600000 },
}
```

- **The loop is bounded**: a CSV import inserts N rows → **per-hook coalesce** collapses the burst
  into **one** bookkeeper run (it drains the whole `pending-category` queue in that run); the
  bookkeeper's writes are *updates* to `transactions` (the hook watches `insert` only) plus inserts
  to `rules`/`categories` — no hook watches those, and **self-write exclusion** backstops it. The
  watchdog writes `recurring_charges`/`alerts` (unwatched); the analyst writes `monthly_reviews`
  (unwatched). Nothing re-fires anything.
- Cron timing is the parent plan's **crond → hook-run endpoint** mechanism
  (`POST /api/projects/money/hooks/watch/run`); a review day missed while the pod was down runs once
  via boot catch-up (the analyst's `month` uniqueness makes a double-fire a no-op); local dev uses
  the in-process fallback tick.

## Chat (ask your ledger)

One drop-in `<Chat agent="ledger/analyst" />` widget on the dashboard, reusing the always-available
multisession WS endpoint (parent plan §Chat) — the binding is a runtime prop, no `chats/` dir:

- "How much did we spend eating out in June, and vs May?" → the analyst reads `transactions`
  (`include` category) and answers with numbers computed from the same rows the pages render.
- "Why is groceries over budget?" → reads `budgetStatus`-shaped data via `apiCall('budgetStatus')`
  plus the underlying lines, and names the drivers.
- "File everything from 'bäckerei' as groceries from now on" → the analyst can't write rules
  (write-narrow); it answers with the correction path, and the user does it on `/transactions`
  (`always:true`) — or the widget on `/transactions` binds `ledger/bookkeeper`, which can.
- History persists at `money/spaces/ledger/sessions/<id>` (project-session snapshot form,
  resumable). This is the one place the catalog descriptor renderer re-enters the app — pages stay
  real React.

## The `ledger` space (agents + capabilities)

Project-scoped at `money/spaces/ledger/`. Capabilities are least-privilege per agent — one
config-bearing `capabilities:` frontmatter key, table scope **per verb** (parent plan §"Capability
globals"):

| Agent | `db:read` tables | `db:write` tables | `api:call` allow | Role |
|---|---|---|---|---|
| **bookkeeper** | `transactions, categories, rules, settings` | `transactions, rules, categories` | — | drain the `pending-category` queue; write a rule per new merchant; create a category only when nothing fits |
| **watchdog** | `transactions, categories, recurring_charges, budgets, alerts, settings` | `recurring_charges, alerts, transactions` | `budgetStatus` | detect recurring charges (steady merchant+cadence+amount), link lines via `recurringChargeId`, raise pace/price/large/new/gone-quiet alerts |
| **analyst** | `transactions, categories, budgets, recurring_charges, alerts, monthly_reviews, settings` | `monthly_reviews` | `budgetStatus` | write the month review (narrative over the deterministic totals); answer dashboard chat |

```yaml
# money/spaces/ledger/agents/bookkeeper/instruct.md frontmatter
capabilities:
  - db:read:  { tables: [transactions, categories, rules, settings] }
  - db:write: { tables: [transactions, rules, categories] }   # updates lines, writes rules; never touches budgets/alerts/reviews
functions: []          # db-only: categorization needs no web — merchants are guessable from descriptor + existing taxonomy
```

```yaml
# money/spaces/ledger/agents/watchdog/instruct.md frontmatter — reads wide, writes narrow
capabilities:
  - db:read:  { tables: [transactions, categories, recurring_charges, budgets, alerts, settings] }
  - db:write: { tables: [recurring_charges, alerts, transactions] }   # transactions only to set recurringChargeId
  - api:call: { names: [budgetStatus] }
functions: []
```

- **The whole space is db-only** (`functions: []` on all three) — the strongest privacy statement
  the engine can make: no `ledger` agent can reach `webSearch`/`webFetch`/`fetch` even if prompted
  to. Financial data influences no outbound call. (Frontmatter, never prose — parent plan gotcha.)
- **The bookkeeper's job description is "make yourself unnecessary"** — its instruct requires a
  `rules` insert for every merchant it categorizes, and its charter forbids re-categorizing lines a
  user already corrected (it checks `createdBy:'user'` rules first, same as the handler).
- **The watchdog dedupes alerts before writing** — it reads open `alerts` for the month and skips
  kinds+relatedIds it already raised, so the daily cron doesn't stack duplicates.
- **The analyst narrates the deterministic numbers, never recomputes them** — `totals` in
  `monthly_reviews` comes from the same aggregation as `budgetStatus`/`moneyStats`; its prose
  explains *why* (drivers, one-offs vs recurring), which is the part only a model can do.
- **No `db:schema`/`pages:write`/`api:write` here** — the ledger *operates* the app. "Track a
  savings goal" or "split shared expenses with my partner" is an authoring request → THING →
  `system-appbuilder`.

## Serving & domains

- **Local CLI**: `localhost:8080/app/money/…` (pages) and `localhost:8080/app/money/api/<name>` —
  the parent plan's mount, `<project>` = `money`.
- **Prod**: served under the **generic authenticated `lmthing.app` domain** at `lmthing.app/money/*`
  → the authenticated user's pod `/app/money/*` (Envoy JWT + per-user routing). No pre-existing
  static SPA to replace; a `lmthing.money` alias is an optional later edge-alias.
- **Admin/dev**: `lmthing.studio` manages it via `/api/projects/money/app` (manifest, data browser,
  manual hook run, build status, live preview iframe of `…/app/money/`).

**No public/shared surface** — every route and endpoint is an authenticated, per-user pod
read/write. For this app that's not just the default but the point: the ledger never leaves the pod.

## Additional features (more user value)

The core loop earns trust with correct categories and a useful review; these deepen it. Each is
**additive** on the same engine.

### Savings goals — give the net number a purpose
- **Data**: `goals` (name, targetAmount, targetDate, savedAmount, categoryId? for "fund from what I
  save on X").
- **API**: `listGoals`/`setGoal`/`fundGoal`; `moneyStats` gains `goalProgress`.
- **Agent**: the analyst's review reports progress and suggests a realistic monthly contribution
  from the actual net.

### Multi-currency accounts — real for anyone with two banks
- **Data**: `fx_rates` (month, from, to, rate — user-entered or seeded); `transactions` keep account
  currency; `budgetStatus`/stats convert to `settings.currency` deterministically in the handler.
- **Agent impact**: none — conversion is handler code (deterministic-first, as ever).

### Statement-shape memory — imports that "just work"
- **Data**: `import_profiles` (accountId, column mapping, dateFormat, decimal separator).
- **Flow**: first import of an account, the bookkeeper is delegated once to infer the mapping from
  the raw header + sample rows and writes the profile; every later import parses deterministically.
  The same automate-yourself-out pattern as `rules`, applied to parsing.

### Annual review — the January email you'd never write yourself
- **Hook**: extend `monthly-review.ts` — on reviewDay of January the analyst also writes a
  `year:'YYYY'` review (stored in `monthly_reviews` with `month:'YYYY'`): totals, subscription
  creep over the year, category trends, three concrete suggestions.

## Round 2 — Planning, forecasting & tax season (feature expansion)

Round 1 shipped the backward-looking ledger — import, categorize, watch, review — and one `ledger`
space. Round 2 turns `money` **forward-looking**: savings **goals** with funding coaching, a
deterministic **cash-flow forecast** the `forecaster` narrates, a **tax season** workflow where a
`tax-scribe` screens categorized spending for deductible candidates and assembles the annual
evidence pack, plus the round-1 "Additional features" **promoted to fully-specced work**
(multi-currency `fx_rates`, statement-shape `import_profiles`, the annual review). A second
specialist team (**`advisor`** — forecaster · goal-coach · tax-scribe) does the forward-looking
work; `ledger` stays the system of record. Everything below is strictly additive to the round-1
shape — same project-rooted db, same serving, same capability model — and stays inside the parent
plan (data/agents/pages/api/hooks only).

### New database tables (round 2 — 6, bringing the app to 15)

Prose-schema form (descriptions mandatory on table/column/relation, FKs resolve, exactly-one PK):

- **`goals.json`** — a savings goal the net number funds. `id` (pk uuid) · `name` (string,
  required, unique) · `targetAmount` (number, required) · `targetDate` (date) · `savedAmount`
  (number, def 0 — updated by `fundGoal`) · `monthlySuggested` (number — the goal-coach's current
  realistic contribution, recomputed weekly) · `status` (string, def `'active'` —
  `'active'`|`'reached'`|`'paused'`) · `createdAt` (date, now).
- **`forecasts.json`** — one cash-flow projection run. `id` (pk) · `month` (string `'YYYY-MM'`,
  required — the month the projection starts) · `horizonMonths` (number, def 6) · `projection`
  (json, required — per-month `{ month, expectedIncome, expectedSpend, recurring, net,
  cumulativeNet }` computed by the deterministic `projectCashflow` space function) · `narrative`
  (string, required — the forecaster's plain-language read: risks, seasonality, the one thing to
  change) · `createdAt` (date, now). Latest row per `month` wins; history kept for "what did we
  expect vs what happened".
- **`tax_items.json`** — a transaction flagged as deductible-relevant. `id` (pk) · `transactionId`
  (references `transactions` onDelete cascade, required, **unique** — one screening verdict per
  line) · `taxYear` (number, required) · `taxCategory` (string, required — e.g.
  `'home-office'`|`'work-equipment'`|`'donation'`|`'medical'`|`'education'`|`'other'`) ·
  `rationale` (string, required — the scribe's one-line why) · `status` (string, def `'candidate'`
  — `'candidate'`|`'confirmed'`|`'rejected'`, user-decided) · `createdAt` (date, now). Relation
  `transaction` belongsTo `transactions` via `transactionId`.
- **`tax_reports.json`** — the annual evidence pack. `id` (pk) · `taxYear` (number, required,
  unique) · `body` (string, required — markdown: per-category totals with the confirmed line items
  listed as evidence) · `totals` (json, required — `{ byCategory: {cat: amount}, confirmedCount,
  candidateCount }`) · `status` (string, def `'draft'` — regenerated while candidates are still
  open) · `createdAt` (date, now).
- **`fx_rates.json`** — month rates for multi-currency accounts. `id` (pk) · `month` (string,
  required) · `from` (string, required) · `to` (string, required) · `rate` (number, required) ·
  `source` (string, def `'user'`). One row per (month, from, to) — `setFxRate` upserts
  (query-then-update; uniqueness is per-column only). All conversion is deterministic handler code.
- **`import_profiles.json`** — the learned statement shape per account. `id` (pk) · `accountId`
  (references `accounts` onDelete cascade, required, unique) · `columnMap` (json, required —
  header → field mapping) · `dateFormat` (string, required) · `decimalSeparator` (string, def
  `'.'`) · `inferredBy` (string, def `'agent'`) · `createdAt` (date, now). First import of an
  account delegates the bookkeeper once to infer the mapping; every later import parses
  deterministically — the `rules` self-automation pattern applied to parsing.

New columns on round-1 tables (additive `addColumn`): `transactions.taxScreened` (boolean, def
false — the scribe's high-water mark so re-screens skip done work); `monthly_reviews.kind` (string,
def `'month'` — `'month'`|`'year'`, the promoted annual review reuses the table).

### New API endpoints (round 2 — 12, bringing the app to 28)

| name | method + route | I/O sketch |
|---|---|---|
| `listGoals` | `GET api/goals` | `{}` → `Goal[]` |
| `setGoal` | `POST api/goals` | `{ name, targetAmount, targetDate? }` → `Goal` (upsert by name) |
| `fundGoal` | `PATCH api/goals/:id/fund` | `{ id, amount }` → `Goal` (bumps `savedAmount`; `reached` when target hit) |
| `cashflowForecast` | `GET api/forecast` | `{}` → latest `Forecast` (projection + narrative) |
| `rebuildForecast` | `POST api/forecast` | `{ horizonMonths? }` → `{ status:'projecting' }` — `spawn`s `advisor/forecaster#project` |
| `listTaxItems` | `GET api/tax/items` | `{ taxYear, status? }` → `(TaxItem & { transaction })[]` |
| `reviewTaxItem` | `PATCH api/tax/items/:id` | `{ id, status }` → `TaxItem` (confirm/reject a candidate) |
| `buildTaxReport` | `POST api/tax/report` | `{ taxYear }` → `{ status:'building' }` — `spawn`s `advisor/tax-scribe#report` |
| `getTaxReport` | `GET api/tax/report/:year` | `{ year }` → `TaxReport` |
| `setFxRate` | `PUT api/fx` | `{ month, from, to, rate }` → `FxRate` (upsert) |
| `listImportProfiles` | `GET api/imports/profiles` | `{}` → `ImportProfile[]` |
| `setImportProfile` | `PUT api/imports/profiles` | `{ accountId, columnMap, dateFormat, decimalSeparator? }` → `ImportProfile` (user override beats inferred) |

All follow the round-1 rules — equality-only `where` (query-all + JS filter), typed `HttpError`
failures, **`spawn` (never `delegate`) from handlers** for fire-and-forget kick-offs. `budgetStatus`
and `moneyStats` gain deterministic `settings.currency` conversion via `fx_rates` (missing rate =
typed error naming the month/pair, never a silent 1.0). `importTransactions` consults
`import_profiles` before its dialect sniffing.

### New hooks (round 2 — 4, bringing the app to 7)

- **`flag-deductibles.ts`** — `database` `transactions:update` (coalesced), imperative handler:
  skip unless the update set a `categoryId` on a line with `taxScreened:false`, else
  `delegate('advisor/tax-scribe','screen',{})` — the scribe drains its own queue (categorized,
  unscreened), writes `tax_items` candidates, and flips `taxScreened` on everything it examined
  (including non-candidates, so nothing is screened twice).
- **`goal-checkin.ts`** — `cron`, `daily: '08:30'`, Monday-gated in the agent →
  `advisor/goal-coach#checkin`: recompute each active goal's `monthlySuggested` from the last three
  months' actual net (via `apiCall('budgetStatus')` history), write an `alerts` row when a goal
  went off-pace, flip `reached` goals.
- **`reforecast-monthly.ts`** — `cron`, `daily: '09:30'`, gated to `settings.reviewDay` →
  `advisor/forecaster#project` — a fresh projection lands right after the analyst's month review.
- **`reforecast-on-budget-change.ts`** — `database` `budgets:update`, imperative handler
  (coalesced): `delegate('advisor/forecaster','project',{})` — editing budgets refreshes the
  forecast without waiting a month.

**Loop-guard sanity.** `transactions:insert` → bookkeeper categorizes (an *update*) →
`flag-deductibles` fires on that update → scribe writes `tax_items` + flips `taxScreened` — the
scribe's own `transactions` updates are excluded by **self-write exclusion** and gated by the
`taxScreened` check, so the cascade stops at depth 2 (cap 3). `budgets:update` → forecaster writes
`forecasts` (no hook) ⇒ stops. The goal-coach writes `goals`/`alerts` (unwatched) ⇒ stops. Per-hook
coalesce collapses a whole CSV import's categorization burst into one screening run.

### New pages (round 2 — 5, bringing the app to 12) + components

| File | Route | Reads / writes |
|---|---|---|
| `pages/goals.tsx` | `/goals` | `listGoals`; `setGoal`/`fundGoal`; `<Chat agent="advisor/goal-coach">` dock |
| `pages/forecast.tsx` | `/forecast` | `cashflowForecast` (projection chart + narrative); `rebuildForecast` button |
| `pages/tax.tsx` | `/tax` | `listTaxItems` (candidate triage: confirm/reject rows); `buildTaxReport`; `getTaxReport` |
| `pages/imports.tsx` | `/imports` | `listImportProfiles`/`setImportProfile` + per-account import history |
| `pages/reviews/year.tsx` | `/reviews/year` | the promoted annual review (`monthly_reviews` `kind:'year'`) |

New shared components (design tokens only): `GoalRing` (progress dial), `ForecastChart`
(token-styled projection bars, expected-vs-actual overlay), `DeductibleRow` (confirm/reject
inline), `FxTable`, `ProfileEditor`. `_layout.tsx` nav gains **Goals · Forecast · Tax** alongside
the round-1 items.

### The `advisor` space (second project-scoped space, full format)

`money/spaces/advisor/` — a distinct forward-looking team sharing the same project-rooted db as
`ledger` (parent plan's multi-space shape). Least-privilege per verb; **`functions: []` on every
agent** — the round-1 privacy invariant (no web, ever) extends to the whole project:

| Agent | `db:read` tables | `db:write` tables | `api:call` allow | Role |
|---|---|---|---|---|
| **forecaster** | `transactions, categories, budgets, recurring_charges, goals, forecasts, fx_rates, settings` | `forecasts` | `budgetStatus` | run `projectCashflow`, sanity-check it, write projection + narrative |
| **goal-coach** | `goals, transactions, budgets, forecasts, monthly_reviews, alerts, settings` | `goals, alerts` | `budgetStatus, cashflowForecast` | weekly check-ins, realistic `monthlySuggested`, off-pace alerts; `/goals` chat |
| **tax-scribe** | `transactions, categories, rules, tax_items, tax_reports, settings` | `tax_items, tax_reports, transactions` | — | screen categorized lines for deductible candidates (writes `taxScreened`), assemble the year report |

- **Agent-frontmatter features exercised**: the goal-coach declares
  `canDelegateTo: [advisor/forecaster#project]` (a "what if I saved €300/month?" chat question
  legitimately commissions a fresh projection — hard allowlist, anything else throws naming the
  allowed targets); the tax-scribe declares `defaultAction: screen` so a freeform delegation
  ("check March for deductibles") lands on the right action; every agent binds its `knowledge:`
  refs (below).
- **Tasklists** (`tasklists/`, numbered task files with real frontmatter):
  `project/` — `01-gather.md` (`role: explore`, read-only: pull 12 months of actuals + recurring +
  budgets), `02-project.md` (`functions: [projectCashflow, convertFx]` — run the deterministic
  projection), `03-narrate.md` (write `forecasts`; `functions: []`). `tax-season/` —
  `01-collect.md` (`role: explore` — the year's confirmed items + open candidates),
  `02-screen.md` (**`forEach: "collect.categoryBatches"`** — the host fans one screening fork per
  spend-category batch; the model never writes the loop), `03-report.md` (assemble
  `tax_reports.body` from confirmed items only).
- **Functions** (`functions/*.ts`, deterministic, host-primitive-only): `projectCashflow`
  (actuals + recurring + budgets → per-month projection), `annualize` (recurring cadence → yearly
  cost), `convertFx` (amount, month, pair → converted, throws on missing rate),
  `deductibleHeuristics` (category + merchant → candidate taxCategory or null — the screen's first
  pass, so the model only judges the ambiguous remainder).
- **Components** (`components/`): view `GoalProgress` (chat-rendered goal dial),
  view `ForecastSummary`; form `DeductibleReview` — an `ask()` batch confirm/reject sheet the
  tax-scribe renders in chat at year-end ("12 candidates need your call"). Design-token-gated.
- **Knowledge** (`knowledge/personal-finance/`, each field an `index.md` overview + ≥2 aspect
  deep-dives loaded via `loadKnowledge`): `forecasting/` (`seasonality.md`,
  `recurring-vs-oneoff.md`, `uncertainty-honesty.md`), `tax-hygiene/` (`deductible-categories.md`,
  `evidence-trail.md`, `jurisdiction-neutrality.md` — the scribe's **not-tax-advice** framing: it
  collects and organizes evidence, it never asserts what is legally deductible; the UI carries the
  same line), `goal-coaching/` (`funding-strategies.md`, `motivation-without-nagging.md`).

### `ledger` space-format remediation (round 2)

Round 1 left `ledger` as `agents/`-only. Round 2 brings it to the **full space format**:
`charter.md` alongside every `instruct.md` (the bookkeeper's fork-safe no-refile-user-rules
guardrail; the watchdog's dedupe-before-write rule; the analyst's narrate-never-recompute rule);
tasklists — `categorize/` for the bookkeeper (`01-queue.md` `role: explore` →
`02-file.md` **`forEach: "queue.merchantGroups"`** one fork per distinct new merchant →
`03-rules.md` write the rule per group) and `sweep/` for the watchdog (detect → dedupe → alert
pipeline); `functions/` (`matchRules` — the same user-first/longest-pattern-first matcher the
import handler uses, `detectCadence`, `summarizeMonth`, `formatCurrency`); catalog `components/`
(`BudgetPreview`, `AlertCard` for chat rendering); and **extensive `knowledge/bookkeeping/`** —
`categorization/` (`merchant-descriptor-heuristics.md`, `transfer-detection.md`),
`subscription-audit/` (`cadence-detection.md`, `price-change-thresholds.md`), `review-craft/`
(`narrative-structure.md`, `benchmarks-and-restraint.md`).

### Phases & verification additions (round 2)

Ordered on top of the round-1 phases: **(R2-1)** new schemas + columns; **(R2-2)** the `advisor`
space full-format (agents, tasklists, functions, components, knowledge) + `ledger` remediation;
**(R2-3)** the 12 endpoints (fx conversion threaded through `budgetStatus`/`moneyStats`);
**(R2-4)** the 4 hooks + loop-guard checks; **(R2-5)** the 5 pages + components; **(R2-6)** tests.

Verification additions: **(a)** categorize a work-equipment line → `flag-deductibles` fires once
(coalesced), a `candidate` `tax_items` row cites a rationale, `taxScreened` flips on every examined
line, re-running screens nothing; **(b)** `reviewTaxItem` confirm ×N + `buildTaxReport` → the
report's `totals.byCategory` equals the sum of confirmed items only; rejected items appear nowhere;
**(c)** `rebuildForecast` → `projectCashflow`'s json equals a hand-computed fixture; the narrative
references only numbers present in the projection; **(d)** goal-coach Monday run recomputes
`monthlySuggested` from actual net and writes an off-pace alert exactly once; the "what if" chat
question delegates `advisor/forecaster#project` (allowlist holds — delegating anything else
throws); **(e)** a second-currency account converts via `fx_rates` in `budgetStatus`; a missing
rate is a typed error naming month+pair; **(f)** first import of a new account infers an
`import_profiles` row once; the next import parses deterministically with no agent involvement;
**(g)** `pnpm lint:tokens` stays green across the 5 new pages; **(h)** the tax page and the
scribe's outputs both carry the not-tax-advice line.

## Round 3 — Net worth, reconciliation & the paper trail (feature expansion)

Round 1 built the backward-looking ledger (`ledger`); round 2 made it forward-looking (`advisor`).
Round 3 makes it **trustworthy to the cent and complete beyond cash flow**: a **net worth** view
that folds assets and liabilities into the picture, a monthly **reconciliation** ritual where an
`auditor` hunts down why the ledger disagrees with the bank statement, and a **paper trail** —
paste a receipt and a `receipt-clerk` matches it to its transaction and itemizes it, unlocking
item-level analytics ("how much of 'groceries' is actually coffee?"). A third specialist team
(**`treasury`** — auditor · receipt-clerk · wealth-keeper) does this work. Everything below is
strictly additive to the round-1/2 shape — same project-rooted db, same serving, same capability
model, `functions: []` project-wide as ever — and stays inside the parent plan
(data/agents/pages/api/hooks only).

### New database tables (round 3 — 6, bringing the app to 21)

- **`assets.json`** — a non-cash thing of value. `id` (pk uuid) · `name` (string, required,
  unique) · `kind` (string, required — `'property'`|`'vehicle'`|`'investment'`|`'pension'`|
  `'other'`) · `currency` (string, required) · `notes` (string) · `archived` (boolean, def false)
  · `createdAt` (date, now). Relation `valuations` hasMany `valuations` via `subjectId`.
- **`valuations.json`** — a point-in-time value snapshot, generic over subject. `id` (pk) ·
  `subjectType` (string, required — `'asset'`|`'liability'`|`'net-worth'`) · `subjectId` (string —
  the asset/liability id; null for the monthly `'net-worth'` roll-up rows the wealth-keeper
  writes) · `month` (string `'YYYY-MM'`, required) · `value` (number, required) · `source`
  (string, def `'user'` — `'user'`|`'agent'`) · `createdAt` (date, now).
- **`liabilities.json`** — a debt. `id` (pk) · `name` (string, required, unique) · `kind`
  (string, required — `'mortgage'`|`'loan'`|`'credit'`|`'other'`) · `principal` (number,
  required — current balance, user-updated or via valuations) · `ratePercent` (number) ·
  `minimumPayment` (number) · `currency` (string, required) · `archived` (boolean, def false) ·
  `createdAt` (date, now).
- **`reconciliations.json`** — one account-month reconciliation run. `id` (pk) · `accountId`
  (references `accounts` onDelete cascade, required) · `month` (string, required) ·
  `statementBalance` (number, required — typed in from the bank statement) · `computedBalance`
  (number, required — the deterministic ledger sum at month end) · `delta` (number, required) ·
  `findings` (json, def `[]` — the auditor's `{ kind:'missing'|'duplicate'|'uncleared'|'unknown',
  transactionId?, note }` list) · `status` (string, def `'open'` —
  `'open'`|`'explained'`|`'balanced'`) · `createdAt` (date, now). Relation `account` belongsTo
  `accounts` via `accountId`.
- **`receipts.json`** — a pasted receipt awaiting its transaction. `id` (pk) · `rawText`
  (string, required — pasted verbatim, never edited) · `merchantGuess` (string) · `total`
  (number) · `purchasedAt` (date) · `transactionId` (references `transactions` onDelete setNull —
  the matched line) · `status` (string, def `'pending'` —
  `'pending'`|`'matched'`|`'unmatched'`) · `createdAt` (date, now). Relation `transaction`
  belongsTo `transactions` via `transactionId`.
- **`transaction_items.json`** — the itemization of a matched receipt. `id` (pk) ·
  `transactionId` (references `transactions` onDelete cascade, required) · `receiptId`
  (references `receipts` onDelete cascade, required) · `label` (string, required — the line item
  as printed) · `itemCategory` (string, required — a finer-grained tag than the transaction's
  category, e.g. `'coffee'` inside `'groceries'`) · `amount` (number, required) · `quantity`
  (number, def 1). Relations: `transaction` belongsTo `transactions` via `transactionId`;
  `receipt` belongsTo `receipts` via `receiptId`.

New columns on earlier tables (additive `addColumn`): `transactions.cleared` (boolean, def false
— reconciliation state; set by the auditor's findings resolution and by `toggleBought`-style user
action on the reconcile page); `alerts.kind` gains `'stale-valuation'` and `'reconcile-delta'`.

### New API endpoints (round 3 — 12, bringing the app to 40)

| name | method + route | I/O sketch |
|---|---|---|
| `addAsset` / `listAssets` | `POST/GET api/assets` | asset CRUD; list includes latest valuation |
| `addLiability` / `listLiabilities` | `POST/GET api/liabilities` | liability CRUD |
| `addValuation` | `POST api/valuations` | `{ subjectType, subjectId, month, value }` → `Valuation` |
| `netWorth` | `GET api/net-worth` | `{}` → `{ month, cash, assets, liabilities, net, history: [{month, net}] }` — deterministic: cleared account balances + latest asset valuations − liability principals, fx-converted |
| `startReconciliation` | `POST api/reconcile` | `{ accountId, month, statementBalance }` → `Reconciliation` (computes `computedBalance`/`delta`; auditor hook fires when delta ≠ 0) |
| `getReconciliation` | `GET api/reconcile/:id` | `{ id }` → `Reconciliation & { account }` |
| `resolveFinding` | `PATCH api/reconcile/:id/findings` | `{ id, index, action }` → `Reconciliation` (`action`: mark cleared / delete duplicate / add missing via `importTransactions`-shaped stub) |
| `addReceipt` | `POST api/receipts` | `{ rawText }` → `Receipt` (stub; match hook fires) |
| `listReceipts` | `GET api/receipts` | `{ status? }` → `Receipt[]` |
| `itemBreakdown` | `GET api/items` | `{ month?, itemCategory? }` → `{ rows: [{ itemCategory, total, count }] }` — item-level analytics under the category level |

All follow the established rules — equality-only `where`, typed `HttpError`, **`spawn` from
handlers**. `netWorth` is round 3's deterministic centrepiece: every number is a sum the user can
audit, the wealth-keeper only narrates it, and the monthly `'net-worth'` valuation row it writes
must equal what `netWorth` computed for that month (single-definition check, testable).

### New hooks (round 3 — 3, bringing the app to 10)

- **`hunt-discrepancies.ts`** — `database` `reconciliations:insert`, imperative handler: skip
  when `row.delta === 0` (auto-`balanced`), else `delegate('treasury/auditor','hunt', { input: {
  reconciliationId: row.id } })` — the auditor works the month's lines: candidate duplicates
  (same day/amount/merchant), missing entries implied by the statement direction, uncleared
  strays; writes `findings` + a `reconcile-delta` alert.
- **`match-receipt.ts`** — `database` `receipts:insert` (coalesced), imperative handler:
  `delegate('treasury/receipt-clerk','match',{})` — the clerk drains `pending` receipts: parse
  merchant/total/date from `rawText`, match against transactions (±3 days, amount within fx/tip
  tolerance), itemize into `transaction_items`, honest `unmatched` when no line fits.
- **`net-worth-snapshot.ts`** — `cron`, `daily: '09:45'`, gated to `settings.reviewDay` →
  `treasury/wealth-keeper#snapshot` — write the month's `'net-worth'` valuation row, flag assets
  whose latest valuation is > 6 months old (`stale-valuation` alerts), and note allocation drift
  in one narrative paragraph appended to the month's review (`monthly_reviews.body` — the analyst
  left a `## Net worth` placeholder section for exactly this).

**Loop-guard sanity.** `reconciliations:insert` → auditor *updates* the row + writes `alerts`
(unwatched) ⇒ stops at depth 1. `receipts:insert` → clerk writes `transaction_items` + updates
`receipts`/`transactions.cleared` — `transactions:update` DOES fire round-2's
`flag-deductibles`, but its gate (`categoryId` newly set + `taxScreened:false`) makes a
cleared-flag update a no-op ⇒ the cascade terminates at depth 2 (cap 3), and the gate is now
load-bearing enough that the round-3 tests pin it. The wealth-keeper writes
`valuations`/`alerts`/`monthly_reviews` (all unwatched) ⇒ stops. **Self-write exclusion**
backstops all three; the auditor's `hunt` runs inside the hook budget and files partial findings
rather than overrunning.

### New pages (round 3 — 5, bringing the app to 17) + components

| File | Route | Reads / writes |
|---|---|---|
| `pages/net-worth.tsx` | `/net-worth` | `netWorth` (history chart + composition); `<Chat agent="treasury/wealth-keeper">` dock |
| `pages/assets.tsx` | `/assets` | `listAssets`/`listLiabilities`; `addAsset`/`addLiability`/`addValuation` |
| `pages/reconcile.tsx` | `/reconcile` | `startReconciliation` (account+month+balance form); `getReconciliation` findings triage; `resolveFinding` |
| `pages/receipts.tsx` | `/receipts` | `addReceipt` (paste zone); `listReceipts` with match status filling in live |
| `pages/items.tsx` | `/items` | `itemBreakdown` — the sub-category drill-down |

New shared components (design tokens only): `NetWorthChart` (history + composition bands),
`FindingRow` (discrepancy triage card), `ReceiptMatchCard` (raw text ⇄ matched line,
side-by-side), `ItemBar`, `ValuationSparkline`. `_layout.tsx` nav gains **Net worth · Reconcile ·
Receipts**; the transactions page shows a `cleared` check column and a paperclip glyph linking a
line to its receipt items.

### The `treasury` space (third project-scoped space, full format)

`money/spaces/treasury/` — the correctness-and-completeness team. Least-privilege per verb;
`functions: []` on every agent (project invariant):

| Agent | `db:read` tables | `db:write` tables | `api:call` allow | Role |
|---|---|---|---|---|
| **auditor** | `transactions, accounts, reconciliations, rules, categories, settings` | `reconciliations, transactions, alerts` | — | hunt statement/ledger deltas; findings with evidence, never silent fixes |
| **receipt-clerk** | `receipts, transactions, transaction_items, categories, settings` | `receipts, transaction_items, transactions` | — | parse/match/itemize pasted receipts; honest `unmatched` |
| **wealth-keeper** | `accounts, assets, valuations, liabilities, fx_rates, monthly_reviews, alerts, settings` | `valuations, alerts, monthly_reviews` | `netWorth, budgetStatus` | monthly snapshot, stale-valuation flags, allocation-drift narrative |

- **Agent-frontmatter features exercised**: the wealth-keeper's numbers all arrive via
  `apiCall('netWorth')` (never recomputed — the round-1 discipline at its strictest); the
  receipt-clerk declares `defaultAction: match`; the auditor declares `actions:` for `hunt`
  (tasklist `reconcile`) with `defaultAction: hunt`.
- **Tasklists** (round 3 exercises the remaining task-frontmatter surface): `reconcile/` —
  `01-scope.md` (`role: explore`, `output: { candidates: 'json' }` — a typed `output` schema so
  the downstream task binds a validated shape), `02-classify.md` (`dependsOn: [scope]`,
  **`forEach: "scope.candidates"`** — one fork per candidate discrepancy),
  `03-strays.md` (`optional: true`, **task-level `canDelegateTo:
  [ledger/bookkeeper#categorize]`** — when the hunt surfaces uncategorized strays, THIS TASK may
  hand them to the round-1 bookkeeper; the tasklist's other tasks cannot delegate at all),
  `04-file.md` (`dependsOn: [classify]` — write `findings` + alert). `match/` for the clerk —
  parse (`role: explore`, `output` typed) → match `forEach` over pending receipts → itemize.
- **Functions** (`functions/*.ts`, deterministic): `computeMonthEndBalance` (the same sum
  `startReconciliation` uses — single definition), `receiptParse` (rawText → merchant/total/date
  candidates, so the model only judges ambiguity), `matchScore` (receipt ⇄ transaction closeness),
  `allocationDrift` (composition month-over-month deltas).
- **Components**: view `ReconcileSummary` (chat-rendered delta + findings count), view
  `NetWorthCard`; form `FindingTriage` — an `ask()` sheet the auditor renders in chat when a
  finding needs the user's call ("these two €12.90 UBER lines — same ride twice, or two rides?").
- **Knowledge** (`knowledge/stewardship/`, each field `index.md` + ≥2 aspects): `reconciling/`
  (`delta-taxonomy.md`, `evidence-first.md`, `never-silent-fixes.md` — every ledger mutation the
  auditor proposes goes through `resolveFinding`, user-approved), `receipts/`
  (`parsing-heuristics.md`, `matching-tolerances.md`), `net-worth/` (`valuation-honesty.md` —
  the app records the user's valuations, it never appraises; `allocation-basics.md`,
  `not-investment-advice.md` — the wealth-keeper describes composition and drift, it never
  recommends buying or selling anything; the UI carries the same line).

### Phases & verification additions (round 3)

Ordered on top of rounds 1–2: **(R3-1)** new schemas + columns; **(R3-2)** the `treasury` space
full-format; **(R3-3)** the 12 endpoints (`netWorth`/`computeMonthEndBalance` single-definition);
**(R3-4)** the 3 hooks + the now-load-bearing `flag-deductibles` gate test; **(R3-5)** the 5
pages + components; **(R3-6)** tests.

Verification additions: **(a)** `startReconciliation` with a delta → auditor files findings each
citing a transaction or an explicit `unknown`; `resolveFinding` is the only path that mutates
lines (duplicate delete / cleared flip observed through it, never directly by the agent);
balancing the delta flips `status:'balanced'`; a zero-delta start never fires the hook;
**(b)** the ambiguous-duplicate case renders the `FindingTriage` `ask()` form instead of
guessing; **(c)** paste a 14-line receipt → clerk matches the right transaction (±3 days
tolerance observed), `transaction_items` sum to the receipt total (mechanical check), and the
`cleared` update does **not** produce a `tax_items` row (the depth-2 gate test); an unmatchable
receipt lands `unmatched`, no retry loop; **(d)** `itemBreakdown` totals reconcile with the
parent transactions' amounts; **(e)** on `reviewDay` the wealth-keeper's `'net-worth'` valuation
row equals `netWorth`'s computed value exactly; a 7-month-old asset valuation raises exactly one
`stale-valuation` alert; the review body gains the `## Net worth` paragraph without disturbing
the analyst's sections; **(f)** in the `reconcile` tasklist, only `03-strays.md` can delegate
(to `ledger/bookkeeper#categorize`); a delegate call from `02-classify.md` fails typecheck
(stripped from the fork DTS); the `01-scope.md` `output` schema rejects a malformed candidates
shape; **(g)** `pnpm lint:tokens` green across the 5 new pages; the not-investment-advice line
renders on `/net-worth`.

## Round 4 — Decisions & the days between paydays (feature expansion)

Rounds 1–3 answer *what happened*, *what's coming*, and *is it correct*. Round 4 answers the two
questions real users actually bring to a money app and never get answered: **"can I afford
this?"** and **"will I make it to payday?"** A fourth specialist team (**`counsel`** —
counselor · timekeeper · debt-planner) turns the app from a mirror into an adviser-shaped tool
that still never advises beyond your own numbers: **purchase decisions** get a grounded verdict
and an optional impulse **cooldown** (the want-it-parking-lot that beats willpower); **life-event
scenarios** ("what if we move / have a kid / drop to 80%?") become saved, comparable what-ifs;
the **bill calendar** finds the low-balance **danger days** inside the month that monthly totals
mathematically cannot see; and **debt payoff plans** give `liabilities` (round 3) a deterministic
avalanche/snowball schedule with a narrative that keeps you on it. Everything below is strictly
additive — same project-rooted db, same capability model, `functions: []` project-wide — and
stays inside the parent plan (data/agents/pages/api/hooks only).

### New database tables (round 4 — 5, bringing the app to 26)

- **`decisions.json`** — one considered purchase or commitment. `id` (pk uuid) · `title`
  (string, required — "the €1,800 gravel bike") · `amount` (number, required) · `recurring`
  (boolean, def false — a subscription-shaped commitment is judged as its **annualized** cost) ·
  `wantedAt` (date, now) · `coolUntil` (date — null = no cooldown; the user picks 7/30/90 days) ·
  `verdict` (string — the counselor's grounded read: fits / tight / doesn't fit, with the three
  numbers that decide it) · `verdictBasis` (json — `{ forecastMonth, goalImpacts:[{goalId,
  monthsDelayed}], dangerDaysAdded }` — every verdict traces to computable facts) · `status`
  (string, def `'considering'` — `'considering'`|`'cooling'`|`'bought'`|`'dropped'`) ·
  `decidedAt` (date) · `createdAt` (date, now).
- **`scenarios.json`** — a saved life-event what-if. `id` (pk) · `name` (string, required,
  unique — "Berlin move", "kid in 2027", "80% hours") · `changes` (json, required — typed deltas:
  `{ incomeDelta?, newRecurring:[{label, amount, cadence}], droppedRecurringIds?, oneOffs:
  [{label, amount, month}] }`) · `projection` (json, required — the deterministic
  `projectCashflow` re-run under the deltas) · `narrative` (string, required — the counselor's
  comparison against the baseline forecast) · `createdAt` (date, now).
- **`paydays.json`** — the income rhythm the danger-day math needs. `id` (pk) · `accountId`
  (references `accounts` onDelete cascade, required) · `dayOfMonth` (number, required — 1–28; a
  second row models a mid-month salary split) · `label` (string, required) · `expectedAmount`
  (number, required) · `createdAt` (date, now). Relation `account` belongsTo `accounts` via
  `accountId`.
- **`payoff_plans.json`** — a debt payoff schedule. `id` (pk) · `name` (string, required,
  unique) · `strategy` (string, required — `'avalanche'`|`'snowball'`|`'custom'`) ·
  `monthlyBudget` (number, required — what goes at debt beyond minimums) · `liabilityOrder`
  (json, required) · `schedule` (json, required — per-month per-liability payment/balance rows
  from the deterministic `payoffSchedule` math, incl. debt-free month and total interest) ·
  `active` (boolean, def false — exactly one active plan; activating deactivates the rest) ·
  `createdAt` (date, now).
- **`danger_days.json`** — the month's projected low-balance windows. `id` (pk) · `month`
  (string, required) · `accountId` (references `accounts` onDelete cascade, required) · `day`
  (number, required) · `projectedBalance` (number, required) · `drivers` (json, required — the
  bills/paydays whose timing collides) · `severity` (string, required — `'watch'`|`'red'` —
  thresholds from settings) · `acknowledged` (boolean, def false) · `createdAt` (date, now).
  Rows are regenerated by the timekeeper's daily pass (delete-and-write per month/account —
  projections are not history; `reconciliations` is history).

New columns on earlier tables (additive `addColumn`): `settings.dangerFloor` (number, def 100 —
below this projected balance a day is `red`); `settings.coolDefaultDays` (number, def 30);
`alerts.kind` gains `'danger-day'` and `'cooldown-ended'`.

### New API endpoints (round 4 — 11, bringing the app to 51)

| name | method + route | I/O sketch |
|---|---|---|
| `askAffordability` | `POST api/decisions` | `{ title, amount, recurring?, coolDays? }` → `Decision` (verdict fills in via the counselor; `spawn`) |
| `listDecisions` / `decideDecision` | `GET api/decisions` / `PATCH api/decisions/:id` | the parking lot; `bought` (writes the transaction stub) / `dropped` |
| `createScenario` | `POST api/scenarios` | `{ name, changes }` → `Scenario` (deterministic projection now; narrative via `spawn`) |
| `listScenarios` / `compareScenarios` | `GET api/scenarios` / `GET api/scenarios/compare` | `{ ids }` → aligned per-month table across scenarios + baseline — pure handler math |
| `setPayday` / `listPaydays` | `PUT/GET api/paydays` | payday CRUD |
| `billCalendar` | `GET api/calendar` | `{ month? }` → `{ days: [{ day, bills:[…], paydays:[…], projectedBalance }] }` — deterministic: recurring_charges' `nextExpected` + paydays + current cleared balance |
| `listDangerDays` | `GET api/calendar/danger` | `{ month? }` → `DangerDay[]` (plus `acknowledgeDangerDay` `PATCH`) |
| `createPayoffPlan` | `POST api/payoff` | `{ name, strategy, monthlyBudget }` → `PayoffPlan` (schedule computed; narrative via `spawn`; `activatePayoffPlan` `PATCH` toggles) |

`billCalendar`, `compareScenarios`, and `payoffSchedule` are round 4's deterministic
centrepieces. `askAffordability` verdicts are **assembled from three existing computations** —
the forecast delta, goal delays, danger days added — so "doesn't fit" always shows its work.

### New hooks (round 4 — 3, bringing the app to 13)

- **`judge-decision.ts`** — `database` `decisions:insert`, imperative handler:
  `delegate('counsel/counselor','judge', { input: { decisionId: row.id } })` — write
  `verdict`/`verdictBasis`; when `coolUntil` is set, status → `cooling`.
- **`cooldown-watch.ts`** — `cron`, `daily: '08:05'`, `trigger: 'counsel/counselor#recheck'` —
  for decisions whose `coolUntil` passed: **re-judge with current numbers** (the month moved on),
  write a `cooldown-ended` alert with old-verdict vs now-verdict ("you waited 30 days; it now
  fits / still doesn't"). The cooldown isn't a timer, it's a second opinion from a future month.
- **`danger-scan.ts`** — `cron`, `daily: '07:35'`, `trigger: 'counsel/timekeeper#scan'` —
  regenerate the month's `danger_days` from `billCalendar` math; on NEW `red` days only, one
  `danger-day` alert naming the drivers and the cheapest fix (move a bill date, delay a decision
  in the parking lot).

**Loop-guard sanity.** `decisions:insert` → counselor updates the row (no update hook on
`decisions`) ⇒ stops at depth 1. The two crons write `danger_days`/`alerts`/`decisions` — none
watched ⇒ stop. `decideDecision('bought')` writes a `transactions` stub → round-1 `categorize`
fires once (the intentional round-1 path — a decision becoming real enters the ledger like any
other line) ⇒ stops at the bookkeeper as always. **Self-write exclusion** backstops; danger-day
regeneration is delete-and-write and fires nothing (no hooks on `danger_days`).

### New pages (round 4 — 5, bringing the app to 22) + components

| File | Route | Reads / writes |
|---|---|---|
| `pages/decide.tsx` | `/decide` | the parking lot: `listDecisions` by status; `askAffordability` intake; `decideDecision`; `<Chat agent="counsel/counselor">` dock ("can I afford…") |
| `pages/calendar.tsx` | `/calendar` | `billCalendar` month grid with payday/bill/danger markers; `acknowledgeDangerDay`; `setPayday` |
| `pages/scenarios.tsx` | `/scenarios` | `createScenario` builder; `compareScenarios` aligned table |
| `pages/payoff.tsx` | `/payoff` | `createPayoffPlan`/`activatePayoffPlan`; the schedule chart + debt-free date |
| `pages/decisions/[id].tsx` | `/decisions/:id` | one decision: verdict, basis links (forecast month, goal impacts, danger days), cooldown state |

New shared components (design tokens only): `VerdictCard` (fits/tight/doesn't-fit as semantic
tokens, basis rows linked), `MonthCalendar` (bill/payday/danger markers), `ScenarioColumn`,
`PayoffCurve` (balance-over-time, debt-free marker), `CooldownBadge`. The dashboard gains the
month's next danger day (if any) beside the alerts; `/subscriptions` gains "judge this" linking a
recurring charge into `askAffordability` as an annualized decision.

### The `counsel` space (fourth project-scoped space, full format)

`money/spaces/counsel/` — the decision team. `functions: []` on every agent (project invariant):

| Agent | `db:read` tables | `db:write` tables | `api:call` allow | Role |
|---|---|---|---|---|
| **counselor** | `decisions, goals, forecasts, budgets, transactions, recurring_charges, danger_days, scenarios, settings` | `decisions, scenarios, alerts` | `cashflowForecast, budgetStatus, billCalendar` | verdicts + cooldown re-judgments + scenario narratives; shows its work, never moralizes |
| **timekeeper** | `recurring_charges, paydays, accounts, transactions, danger_days, decisions, settings` | `danger_days, alerts` | `billCalendar` | the daily timing scan; names drivers and the cheapest fix |
| **debt-planner** | `liabilities, payoff_plans, transactions, budgets, forecasts, settings` | `payoff_plans, alerts` | `cashflowForecast` | schedule narratives, monthly keep-on-it note, plan-vs-actual drift flags |

- **Agent-frontmatter features exercised**: the counselor declares
  `canDelegateTo: [advisor/forecaster#project]` (a scenario with structural income changes
  warrants a full re-forecast — cross-space allowlist) and `defaultAction: judge`; the
  debt-planner declares `defaultAction: plan`. The counselor's verdict tasklist ends in an
  `ask()` **only in chat sessions** — hook-driven judgments never block (headless runs file the
  verdict; the parking lot is where the user responds).
- **Tasklists**: `judge/` — `01-numbers.md` (`role: explore`, `output: { basis: 'json' }` — the
  three computations via `apiCall`s), `02-goals.md` (`dependsOn: [numbers]` — per-goal delay
  math), `03-verdict.md` (write verdict + basis; `functions: []`). `scenario/` — deltas →
  project (task-level `canDelegateTo: [advisor/forecaster#project]`, the ONLY task that may) →
  compare-and-narrate. `payoff/` — inventory (`role: explore`) → schedule
  (`functions: [payoffSchedule]`) → narrate.
- **Functions** (`functions/*.ts`, deterministic): `payoffSchedule` (strategy + budget +
  liabilities → the month-by-month table, interest math documented), `dangerScan` (the same
  projection `billCalendar` serves — single definition), `annualizeCommitment`, `goalDelay`
  (amount vs goal funding rate → months delayed).
- **Components**: view `VerdictPreview` (chat-rendered verdict card), view `DangerWeek`; form
  `CooldownPick` — the `ask()` sheet in chat ("park it? 7 / 30 / 90 days / decide now").
- **Knowledge** (`knowledge/decisions/`, each field `index.md` + ≥2 aspects): `affordability/`
  (`three-number-verdicts.md`, `recurring-is-annual.md`, `tight-is-a-verdict.md` — "tight" with
  the numbers beats a false yes/no), `impulse-craft/` (`cooldown-psychology.md`,
  `future-self-second-opinion.md`, `no-moralizing.md` — the app judges fit, never worth),
  `debt/` (`avalanche-vs-snowball.md`, `minimums-are-sacred.md`, `not-refinancing-advice.md` —
  the planner schedules the user's own debts; recommending products is out of scope, stated in
  UI and charter), `cash-timing/` (`danger-day-anatomy.md`, `cheapest-fix-first.md`).

### Phases & verification additions (round 4)

**(R4-1)** schemas; **(R4-2)** `counsel` full-format; **(R4-3)** the 11 endpoints
(`billCalendar`/`dangerScan` and `payoffSchedule` single-definition checks); **(R4-4)** the 3
hooks; **(R4-5)** the 5 pages; **(R4-6)** tests. Verification: **(a)** `askAffordability` on a
fixture where the amount delays one goal by 2 months and adds one red day → the verdict's basis
carries exactly those, page-linkable; a recurring decision is judged annualized; **(b)** a
30-day cooldown ending after a fat-month import flips the re-judgment (old vs new verdict in the
alert — the second-opinion property observed); **(c)** `billCalendar` vs `dangerScan` never
disagree (property test across fixture months); acknowledging a red day silences it without
deleting it; a bill collision names both drivers; **(d)** avalanche vs snowball on two seeded
debts: schedules match hand math to the cent, debt-free months differ as expected, activating
one deactivates the other; **(e)** `decideDecision('bought')` → one transaction stub → the
round-1 categorize path runs (cascade pinned end-to-end from parking lot to ledger); **(f)** in
`scenario/`, only the project task may delegate (task-level allowlist; typecheck failure
elsewhere); **(g)** `pnpm lint:tokens` green; the not-refinancing-advice line renders on
`/payoff`.

## Round 5 — The mentor: briefings, patterns & experiments (feature expansion)

Rounds 1–4 built four teams that each know one slice. Round 5 adds the layer users actually
experience as *intelligence*: something that reads **all of it** and talks to you like a sharp
friend who happens to have perfect memory. Three genuinely AI-shaped capabilities: the **Sunday
briefing** — five minutes, one narrative, one action, fused from every space (alerts, danger
days, goal pace, parked decisions, the forecast) instead of five dashboards; **pattern mining**
— the behavioral shapes hiding in your own ledger ("delivery spikes every Friday you work late",
"the post-payday 48 hours cost €130/month"), surfaced as evidence-backed, dismissible
observations, never accusations; and **spending experiments** — a pattern becomes a two-week
protocol with a deterministic baseline and a measured verdict ("delivery pause: projected €62,
actual €71 — keep it?"). Plus **explain-any-number**: every figure in the app becomes clickable
into a deterministic delta decomposition the analyst narrates. A fifth team (**`mentor`** —
briefer · pattern-miner · experimenter) owns it; `functions: []` project-wide holds — this round
is pure synthesis over your own rows, the strongest proof that the AI value here needs no web.
Strictly additive; data/agents/pages/api/hooks only.

### New database tables (round 5 — 3, bringing the app to 29)

- **`briefings.json`** — one weekly read. `id` (pk uuid) · `weekStart` (date, required, unique) ·
  `body` (string, required — markdown, ≤ five minutes' reading, written to the `briefing-craft`
  knowledge: lead with what changed, one number per claim, end with exactly one action) ·
  `focusAction` (json, required — `{ label, route, why }` — THE one thing, deep-linked into the
  app: a decision to unpark, a finding to resolve, a budget to adjust) · `inputs` (json, required
  — the machine-readable digest of what it fused: open alerts, danger days, goal paces, parked
  decisions, forecast month — so the brief is auditable against its sources) · `createdAt`
  (date, now).
- **`patterns.json`** — one mined behavioral shape. `id` (pk) · `title` (string, required —
  "Friday delivery spike") · `description` (string, required — the pattern in plain language,
  no moralizing) · `evidence` (json, required — the transaction ids + the aggregation that
  demonstrates it; every pattern is re-checkable) · `monthlyImpact` (number, required — the
  deterministic cost/benefit estimate from `patternImpact`) · `status` (string, def `'candidate'`
  — `'candidate'`|`'confirmed'`|`'dismissed'` — the user judges; dismissed patterns are never
  re-mined (fingerprint kept)) · `fingerprint` (string, required, unique — normalized
  pattern key so re-mining can't resurrect a dismissal) · `createdAt` (date, now).
- **`experiments.json`** — one measured behavior change. `id` (pk) · `patternId` (references
  `patterns` onDelete setNull — most experiments come from a pattern; free-standing allowed) ·
  `hypothesis` (string, required — "pausing delivery apps for 14 days saves ≈ €62") ·
  `protocol` (string, required — what the user actually does, one paragraph) · `startAt`/`endAt`
  (dates, required) · `baseline` (json, required — the matched-window spend computed at start by
  `experimentBaseline`; frozen, never recomputed) · `result` (json — the same math over the live
  window; null until `endAt`) · `verdict` (string — `'worked'`|`'partly'`|`'didnt'` + the
  experimenter's one-paragraph honest read; null until concluded) · `status` (string, def
  `'active'` — `'active'`|`'concluded'`|`'abandoned'`) · `createdAt` (date, now).

New columns (additive `addColumn`): `alerts.kind` gains `'experiment-concluded'`;
`settings.briefingDay` (number, def 0 — Sunday).

### New API endpoints (round 5 — 9, bringing the app to 60)

| name | method + route | I/O sketch |
|---|---|---|
| `getBriefing` / `listBriefings` | `GET api/briefing/:week` / `GET api/briefing` | the read + archive |
| `explainDelta` | `GET api/explain` | `{ month, categoryId?, compareTo? }` → `{ delta, drivers: [{ kind:'new-merchant'\|'price-change'\|'frequency'\|'one-off', label, amount, transactionIds }] }` — the deterministic decomposition behind every clickable number |
| `listPatterns` / `reviewPattern` | `GET api/patterns` / `PATCH api/patterns/:id` | candidates first; confirm/dismiss (dismissal is permanent via fingerprint) |
| `startExperiment` | `POST api/experiments` | `{ patternId?, hypothesis, protocol, days? }` → `Experiment` (baseline frozen now) |
| `getExperiment` / `listExperiments` | `GET api/experiments/:id` / `GET` | live progress: the same window math running against today |
| `abandonExperiment` | `PATCH api/experiments/:id` | `{ id }` → `Experiment` (no verdict, no guilt — recorded and closed) |

`explainDelta` is round 5's deterministic centrepiece and its biggest UX lever: month-over-month
change decomposed into named drivers with the exact lines behind each — the analyst, briefer,
and pattern-miner all narrate **this** decomposition, and the dashboard/budget/review pages all
deep-link into it. Established rules hold (equality-only `where`, typed `HttpError`, `spawn`
from handlers).

### New hooks (round 5 — 3, bringing the app to 16)

- **`weekly-briefing.ts`** — `cron`, `daily: '07:00'`, `briefingDay`-gated in the agent →
  `mentor/briefer#brief` — fuse the week via `apiCall`s (`budgetStatus`, `cashflowForecast`,
  `billCalendar`, `netWorth`, `explainDelta`), write the one narrative + the one `focusAction`.
- **`mine-patterns.ts`** — `cron`, `daily: '07:10'`, first-of-month-gated →
  `mentor/pattern-miner#mine` — run the deterministic candidate generators
  (`minePatternCandidates`: weekday/time-of-month/merchant-frequency shapes), have the model
  judge which candidates are *real and worth saying*, write ≤3 new `candidate` patterns
  (fingerprint-deduped against everything ever mined).
- **`experiment-watch.ts`** — `cron`, `daily: '07:50'`, `trigger: 'mentor/experimenter#watch'`
  — refresh active experiments' live window; at `endAt`, compute `result`, write the honest
  `verdict` + one `experiment-concluded` alert; suggest (in the verdict text only, never
  auto-apply) the follow-through — a budget change, a rule, a cancelled subscription.

**Loop-guard sanity.** All three write only `briefings`/`patterns`/`experiments`/`alerts` —
none watched ⇒ every chain stops at depth 1. Pattern mining is capped (≤3/month), fingerprinted,
and dismissals are terminal — the mentor cannot become a nag by construction. **Self-write
exclusion** backstops as ever.

### New pages (round 5 — 4, bringing the app to 26) + components

| File | Route | Reads / writes |
|---|---|---|
| `pages/briefing.tsx` | `/briefing` | this week's read + archive; the `focusAction` button; `<Chat agent="mentor/briefer">` ("why is groceries the focus?") |
| `pages/patterns.tsx` | `/patterns` | `listPatterns`; confirm/dismiss; evidence drill-down into `explainDelta`; "try an experiment" → intake |
| `pages/experiments/index.tsx` | `/experiments` | active with live progress bar (baseline vs current window), concluded with verdicts |
| `pages/explain.tsx` | `/explain` | the driver decomposition view every number deep-links into (`?month=&categoryId=`) |

New components (design tokens only): `BriefingView` (reading-first typography), `FocusActionCard`,
`PatternCard` (evidence-expandable, dismiss-forever affordance), `ExperimentProgress` (baseline
vs live, no red until concluded), `DriverBar` (delta decomposition rows). Every number on the
dashboard, budgets, and reviews pages becomes an `explainDelta` deep-link — the app-wide
"why?" affordance.

### The `mentor` space (fifth project-scoped space, full format)

`money/spaces/mentor/` — the synthesis team. `functions: []` on every agent (project invariant —
the whole round is db-only intelligence):

| Agent | `db:read` tables | `db:write` tables | `api:call` allow | Role |
|---|---|---|---|---|
| **briefer** | all read tables of rounds 1–4 + `briefings, patterns, experiments` | `briefings` | `budgetStatus, cashflowForecast, billCalendar, netWorth, explainDelta` | the Sunday read; one action, every claim numbered and auditable against `inputs` |
| **pattern-miner** | `transactions, categories, recurring_charges, patterns, settings` | `patterns` | `explainDelta` | judge deterministic candidates; ≤3/month; evidence or silence |
| **experimenter** | `experiments, patterns, transactions, budgets, alerts, settings` | `experiments, alerts` | `explainDelta` | frozen baselines, honest verdicts, suggested (never auto-applied) follow-through |

- **Frontmatter features**: the briefer declares `canDelegateTo: [advisor/forecaster#project,
  counsel/counselor#judge]` — the brief may commission a fresh projection or re-judge a parked
  decision whose cooldown ended this week, so the Sunday read is current, not stale (hard
  allowlist). `defaultAction: brief` / `mine` / `watch` respectively.
- **Tasklists**: `brief/` — `01-gather.md` (`role: explore`, `output: { inputs: 'json' }` — the
  five `apiCall`s into one typed digest), `02-focus.md` (`dependsOn: [gather]` — pick THE
  action; the task fails if it picks more than one), `03-write.md` (`functions: []` — narrative
  over `inputs` only; a claim without a matching input number fails review). `mine/` —
  candidates (`role: explore`, `functions: [minePatternCandidates, patternImpact]`) → judge
  (**`forEach: "candidates.shapes"`**, each fork returns keep/drop + phrasing) → file
  (fingerprint dedupe). `experiment/` — baseline (`functions: [experimentBaseline]`) → watch →
  verdict.
- **Functions** (deterministic): `minePatternCandidates` (weekday/time-of-month/merchant-
  frequency aggregations → candidate shapes with supporting rows), `patternImpact` (shape →
  monthly cost estimate), `experimentBaseline` (matched prior window, seasonality-adjusted via
  same-weekday matching — documented), `deltaDrivers` (the `explainDelta` math — single
  definition, shared with the handler).
- **Components**: view `BriefingPreview` (chat-rendered focus + top numbers), form
  `ExperimentIntake` — the `ask()` sheet from a pattern card ("14 days? what's the protocol in
  your words?" — the user writes the protocol; commitment they author is commitment they keep).
- **Knowledge** (`knowledge/mentoring/`): `briefing-craft/` (`one-action.md`,
  `numbers-not-adjectives.md`, `five-minute-ceiling.md`), `pattern-ethics/`
  (`observation-not-judgment.md`, `dismissed-means-dismissed.md`, `evidence-or-silence.md`),
  `experiment-method/` (`frozen-baselines.md`, `honest-verdicts.md`,
  `follow-through-not-automation.md` — the app proposes the rule/budget change; the user applies
  it on the pages that own those writes).

### Phases & verification additions (round 5)

**(R5-1)** schemas; **(R5-2)** `mentor` full-format; **(R5-3)** the 9 endpoints
(`explainDelta`/`deltaDrivers` single definition); **(R5-4)** the 3 hooks; **(R5-5)** the 4
pages + the app-wide explain deep-links; **(R5-6)** tests. Verification: **(a)** the Sunday
brief: every number in `body` appears in `inputs` (mechanical claim-audit); exactly one
`focusAction`, and its route resolves; a week where a parked decision's cooldown ended shows the
re-judgment (delegation allowlist observed); **(b)** `explainDelta` drivers sum to the delta
exactly on fixtures (new merchant / price change / frequency / one-off each isolated);
**(c)** mining on a seeded Friday-spike ledger yields that pattern with correct
`monthlyImpact`; dismissing it and re-mining yields nothing (fingerprint pinned); a clean
ledger yields zero patterns (evidence-or-silence pinned); **(d)** an experiment's `baseline` is
byte-identical at conclusion to what was frozen at start; the verdict compares like windows;
abandoning writes no verdict and no alert; nothing auto-applied anywhere (no writes to
budgets/rules from `mentor` — capability walls make this structural); **(e)** `pnpm
lint:tokens` green across the 4 new pages.

## Round 6 — The library: researched content, curated answers & conversation (feature expansion)

Five rounds of agents compute over your rows; none of them can *teach you anything about money*.
Round 6 adds researched, curated, **db-stored content** — and does it without breaking the
project's load-bearing privacy invariant, by making it **architecturally impossible** for
financial data to reach the web: a sixth space (**`library`** — scholar · archivist · guide) is
the ONLY space in the project with web functions, and it holds **zero `db:read` on any ledger
table** — no transactions, no accounts, no budgets, nothing. Web access and ledger access are
disjoint capability sets; the invariant stops being a promise and becomes a shape. The library
curates a **reference shelf** (cited explainers on the topics the app lives in — budgeting
methods, subscription-cancellation scripts, debt strategy, tax-hygiene primers), answers
**user-asked questions** (queries the user typed are the user's to send; queries derived from
ledger rows are forbidden and unconstructible), and keeps it all **fresh** (entries carry
freshness and get re-verified). And round 6 adds the catalog's new user↔AI surface:
**conversation starters** — bounded, dismissible openers where an agent reaches toward the user
with something worth talking about, each opening a pre-seeded chat with the *right* agent.
Strictly additive; data/agents/pages/api/hooks only.

### New database tables (round 6 — 3, bringing the app to 32)

- **`shelf_entries.json`** — one curated explainer. `id` (pk uuid) · `topic` (string, required,
  unique — "cancelling a gym membership", "avalanche vs snowball, honestly") · `curriculum`
  (string, required — `'seeded'`|`'requested'` — the seeded curriculum ships with the template;
  requested entries come from user questions that deserved a durable answer) · `body` (string,
  required — markdown, written to the `shelf-craft` knowledge: practical, sourced, no
  affiliate-shaped advice) · `sources` (json, required — `{ title, url, checkedAt }[]`; every
  claim traces) · `freshness` (string, def `'fresh'` — `'fresh'`|`'aging'`|`'stale'` — set by
  the deterministic age rule; `stale` queues re-verification) · `linkedFrom` (json, def `[]` —
  where the app surfaces it: alert kinds, pattern fingerprints, page routes — maintained by the
  guide) · `createdAt`/`verifiedAt` (dates) .
- **`money_questions.json`** — one user-asked question and its answer. `id` (pk) · `question`
  (string, required — verbatim as typed; the ONLY user-originated text the library ever sees) ·
  `answer` (string — cited markdown; null while `researching`) · `sources` (json, def `[]`) ·
  `needsYourNumbers` (boolean, def false — true when a complete answer requires the user's own
  figures; the answer then covers the general picture and the UI offers the **analyst** dock —
  a designed handoff between two agents with disjoint powers) · `promotedToShelf` (string —
  `shelf_entries` id when the answer proved durable) · `status` (string, def `'researching'` —
  `'researching'`|`'answered'`) · `createdAt` (date, now).
- **`starters.json`** — one agent-initiated conversation opener. `id` (pk) · `agent` (string,
  required — the `space/agent` the chat opens with) · `hook` (string, required — the one-line
  opener shown on the chip: "Netflix went up 30% — want the cancellation script?") · `seed`
  (string, required — the pre-seeded first message context the chat session starts from) ·
  `reason` (json, required — the row/alert/pattern that justified it; auditable) · `status`
  (string, def `'open'` — `'open'`|`'engaged'`|`'dismissed'`|`'expired'`) · `expiresAt` (date,
  required — starters die quietly; a stale opener is worse than none) · `createdAt` (date,
  now). **Hard bounds, handler-enforced**: ≤2 `open` at once app-wide, dedupe by `reason`
  fingerprint, dismissal is terminal for that fingerprint.

New columns (additive `addColumn`): `alerts.shelfEntryId` (string — an alert can carry its
explainer: the price-increase alert links the cancellation-script entry);
`patterns.shelfEntryId` (same, on pattern cards).

### New API endpoints (round 6 — 8, bringing the app to 68)

| name | method + route | I/O sketch |
|---|---|---|
| `browseShelf` / `getShelfEntry` | `GET api/shelf` / `GET api/shelf/:id` | the shelf by topic/freshness; one entry with sources |
| `askLibrary` | `POST api/questions` | `{ question }` → `MoneyQuestion` (`researching`; answer hook fires) |
| `listQuestions` / `getQuestion` | `GET api/questions` / `GET api/questions/:id` | history; one Q&A with sources |
| `listStarters` | `GET api/starters` | `{}` → open, unexpired `Starter[]` (the home-page chips) |
| `engageStarter` | `PATCH api/starters/:id` | `{ id, action:'engage'\|'dismiss' }` → on engage: opens the agent chat pre-seeded with `seed`; on dismiss: terminal for the fingerprint |
| `shelfHealth` | `GET api/shelf/health` | `{}` → `{ fresh, aging, stale, coverage: [{ linkedSurface, hasEntry }] }` — deterministic freshness + coverage audit |

Established rules hold. The **linking** of shelf entries into alerts/patterns is done by the
`guide` (which reads alert *kinds* and pattern *fingerprints* — metadata, never amounts or
merchants beyond what the entry topic needs — and even that lives inside the no-web `mentor`-
side boundary: the guide has **no web either**; see the capability table).

### New hooks (round 6 — 3, bringing the app to 19)

- **`curate-shelf.ts`** — `cron`, `daily: '05:30'`, Wednesday-gated in the agent →
  `library/scholar#curate` — write the next unseeded curriculum entry OR re-verify the oldest
  `stale` one (freshness rule: `verifiedAt` > 120 days → `aging`, > 240 → `stale`); one entry
  per week — a shelf that grows slowly and stays true beats a content farm.
- **`answer-question.ts`** — `database` `money_questions:insert`, imperative handler:
  `delegate('library/scholar','answer', { input: { questionId: row.id } })` — research, cite,
  set `needsYourNumbers` honestly; an answer that proved durable gets proposed for shelf
  promotion (the archivist judges).
- **`open-starters.ts`** — `cron`, `daily: '08:10'`, `trigger: 'library/guide#starters'` — scan
  the *surfaces* (new alerts by kind, fresh patterns, cooldowns ending, a new shelf entry
  matching an open alert) and open ≤1 new starter per day within the ≤2-open bound, each
  pointing at the right agent (`ledger/analyst` for "why", `counsel/counselor` for a parked
  decision, `library/scholar` for a shelf read).

**Loop-guard sanity.** All three write only `shelf_entries`/`money_questions`/`starters`
(unwatched) ⇒ every chain stops at depth 1. The scholar cannot read ledger tables (no
capability) and the guide cannot reach the web (no functions) — the two halves of the privacy
shape, each enforced at typecheck/host level, both pinned by tests.

### New pages (round 6 — 3, bringing the app to 29) + components

| File | Route | Reads / writes |
|---|---|---|
| `pages/shelf/index.tsx` | `/shelf` | `browseShelf` + `shelfHealth`; the ask box (`askLibrary`); `<Chat agent="library/scholar">` dock |
| `pages/shelf/[id].tsx` | `/shelf/:id` | one entry: body, sources with checked dates, freshness badge, "where this appears" |
| `pages/questions.tsx` | `/questions` | Q&A history; `needsYourNumbers` rows carry the analyst-dock handoff button |

New components (design tokens only): `StarterChips` (mounted on the dashboard — the new
front-door surface: ≤2 chips, each `engageStarter` into a pre-seeded chat), `ShelfCard`
(freshness badge + source count), `SourceLine` (title + checkedAt), `HandoffButton` ("get YOUR
numbers → analyst"). Alerts and pattern cards render their linked shelf entry inline
("→ the cancellation script") — content meets moment.

### The `library` space (sixth project-scoped space, full format)

`money/spaces/library/` — the only web-capable space in the project, and the only one that
cannot see money:

| Agent | `db:read` tables | `db:write` tables | `functions` | Role |
|---|---|---|---|---|
| **scholar** | `shelf_entries, money_questions, settings` | `shelf_entries, money_questions` | `webSearch, webFetch` | research + write entries and answers; cite everything; jurisdiction-neutral, product-neutral |
| **archivist** | `shelf_entries, money_questions` | `shelf_entries` | `[]` | freshness sweeps, promotion judgments (question → shelf), dedupe/merge of overlapping topics |
| **guide** | `shelf_entries, starters, alerts, patterns, decisions, settings` | `starters, alerts, patterns` | `[]` | link entries into surfaces (`linkedFrom`, `shelfEntryId`); open the day's ≤1 starter; no web, by design |

- **The privacy shape, stated once**: the scholar/archivist read NO ledger table (their
  `db:read` lists above are exhaustive — a `db.query('transactions', …)` fails at host level
  and is absent from their DTS); the guide, which does read alert/pattern metadata, has
  `functions: []`. No agent in the project holds both web and ledger. The charter adds the
  prose half: the scholar answers the question as asked and never requests figures; a question
  that needs them sets `needsYourNumbers` and stops.
- **Frontmatter features**: the scholar declares `defaultAction: answer` (any freeform ask in
  its dock routes right); `actions:` bind `curate` (tasklist `curate`) and `answer` (tasklist
  `answer`). The guide declares `canDelegateTo: []` — it opens conversations, it never has
  them (the loader-warned explicit no-delegation shape, used deliberately once in the
  catalog). The archivist's promotion path notes the **space-knowledge lifecycle**: an entry
  that proves foundational (linked from 3+ surfaces, stable through 2 re-verifications) is
  flagged `promoteToSpaceKnowledge` in its row — an *authoring* request THING routes to
  `system-appbuilder`, which folds it into `library/knowledge/` as a proper field aspect (the
  trips-app precedent: runtime agents never write space `knowledge/` files; durable content is
  promoted through the authoring path, making future scholars smarter without a capability
  violation).
- **Tasklists**: `curate/` — `01-pick.md` (`role: explore` — next curriculum gap or oldest
  stale, via `shelfHealth`-shaped reads), `02-research.md` (`functions: [webSearch, webFetch]`
  scoped to THIS task — the round-4 workshop pattern), `03-write.md` (`functions: []` — cited
  body from `02`'s gathered sources only; `citeCheck`-style function gate before filing).
  `answer/` — read-question → research (web-scoped task) → answer (+ `needsYourNumbers`
  verdict) → propose-promotion (`optional: true`, archivist-bound). `starters/` — scan
  (`role: explore`, `output: { candidates: 'json' }`) → pick-one (the task fails on two) →
  open.
- **Functions** (deterministic): `freshnessRule` (verifiedAt → fresh/aging/stale — the same
  rule `shelfHealth` serves), `starterBounds` (open-count + fingerprint dedupe — the same rule
  the handler enforces), `sourceCheck` (body → claims lacking a source entry), `topicOverlap`
  (new topic vs shelf → merge candidates for the archivist).
- **Components**: view `ShelfPreview` (chat-rendered entry card), view `AnswerCard` (answer +
  sources + the handoff state); form `PromoteSheet` — the archivist's `ask()` when a promotion
  judgment is genuinely close ("this answer keeps coming up — make it a shelf entry?").
- **Knowledge** (`knowledge/librarianship/`): `shelf-craft/` (`practical-not-encyclopedic.md`,
  `product-neutrality.md` — no bank/broker/app recommendations, ever; `jurisdiction-honesty.md`),
  `research-method/` (`source-quality.md`, `cite-or-cut.md`, `freshness-discipline.md`),
  `conversation-craft/` (`starters-worth-tapping.md`, `right-agent-for-the-opener.md`,
  `two-open-max.md` — the guide's restraint rules, mirrored by the handler bounds).

### Phases & verification additions (round 6)

**(R6-1)** schemas + columns; **(R6-2)** the `library` space full-format; **(R6-3)** the 8
endpoints (`freshnessRule`/`starterBounds` single-definition); **(R6-4)** the 3 hooks;
**(R6-5)** the 3 pages + StarterChips + inline entry links; **(R6-6)** tests. Verification:
**(a)** the privacy shape, adversarially: the scholar attempting `db.query('transactions',…)`
→ host error + absent from DTS; the guide calling `webSearch` → typecheck failure; a grep of
every `library` capability list confirms web∩ledger = ∅ (structural test); **(b)** `askLibrary`
→ a cited answer; a fixture question that needs figures sets `needsYourNumbers` and the answer
contains no request for them; the handoff button opens the analyst dock; **(c)** Wednesday
curation writes exactly one entry (or one re-verification); every body claim passes
`sourceCheck`; freshness transitions match the rule on aged fixtures; **(d)** a price-increase
alert renders its linked cancellation-script entry; `shelfHealth.coverage` flags a linked
surface with no entry; **(e)** starters: never >2 open (bound test under a flood of
candidates), dedupe by fingerprint survives re-scans, dismissal is terminal, expiry silent;
engaging opens the named agent pre-seeded with `seed`; **(f)** a thrice-linked, twice-verified
entry gets flagged for space-knowledge promotion and the flag routes as an authoring request
(never a runtime write to `knowledge/` — pinned); **(g)** `pnpm lint:tokens` green.

## Phases & order

Assumes the parent plan's engine (db + capability globals, api runtime, typed-contract build, pages
build, hooks runtime, chat) exists. Money-specific work on top:

1. **Schemas** — the nine `database/*.json`; verify FKs (`transactions` → accounts/categories/
   recurring_charges; `rules`/`budgets` → categories), required descriptions pass the fail-loud
   loader; row types generate (`Transaction`, `RecurringCharge`, `MonthlyReview`, `Category`…).
2. **Import pipeline** — `importTransactions` (CSV parse, `dedupeKey` skip, rules-first
   categorization with user-first/longest-pattern-first ordering, `hits` bump); `updateTransaction`
   with `always:true` → user rule.
3. **`ledger` space** — the three agents' `instruct.md` (config-bearing `capabilities:` —
   read-wide/write-narrow, `functions: []` space-wide) with the bookkeeper's rule-per-merchant
   contract and the watchdog's alert-dedupe contract.
4. **API** — the remaining endpoints; `budgetStatus` as the shared deterministic aggregation
   (transfers excluded, pace math).
5. **Hooks** — `categorize` (database:insert, coalesced, queue-draining), `watch` (cron daily),
   `monthly-review` (cron daily, reviewDay-gated); confirm boundedness (bookkeeper updates don't
   re-fire the insert hook; nothing watches rules/alerts/reviews).
6. **Pages** — dashboard (budget bars + alerts + stats), transactions (import drop + live
   categorization poll), budgets, subscriptions, reviews, settings (rules table with `hits`);
   `<Chat agent="ledger/analyst">` on the dashboard; design-system token gate (no raw colors —
   over-budget state uses `var(--destructive)`, not a literal red).
7. **Serving** — seed each pod's `money` project from the checked-in template (standard categories +
   settings row); serve under generic `lmthing.app/money/*`; Studio manages it under
   `/api/projects/money/app`.
8. **Additional features** — goals, multi-currency, import profiles, annual review (§above); each
   additive, shippable after the core loop.
9. **Docs** — fold into `SPACE_DEVELOPMENT.md` "Project apps" as the high-volume/self-automation
   example.

## Verification (end-to-end, local)

1. Load the `money` project → schemas validate (descriptions/FK/relations), `types/generated.d.ts`
   has `Account`/`Category`/`Transaction`/`Rule`/`Budget`/`RecurringCharge`/`Alert`/`MonthlyReview`
   with relation fields (`Transaction.category?: Category`).
2. `lmthing serve`; `importTransactions` with a 50-row CSV where 30 rows match seeded rules →
   response `{ inserted:50, autoCategorized:30, needsReview:20 }`; the 30 carry
   `status:'categorized'` + `merchantLabel` with **zero** agent involvement.
3. The 20-row burst **coalesces into one** bookkeeper run (mock streamFn): it drains the queue,
   every line ends `categorized`, and `rules` gained one row per distinct new merchant. Re-import
   the same CSV → `{ inserted:0, skippedDuplicates:50 }` and **no** hook fire.
4. Import next month's CSV containing those same merchants → `needsReview:0` — the self-automation
   claim, observable.
5. `updateTransaction` `{ always:true }` on a line the agent filed → a `createdBy:'user'` rule; a
   later import of that merchant follows the user rule even though the agent rule still exists.
6. Seed three months of a steady `Netflix` line, run `watch` → one `recurring_charges` row
   (`cadence:'monthly'`, lines linked via `recurringChargeId`); bump the amount 30% and re-run →
   `status:'price-changed'` + one `price-increase` alert; a second run adds **no duplicate** alert.
7. Set a budget, insert spend past `paceAlertRatio` pace, run `watch` → `over-budget-pace` alert
   whose numbers equal `budgetStatus`; `dismissAlert` hides it from `/`.
8. On `reviewDay`, `monthly-review` → one `monthly_reviews` row for the prior month whose `totals`
   match `budgetStatus` for that month; restart the pod that day → boot catch-up doesn't duplicate
   (unique `month`).
9. Capability walls: the bookkeeper writing `budgets` → host error naming its allowed tables; any
   `ledger` agent calling `webFetch` → typecheck failure (`functions: []`); `apiCall('setBudget')`
   from the watchdog → host error naming its allowed names.
10. Chat: `<Chat agent="ledger/analyst">` "how much on eating out this month?" → answer matches the
    transactions page total; history under `money/spaces/ledger/sessions/`.
11. Backup: `app.sql` + schemas + pages + api + hooks + ledger space committed; `**/sessions/` not;
    restore rebuilds `app.db` from `app.sql` (dedupeKeys intact → re-import still idempotent).

## Notes

- **Reuses the parent engine wholesale** — no money-specific runtime; data + agents + pages + hooks
  on the shared layer. If a mechanism is missing here, it belongs in
  [project-as-application.md](./project-as-application.md), not a money fork.
- **Why it's a good AI-assisted app** — bookkeeping is the canonical recurring chore: high value
  when done, universally skipped, and made of exactly the two halves this engine splits well —
  fuzzy judgment (what is `SQ *BLUE BOTTLE 4821`?) for the model, arithmetic (totals, pace, dedupe)
  for handler code. The rules table is the catalog's clearest demonstration that an agent can
  *cheapen itself over time* instead of being a per-row cost forever.
- **Deterministic money math, always** — every number a user might check (totals, budget pace,
  annual subscription cost) is computed in handler code; agents narrate and classify, they never
  add. `budgetStatus` is the single source both sides consume.
- **`db.query` `where` is equality-only** in the shipped engine — month windows, `amount < 0`,
  pattern matching against `rules`, cadence detection are all query-wide-then-filter-in-JS in
  handlers/agent prompts, not SQL predicates. At personal-ledger volume (thousands of rows) this is
  fine; if it ever isn't, the fix is an engine-level range filter, not app-side SQL.
- **No external-binding registry exists in v1** — and this app doesn't want one: `functions: []`
  space-wide keeps financial data out of any outbound call. Bank *connections* (aggregator APIs)
  are explicitly out of scope for v1 and would be a parent-plan-level trust decision, not an app
  patch.
- **CSV dialects vary wildly** — v1 ships a tolerant parser (delimiter sniff, `DD.MM.YYYY`/`MM/DD`
  date sniff, comma-decimal handling) and the Additional-features `import_profiles` makes per-bank
  shape a learned, deterministic mapping. Import failures surface as a typed error naming the first
  bad row, never a silent partial import.
