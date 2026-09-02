---
id: wire
dependsOn:
  - pages
output:
  hooks: array
---

Wire the automation. Load the hooks knowledge before writing anything: a `hooks/<slug>.ts` file default-exports exactly ONE hook def (slug = filename basename, duplicates throw at load). The three kinds — `cron` (declarative `trigger: 'space/agent#action'` only), `event` (subscribes to a source-qualified event; a db write auto-emits `project/db.<table>.<insert|update|remove>` whose payload IS the row, so react to data changes with an event hook, never a removed `{type:'database'}` hook), and `webhook` (external inbound POST). A hook is declarative (`trigger`) or imperative (`handler(ctx)`). An imperative db-writing hook must not re-trigger itself: the loop guard gives depth cap 3, a 5s cooldown and self-write exclusion, but pick subscribe/emit pairs that cannot cycle anyway. `events/*.ts` emitter defs are the optional PRODUCER side — most project apps need none, because the synthetic db events already cover them. Write with `writeProjectHook`/`writeProjectEvent` (`hooks:write`). Record each `{ slug, kind }` as `hooks` (an empty list is a valid answer — an app with no automation has none).