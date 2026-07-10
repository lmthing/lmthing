/**
 * Send a photo to a Telegram chat (POST /sendPhoto on the Telegram Bot API).
 *
 * The gateway pins the base to `https://api.telegram.org/bot<token>`, so the path is just the
 * leading-slash method name. Telegram accepts a JSON body; `photo` may be a public HTTP(S) URL that
 * Telegram fetches, or an existing `file_id`.
 *
 * @param chatId    Target chat id (`message.chat.id` from an inbound update).
 * @param photoUrl  A public HTTP(S) URL to the image (or a Telegram `file_id`).
 * @param caption   Optional caption shown under the photo.
 * @returns The Telegram response envelope: { ok: boolean; result?: any; description?: string; error_code?: number }
 */
export async function telegramSendPhoto(chatId: number | string, photoUrl: string, caption?: string): Promise<any> {
  const body: Record<string, unknown> = { chat_id: chatId, photo: photoUrl };
  if (caption) body['caption'] = caption;
  const r = await callConnection('telegram', {
    method: 'POST',
    path: '/sendPhoto',
    body,
  });
  return r.data;
}
