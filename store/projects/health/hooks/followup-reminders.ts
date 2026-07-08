type Row = Record<string, unknown>;
interface AsyncDb {
  query(table: string, opts?: { where?: Record<string, unknown> }): Promise<Row[]>;
  insert(table: string, values: Row | Row[]): Promise<Row | Row[]>;
}

interface Followup {
  id: string;
  topic: string;
  reason?: string | null;
  dueAt: string;
  done: boolean;
}

interface Insight {
  id: string;
  kind: string;
  body: string;
}

// Imperative cron handler — NO agent, NO LLM. This used to delegate to
// `coaching/coach#reminders`, an agent action that only ever READ `followups`
// and `display()`-ed a plain-language summary of the overdue ones; it never
// wrote to the database (see spaces/coaching/agents/coach/instruct.md, "Action:
// reminders"). That's a plain date filter + a templated sentence — no natural-
// language generation an agent is actually needed for. This handler reproduces
// the filter in code and persists one `insights` row per overdue follow-up (a
// `kind: 'reminder'` row — the interpreter's own weekly digest already writes a
// non-enumerated `kind: 'weekly'` row to the same table, so this follows an
// existing precedent) so the reminder actually surfaces on the Insights page
// instead of vanishing into an agent transcript no one reads.
//
// Idempotent: before inserting, it checks for an existing `kind: 'reminder'`
// insight with the exact same body text for this follow-up (topic/reason/dueAt
// never change once a follow-up is created), so re-running never duplicates a
// reminder for the same follow-up — even across many days while it stays due.
export default {
  type: 'cron',
  daily: '07:30',
  budget: { maxWallClockMs: 60000 },
  handler: async ({ db }: { db: AsyncDb }) => {
    const now = new Date();

    const followups = (await db.query('followups', {})) as Followup[];
    const due = followups.filter((f) => !f.done && new Date(f.dueAt) <= now);
    if (due.length === 0) return;

    const existingReminders = (await db.query('insights', {
      where: { kind: 'reminder' },
    })) as Insight[];
    const existingBodies = new Set(existingReminders.map((i) => i.body));

    for (const f of due) {
      const dueDateStr = new Date(f.dueAt).toISOString().slice(0, 10);
      const body = `Follow-up due: ${f.topic}${f.reason ? ` — ${f.reason}` : ''} (was due ${dueDateStr})`;
      if (existingBodies.has(body)) continue; // already reminded for this follow-up
      await db.insert('insights', { kind: 'reminder', body });
      existingBodies.add(body);
    }
  },
};
