/**
 * Send a document/file to a Telegram chat (POST /sendDocument on the Telegram Bot API).
 *
 * The gateway pins the base to `https://api.telegram.org/bot<token>`, so the path is just the
 * leading-slash method name. Telegram accepts a JSON body; `document` may be a public HTTP(S) URL
 * that Telegram fetches, or an existing `file_id`.
 *
 * @param chatId       Target chat id (`message.chat.id` from an inbound update).
 * @param documentUrl  A public HTTP(S) URL to the file (or a Telegram `file_id`).
 * @param caption      Optional caption shown with the document.
 * @returns The Telegram response envelope: { ok: boolean; result?: any; description?: string; error_code?: number }
 */
export async function telegramSendDocument(chatId: number | string, documentUrl: string, caption?: string): Promise<any> {
  const body: Record<string, unknown> = { chat_id: chatId, document: documentUrl };
  if (caption) body['caption'] = caption;
  const r = await callConnection('telegram', {
    method: 'POST',
    path: '/sendDocument',
    body,
  });
  return r.data;
}
