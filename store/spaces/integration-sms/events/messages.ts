/**
 * `integration-sms/message.received` — the inbound producer for the user's
 * Twilio phone number. Twilio POSTs an inbound SMS as
 * `application/x-www-form-urlencoded` to this def's own inbound path; the pod
 * verifies the request against Twilio's bespoke signature scheme (base64
 * HMAC-SHA1 over the forwarded public URL — `x-lmthing-inbound-url`, injected by
 * the gateway — plus the POST form params sorted by key, using the account's
 * `INTEGRATION_SMS_AUTH_TOKEN` as the key), then the PURE `emit` parses the form
 * body into a normalized `message.received` event.
 *
 * SMS has no threading model, so `threadKey` is omitted (each text is a
 * one-shot run keyed by the sender). Twilio also POSTs delivery/status
 * callbacks (no `Body`) — those yield no event (`emit` returns `[]`).
 */
import type { Emitted, WebhookEmitterDef, WebhookInbound } from '@lmthing/core';

/** Decode one `application/x-www-form-urlencoded` value (`+` → space, then %XX). */
function decodeFormValue(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value.replace(/\+/g, ' ');
  }
}

/** Hand-roll a urlencoded body into a flat string map (last key wins). */
function parseForm(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const pair of raw.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = eq === -1 ? pair : pair.slice(0, eq);
    const val = eq === -1 ? '' : pair.slice(eq + 1);
    out[decodeFormValue(key)] = decodeFormValue(val);
  }
  return out;
}

const def: WebhookEmitterDef = {
  type: 'webhook',
  path: 'sms',
  verify: { type: 'twilio' },
  secretEnv: 'INTEGRATION_SMS_AUTH_TOKEN',
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
    // Prefer a pre-parsed body if the host already decoded the form; otherwise
    // hand-roll the raw `application/x-www-form-urlencoded` string.
    const pre =
      inbound.json && typeof inbound.json === 'object'
        ? (inbound.json as Record<string, unknown>)
        : undefined;
    const form = pre
      ? Object.fromEntries(
          Object.entries(pre).map(([k, v]) => [k, typeof v === 'string' ? v : String(v ?? '')]),
        )
      : parseForm(inbound.raw);

    const body = form['Body'];
    const from = form['From'];
    // Status/delivery callbacks (and anything without a real sender + body) are
    // not inbound messages — drop them.
    if (typeof body !== 'string' || body.length === 0) return [];
    if (typeof from !== 'string' || from.length === 0) return [];

    return [
      {
        event: 'message.received',
        payload: {
          text: body,
          from,
          chatId: from,
          raw: {
            From: from,
            To: form['To'],
            MessageSid: form['MessageSid'],
            AccountSid: form['AccountSid'],
          },
        },
      },
    ];
  },
};

export default def;
