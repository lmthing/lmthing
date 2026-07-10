/**
 * Post a message to a Mattermost channel (POST /posts on the Mattermost REST v4 API).
 *
 * The pod pins the base to `<MATTERMOST_BASE_URL>/api/v4`, so the path is the leading-slash
 * resource. Mattermost accepts a JSON body for creating a post.
 *
 * @param channelId  The channel id (e.g. "4xp9fdt77pncbef59f4k1qe83o"). Resolve names via
 *                   mattermostListChannels first.
 * @param message    Message text (Mattermost markdown is supported).
 * @param rootId     Optional id of the root post to reply IN-THREAD (e.g. the `post_id` from an
 *                   inbound outgoing-webhook event) so the reply lands under the original message.
 * @returns The created post object: { id, channel_id, user_id, message, root_id, create_at, ... }
 *          or, on error, { id, message, status_code }.
 */
export async function mattermostPostMessage(channelId: string, message: string, rootId?: string): Promise<any> {
  const body: Record<string, unknown> = { channel_id: channelId, message };
  if (rootId) body['root_id'] = rootId;
  const r = await callConnection('mattermost', {
    method: 'POST',
    path: '/posts',
    body,
  });
  return r.data;
}
