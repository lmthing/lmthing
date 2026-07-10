/**
 * Post a message to a Discord channel (POST /channels/{channelId}/messages on the Discord REST v10 API).
 *
 * The pod pins the base to `https://discord.com/api/v10` and attaches the user's own bot token
 * (`Authorization: Bot ...`). Pass only the relative path.
 *
 * @param channelId  The target channel id (e.g. "1012345678901234567").
 * @param content    The message text (Discord markdown is supported; max 2000 chars).
 * @returns The created message object, or `{ message, code }` on error.
 */
export async function discordCreateMessage(channelId: string, content: string): Promise<any> {
  const r = await callConnection('discord', {
    method: 'POST',
    path: `/channels/${channelId}/messages`,
    body: { content },
  });
  return r.data;
}
