/**
 * Fraction of adherence logs recorded as `'taken'` — the simplest honest read of "how consistently
 * is this being taken," used by the `reminders` action to report today's adherence alongside any
 * doses still missed or due. An empty log set means there's nothing to measure yet, so it returns
 * `0` rather than a misleading rate.
 */
export function adherenceRate(logs: { status: string }[]): number {
  if (logs.length === 0) return 0;
  const taken = logs.filter((l) => l.status === 'taken').length;
  return taken / logs.length;
}
