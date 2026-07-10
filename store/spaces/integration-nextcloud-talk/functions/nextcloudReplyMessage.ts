/**
 * Reply to a specific message in a Nextcloud Talk conversation as the bot
 * (POST /bot/{roomToken}/message with `replyTo` on the Talk/Spreed bot API).
 *
 * Use this from the inbound handler to answer the message that triggered the event — pass the
 * incoming message id as `replyToMessageId` so the reply is threaded under the original.
 *
 * @param roomToken         The conversation (room) token (the inbound event's `target.id`).
 * @param message           The reply text to post.
 * @param replyToMessageId  The id of the message being replied to (the inbound event's `object.id`).
 * @returns The OCS envelope: { ocs: { meta: { status, statuscode, message }, data } }.
 */
export async function nextcloudReplyMessage(
  roomToken: string,
  message: string,
  replyToMessageId: number | string,
): Promise<any> {
  const r = await callConnection('nextcloud', {
    method: 'POST',
    path: `/bot/${encodeURIComponent(roomToken)}/message`,
    headers: { 'OCS-APIRequest': 'true', Accept: 'application/json' },
    body: { message, replyTo: replyToMessageId },
  });
  return r.data;
}
