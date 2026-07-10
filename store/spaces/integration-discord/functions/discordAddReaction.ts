/**
 * Add the bot's reaction to a message
 * (PUT /channels/{channelId}/messages/{messageId}/reactions/{emoji}/@me).
 *
 * For a Unicode emoji pass the emoji character itself (e.g. "👍"); for a custom guild emoji pass
 * `name:id` (e.g. "partyparrot:123456789012345678"). The value is URL-encoded before it is sent.
 * On success Discord returns 204 with no body.
 *
 * @param channelId  The channel id the message lives in.
 * @param messageId  The id of the message to react to.
 * @param emoji      A Unicode emoji, or `name:id` for a custom emoji.
 * @returns An empty body on success, or `{ message, code }` on error.
 */
export async function discordAddReaction(channelId: string, messageId: string, emoji: string): Promise<any> {
  const r = await callConnection('discord', {
    method: 'PUT',
    path: `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
  });
  return r.data;
}
