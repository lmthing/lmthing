/**
 * List the channels in a Discord server / guild (GET /guilds/{guildId}/channels).
 *
 * Use this to resolve a human channel name to the numeric channel id that the message functions need.
 *
 * @param guildId  The server (guild) id.
 * @returns An array of channel objects `[{ id, name, type, ... }]`, or `{ message, code }` on error.
 */
export async function discordListChannels(guildId: string): Promise<any> {
  const r = await callConnection('discord', {
    method: 'GET',
    path: `/guilds/${guildId}/channels`,
  });
  return r.data;
}
