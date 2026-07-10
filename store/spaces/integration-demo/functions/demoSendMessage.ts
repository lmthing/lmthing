/**
 * Send a message to the demo echo endpoint (POST /messages).
 *
 * The pod pins the base to your `INTEGRATION_DEMO_BASE_URL` and attaches your `INTEGRATION_DEMO_API_TOKEN`
 * as an `Authorization: Bearer` header — you pass only a relative path + body.
 *
 * @param chatId  The conversation/chat id to send to (echoed back as `chat_id`).
 * @param text    The message text.
 * @returns Whatever the echo endpoint returns (its parsed JSON, or the raw text).
 */
export async function demoSendMessage(chatId: string, text: string): Promise<any> {
  const r = await callConnection('demo', {
    method: 'POST',
    path: '/messages',
    body: { chat_id: chatId, text },
  });
  return r.data;
}
