/**
 * Send a plain-text WhatsApp message (POST /messages on the Meta Cloud API).
 *
 * The gateway pins the base to `https://graph.facebook.com/v20.0/<INTEGRATION_WHATSAPP_PHONE_ID>`, so the path
 * is the leading-slash `/messages` endpoint of your business phone number. A text message can only
 * be sent freely inside the 24-hour customer-service window (a reply to a recent inbound message);
 * outside it you must use an approved template — see `whatsappSendTemplate`.
 *
 * @param to    Recipient WhatsApp number in international format WITHOUT a leading "+" (e.g. "15551234567").
 * @param body  Message text.
 * @returns The Cloud API response: { messaging_product, contacts, messages: [{ id }] } on success,
 *          or { error: { message, code, ... } } on failure.
 */
export async function whatsappSendText(to: string, body: string): Promise<any> {
  const r = await callConnection('whatsapp', {
    method: 'POST',
    path: '/messages',
    body: { messaging_product: 'whatsapp', to, type: 'text', text: { body } },
  });
  return r.data;
}
