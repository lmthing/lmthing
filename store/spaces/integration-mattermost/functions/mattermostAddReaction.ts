/**
 * Add an emoji reaction to a post (POST /reactions on the Mattermost REST v4 API).
 *
 * @param userId     The user id that owns the reaction — normally the bot's own id (from
 *                   mattermostGetMe). Mattermost requires the reaction be attributed to a user.
 * @param postId     The id of the post to react to.
 * @param emojiName  The emoji name WITHOUT colons (e.g. "thumbsup", "eyes", "white_check_mark").
 * @returns The created reaction object: { user_id, post_id, emoji_name, create_at }
 *          or, on error, { id, message, status_code }.
 */
export async function mattermostAddReaction(userId: string, postId: string, emojiName: string): Promise<any> {
  const r = await callConnection('mattermost', {
    method: 'POST',
    path: '/reactions',
    body: { user_id: userId, post_id: postId, emoji_name: emojiName },
  });
  return r.data;
}
