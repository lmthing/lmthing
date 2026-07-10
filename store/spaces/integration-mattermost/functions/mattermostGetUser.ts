/**
 * Get a user by id (GET /users/{userId} on the Mattermost REST v4 API).
 *
 * Useful to turn a `user_id` from an inbound event into a human username/name.
 *
 * @param userId  The user id to look up.
 * @returns The user object: { id, username, email, first_name, last_name, nickname, ... }
 *          or, on error, { id, message, status_code }.
 */
export async function mattermostGetUser(userId: string): Promise<any> {
  const r = await callConnection('mattermost', {
    method: 'GET',
    path: '/users/' + encodeURIComponent(userId),
  });
  return r.data;
}
