/**
 * Reply to an existing Discord message (POST /channels/{channelId}/messages with a message_reference).
 *
 * This creates a new message that visibly references `messageId`, keeping the reply threaded to the
 * original in the Discord client.
 *
 * @param channelId  The channel id the original message lives in.
 * @param content    The reply text (Discord markdown; max 2000 chars).
 * @param messageId  The id of the message being replied to.
 * @returns The created message object, or `{ message, code }` on error.
 */
export async function discordReplyMessage(channelId: string, content: string, messageId: string): Promise<any> {
  const r = await callConnection('discord', {
    method: 'POST',
    path: `/channels/${channelId}/messages`,
    body: { content, message_reference: { message_id: messageId } },
  });
  return r.data;
}
