/**
 * List recent messages on the user's Twilio account (GET /Messages.json on the Twilio REST API).
 *
 * Returns both inbound and outbound messages, most recent first. Useful to review history or check
 * the delivery `status` of something you just sent.
 *
 * @returns The Twilio list resource: { messages: [{ sid, from, to, body, status, direction,
 *          date_sent, ... }], ... } on success, or an error object { code, message, status }.
 */
export async function smsListMessages(): Promise<any> {
  const r = await callConnection('sms', {
    method: 'GET',
    path: '/Messages.json',
  });
  return r.data;
}
