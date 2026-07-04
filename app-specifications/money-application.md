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
