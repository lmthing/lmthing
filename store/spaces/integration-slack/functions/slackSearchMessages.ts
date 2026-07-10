/**
 * Search messages across the user's Slack workspace (GET /search.messages on the Slack Web API).
 *
 * @param query  Slack search query, e.g. "from:@alice in:#general deploy" or a plain keyword.
 * @returns The Slack response envelope:
 *          { ok: boolean; query?: string; messages?: { total: number; matches: any[] }; error?: string }
 */
export async function slackSearchMessages(query: string): Promise<any> {
  const r = await callConnection('slack', {
    method: 'GET',
    path: '/search.messages',
    query: { query },
  });
  return r.data;
}
