---
name: triggers
description: Load when authoring an inbound "Trigger" — declaring that a space agent (`triggers:` frontmatter) or a project (`type:'webhook'` hook) listens for external events, the binding manifest, or the Triggers settings tab.
---

# Skill: Triggers (the inbound authoring surface)

> **⚠️ LEGACY path.** Triggers (`triggers:` frontmatter + `type:'webhook'` hooks) predate the unified
> **event pipeline**. The CURRENT way to author inbound is an `events/<name>.ts` **webhook emitter def**
> (typed payload contract + pure `emit`, pre-agent filtering) consumed by a `{type:'event'}` hook —
> `@.claude/skills/events-and-hooks.md`. Integration spaces are now event SOURCES
> (`events/messages.ts` → `message.received`), not handler-agent bridges. This skill documents the
> legacy binding surface, which still works and shares the same transport plumbing (`webhooks.md`);
> reach for it only when touching that legacy surface, and prefer emitter defs + event hooks for new
> work.

**Triggers** are the inbound mirror of Connections. Connections is outbound (pod → gateway →
provider, via `callConnection`); a **Trigger** is inbound (external → gateway → pod → **agent**). An
OpenClaw-style messaging channel = **inbound Trigger + outbound Connection**. This skill covers how a
user/agent *declares* an inbound binding; the request-flow, signature verification, and token/secret
mechanics live in `@.claude/skills/webhooks.md`; running OpenClaw plugin code verbatim is
`@.claude/skills/openclaw-compat.md`.

Both authoring surfaces bottom out in the same pod primitive — `SessionManager.runHeadless` (one-shot)
/ `runHeadlessThreaded` (persisted per external thread) — and both publish into **one unified binding
manifest** (`WebhookBinding { projectId, path, provider, agentRef }`) that the pod pushes to the
gateway. **`path` is globally unique per pod** (the gateway routes on `path` alone) — a duplicate
across ANY two bindings (hook or space-trigger, same or different project) is **fail-loud at boot**.

## The two authoring surfaces

### A. Spaces — an agent that listens (`triggers:` frontmatter)
A space agent declares an inbound binding in its `instruct.md` frontmatter, alongside `capabilities:`:

```yaml
title: Support Agent
triggers:
  - webhook: { path: support, provider: slack }   # provider optional, defaults to 'generic'
capabilities:
  - connections:use: { providers: [slack] }        # to reply outbound (async)
```

`triggers` is an allow-listed frontmatter key (`AGENT_FRONTMATTER_ALLOWED_KEYS` in
`sdk/org/libs/core/src/spaces/load.ts`), parsed fail-loud into `AgentDef.triggers: WebhookTrigger[]`
(`{ path, provider? }`). `path` must be URL-safe (`[A-Za-z0-9_-]`). On boot the pod's
`scanSpaceTriggers` (`webhook-manifest.ts`) loads every project space and emits one binding per
trigger with `agentRef = <spaceId>/<agentSlug>`.

### B. Projects — a `type: 'webhook'` hook
A hook type next to `cron` and `event` (`sdk/org/libs/cli/src/app/hooks/loader.ts` `WebhookHookDef`;
note `type:'database'` was REMOVED — db writes are now `event` hooks on `project/db.*`). **Declarative
only — no imperative `handler`**; every event delegates to `trigger`:

```ts
// <project>/hooks/support.ts
export default {
  type: 'webhook',
  path: 'support',           // → public …/api/inbound/<userToken>/support
  provider: 'slack',         // verifier/adapter id ('generic' default)
  trigger: 'crm/intake#handle', // `space/agent#action` run for each event
  budget: { maxEpisodes: 20, maxWallClockMs: 600000 }, // optional, forwarded to runHeadless
}
```

`trigger` is parsed `space/agent#action` → `spaceRef` (everything before `#`), `agentSlug` (last path
segment of spaceRef), `action`.

## Gotcha — never route through hook `delegate`/`trigger`

Hook `trigger`/`delegate` **drop the payload** (`server/routes/hooks.ts`). Inbound events **must**
embed the rendered payload directly in the `runHeadless`/`runHeadlessThreaded` *message* — which is
exactly what the inbound dispatcher does via `adapter.renderMessage(...)`. Don't reintroduce a
`delegate` path for inbound.

## Threading (author-transparent)

If the provider adapter's `extractThread(...)` returns a key (Slack `thread_ts`/`ts`/`channel`, GitHub
`repo#number`, generic `x-lmthing-thread` header or JSON `threadKey`/`thread`), the event continues
ONE persisted session per external thread (`runHeadlessThreaded`, keyed via `webhook-threads.ts`
`.data/webhook-threads.json`). No key ⇒ stateless one-shot `runHeadless`. The author doesn't choose
this — the provider adapter does.

## Getting the public URL (Triggers settings tab)

The UI tab (`sdk/org/libs/ui/src/elements/settings/triggers/index.tsx`, mirrors Connections) calls
`GET ${CLOUD}/api/inbound`, which returns `{ baseUrl: <gw>/api/inbound/<userToken>, token, bindings }`
— the user copies the per-binding URL (`<baseUrl>/<path>`) into Slack/GitHub/Zapier/curl. The
`bindings` list is empty until the pod's first `POST /api/compute/webhook-manifest` publish.

## Outbound reply — reuse Connections, no new code

Async replies go out through the existing outbound path: grant the agent `connections:use` and have it
call an `integration-<provider>` wrapper (`callConnection('slack', {...})`) or a `response_url` the
adapter captured. See `@.claude/skills/web-search.md` sibling pattern and the
`[[project-oauth-integrations]]` memory.

## File map

| File | Role |
|---|---|
| `sdk/org/libs/core/src/spaces/load.ts` | `WebhookTrigger` type, `AgentDef.triggers`, `'triggers'` in `AGENT_FRONTMATTER_ALLOWED_KEYS`, fail-loud parse |
| `sdk/org/libs/cli/src/app/hooks/loader.ts` | `WebhookHookDef {type:'webhook', path, provider?, trigger, budget?}` + `validateBudget` |
| `sdk/org/libs/cli/src/server/webhook-manifest.ts` | `buildWebhookManifest` (hooks + `scanSpaceTriggers`, global path-uniqueness), `publishWebhookManifest`, `resolveBinding` |
| `sdk/org/libs/ui/src/elements/settings/triggers/index.tsx` | "Triggers" settings tab (per-binding URL + copy) |
| `cloud/gateway/src/routes/inbound.ts` | `GET /api/inbound` → base URL + token + bindings (feeds the UI) |

## Testing

- Manifest/parse unit: `pnpm --filter @lmthing/cli test -- webhook` and `pnpm --filter @lmthing/core typecheck` (frontmatter parse).
- End-to-end (local, no gateway): author a `type:'webhook'` hook, boot a credentialed pod
  (`sdk/org/.env` keys — see `[[reference-local-ai-keys-env]]`), `curl -X POST
  localhost:<port>/api/inbound/<path>` with a fake payload; assert the agent ran (`display()` in the
  session snapshot). Re-POST with a thread key → asserts it resumes the same `sessionId`.
- Prod: register the binding, copy the Triggers URL, POST via `<gw>/api/inbound/<userToken>/<path>`.
  Verification runbook + token minting → `@.claude/skills/webhooks.md`.
