/**
 * Send a message to Synology Chat via the user's INCOMING webhook
 * (POST /webapi/entry.cgi?api=SYNO.Chat.External&method=incoming&version=2 on the NAS).
 *
 * The pod pins the base to the user's `SYNOLOGY_CHAT_BASE_URL` (e.g. https://nas.example.com:5001)
 * and appends `?token=<SYNOLOGY_CHAT_TOKEN>` automatically. Synology expects a
 * form-encoded body of the shape `payload=<url-encoded JSON>`. Buffer/URLSearchParams are NOT
 * available in the sandbox, so the form string is built by hand with encodeURIComponent.
 *
 * The message lands in the channel/conversation that owns the incoming webhook token.
 *
 * @param text  Message text. Synology Chat supports basic markdown-like markup and <url|label> links.
 * @returns The Synology response: { success: boolean; error?: { code: number; errors?: any } }
 */
export async function synologySendMessage(text: string): Promise<any> {
  const payload = JSON.stringify({ text });
  const r = await callConnection('synology', {
    method: 'POST',
    path: '/webapi/entry.cgi',
    query: { api: 'SYNO.Chat.External', method: 'incoming', version: '2' },
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'payload=' + encodeURIComponent(payload),
  });
  return r.data;
}
