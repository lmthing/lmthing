/**
 * Send a direct message to specific Synology Chat user(s) via the INCOMING webhook
 * (POST /webapi/entry.cgi?api=SYNO.Chat.External&method=incoming&version=2 on the NAS).
 *
 * Same transport as synologySendMessage, but the payload carries a `user_ids` array so the
 * message is delivered privately to those users instead of the webhook's default channel.
 * This is how the inbound handler replies to the person who messaged the bot.
 *
 * The pod pins the base to `INTEGRATION_SYNOLOGY_CHAT_BASE_URL` and appends `?token=<INTEGRATION_SYNOLOGY_CHAT_TOKEN>`.
 * The form body is `payload=<url-encoded JSON>` built by hand (no Buffer/URLSearchParams).
 *
 * @param userId  Synology Chat numeric user id (the `user_id` field from an outgoing-webhook event).
 * @param text    Message text.
 * @returns The Synology response: { success: boolean; error?: { code: number; errors?: any } }
 */
export async function synologySendToUser(userId: string | number, text: string): Promise<any> {
  const payload = JSON.stringify({ text, user_ids: [userId] });
  const r = await callConnection('synology', {
    method: 'POST',
    path: '/webapi/entry.cgi',
    query: { api: 'SYNO.Chat.External', method: 'incoming', version: '2' },
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'payload=' + encodeURIComponent(payload),
  });
  return r.data;
}
