# `events/<name>.ts` — typed emitter def (project scope)

A **producer** of typed events. The on-disk format is **identical in a project and a space** — the
canonical four-kind reference lives at **[../../space/events/](../../space/events/)**. This page
covers only the project-scope specifics.

## Project-scope framing

- A project's own emitter defs address their events as **`project/<event>`** (e.g.
  `project/item.added`).
- Every committed db write **also** auto-emits the synthetic **`project/db.<table>.<insert|update|remove>`**
  event whose payload IS the row — you do **not** need a `db` emitter to react to writes. Author a
  `db` emitter only when you want a *curated, named* payload instead of the raw row.
- A `cron` emitter in a project uses the project's declared `connections:` for `ctx.callConnection`
  (in a space it's locked to the space's own provider(s)).

## The four kinds (summary)

| Kind | Fires on | `emit` shape |
|---|---|---|
| `webhook` | inbound HTTP to its own path | pure: `(inbound) => Emitted[]` |
| `cron` | `every`/`daily` schedule | async: `(ctx) => Emitted[]` (gated `callConnection`, persisted `ctx.state`) |
| `db` | a project-db write | pure: `(row) => Emitted[]` |
| `internal` | a curated runtime signal | pure: `(signal) => Emitted[]` |

`emits` maps `<event name> → { payload: { <field>: <typeString> } }`; typeStrings are
`string | number | boolean | object | array | any` with a trailing **`?`** for optional fields.

Full field-by-field reference, imports, and worked examples for each kind:
**[../../space/events/](../../space/events/)**.

Consumers subscribe with an [event hook](../hooks/) (`{ type: 'event', on: { event: 'project/…' } }`).
