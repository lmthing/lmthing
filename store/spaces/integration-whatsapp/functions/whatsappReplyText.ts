/**
 * Reply to a specific inbound WhatsApp message, quoting it (POST /messages with a `context`).
 *
 * Identical to `whatsappSendText` but attaches `context.message_id` so the reply is shown quoting the
 * original message in the user's WhatsApp thread. Use this from the inbound handler: pass the `from`
 * and the message `id` you read out of the webhook payload.
 *
 * @param to                Recipient WhatsApp number in international format WITHOUT a leading "+".
 * @param body              Reply text.
 * @param contextMessageId  The `id` of the inbound message you are replying to (e.g. "wamid.HBg...").
 * @returns The Cloud API response: { messaging_product, contacts, messages: [{ id }] } on success,
 *          or { error: { message, code, ... } } on failure.
 */
export async function whatsappReplyText(to: string, body: string, contextMessageId: string): Promise<any> {
  const r = await callConnection('whatsapp', {
    method: 'POST',
    path: '/messages',
    body: {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
      context: { message_id: contextMessageId },
    },
  });
  return r.data;
}
