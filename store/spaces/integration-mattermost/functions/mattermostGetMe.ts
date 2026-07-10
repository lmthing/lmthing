/**
 * Get the authenticated bot/user account (GET /users/me on the Mattermost REST v4 API).
 *
 * Useful to confirm the token works and to learn the bot's own user id (e.g. so it does not
 * reply to its own posts).
 *
 * @returns The user object: { id, username, email, first_name, last_name, roles, ... }
 *          or, on error, { id, message, status_code }.
 */
export async function mattermostGetMe(): Promise<any> {
  const r = await callConnection('mattermost', {
    method: 'GET',
    path: '/users/me',
  });
  return r.data;
}
