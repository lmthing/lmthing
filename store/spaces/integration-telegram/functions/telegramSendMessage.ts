/**
 * Send a text message to a Telegram chat (POST /sendMessage on the Telegram Bot API).
 *
 * The gateway pins the base to `https://api.telegram.org/bot<token>` (the bot token is part of the
 * base, resolved from the user's `INTEGRATION_TELEGRAM_BOT_TOKEN`), so the path is just the leading-slash method
 * name. Telegram accepts a JSON body.
 *
 * @param chatId            Target chat id (e.g. `123456789` or a negative group/channel id). This is
 *                          `message.chat.id` from an inbound update.
 * @param text              Message text.
 * @param replyToMessageId  Optional `message_id` of the message to reply to (threads the reply under
 *                          the original message).
 * @returns The Telegram response envelope: { ok: boolean; result?: any; description?: string; error_code?: number }
 */
export async function telegramSendMessage(chatId: number | string, text: string, replyToMessageId?: number | string): Promise<any> {
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (replyToMessageId !== undefined && replyToMessageId !== null) body['reply_to_message_id'] = replyToMessageId;
  const r = await callConnection('telegram', {
    method: 'POST',
    path: '/sendMessage',
    body,
  });
  return r.data;
}
