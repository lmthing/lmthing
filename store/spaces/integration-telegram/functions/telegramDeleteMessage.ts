/**
 * Delete a message from a Telegram chat (POST /deleteMessage on the Telegram Bot API).
 *
 * The gateway pins the base to `https://api.telegram.org/bot<token>`, so the path is just the
 * leading-slash method name. A bot can delete its own messages, and (in groups where it is admin
 * with the right permission) other users' messages.
 *
 * @param chatId     Chat id the message lives in (`message.chat.id`).
 * @param messageId  `message_id` of the message to delete.
 * @returns The Telegram response envelope: { ok: boolean; result?: boolean; description?: string; error_code?: number }
 */
export async function telegramDeleteMessage(chatId: number | string, messageId: number | string): Promise<any> {
  const r = await callConnection('telegram', {
    method: 'POST',
    path: '/deleteMessage',
    body: { chat_id: chatId, message_id: messageId },
  });
  return r.data;
}
