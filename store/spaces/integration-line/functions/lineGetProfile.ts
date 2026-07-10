/**
 * Fetch a LINE user's display profile (GET /v2/bot/profile/{userId}).
 *
 * Use this to turn a bare `userId` (e.g. from an inbound `event.source.userId`) into a friendly
 * name for context. Works only for users who have added the account as a friend.
 *
 * @param userId  The LINE `userId` to look up.
 * @returns On success: `{ userId, displayName, pictureUrl?, statusMessage?, language? }`.
 *          On error: `{ message, details }`.
 */
export async function lineGetProfile(userId: string): Promise<any> {
  const r = await callConnection('line', {
    method: 'GET',
    path: '/v2/bot/profile/' + encodeURIComponent(userId),
  });
  return r.data;
}
