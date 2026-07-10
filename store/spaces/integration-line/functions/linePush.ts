/**
 * Push a message to a single LINE user, group, or room (POST /v2/bot/message/push).
 *
 * Unlike `lineReply`, this does not need a reply token and can be sent at any time — but it
 * counts against the channel's push-message quota. Use it to reach a user proactively, or as a
 * fallback when a reply token has already expired.
 *
 * @param to    Destination id — a `userId`, `groupId`, or `roomId` (e.g. from `event.source`).
 * @param text  Message text to send.
 * @returns The LINE response body: `{}` on success, or `{ message, details }` on error.
 */
export async function linePush(to: string, text: string): Promise<any> {
  const r = await callConnection('line', {
    method: 'POST',
    path: '/v2/bot/message/push',
    body: { to, messages: [{ type: 'text', text }] },
  });
  return r.data;
}
