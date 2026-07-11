/**
 * `integration-whatsapp/message.received` — the inbound producer for the user's
 * WhatsApp Business number. Meta POSTs a WhatsApp Cloud API webhook to this
 * def's own inbound path; the pod verifies the request against the `hmac`
 * SHA-256 signature (`x-hub-signature-256` === `sha256=<hmac(body, APP_SECRET)>`,
 * the `INTEGRATION_WHATSAPP_APP_SECRET` env), then the PURE `emit` parses the
 * webhook into normalized `message.received` events.
 *
 * The GET subscription-verification handshake (`hub.challenge`) is answered by
 * the pod BEFORE any agent wakes, echoing `hub.challenge` when `hub.verify_token`
 * equals `INTEGRATION_WHATSAPP_VERIFY_TOKEN` (the `challenge` spec below).
 *
 * WhatsApp threads per sender, so `threadKey` is `whatsapp:<from>` (the sender's
 * wa id). Status-only callbacks (delivery/read receipts, `value.statuses`) and
 * non-text messages (image/audio/button/interactive) carry no `text.body` and
 * are dropped — those changes contribute no events.
 */
import type { Emitted, WebhookEmitterDef, WebhookInbound } from '@lmthing/core';

interface WhatsAppMessage {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
}

interface WhatsAppValue {
  messages?: WhatsAppMessage[];
  contacts?: Array<{ profile?: { name?: string } }>;
  metadata?: { phone_number_id?: string };
}

interface WhatsAppChange {
  value?: WhatsAppValue;
}

interface WhatsAppEntry {
  changes?: WhatsAppChange[];
}

interface WhatsAppWebhook {
  entry?: WhatsAppEntry[];
}

const def: WebhookEmitterDef = {
  type: 'webhook',
  path: 'whatsapp',
  verify: {
    type: 'hmac',
    algo: 'sha256',
    encoding: 'hex',
    header: 'x-hub-signature-256',
    prefix: 'sha256=',
  },
  secretEnv: 'INTEGRATION_WHATSAPP_APP_SECRET',
  challenge: {
    type: 'hub-challenge',
    verifyTokenEnv: 'INTEGRATION_WHATSAPP_VERIFY_TOKEN',
  },
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
    const body = inbound.json as WhatsAppWebhook | null | undefined;
    const entries = body?.entry;
    if (!Array.isArray(entries)) return [];

    const events: Emitted[] = [];
    for (const entry of entries) {
      const changes = entry?.changes;
      if (!Array.isArray(changes)) continue;
      for (const change of changes) {
        const value = change?.value;
        const messages = value?.messages;
        if (!Array.isArray(messages)) continue; // status-only callback → no messages
        for (const m of messages) {
          const text = m?.text?.body;
          if (typeof text !== 'string' || text.length === 0) continue; // non-text → skip
          if (typeof m.from !== 'string' || m.from.length === 0) continue;

          const userName = value?.contacts?.[0]?.profile?.name;
          events.push({
            event: 'message.received',
            payload: {
              text,
              from: m.from,
              chatId: m.from,
              userName: typeof userName === 'string' ? userName : undefined,
              raw: {
                message: m as Record<string, unknown>,
                phone_number_id: value?.metadata?.phone_number_id,
              },
            },
            threadKey: `whatsapp:${m.from}`,
          });
        }
      }
    }
    return events;
  },
};

export default def;
