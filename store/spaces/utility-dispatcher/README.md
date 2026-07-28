# utility-dispatcher — the delivery router

The composability keystone of the utility tier. The other utility spaces **record** what they find
as rows in their queue tables; the dispatcher **notices** the new ones, renders a faithful digest,
and delivers it through whichever messaging integration the user configured for that source.

Without it, every utility space's findings sit in a table nobody opens. With it, one configuration
step per source turns the whole tier into something that reaches you.

## Own tables

| Table | Purpose |
|---|---|
| `dispatch_rules` | One per routed source: `sourceTable`, `channelRef`, `channelHint`, `label`, `status` (`active`\|`proposed`\|`disabled`), `createdAt` |
| `dispatch_log` | One per delivery: `ruleId`, `batchKey`, `itemCount`, `lastSeenCreatedAt` (the watermark), `deliveredVia`, `status` (`sent`\|`failed`), `createdAt` |

## Agent

`dispatcher` — actions:

- **`bind`** (tasklist): find which utility queue tables exist and create one `proposed` rule each,
  with an empty `channelRef`. Idempotent.
- **`dispatch`** (tasklist): per active rule, collect rows newer than its watermark, render, deliver,
  log. Runs daily at 08:30 via `hooks/daily-dispatch.ts`. Re-runs are free.
- **`rules`** (live session): attach a channel to a rule, **prove it with a test delivery the user
  confirms**, then activate.
- **`review`** (live session): walk delivery history, pause or resume rules.

## Why `canDelegateTo: ["*"]`

This space is the one utility space that delegates, and it needs an open allowlist for a specific,
bounded reason: **a delivery target is user configuration data**. `dispatch_rules.channelRef` is
written by the user at configure time and is unknowable when this space is authored — they might
install Telegram, Slack, both, or none.

The scope is narrowed by contract instead of by frontmatter, and stated in the agent's own
instructions: the only delegation the dispatcher ever performs is handing a composed digest to a
rule's configured `channelRef`, and a `channelRef` only becomes deliverable after a user-confirmed
test. Nothing else is ever a legitimate delegation target.

## Determinism

Every decision that can be mechanical is: `discoverQueueTables` (the registry as data),
`collectNewRows` (strict-greater watermark + status filter + stable sort), `renderDigest`
(verbatim values, 20-line and 120-char caps), `computeBatchKey` (duplicate-delivery guard). The
model chooses nothing about *what* is sent — only performs the delegation.

Tests: `tests/*.test.mjs` — run `pnpm -C store test:spaces`.
