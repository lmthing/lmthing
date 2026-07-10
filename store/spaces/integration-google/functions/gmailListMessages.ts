/**
 * List message ids in the user's Gmail mailbox (GET /gmail/v1/users/me/messages).
 *
 * @param query   Optional Gmail search query, e.g. "is:unread from:foo@bar.com newer_than:7d".
 * @param maxResults  Max number of message ids to return (default 25).
 * @returns The Gmail messages.list payload:
 *          { messages?: { id: string; threadId: string }[]; resultSizeEstimate: number; nextPageToken?: string }
 */
export async function gmailListMessages(query?: string, maxResults?: number): Promise<any> {
  const q: Record<string, string> = { maxResults: String(maxResults ?? 25) };
  if (query) q.q = query;
  const r = await callConnection('google', {
    method: 'GET',
    path: '/gmail/v1/users/me/messages',
    query: q,
  });
  return r.data;
}
