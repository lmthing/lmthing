/**
 * Mark an inbound WhatsApp message as read (POST /messages with status "read").
 *
 * This turns on the blue "read" ticks for the user who messaged you. Call it with the inbound
 * message `id` after you have processed a message. It sends no content.
 *
 * @param messageId  The `id` of the inbound message to mark read (e.g. "wamid.HBg...").
 * @returns The Cloud API response: { success: true } on success, or { error: { message, code } }.
 */
export async function whatsappMarkRead(messageId: string): Promise<any> {
  const r = await callConnection('whatsapp', {
    method: 'POST',
    path: '/messages',
    body: { messaging_product: 'whatsapp', status: 'read', message_id: messageId },
  });
  return r.data;
}
