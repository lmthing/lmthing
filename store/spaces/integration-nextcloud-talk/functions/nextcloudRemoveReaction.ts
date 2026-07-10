/**
 * Remove an emoji reaction the bot previously added to a message in a Nextcloud Talk conversation
 * (DELETE /bot/{roomToken}/reaction/{messageId} on the Talk/Spreed bot API).
 *
 * @param roomToken  The conversation (room) token.
 * @param messageId  The id of the message to un-react.
 * @param reaction   The single emoji to remove, e.g. "👍".
 * @returns The OCS envelope: { ocs: { meta: { status, statuscode, message }, data } }.
 */
export async function nextcloudRemoveReaction(
  roomToken: string,
  messageId: number | string,
  reaction: string,
): Promise<any> {
  const r = await callConnection('nextcloud', {
    method: 'DELETE',
    path: `/bot/${encodeURIComponent(roomToken)}/reaction/${encodeURIComponent(String(messageId))}`,
    headers: { 'OCS-APIRequest': 'true', Accept: 'application/json' },
    body: { reaction },
  });
  return r.data;
}
