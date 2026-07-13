---
name: triggers
description: Load when authoring an inbound "Trigger" — declaring that a space agent (`triggers:` frontmatter) or a project (`type:'webhook'` hook) listens for external events, the binding manifest, or the Triggers settings tab.
---

# Skill: Triggers (the LEGACY inbound authoring surface)

> **This surface is LEGACY.** The `triggers:` agent frontmatter key and the `{type:'webhook'}` project
> hook predate the unified **event pipeline**. They still work, and the manifest tags their bindings
> `kind: 'legacy'` — but the CURRENT way to author inbound is a **webhook emitter def**
> (`events/<name>.ts`: typed `emits` contract + a pure `emit(inbound)`), consumed by one or more
> `{type:'event'}` hooks. Reach for this skill only when you are touching the legacy surface; author
> new inbound with an emitter def.

Applies when: an agent or project declares that it listens for an external HTTP call, you are debugging
a published binding / the Triggers settings tab, or you are migrating a legacy `triggers:` /
`{type:'webhook'}` binding onto the event pipeline.

## Read first (the grounded detail lives here)

| To learn… | Read |
|---|---|
| **the CURRENT inbound producer** — `webhook` emitter def, `verify` union, pure `emit`, `emits` schema | `org/docs/format/space/events/webhook.md` |
| the unified event pipeline + the four emitter kinds (`webhook`/`cron`/`db`/`internal`) | `org/docs/format/space/events/README.md` |
| the CONSUMER half — hook types, `trigger` vs `handler`, source-qualified event addresses, loop guards | `org/docs/format/project/hooks/README.md` · `org/docs/format/project/hooks/event.md` |
| pod-side inbound handling — **Flow A (emitter)** vs **Flow B (legacy `trigger` binding)**, verification, secret resolution, dedupe, threading, response codes | `org/docs/cli-api/rest/webhooks.md` |
| the gateway broker — `GET /api/inbound`, the public `POST /api/inbound/:userToken/:path`, `POST /api/compute/webhook-manifest` | `org/docs/cloud/routes.md` |
| the legacy `triggers:` frontmatter key itself (shape, URL-safe path, `agentRef`) | `org/docs/format/space/agents/README.md` · `org/docs/format/space/agents/frontmatter.md` · `org/docs/runtime/spaces-loading.md` |
| the **Triggers** settings tab (where the user copies the public URL) | `org/docs/chat/features.md` |
| outbound replies — `callConnection`, integration spaces as event sources | `org/docs/runtime-globals/events-and-integrations.md` |

## Procedure — authoring new inbound (do this)

1. Write the producer: `events/<name>.ts` webhook emitter def (`type`, `path`, `verify`, `emits`,
   pure `emit`) — shape and worked example in `org/docs/format/space/events/webhook.md`.
2. Write the consumer: one or more `hooks/<slug>.ts` `{type:'event'}` hooks subscribing to the
   source-qualified address `<sourceId>/<event>` — `org/docs/format/project/hooks/event.md`.
3. Set the signing secret in the pod env (`PUT /api/compute/env` **replaces** all vars — GET + merge
   first), then boot the pod so it publishes its manifest.
4. Copy the public URL from the **Triggers** settings tab (it is empty until the pod's first
   `POST /api/compute/webhook-manifest`) into Slack/GitHub/Zapier/curl.

## Procedure — touching the legacy surface

- A webhook `path` is the routing key and is **globally unique per pod**; the manifest builder throws
  fail-loud at boot on a duplicate across ANY two bindings (legacy or emitter, same or different
  project). If a new binding kills pod boot, that is why.
- Do not add new provider bridges here — add an emitter def instead, and migrate the legacy binding.

## Testing

- Unit: `cd sdk/org && pnpm test libs/cli/src/server/webhook` (substring filter; the suite is
  `vitest run` from `sdk/org`, **not** the repo root — see `org/docs/contributing/testing.md`).
  Frontmatter parse: `pnpm --filter @lmthing/core typecheck`.
- End-to-end (local, no gateway): boot a credentialed pod, `curl -X POST
  localhost:<port>/api/inbound/<path>` with a signed/fake payload, then assert the run happened in the
  session snapshot. Re-POST with the same thread key → asserts it resumes the same `sessionId`.
- Prod: register the binding, copy the Triggers URL, POST via `<gw>/api/inbound/<userToken>/<path>`.
  Token minting + the full verification runbook → `org/docs/cli-api/rest/webhooks.md`.

## Keep the docs true

GROUND TRUTH IS THE CODE. If you change the implementation, update the matching org/docs page in the
same change (see `org/docs/SYNC.md`).
