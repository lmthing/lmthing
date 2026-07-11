/**
 * `integration-synology-chat/message.received` — the inbound producer for the
 * user's Synology Chat bot. Synology Chat's **outgoing webhook** POSTs a
 * form-encoded (`application/x-www-form-urlencoded`) body to this def's own
 * inbound path when someone messages the bot's channel; the pod verifies the
 * request against the shared outgoing-webhook `token` (`body-token`, `form`
 * decoder, compared to `INTEGRATION_SYNOLOGY_CHAT_OUTGOING_TOKEN`), then the
 * PURE `emit` parses the form fields into a normalized `message.received` event.
 *
 * Synology outgoing-webhook form fields: `token, channel_id, channel_name,
 * user_id, username, post_id, text, timestamp`. There is no channel-post reply
 * API and no threading model, so `threadKey` is derived from `post_id` when
 * present. Non-message posts (no `text`) and the bot's own posts are dropped —
 * `emit` returns `[]`.
 *
 * The `emit` is PURE (no ctx, no i/o) and runs worker-isolated at dispatch.
 */
import type { Emitted, WebhookEmitterDef, WebhookInbound } from '@lmthing/core';

/** Hand-roll a `application/x-www-form-urlencoded` body into a flat string map
 *  (last value wins), URL-decoding keys and values (`+` → space). */
function parseForm(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof raw !== 'string' || raw.length === 0) return out;
  for (const pair of raw.split('&')) {
    if (pair.length === 0) continue;
    const eq = pair.indexOf('=');
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    const rawVal = eq === -1 ? '' : pair.slice(eq + 1);
    let key: string;
    let val: string;
    try {
      key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
    } catch {
      key = rawKey;
    }
    try {
      val = decodeURIComponent(rawVal.replace(/\+/g, ' '));
    } catch {
      val = rawVal;
    }
    if (key.length > 0) out[key] = val;
  }
  return out;
}

/** Coerce a parsed-JSON form object into a flat string map. */
function coerceFields(json: unknown): Record<string, string> | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
    if (v === null || v === undefined) continue;
    out[k] = typeof v === 'string' ? v : String(v);
  }
  return out;
}

const def: WebhookEmitterDef = {
  type: 'webhook',
  path: 'synology',
  verify: { type: 'body-token', field: 'token', bodyType: 'form' },
  secretEnv: 'INTEGRATION_SYNOLOGY_CHAT_OUTGOING_TOKEN',
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
    // Prefer a pre-parsed body; otherwise hand-roll the urlencoded form.
    const fields = coerceFields(inbound.json) ?? parseForm(inbound.raw);

    const text = fields['text'];
    if (typeof text !== 'string' || text.length === 0) return [];

    // Drop the bot's own / system posts (no human sender; Synology uses `0`).
    const userId = fields['user_id'];
    if (typeof userId !== 'string' || userId.length === 0 || userId === '0') return [];

    const channelId = fields['channel_id'];
    if (typeof channelId !== 'string' || channelId.length === 0) return [];

    const username = fields['username'];
    const from = typeof username === 'string' && username.length > 0 ? username : userId;
    const userName = typeof username === 'string' && username.length > 0 ? username : undefined;

    const postId = fields['post_id'];
    const threadKey = typeof postId === 'string' && postId.length > 0 ? String(postId) : undefined;

    return [
      {
        event: 'message.received',
        payload: {
          text,
          from,
          chatId: String(channelId),
          userName,
          raw: fields as Record<string, unknown>,
        },
        threadKey,
      },
    ];
  },
};

export default def;
