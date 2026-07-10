/**
 * Send the same message to multiple LINE users at once (POST /v2/bot/message/multicast).
 *
 * The gateway pins the base to `https://api.line.me` and attaches the user's own
 * `INTEGRATION_LINE_CHANNEL_ACCESS_TOKEN`. Multicast targets INDIVIDUAL users only (not groups/rooms) and
 * counts against the push-message quota.
 *
 * @param to    Array of `userId` strings to deliver to.
 * @param text  Message text to send to each recipient.
 * @returns The LINE response body: `{}` on success, or `{ message, details }` on error.
 */
export async function lineMulticast(to: string[], text: string): Promise<any> {
  const r = await callConnection('line', {
    method: 'POST',
    path: '/v2/bot/message/multicast',
    body: { to, messages: [{ type: 'text', text }] },
  });
  return r.data;
}
