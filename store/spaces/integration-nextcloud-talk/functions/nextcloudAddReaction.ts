/**
 * Add an emoji reaction to a message in a Nextcloud Talk conversation as the bot
 * (POST /bot/{roomToken}/reaction/{messageId} on the Talk/Spreed bot API).
 *
 * @param roomToken  The conversation (room) token.
 * @param messageId  The id of the message to react to.
 * @param reaction   A single emoji, e.g. "👍".
 * @returns The OCS envelope: { ocs: { meta: { status, statuscode, message }, data } }.
 */
export async function nextcloudAddReaction(
  roomToken: string,
  messageId: number | string,
  reaction: string,
): Promise<any> {
  const r = await callConnection('nextcloud', {
    method: 'POST',
    path: `/bot/${encodeURIComponent(roomToken)}/reaction/${encodeURIComponent(String(messageId))}`,
    headers: { 'OCS-APIRequest': 'true', Accept: 'application/json' },
    body: { reaction },
  });
  return r.data;
}
