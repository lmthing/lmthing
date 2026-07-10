/**
 * List the teams the authenticated bot/user belongs to (GET /users/me/teams on the Mattermost
 * REST v4 API).
 *
 * A Mattermost server is organised into teams; channels live inside a team. Use a team id from
 * here with mattermostListChannels to enumerate that team's channels.
 *
 * @returns An array of team objects: [{ id, name, display_name, type, ... }]
 *          or, on error, { id, message, status_code }.
 */
export async function mattermostListTeams(): Promise<any> {
  const r = await callConnection('mattermost', {
    method: 'GET',
    path: '/users/me/teams',
  });
  return r.data;
}
