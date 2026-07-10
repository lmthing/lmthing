/**
 * Delete a message (DELETE /channels/{channelId}/messages/{messageId}).
 *
 * Deleting another author's message requires the MANAGE_MESSAGES permission; the bot can always
 * delete its own messages. On success Discord returns 204 with no body.
 *
 * @param channelId  The channel id the message lives in.
 * @param messageId  The id of the message to delete.
 * @returns An empty body on success, or `{ message, code }` on error.
 */
export async function discordDeleteMessage(channelId: string, messageId: string): Promise<any> {
  const r = await callConnection('discord', {
    method: 'DELETE',
    path: `/channels/${channelId}/messages/${messageId}`,
  });
  return r.data;
}
