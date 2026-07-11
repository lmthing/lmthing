/**
 * `integration-nextcloud-talk/message.received` — the inbound producer for the
 * user's Nextcloud Talk (Spreed) bot. Nextcloud POSTs an ActivityStreams bot
 * event to this def's own inbound path; the pod verifies the request via hex
 * HMAC-SHA256 over `<x-nextcloud-talk-random header> + <raw body>` compared to
 * the `x-nextcloud-talk-signature` header (keyed by the bot secret in
 * `INTEGRATION_NEXTCLOUD_TALK_BOT_SECRET`), then the PURE `emit` normalizes a
 * real user chat message into a `message.received` event.
 *
 * Nextcloud Talk signs the concatenation of the `x-nextcloud-talk-random`
 * header and the raw body, so `verify.signed` is the ordered parts array
 * `[{ header: 'x-nextcloud-talk-random' }, 'body']` — carried VERBATIM from the
 * space's `lmthing.webhook` descriptor.
 *
 * `object.content` is usually a JSON string (`{"message":"hi","parameters":{}}`);
 * `emit` parses it and reads `.message` for the human text (falling back to the
 * raw content / `object.message` / `object.name`). The chat id is the
 * conversation room token (`target.id`); `threadKey` is derived from it for
 * multi-turn continuity. Non-`Create` events, non-`Note` objects, and the bot's
 * own messages (actor type `Application`) are dropped — `emit` returns `[]`.
 */
import type { Emitted, WebhookEmitterDef, WebhookInbound } from '@lmthing/core';

interface NcActor {
  name?: string;
  type?: string;
}

interface NcObject {
  type?: string;
  content?: string;
  message?: string;
  name?: string;
}

interface NcTarget {
  id?: string;
}

interface NcBotEvent {
  type?: string;
  actor?: NcActor;
  object?: NcObject;
  target?: NcTarget;
}

/** Read the human message text from a Talk bot event's `object`. `content` is
 *  typically a JSON string `{"message":"…"}`; fall back to the raw content, then
 *  `object.message` / `object.name`. Returns undefined when nothing usable. */
function extractText(object: NcObject): string | undefined {
  const content = object.content;
  if (typeof content === 'string' && content.length > 0) {
    try {
      const parsed = JSON.parse(content) as { message?: unknown };
      if (parsed && typeof parsed.message === 'string' && parsed.message.length > 0) {
        return parsed.message;
      }
    } catch {
      // not JSON — fall through to the raw content string
    }
    return content;
  }
  if (typeof object.message === 'string' && object.message.length > 0) return object.message;
  if (typeof object.name === 'string' && object.name.length > 0) return object.name;
  return undefined;
}

const def: WebhookEmitterDef = {
  type: 'webhook',
  path: 'nextcloud',
  verify: {
    type: 'hmac',
    algo: 'sha256',
    encoding: 'hex',
    header: 'x-nextcloud-talk-signature',
    signed: [{ header: 'x-nextcloud-talk-random' }, 'body'],
  },
  secretEnv: 'INTEGRATION_NEXTCLOUD_TALK_BOT_SECRET',
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
    const event = inbound.json as NcBotEvent | null | undefined;
    if (!event || event.type !== 'Create') return [];

    const object = event.object;
    if (!object || (typeof object.type === 'string' && object.type !== 'Note')) return [];

    // Ignore the bot's own messages (Application actors) to avoid reply loops.
    const actor = event.actor ?? {};
    if (actor.type === 'Application') return [];

    const chatId = event.target?.id;
    if (typeof chatId !== 'string' || chatId.length === 0) return [];

    const text = extractText(object);
    if (typeof text !== 'string' || text.length === 0) return [];

    const from = typeof actor.name === 'string' ? actor.name : '';

    return [
      {
        event: 'message.received',
        payload: {
          text,
          from,
          chatId,
          userName: typeof actor.name === 'string' ? actor.name : undefined,
          raw: event as Record<string, unknown>,
        },
        threadKey: `nextcloud:${chatId}`,
      },
    ];
  },
};

export default def;
