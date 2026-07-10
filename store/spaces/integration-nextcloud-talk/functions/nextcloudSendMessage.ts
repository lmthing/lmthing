/**
 * Send a message into a Nextcloud Talk conversation as the bot
 * (POST /bot/{roomToken}/message on the Talk/Spreed bot API).
 *
 * The pod pins the base to `<INTEGRATION_NEXTCLOUD_TALK_BASE_URL>/ocs/v2.php/apps/spreed/api/v1` and HMAC-signs the
 * request (nextcloud-bot auth) — you pass only the relative method path and the message body.
 *
 * @param roomToken  The conversation (room) token, e.g. "a1b2c3d4".
 * @param message    The message text to post (Talk markdown is supported).
 * @returns The OCS envelope: { ocs: { meta: { status, statuscode, message }, data } }.
 */
export async function nextcloudSendMessage(roomToken: string, message: string): Promise<any> {
  const r = await callConnection('nextcloud', {
    method: 'POST',
    path: `/bot/${encodeURIComponent(roomToken)}/message`,
    headers: { 'OCS-APIRequest': 'true', Accept: 'application/json' },
    body: { message },
  });
  return r.data;
}
