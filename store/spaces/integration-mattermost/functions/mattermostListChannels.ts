/**
 * List the channels the authenticated bot/user belongs to within a team
 * (GET /users/me/teams/{teamId}/channels on the Mattermost REST v4 API).
 *
 * Use this to resolve a channel NAME/display name to the channel id that mattermostPostMessage
 * needs. Get a team id from mattermostListTeams.
 *
 * @param teamId  The team id whose channels to list.
 * @returns An array of channel objects: [{ id, name, display_name, type, team_id, ... }]
 *          or, on error, { id, message, status_code }.
 */
export async function mattermostListChannels(teamId: string): Promise<any> {
  const r = await callConnection('mattermost', {
    method: 'GET',
    path: '/users/me/teams/' + encodeURIComponent(teamId) + '/channels',
  });
  return r.data;
}
