# Slack channel (event source + Connection)

A **messaging channel built natively on lmthing** — an inbound **event source** plus an outbound
**Connection**. Slack is wired through lmthing's own seams:

- **Inbound — this space EMITS an event.** `events/messages.ts` is a `webhook` emitter def bound to
  the `slack` inbound path. Slack's **Events API** POSTs an `event_callback` envelope; the pod
  verifies it with the BUILTIN `slack` adapter (`sdk/org/libs/cli/src/server/webhook-verifiers.ts`
  — v0-HMAC signature + 5-min replay window + the `url_verification` handshake), then the def's pure
  `emit` normalizes the payload and emits one typed event:

  **`integration-slack/message.received`**

  | field | type | meaning |
  |---|---|---|
  | `text` | string | the message text |
  | `from` | string | Slack **user id** (e.g. `U0123`) |
  | `chatId` | string | Slack **channel id** — where to reply |
  | `threadKey` | string? | `thread_ts` if present, else the message `ts` (start a thread on it) |
  | `userName` | string? | not resolved here (undefined) |
  | `raw` | object | the full Slack `event_callback` JSON |

  Bot echoes (`bot_id`) and every message **subtype** (edits, deletes, joins, bot posts) are DROPPED.

- **Handling it — the user's project decides.** There is no bundled handler agent. Ask **THING**
  *"when a Slack message arrives, do X"* and its **automator** writes a project **event hook**
  (`hooks/*.ts` with `on: { event: 'integration-slack/message.received' }`). The hook's handler reads
  the payload from `ctx.input` and replies:

  ```ts
  await callConnection('slack', {
    method: 'POST',
    path: '/chat.postMessage',
    body: { channel: ctx.input.chatId, thread_ts: ctx.input.threadKey, text: answer },
  });
  ```

- **Outbound — Connection.** `callConnection('slack', …)` attaches the user's own **`SLACK_BOT_TOKEN`**
  (bring-your-own-token — no gateway OAuth broker). The `slack` outbound agent + `functions/`
  (`slackPostMessage`, `slackListChannels`, `slackSearchMessages`) remain for direct "post to Slack"
  requests.

## Install (per user/pod)

1. Install this space into a project (from **lmthing.studio**, or copy `integration-slack/` into
   `<root>/<projectId>/spaces/integration-slack/`).
2. Create a Slack app (see `slack-app-manifest.yaml`), install it to your workspace, and invite the
   bot to a channel.
3. In **Settings → Integrations** (Slack), paste the app's **Bot User OAuth Token** (`xoxb-…`, saved
   as `SLACK_BOT_TOKEN` — outbound) and its **Signing Secret** (saved as `SLACK_SIGNING_SECRET` —
   inbound Events verification).
4. In the Slack app's **Event Subscriptions**, set the Request URL to the binding's inbound URL
   (shown in the project's **Triggers** settings, `<baseUrl>/slack`) and subscribe to
   `message.channels` / `app_mention` events.
5. Ask THING to automate what should happen on an inbound message (it writes the event hook).

## Slack app manifest

A ready-to-paste manifest (Events API + OAuth scopes + signing) lives in `slack-app-manifest.yaml`.
