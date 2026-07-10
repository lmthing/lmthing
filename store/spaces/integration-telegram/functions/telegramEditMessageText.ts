/**
 * Edit the text of a message the bot previously sent (POST /editMessageText on the Telegram Bot API).
 *
 * The gateway pins the base to `https://api.telegram.org/bot<token>`, so the path is just the
 * leading-slash method name. You can only edit messages the bot itself sent.
 *
 * @param chatId     Chat id the message lives in (`message.chat.id`).
 * @param messageId  `message_id` of the bot message to edit.
 * @param text       The new text.
 * @returns The Telegram response envelope: { ok: boolean; result?: any; description?: string; error_code?: number }
 */
export async function telegramEditMessageText(chatId: number | string, messageId: number | string, text: string): Promise<any> {
  const r = await callConnection('telegram', {
    method: 'POST',
    path: '/editMessageText',
    body: { chat_id: chatId, message_id: messageId, text },
  });
  return r.data;
}
