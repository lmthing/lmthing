/**
 * Broadcast a message to every user who has added the LINE Official Account as a friend
 * (POST /v2/bot/message/broadcast).
 *
 * No recipient list is needed — LINE delivers to all followers. This counts heavily against the
 * push-message quota, so use it sparingly.
 *
 * @param text  Message text to broadcast to all friends of the account.
 * @returns The LINE response body: `{}` on success, or `{ message, details }` on error.
 */
export async function lineBroadcast(text: string): Promise<any> {
  const r = await callConnection('line', {
    method: 'POST',
    path: '/v2/bot/message/broadcast',
    body: { messages: [{ type: 'text', text }] },
  });
  return r.data;
}
