/**
 * Respond to a slash-command interaction with a channel message
 * (POST /interactions/{interactionId}/{interactionToken}/callback).
 *
 * Sends an interaction callback of type 4 (CHANNEL_MESSAGE_WITH_SOURCE) — the visible reply to the
 * user who invoked the command. Discord requires the FIRST response within 3 seconds of the
 * interaction being received, so call this promptly. On success Discord returns 204 with no body.
 *
 * @param interactionId     The `id` from the inbound interaction payload.
 * @param interactionToken  The `token` from the inbound interaction payload.
 * @param content           The reply text shown in the channel (Discord markdown; max 2000 chars).
 * @returns An empty body on success, or `{ message, code }` on error.
 */
export async function discordRespondInteraction(interactionId: string, interactionToken: string, content: string): Promise<any> {
  const r = await callConnection('discord', {
    method: 'POST',
    path: `/interactions/${interactionId}/${interactionToken}/callback`,
    body: { type: 4, data: { content } },
  });
  return r.data;
}
