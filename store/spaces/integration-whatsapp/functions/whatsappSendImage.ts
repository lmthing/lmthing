/**
 * Send an image by public link with an optional caption (POST /messages, type "image").
 *
 * The image is referenced by a publicly reachable HTTPS URL that Meta fetches — you do not upload
 * bytes here. Like text, free-form images are only deliverable inside the 24-hour customer-service
 * window.
 *
 * @param to         Recipient WhatsApp number in international format WITHOUT a leading "+".
 * @param imageLink  Public HTTPS URL of the image (jpg/png).
 * @param caption    Optional caption text shown under the image.
 * @returns The Cloud API response: { messaging_product, contacts, messages: [{ id }] } on success,
 *          or { error: { message, code, ... } } on failure.
 */
export async function whatsappSendImage(to: string, imageLink: string, caption?: string): Promise<any> {
  const image: Record<string, unknown> = { link: imageLink };
  if (caption) image['caption'] = caption;
  const r = await callConnection('whatsapp', {
    method: 'POST',
    path: '/messages',
    body: { messaging_product: 'whatsapp', to, type: 'image', image },
  });
  return r.data;
}
