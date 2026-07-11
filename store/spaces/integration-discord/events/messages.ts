/**
 * `integration-discord/message.received` — the inbound producer for the user's
 * Discord bot. Discord POSTs a signed Interaction / message payload to this
 * def's own inbound path; the pod verifies the request against the app's
 * Ed25519 public key (`INTEGRATION_DISCORD_PUBLIC_KEY`) over
 * `x-signature-timestamp` + raw body, using the `x-signature-ed25519` header.
 *
 * Discord's endpoint-validation **PING** (`type: 1`) is answered synchronously
 * by the `preflight` (a `{ type: 1 }` PONG) BEFORE any agent wakes — the PURE
 * `emit` never sees a normal PING, and defensively drops it if it does. Bot
 * messages and non-message payloads are dropped (`emit` returns `[]`).
 *
 * Threading uses the originating `channel_id` (a stable per-channel key), so a
 * channel's inbound messages continue the same conversation thread.
 */
import type { Emitted, PreflightSpec, WebhookEmitterDef, WebhookInbound } from '@lmthing/core';

interface DiscordAuthor {
  id?: string;
  username?: string;
  bot?: boolean;
}

interface DiscordPayload {
  /** Discord message/interaction `type` — `1` is the endpoint-validation PING. */
  type?: number;
  content?: string;
  channel_id?: string;
  author?: DiscordAuthor;
}

const def: WebhookEmitterDef & { preflight: PreflightSpec } = {
  type: 'webhook',
  path: 'discord',
  verify: { type: 'ed25519', sigHeader: 'x-signature-ed25519', tsHeader: 'x-signature-timestamp' },
  secretEnv: 'INTEGRATION_DISCORD_PUBLIC_KEY',
  preflight: { type: 'json-echo', when: { field: 'type', equals: 1 }, respond: { type: 1 } },
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
    const json = inbound.json as DiscordPayload | null | undefined;
    if (!json) return [];

    // The PING (type 1) is answered by `preflight`; never emit for it.
    if (json.type === 1) return [];

    const author = json.author;
    if (!author || author.bot === true) return [];

    const from = author.id;
    if (typeof from !== 'string' || from.length === 0) return [];

    const text = json.content;
    if (typeof text !== 'string' || text.length === 0) return [];

    const channelId = json.channel_id;
    if (typeof channelId !== 'string' || channelId.length === 0) return [];

    const userName = typeof author.username === 'string' ? author.username : undefined;

    return [
      {
        event: 'message.received',
        payload: {
          text,
          from,
          chatId: channelId,
          userName,
          raw: json as Record<string, unknown>,
        },
        threadKey: channelId,
      },
    ];
  },
};

export default def;
