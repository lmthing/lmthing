/**
 * Edit a message the bot previously sent (PATCH /channels/{channelId}/messages/{messageId}).
 *
 * A bot can only edit its OWN messages. Editing another author's message returns an error.
 *
 * @param channelId  The channel id the message lives in.
 * @param messageId  The id of the message to edit.
 * @param content    The new message text (Discord markdown; max 2000 chars).
 * @returns The updated message object, or `{ message, code }` on error.
 */
export async function discordEditMessage(channelId: string, messageId: string, content: string): Promise<any> {
  const r = await callConnection('discord', {
    method: 'PATCH',
    path: `/channels/${channelId}/messages/${messageId}`,
    body: { content },
  });
  return r.data;
}
