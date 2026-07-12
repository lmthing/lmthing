---
name: events-and-hooks
description: Load when authoring the unified event pipeline — an `events/<name>.ts` emitter def (webhook/cron/db/internal), an `events/`-subscribing `hooks/<slug>.ts` event hook, code nodes in space tasklists, project functions, or the generic `@consent` function flag. This is the CURRENT path; legacy inbound `triggers:`/webhook descriptors are `@.claude/skills/triggers.md` + `@.claude/skills/webhooks.md`.
---

# Skill: Events & Hooks (the unified event pipeline)

Use this skill when you are authoring or changing anything on lmthing's one event pipeline: the
**producer** half (`events/<name>.ts` emitter defs — `webhook` / `cron` / `db` / `internal`) or the
**consumer** half (`hooks/<slug>.ts` with `{ type: 'event' }`), in either a project or an installed
space; plus the things that hang off it — tasklist **code nodes**, **project functions**, and the
host-enforced **`@consent`** gate.

**All of the knowledge lives in `org/docs/`.** This file holds no format specs, no type tables, no
security prose — only the map and the procedure.

## Read first (the grounded truth)

**Producer — emitter defs**
- `org/docs/format/space/events/README.md` — the `EmitterDef` model, the `emits` schema + `?` optional typeStrings, event naming, event addressing (`<sourceId>/<name>`), integrations-as-event-sources.
- `org/docs/format/space/events/webhook.md` · `cron.md` · `db.md` · `internal.md` — the four kinds in detail (verify specs, `ctx.state`, db-write defs, the curated runtime signals).
- `org/docs/format/project/events/README.md` — the same def format in project scope.

**Consumer — hooks**
- `org/docs/format/project/hooks/README.md` — hook types, `trigger` vs `handler`, the handler ctx, the source-qualified address, `budget`, the loop guards.
- `org/docs/format/project/hooks/event.md` · `database.md` · `cron.md` — subscribing to an address, reacting to db writes via the synthetic `project/db.<table>.<event>`, time-based hooks.
- `org/docs/format/space/hooks/README.md` — hooks in a SPACE (store code, worker-isolated).

**Runtime + surrounding surfaces**
- `org/docs/runtime-globals/events-and-integrations.md` — `emitEvent`, `callConnection`, `integrationStatus`, `fetch`, the SSRF/pinning guards, the failure contract.
- `org/docs/runtime-globals/store-and-consent.md` — `storeSearch` / `storeInspect` / `installSpace` and the host-enforced `@consent` gate (global yield-kind registry + the function pragma).
- `org/docs/format/space/tasklists/step-file.md` — `NN-<id>.ts` **code nodes** (`node` metadata AST-extracted, `run(ctx, inputs)` worker-isolated).
- `org/docs/format/space/agents/capabilities.md` — `events:emit`, `connections:use`, `store:*` and how a grant becomes DTS.
- `org/docs/runtime-globals/app-authoring.md` — the `write*` globals that author these files (`writeHook`, `writeProjectHook`, `writeProjectEvent`, `writeProjectFunction`).

## Procedure

**Adding an emitter def**
1. Author `<scope>/events/<name>.ts` with one default-exported `EmitterDef`. Basename = the def id (unique per scope).
2. Declare every event's payload inline in `emits` before writing `emit` — dispatch validates against it.
3. Keep `emit` PURE for `webhook` / `db` / `internal` (no i/o, no verification logic — the host verifies first). Only `cron` `emit` is async and gets a gated ctx.
4. A SPACE def that names an env secret must namespace it `INTEGRATION_<ID>_…` (containment is enforced at scan time) — so a def naming a secret can only live in an `integration-*` space.

**Adding an event hook**
1. Author `<scope>/hooks/<slug>.ts`, `{ type: 'event', on: { event: '<sourceId>/<name>' } }`.
2. Pick exactly one of `handler` (code IS the filter — no agent, no LLM, no AI credits) or `trigger: 'space/agent#action'` (delegates a headless agent run).
3. Prefer `handler` for cheap filtering, and only delegate on a match — this is the whole point of the pipeline.
4. To use `ctx.callConnection`, declare `connections: [...]` on the hook def, or the call throws.

**Verify the change**
```bash
pnpm -C sdk/org/libs/core test -- emitter          # emitter-load.test.ts: per-kind validation, ?-optionals, dup-event rejection
pnpm -C sdk/org/libs/cli  test -- emitter          # emitter-manifests.test.ts: scan + env containment
pnpm -C sdk/org/libs/cli  test -- event            # event-dispatch / emit-event
pnpm -C sdk/org/libs/cli  test -- internal-signals
pnpm -C sdk/org/libs/cli  test -- hooks            # loader, dispatcher, loop-guard, space-hooks, runtime
```

**Live reference implementations** (read these before inventing a shape):
`store/spaces/integration-slack/events/messages.ts` (webhook def) · `store/spaces/integration-lmthing/`
(internal signals + `publishEvent`) · `store/projects/blog/hooks/*.ts` (event + cron hooks, handler and
trigger forms).

## Keep the docs true

GROUND TRUTH IS THE CODE. If you change the implementation, update the matching org/docs page in the
same change (see `org/docs/SYNC.md`).
