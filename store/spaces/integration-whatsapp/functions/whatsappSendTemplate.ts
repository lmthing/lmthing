/**
 * Send an approved WhatsApp message template (POST /messages, type "template").
 *
 * Templates are the ONLY way to message a user OUTSIDE the 24-hour customer-service window (i.e. to
 * start a conversation or re-engage). The template must already be approved in the WhatsApp Manager,
 * and `templateName` + `languageCode` must match it exactly.
 *
 * @param to            Recipient WhatsApp number in international format WITHOUT a leading "+".
 * @param templateName  Registered template name (e.g. "hello_world").
 * @param languageCode  Template language/locale code (e.g. "en_US").
 * @param components    Optional array of template components (header/body/button parameters). Pass
 *                      `[]` (or omit) for templates with no variables.
 * @returns The Cloud API response: { messaging_product, contacts, messages: [{ id }] } on success,
 *          or { error: { message, code, ... } } on failure.
 */
export async function whatsappSendTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  components?: any[],
): Promise<any> {
  const template: Record<string, unknown> = { name: templateName, language: { code: languageCode } };
  if (components && components.length) template['components'] = components;
  const r = await callConnection('whatsapp', {
    method: 'POST',
    path: '/messages',
    body: { messaging_product: 'whatsapp', to, type: 'template', template },
  });
  return r.data;
}
