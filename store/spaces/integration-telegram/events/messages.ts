/**
 * `integration-telegram/message.received` — the inbound producer for the user's
 * Telegram bot. Telegram POSTs an [Update](https://core.telegram.org/bots/api#update)
 * to this def's own inbound path; the pod verifies the request against the
 * `header-equals` secret (`x-telegram-bot-api-secret-token` === the
 * `INTEGRATION_TELEGRAM_WEBHOOK_SECRET` env), then the PURE `emit` parses the
 * Update into a normalized `message.received` event.
 *
 * Telegram has no threading model, so `threadKey` is derived from the message
 * id (stable per message). Non-text updates (edited_message, callback_query,
 * bot messages, service messages) are dropped — `emit` returns `[]`.
 */
import type { Emitted, WebhookEmitterDef, WebhookInbound } from '@lmthing/core';

interface TelegramFrom {
  id?: number;
  username?: string;
  is_bot?: boolean;
}

interface TelegramMessage {
  message_id?: number;
  text?: string;
  from?: TelegramFrom;
  chat?: { id?: number };
}

interface TelegramUpdate {
  message?: TelegramMessage;
}

const def: WebhookEmitterDef = {
  type: 'webhook',
  path: 'telegram',
  verify: { type: 'header-equals', header: 'x-telegram-bot-api-secret-token' },
  secretEnv: 'INTEGRATION_TELEGRAM_WEBHOOK_SECRET',
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
    const update = inbound.json as TelegramUpdate | null | undefined;
    const message = update?.message;
    if (!message) return [];

    const text = message.text;
    if (typeof text !== 'string' || text.length === 0) return [];

    const from = message.from;
    if (!from || from.is_bot === true) return [];
    if (typeof from.id !== 'number') return [];

    const chatId = message.chat?.id;
    if (typeof chatId !== 'number') return [];

    const userName = typeof from.username === 'string' ? from.username : undefined;

    return [
      {
        event: 'message.received',
        payload: {
          text,
          from: String(from.id),
          chatId: String(chatId),
          userName,
          raw: update as Record<string, unknown>,
        },
        threadKey: String(message.message_id),
      },
    ];
  },
};

export default def;
