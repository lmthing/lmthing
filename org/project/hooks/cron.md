# `cron` hook file (`hooks/<slug>.ts`, `type: 'cron'`)

A **cron hook** is a time-based hook: it fires on a schedule and either runs a
declarative `trigger` (delegate to an agent action) or an imperative `handler`
(plain in-proc code, no agent/LLM) `sdk/org/libs/cli/src/app/hooks/loader.ts:100-118`.
It is one of the three hook types (`'cron' | 'webhook' | 'event'`) whose default
export a `hooks/<slug>.ts` file may declare `sdk/org/libs/cli/src/app/hooks/loader.ts:164-165`.
See [`hooks/README.md`](./README.md) for the hook system overview, and the two
sibling hook types [`hooks/database.md`](./database.md) and [`hooks/event.md`](./event.md).

## Shape

The default export is a `CronHookDef` object `sdk/org/libs/cli/src/app/hooks/loader.ts:105-118`:

| Field | Required | Meaning |
|---|---|---|
| `type: 'cron'` | yes | Discriminant `sdk/org/libs/cli/src/app/hooks/loader.ts:106`. |
| `every` | one of `every`/`daily` | Interval spec `'<n>m' \| '<n>h' \| '<n>d'` `sdk/org/libs/cli/src/app/hooks/loader.ts:107-108`. |
| `daily` | one of `every`/`daily` | Time-of-day spec `'HH:MM'` `sdk/org/libs/cli/src/app/hooks/loader.ts:109-110`. |
| `trigger` | one of `trigger`/`handler` | `space/agent#action` to delegate to when due `sdk/org/libs/cli/src/app/hooks/loader.ts:111-112`. |
| `handler` | one of `trigger`/`handler` | Imperative function run in-proc — no agent, no LLM `sdk/org/libs/cli/src/app/hooks/loader.ts:113-114`. |
| `connections` | no | Providers `ctx.callConnection` may reach (gated at call time) `sdk/org/libs/cli/src/app/hooks/loader.ts:115-116`. |
| `budget` | no | Caps forwarded verbatim to `runHeadless`/`delegate` `sdk/org/libs/cli/src/app/hooks/loader.ts:117`. |

### `every` vs `daily` are mutually exclusive

Validation requires **exactly one** of `every` or `daily`: `hasEvery === hasDaily`
throws (`a cron hook needs exactly one of \`every\` or \`daily\``) — so declaring
both, or neither, fails loud `sdk/org/libs/cli/src/app/hooks/loader.ts:384-389`.

- `every` must match `EVERY_RE = /^\d+[mhd]$/` — one or more digits followed by
  `m` (minutes), `h` (hours), or `d` (days); anything else throws
  `sdk/org/libs/cli/src/app/hooks/loader.ts:187,390-392`.
- `daily` must match `DAILY_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/` — a 24-hour
  `HH:MM` time; anything else throws `sdk/org/libs/cli/src/app/hooks/loader.ts:186,393-395`.

### `trigger` vs `handler` are mutually exclusive

A cron hook also needs **exactly one** of a non-empty string `trigger` or a
function `handler`; `hasTrigger === hasHandler` throws (`a cron hook needs exactly
one of \`trigger\` ... or \`handler\``) `sdk/org/libs/cli/src/app/hooks/loader.ts:396-402`.
Prefer `handler` for deterministic fetch/compute work — it does not spin up an
agent session `sdk/org/libs/cli/src/app/hooks/loader.ts:101-103`.

## How it runs on schedule

The pod's `crond` hits a local hook-run endpoint; `nextCrontabLines` renders one
crontab line per cron hook, expanding the endpoint URL template with the hook slug
`sdk/org/libs/cli/src/app/hooks/cron.ts:3-8,99-103`. `crontabSchedule` builds the
5-field crontab line from the def: `daily:'HH:MM'` → `MM HH * * *`, and `every`
becomes a `*/<minutes>`, `0 */<hours>`, or `0 0 */<days>` field depending on
magnitude `sdk/org/libs/cli/src/app/hooks/cron.ts:105-117`.

Granularity is clamped to **≥ 5 minutes** (`MIN_CRON_INTERVAL_MS = 5 * 60_000`):
`parseEvery` returns `Math.max(ms, MIN_CRON_INTERVAL_MS)`, so e.g. `every: '1m'`
passes the regex but is scheduled every 5 minutes `sdk/org/libs/cli/src/app/hooks/cron.ts:21-22,31-38`.

Dueness is decided from an injected `now` and the persisted `{ lastRunAt }`:
`dueCronHooks` keeps a cron hook whose `now >= nextRunAt(def, lastRunAt)`, which
powers boot catch-up (a window missed while the pod was down runs once)
`sdk/org/libs/cli/src/app/hooks/cron.ts:78-91`. `nextRunAt` computes the next
wall-clock occurrence of `daily`'s `HH:MM`, or the next epoch-aligned multiple of
the `every` interval; a never-run hook (`fromMs = 0`) is due immediately
`sdk/org/libs/cli/src/app/hooks/cron.ts:65-76`.

## Dispatch: `trigger` (agent) vs `handler` (code)

Every actual cron dispatch funnels through `runHook` `sdk/org/libs/cli/src/server/routes/hooks.ts:307-314`:

- **`trigger`** — `parseTrigger` splits `space/agent#action` on `#` (and the space
  ref on `/` for the agent slug) `sdk/org/libs/cli/src/server/routes/hooks.ts:176-183`,
  then `manager.runHeadless` runs that agent action headless with the hook's
  `budget`, from a "Scheduled hook ... fired — perform the \"<action>\" action."
  kickoff message `sdk/org/libs/cli/src/server/routes/hooks.ts:327-343`.
- **`handler`** — invoked directly with a hook ctx (`{ db, delegate, ... }`) built
  by `buildHookCtx`; no agent session is started
  `sdk/org/libs/cli/src/server/routes/hooks.ts:346-353`.

`budget` accepts only `maxEpisodes` and `maxWallClockMs`, each a non-negative
number (anything else throws) `sdk/org/libs/cli/src/app/hooks/loader.ts:501-519`.
A budget-exhausted run returns `{ queued: true }` rather than an error
`sdk/org/libs/cli/src/server/routes/hooks.ts:342,351,356-358`.

## Worked example

A declarative daily cron hook that delegates to an agent action, adapted from
`store/projects/blog/hooks/build-daily-digest.ts`:

```ts
// hooks/build-daily-digest.ts — every day at 07:00, delegate to an agent action.
export default {
  type: 'cron',
  daily: '07:00',
  trigger: 'editorial/curator#digest',
  budget: { maxEpisodes: 20, maxWallClockMs: 600000 },
};
```

An imperative interval hook (no LLM) instead sets `every` and `handler`, as in
`store/projects/blog/hooks/refresh-sources.ts:172-176` (`type: 'cron', every: '30m',
budget: { maxWallClockMs: 120000 }, handler: async ({ db }) => { ... }`).

## Related

- [`hooks/README.md`](./README.md) — hook system overview.
- [`hooks/database.md`](./database.md) — the removed `database` hook (now event hooks).
- [`hooks/event.md`](./event.md) — event-triggered hooks.
