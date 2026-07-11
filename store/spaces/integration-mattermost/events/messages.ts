/**
 * `integration-mattermost/message.received` — the inbound producer for the
 * user's Mattermost server. A Mattermost **outgoing webhook** POSTs a
 * form-encoded body (`application/x-www-form-urlencoded`) to this def's own
 * inbound path; the pod verifies the request via a `body-token` shared-secret
 * check — the form `token` field is constant-time-compared to the
 * `INTEGRATION_MATTERMOST_OUTGOING_TOKEN` env — then the PURE `emit` parses the
 * form body into a normalized `message.received` event.
 *
 * Mattermost outgoing webhooks post these form fields:
 *   `token, channel_id, channel_name, user_id, user_name, post_id, text, trigger_word`.
 * We map `chatId = channel_id`, `from`/`userName = user_name`, and `text` (with
 * a leading `trigger_word` stripped). `threadKey` is derived from the channel
 * (`mattermost:<channel_id>`) for per-channel multi-turn continuity — mirroring
 * the descriptor's removed `thread` spec. Mattermost never fires an outgoing
 * webhook on a bot's / another integration's post, so a bot echo can't loop;
 * `emit` additionally returns `[]` when there is no `text` or no `user_name`
 * (a non-user / system post).
 *
 * The body arrives as a form string, so `emit` parses `inbound.raw` itself.
 * Since the extraction is worker-isolated, the parse is hand-rolled (split on
 * `&`, `decodeURIComponent` each half) rather than relying on `URLSearchParams`;
 * if the pod already parsed the form into `inbound.json`, that object is used.
 */
import type { Emitted, WebhookEmitterDef, WebhookInbound } from '@lmthing/core';

/** Hand-rolled urlencoded form parser (no URLSearchParams dependency). */
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

const def: WebhookEmitterDef = {
  type: 'webhook',
  path: 'mattermost',
  verify: { type: 'body-token', field: 'token', bodyType: 'form' },
  secretEnv: 'INTEGRATION_MATTERMOST_OUTGOING_TOKEN',
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
    // Mattermost sends a form body → prefer the pod-parsed object, else parse raw.
    const parsed = inbound.json;
    const fields: Record<string, string> =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, string>)
        : parseForm(inbound.raw);

    const userName = fields['user_name'];
    if (typeof userName !== 'string' || userName.length === 0) return [];

    const channelId = fields['channel_id'];
    if (typeof channelId !== 'string' || channelId.length === 0) return [];

    const rawText = fields['text'];
    if (typeof rawText !== 'string' || rawText.length === 0) return [];

    // Strip a leading trigger word (Mattermost fires only on a trigger prefix).
    let text = rawText;
    const trigger = fields['trigger_word'];
    if (typeof trigger === 'string' && trigger.length > 0) {
      if (text.slice(0, trigger.length).toLowerCase() === trigger.toLowerCase()) {
        text = text.slice(trigger.length).replace(/^\s+/, '');
      }
    }
    if (text.length === 0) return [];

    return [
      {
        event: 'message.received',
        payload: {
          text,
          from: userName,
          chatId: channelId,
          userName,
          raw: fields as Record<string, unknown>,
        },
        threadKey: `mattermost:${channelId}`,
      },
    ];
  },
};

export default def;
