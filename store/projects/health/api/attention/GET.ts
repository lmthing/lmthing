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

export const name = 'getAttention';
export const description =
  'Aggregate everything that needs the user\'s attention today — flagged labs, due follow-ups, due/missed doses, imminent appointments (next 7 days), and urgent triage results — into one call for the dashboard "Needs attention" strip.';

export interface Input {}

/** One card in the "Needs attention" strip. `href` deep-links to the owning page. */
export interface AttentionItem {
  kind: 'lab' | 'followup' | 'dose' | 'appointment' | 'triage';
  severity: 'emergency' | 'urgent' | 'routine';
  title: string;
  detail: string;
  href: string;
  count?: number;
}

export interface Output {
  items: AttentionItem[];
  total: number;
}

export default async function handler(_input: Input, ctx: Ctx): Promise<Output> {
  const now = Date.now();
  const items: AttentionItem[] = [];

  // Flagged labs (any non-normal flag) → one summary card.
  const labs = (await ctx.db.query('lab_results')) as Row[];
  const flagged = labs.filter((l) => l.flag && l.flag !== 'normal');
  if (flagged.length > 0) {
    items.push({
      kind: 'lab',
      severity: flagged.some((l) => l.flag === 'critical') ? 'urgent' : 'routine',
      title: `${flagged.length} lab ${flagged.length === 1 ? 'result' : 'results'} outside range`,
      detail: flagged
        .slice(0, 3)
        .map((l) => `${l.analyte}`)
        .join(', '),
      href: '/labs',
      count: flagged.length,
    });
  }

  // Follow-ups that are due (not done, dueAt in the past).
  const followups = (await ctx.db.query('followups')) as Row[];
  const dueFollowups = followups.filter(
    (f) => !f.done && f.dueAt && new Date(String(f.dueAt)).getTime() <= now,
  );
  if (dueFollowups.length > 0) {
    items.push({
      kind: 'followup',
      severity: 'routine',
      title: `${dueFollowups.length} follow-up${dueFollowups.length === 1 ? '' : 's'} due`,
      detail: dueFollowups
        .slice(0, 2)
        .map((f) => String(f.topic ?? 'Follow-up'))
        .join(', '),
      href: '/followups',
      count: dueFollowups.length,
    });
  }

  // Doses still due/missed with a scheduled time up to end of today.
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const doses = (await ctx.db.query('adherence_logs')) as Row[];
  const dueDoses = doses.filter(
    (d) =>
      (d.status === 'pending' || d.status === 'missed') &&
      d.scheduledAt &&
      new Date(String(d.scheduledAt)).getTime() <= endOfToday.getTime(),
  );
  if (dueDoses.length > 0) {
    const missed = dueDoses.filter((d) => d.status === 'missed').length;
    items.push({
      kind: 'dose',
      severity: missed > 0 ? 'urgent' : 'routine',
      title: `${dueDoses.length} dose${dueDoses.length === 1 ? '' : 's'} to confirm`,
      detail: missed > 0 ? `${missed} missed` : 'Tap to mark taken',
      href: '/doses',
      count: dueDoses.length,
    });
  }

  // Appointments within the next 7 days.
  const appts = (await ctx.db.query('appointments')) as Row[];
  const in7d = now + 7 * 24 * 60 * 60 * 1000;
  const soon = appts.filter((a) => {
    if (a.status !== 'scheduled' || !a.scheduledAt) return false;
    const t = new Date(String(a.scheduledAt)).getTime();
    return t >= now && t <= in7d;
  });
  if (soon.length > 0) {
    const next = soon.sort((a, b) =>
      String(a.scheduledAt).localeCompare(String(b.scheduledAt)),
    )[0];
    items.push({
      kind: 'appointment',
      severity: 'routine',
      title: `${soon.length} upcoming appointment${soon.length === 1 ? '' : 's'}`,
      detail: String(next.title ?? 'Appointment'),
      href: '/appointments',
      count: soon.length,
    });
  }

  // Urgent / emergency triage results.
  const triage = (await ctx.db.query('triage_assessments')) as Row[];
  const urgentTriage = triage.filter(
    (t) => t.urgency === 'urgent' || t.urgency === 'emergency',
  );
  if (urgentTriage.length > 0) {
    const hasEmergency = urgentTriage.some((t) => t.urgency === 'emergency');
    items.push({
      kind: 'triage',
      severity: hasEmergency ? 'emergency' : 'urgent',
      title: hasEmergency ? 'Triage flagged an emergency' : 'Triage flagged urgent findings',
      detail: String(urgentTriage[0].question ?? ''),
      href: '/triage',
      count: urgentTriage.length,
    });
  }

  // Emergency first, then urgent, then routine.
  const order = { emergency: 0, urgent: 1, routine: 2 } as const;
  items.sort((a, b) => order[a.severity] - order[b.severity]);

  return { items, total: items.length };
}
