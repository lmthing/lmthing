/**
 * Select the rows a rule has not delivered yet — the watermark filter. Pure, never throws.
 *
 * The watermark is STRICTLY greater-than on `createdAt`: a row created at exactly the last
 * delivered instant was already in that batch, so re-including it would double-send. ISO-8601
 * strings compare lexicographically in chronological order (same length, UTC `Z`), which is why a
 * plain string compare is correct here and no date parsing is needed.
 *
 * @param rows               The queue table's rows.
 * @param lastSeenCreatedAt  Watermark; empty/missing means "everything so far".
 * @param statusFilter       When non-empty, only rows whose `status` equals it are eligible.
 * @returns Eligible rows sorted by `createdAt` then `id`.
 */
export function collectNewRows(
  rows: Record<string, unknown>[] | null | undefined,
  lastSeenCreatedAt: string | null | undefined,
  statusFilter: string | null | undefined,
): Record<string, unknown>[] {
  if (!Array.isArray(rows)) return [];
  const watermark = typeof lastSeenCreatedAt === 'string' ? lastSeenCreatedAt : '';
  const wanted = typeof statusFilter === 'string' ? statusFilter : '';

  const out = rows.filter((row) => {
    if (!row || typeof row !== 'object') return false;
    if (wanted !== '' && String(row['status'] ?? '') !== wanted) return false;
    const createdAt = row['createdAt'];
    if (typeof createdAt !== 'string' || createdAt === '') return false;
    return watermark === '' ? true : createdAt > watermark;
  });

  out.sort((a, b) => {
    const ac = String(a['createdAt'] ?? ''), bc = String(b['createdAt'] ?? '');
    if (ac !== bc) return ac < bc ? -1 : 1;
    return String(a['id'] ?? '').localeCompare(String(b['id'] ?? ''));
  });
  return out;
}
