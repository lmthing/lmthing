/**
 * The earliest `scheduledAt` among logs that are not yet `'taken'` — the next dose still owed,
 * used to tell the user what's coming up rather than only what's already missed. Returns `null`
 * when every log is taken (or there are none), since there's nothing still due.
 */
export function nextDoseDue(logs: { scheduledAt: string; status: string }[]): string | null {
  const pending = logs.filter((l) => l.status !== 'taken');
  if (pending.length === 0) return null;
  return pending
    .slice()
    .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''))[0].scheduledAt;
}
