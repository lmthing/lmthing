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

import { HttpError } from '@app/runtime';

export const name = 'sendNewsletter';
export const description = 'Deliver a rendered newsletter edition by email via Resend, degrading gracefully when unconfigured.';

export interface Input {
  id: string;
  to?: string;
}

export type Output =
  | { sent: true; to: string }
  | { sent: false; reason: 'no-recipient' | 'not-configured' | 'send-failed'; detail?: string };

interface Newsletter {
  id: string;
  digestId: string;
  subject: string;
  body: string;
  sentAt: string | null;
}

interface Setting {
  id: string;
  deliveryEmail?: string | null;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('newsletters', { where: { id: input.id } })) as Newsletter[];
  const newsletter = rows[0];
  if (!newsletter) throw new HttpError(404, 'newsletter not found');

  let recipient = input.to;
  if (!recipient) {
    const settingsRows = (await ctx.db.query('settings')) as Setting[];
    recipient = settingsRows[0]?.deliveryEmail ?? undefined;
  }
  if (!recipient) {
    return { sent: false, reason: 'no-recipient' };
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return { sent: false, reason: 'not-configured' };
  }

  const from = process.env.RESEND_FROM || 'newsletter@lmthing.blog';

  let res: Response;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: newsletter.subject,
        text: newsletter.body,
      }),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { sent: false, reason: 'send-failed', detail };
  }

  if (!res.ok) {
    let detail = `resend responded ${res.status}`;
    try {
      const text = await res.text();
      if (text) detail = text;
    } catch {
      // ignore body read failure
    }
    return { sent: false, reason: 'send-failed', detail };
  }

  await ctx.db.update('newsletters', {
    where: { id: newsletter.id },
    set: { sentAt: new Date().toISOString() },
  });

  return { sent: true, to: recipient };
}
