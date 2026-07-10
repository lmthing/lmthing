/**
 * List channels in the user's Slack workspace (GET /conversations.list on the Slack Web API).
 *
 * Includes public and private channels. Use this to resolve a channel NAME to the id that
 * slackPostMessage needs.
 *
 * @returns The Slack response envelope:
 *          { ok: boolean; channels?: { id: string; name: string; is_private: boolean }[]; error?: string; response_metadata?: any }
 */
export async function slackListChannels(): Promise<any> {
  const r = await callConnection('slack', {
    method: 'GET',
    path: '/conversations.list',
    query: { types: 'public_channel,private_channel', limit: '200' },
  });
  return r.data;
}
