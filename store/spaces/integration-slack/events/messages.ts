/**
 * `integration-slack/message.received` — the inbound producer for the user's
 * connected Slack workspace. Slack's Events API POSTs an `event_callback`
 * envelope to this def's own inbound path; the pod verifies the request with the
 * BUILTIN `slack` adapter (v0-HMAC signature + 5-min replay skew guard, and the
 * `url_verification` handshake preflight) in
 * `sdk/org/libs/cli/src/server/webhook-verifiers.ts`, then the PURE `emit` parses
 * the `event_callback` wrapper into a normalized `message.received` event.
 *
 * Slack's signing scheme + `url_verification` preflight aren't expressible in the
 * declarative verify union, so `verify` is the `{ type:'builtin', provider:'slack' }`
 * shorthand (resolved pod-side to the inline slack adapter; secret =
 * `SLACK_SIGNING_SECRET`). The `emit` DROPS bot echoes (`bot_id`) and every
 * message subtype (edits/deletes/joins/bot posts carry a `subtype`) — returning
 * `[]` — and only forwards genuine user messages. `threadKey` (and the payload's
 * `threadKey` field) fall back to the message `ts` when there's no `thread_ts`,
 * so a reply starts a thread on the original message; `chatId` is the channel.
 */
import type { Emitted, WebhookEmitterDef, WebhookInbound } from '@lmthing/core';

interface SlackEvent {
  type?: string;
  text?: string;
  channel?: string;
  user?: string;
  ts?: string;
  thread_ts?: string;
  bot_id?: string;
  subtype?: string;
}

interface SlackEventCallback {
  type?: string;
  event?: SlackEvent;
}

const def: WebhookEmitterDef = {
  type: 'webhook',
  path: 'slack',
  verify: { type: 'builtin', provider: 'slack' },
  emits: {
    'message.received': {
      payload: {
        text: 'string',
        from: 'string',
        chatId: 'string',
        threadKey: 'string?',
        userName: 'string?',
        raw: 'object',
      },
    },
  },
  emit(inbound: WebhookInbound): Emitted[] {
    const json = inbound.json as SlackEventCallback | null | undefined;
    const event = json?.event;
    // Only genuine channel messages produce an event.
    if (!event || event.type !== 'message') return [];
    // Drop the pod's own / any bot echoes and every message subtype
    // (message_changed, message_deleted, channel_join, bot_message, …).
    if (event.bot_id) return [];
    if (event.subtype) return [];

    const text = event.text;
    if (typeof text !== 'string' || text.length === 0) return [];
    if (typeof event.channel !== 'string') return [];
    if (typeof event.user !== 'string') return [];

    const threadKey =
      typeof event.thread_ts === 'string' ? event.thread_ts : typeof event.ts === 'string' ? event.ts : undefined;

    return [
      {
        event: 'message.received',
        payload: {
          text,
          from: event.user,
          chatId: event.channel,
          threadKey,
          userName: undefined,
          raw: json as Record<string, unknown>,
        },
        ...(threadKey !== undefined ? { threadKey } : {}),
      },
    ];
  },
};

export default def;
