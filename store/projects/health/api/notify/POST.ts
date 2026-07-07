type Row = Record<string, unknown>;
interface Db {
  query(table: string, opts?: { where?: Record<string, unknown>; include?: string[]; orderBy?: string | { column: string; dir?: 'asc' | 'desc' }; limit?: number; offset?: number }): Promise<Row[]>;
  insert(table: string, values: Row | Row[]): Promise<Row | Row[]>;
  update(table: string, opts: { where: Record<string, unknown>; set: Record<string, unknown> }): Promise<number>;
  remove(table: string, opts: { where: Record<string, unknown> }): Promise<number>;
}
type Ctx = {
  db: Db;
  spawn: (ref: string, input?: unknown, opts?: { onError?: (e: unknown) => void }) => Promise<{ runId: string }>;
  apiCall: (name: string, input?: unknown) => Promise<unknown>;
};

export const name = 'sendNotification';
export const description =
  "Deliver a reminder to the user's chosen channel (in-app / email / Telegram). External channels require server-side credentials (RESEND_API_KEY, TELEGRAM_BOT_TOKEN); when they are absent this gracefully no-ops and reports why, so reminder crons can call it unconditionally without breaking.";

export interface Input {
  title: string;
  body: string;
  /** e.g. 'dose' | 'appointment' | 'followup' | 'digest' — for the caller's records. */
  category?: string;
}

export interface Output {
  sent: boolean;
  channel: string;
  reason?: string;
}

interface Setting {
  id: string;
  notifyChannel?: string;
  notifyEmail?: string;
  notifyTelegramChatId?: string;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const settings = (await ctx.db.query('settings')) as Setting[];
  const channel = settings[0]?.notifyChannel ?? 'in_app';

  // In-app is always "delivered" — the reminder shows the next time the user opens
  // the app (the crons already display() in-app). No external send needed.
  if (channel === 'in_app') {
    return { sent: true, channel: 'in_app' };
  }

  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

  if (channel === 'email') {
    const key = env.RESEND_API_KEY;
    const to = settings[0]?.notifyEmail;
    if (!key || !to) {
      return {
        sent: false,
        channel: 'email',
        reason: !to ? 'no destination email set' : 'email delivery not configured (RESEND_API_KEY missing)',
      };
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'lmthing.health <health@lmthing.health>',
          to,
          subject: input.title,
          text: input.body,
        }),
      });
      if (!res.ok) return { sent: false, channel: 'email', reason: `provider returned ${res.status}` };
      return { sent: true, channel: 'email' };
    } catch (e) {
      return { sent: false, channel: 'email', reason: (e as Error)?.message ?? 'send failed' };
    }
  }

  if (channel === 'telegram') {
    const token = env.TELEGRAM_BOT_TOKEN;
    const chatId = settings[0]?.notifyTelegramChatId;
    if (!token || !chatId) {
      return {
        sent: false,
        channel: 'telegram',
        reason: !chatId ? 'no Telegram chat id set' : 'Telegram delivery not configured (TELEGRAM_BOT_TOKEN missing)',
      };
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: `${input.title}\n\n${input.body}` }),
      });
      if (!res.ok) return { sent: false, channel: 'telegram', reason: `provider returned ${res.status}` };
      return { sent: true, channel: 'telegram' };
    } catch (e) {
      return { sent: false, channel: 'telegram', reason: (e as Error)?.message ?? 'send failed' };
    }
  }

  return { sent: false, channel, reason: 'unknown channel' };
}
