/**
 * `integration-line/message.received` — the inbound producer for the user's
 * LINE Official Account. LINE POSTs a webhook body to this def's own inbound
 * path; the pod verifies the request via base64 HMAC-SHA256 over the raw body
 * compared to the `x-line-signature` header (keyed by the channel secret in
 * `INTEGRATION_LINE_CHANNEL_SECRET`), then the PURE `emit` walks the delivery's
 * `events[]` and normalizes each text message into a `message.received` event.
 *
 * A single LINE delivery can carry several events, so `emit` may return more
 * than one `Emitted` (one per text message). The chat id is `groupId` ||
 * `roomId` || `userId` (LINE's three source scopes). The per-event `replyToken`
 * is carried in `raw` so a hook can reply with `lineReply` — it is single-use
 * and expires ~1 minute after delivery. Non-message events and non-text
 * messages (follow / join / postback / sticker / image …) are dropped —
 * `emit` returns `[]` when nothing matches.
 */
import type { Emitted, WebhookEmitterDef, WebhookInbound } from '@lmthing/core';

interface LineSource {
  userId?: string;
  groupId?: string;
  roomId?: string;
}

interface LineMessage {
  type?: string;
  text?: string;
}

interface LineEvent {
  type?: string;
  replyToken?: string;
  source?: LineSource;
  message?: LineMessage;
}

interface LineDelivery {
  events?: LineEvent[];
}

const def: WebhookEmitterDef = {
  type: 'webhook',
  path: 'line',
  verify: { type: 'hmac', algo: 'sha256', encoding: 'base64', header: 'x-line-signature' },
  secretEnv: 'INTEGRATION_LINE_CHANNEL_SECRET',
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
    const delivery = inbound.json as LineDelivery | null | undefined;
    const events = delivery?.events;
    if (!Array.isArray(events)) return [];

    const out: Emitted[] = [];
    for (const e of events) {
      if (!e || e.type !== 'message') continue;
      const message = e.message;
      if (!message || message.type !== 'text') continue;

      const text = message.text;
      if (typeof text !== 'string' || text.length === 0) continue;

      const source = e.source ?? {};
      const chatId = source.groupId || source.roomId || source.userId;
      if (typeof chatId !== 'string' || chatId.length === 0) continue;

      out.push({
        event: 'message.received',
        payload: {
          text,
          from: source.userId || '',
          chatId,
          raw: { event: e, replyToken: e.replyToken } as Record<string, unknown>,
        },
      });
    }
    return out;
  },
};

export default def;
