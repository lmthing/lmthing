/**
 * Send a message with an attached file to Synology Chat via the INCOMING webhook
 * (POST /webapi/entry.cgi?api=SYNO.Chat.External&method=incoming&version=2 on the NAS).
 *
 * Synology fetches the file itself from the supplied `file_url` (which must be reachable from the
 * NAS) and posts it alongside the text into the webhook's channel.
 *
 * The pod pins the base to `INTEGRATION_SYNOLOGY_CHAT_BASE_URL` and appends `?token=<INTEGRATION_SYNOLOGY_CHAT_TOKEN>`.
 * The form body is `payload=<url-encoded JSON>` built by hand (no Buffer/URLSearchParams).
 *
 * @param text     Message text to accompany the file.
 * @param fileUrl  Publicly reachable URL of the file for Synology to fetch and attach.
 * @returns The Synology response: { success: boolean; error?: { code: number; errors?: any } }
 */
export async function synologySendFile(text: string, fileUrl: string): Promise<any> {
  const payload = JSON.stringify({ text, file_url: fileUrl });
  const r = await callConnection('synology', {
    method: 'POST',
    path: '/webapi/entry.cgi',
    query: { api: 'SYNO.Chat.External', method: 'incoming', version: '2' },
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'payload=' + encodeURIComponent(payload),
  });
  return r.data;
}
