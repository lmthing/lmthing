/**
 * Get the bot's own identity (GET /getMe on the Telegram Bot API).
 *
 * A cheap way to confirm the `INTEGRATION_TELEGRAM_BOT_TOKEN` is valid and see the bot's username. The gateway
 * pins the base to `https://api.telegram.org/bot<token>`, so the path is just the leading-slash
 * method name.
 *
 * @returns The Telegram response envelope:
 *          { ok: boolean; result?: { id: number; is_bot: boolean; first_name: string; username: string }; description?: string; error_code?: number }
 */
export async function telegramGetMe(): Promise<any> {
  const r = await callConnection('telegram', {
    method: 'GET',
    path: '/getMe',
  });
  return r.data;
}
