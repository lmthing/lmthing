/**
 * Show a chat action / status in a Telegram chat (POST /sendChatAction on the Telegram Bot API).
 *
 * Useful to display "typing…" (or "upload_photo", "upload_document", …) while THING prepares a reply.
 * The status clears automatically after ~5 seconds or when the next message arrives.
 *
 * The gateway pins the base to `https://api.telegram.org/bot<token>`, so the path is just the
 * leading-slash method name.
 *
 * @param chatId  Target chat id (`message.chat.id` from an inbound update).
 * @param action  The action type, e.g. `"typing"`, `"upload_photo"`, `"upload_document"`.
 * @returns The Telegram response envelope: { ok: boolean; result?: boolean; description?: string; error_code?: number }
 */
export async function telegramSendChatAction(chatId: number | string, action: string): Promise<any> {
  const r = await callConnection('telegram', {
    method: 'POST',
    path: '/sendChatAction',
    body: { chat_id: chatId, action },
  });
  return r.data;
}
