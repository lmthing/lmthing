/**
 * `integration-demo/message.received` — the inbound producer for the demo integration.
 *
 * The demo space exists so the event pipeline can be exercised end-to-end **without a real
 * provider account**: you point any HMAC-signing caller (a test harness, `curl`, webhook.site)
 * at this def's inbound path and it behaves exactly like Slack/Telegram/etc. It is therefore the
 * space every live scenario uses to inject inbound events (`sdk/org/scenarios/`).
 *
 * Verification is the declarative `hmac` VerifySpec — SHA-256 over the raw body, hex-encoded,
 * presented as `x-demo-signature: sha256=<hex>`, keyed by `INTEGRATION_DEMO_WEBHOOK_SECRET`
 * (inside this space's own `INTEGRATION_DEMO_` env namespace, so it satisfies containment).
 * `emit` runs only AFTER the host has verified the signature, and is pure — no i/o.
 *
 * Body shape (deliberately Telegram-ish, so the demo doubles as a stand-in for a messaging
 * provider):
 *
 *   { "message": { "message_id": 1, "text": "hello", "chat": { "id": "c1" },
 *                  "from": { "id": "u1", "username": "ada" } } }
 *
 * Non-message payloads and empty/absent text emit nothing (`[]`) — the filter lives here, so no
 * agent ever wakes for a malformed or irrelevant delivery.
 *
 * Historical note: before the events migration this space declared its webhook in the
 * package.json `lmthing.webhook` descriptor block (the legacy `triggers:` path). That block was
 * removed when this def landed — a space must not carry both, or the legacy binding shadows the
 * emitter def.
 */
import type { Emitted, WebhookEmitterDef, WebhookInbound } from '@lmthing/core';

interface DemoFrom {
  id?: string | number;
  username?: string;
  is_bot?: boolean;
}

interface DemoMessage {
  message_id?: string | number;
  text?: string;
  chat?: { id?: string | number };
  from?: DemoFrom;
}

interface DemoUpdate {
  message?: DemoMessage;
}

const def: WebhookEmitterDef = {
  type: 'webhook',
  path: 'demo',
  verify: {
    type: 'hmac',
    algo: 'sha256',
    encoding: 'hex',
    header: 'x-demo-signature',
    prefix: 'sha256=',
  },
  secretEnv: 'INTEGRATION_DEMO_WEBHOOK_SECRET',
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
    const update = inbound.json as DemoUpdate | null | undefined;
    const message = update?.message;
    if (!message) return [];

    const text = message.text;
    if (typeof text !== 'string' || text.length === 0) return [];

    const from = message.from;
    if (!from || from.is_bot === true) return [];
    if (from.id === undefined || from.id === null) return [];

    const chatId = message.chat?.id;
    if (chatId === undefined || chatId === null) return [];

    const userName = typeof from.username === 'string' ? from.username : undefined;
    const threadKey =
      message.message_id === undefined || message.message_id === null
        ? undefined
        : String(message.message_id);

    return [
      {
        event: 'message.received',
        payload: {
          text,
          from: String(from.id),
          chatId: String(chatId),
          userName,
          raw: update as unknown as Record<string, unknown>,
        },
        ...(threadKey ? { threadKey } : {}),
      },
    ];
  },
};

export default def;
