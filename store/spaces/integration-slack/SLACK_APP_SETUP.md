# Slack channel (native Trigger + Connection)

A working example of an **OpenClaw-style messaging channel built natively on lmthing** — the
plan's "channel = inbound **Trigger** + outbound **Connection**". No OpenClaw plugin code runs;
Slack is wired through lmthing's own seams:

- **Inbound** — Slack **Events API** posts to the pod's Triggers ingress. The `slack` verifier
  (`libs/cli/src/server/webhook-verifiers.ts`) checks the signature (v0 + 5-min replay window),
  answers the `url_verification` handshake, extracts the thread key, and renders the message —
  including a `[slack-reply-target]` line carrying `channel`/`thread_ts`.
- **Agent** — the `channel-slack` space (this dir) declares `triggers: [{ webhook: { path: slack,
  provider: slack } }]` + `capabilities: [connections:use { providers: [slack] }]`. Its `handler`
  agent delegates the message to THING and posts the answer back **in-thread**.
- **Outbound** — the agent calls `callConnection('slack', { method:'POST', path:'/chat.postMessage',
  body:{ channel, thread_ts, text } })`; the pod attaches the user's own **`SLACK_BOT_TOKEN`**
  (bring-your-own-token — no gateway OAuth broker).

## Install (per user/pod)

1. Copy `channel-slack/` into a project's spaces dir on the pod:
   `<root>/<projectId>/spaces/channel-slack/`.
2. Create a Slack app (see `slack-app-manifest.yaml`), install it to your workspace, and invite the
   bot to a channel.
3. In **Settings → Integrations** (Slack), paste the app's **Bot User OAuth Token** (`xoxb-…`, saved
   as `SLACK_BOT_TOKEN` — outbound) and its **Signing Secret** (saved as `SLACK_SIGNING_SECRET` —
   inbound Events verification).
4. In the Slack app's **Event Subscriptions**, set the Request URL to the binding's Triggers URL
   (`GET /api/inbound` → `<baseUrl>/slack`) and subscribe to `message.channels` /
   `app_mention` events.

## Slack app manifest

A ready-to-paste manifest (Events API + OAuth scopes + signing) lives in `slack-app-manifest.yaml`.
