/**
 * Reply to a LINE message using its one-time reply token (POST /v2/bot/message/reply).
 *
 * The gateway pins the base to `https://api.line.me` and attaches the user's own
 * `INTEGRATION_LINE_CHANNEL_ACCESS_TOKEN` as a Bearer token. Use this to answer an inbound webhook
 * event: the reply token comes from `event.replyToken` and is SINGLE-USE and short-lived
 * (~1 minute) — reply immediately, never store it. For unsolicited sends use `linePush`.
 *
 * @param replyToken  The `replyToken` from an inbound LINE webhook event.
 * @param text        Message text to send back.
 * @returns The LINE response body: `{}` on success, or `{ message, details }` on error.
 */
export async function lineReply(replyToken: string, text: string): Promise<any> {
  const r = await callConnection('line', {
    method: 'POST',
    path: '/v2/bot/message/reply',
    body: { replyToken, messages: [{ type: 'text', text }] },
  });
  return r.data;
}
