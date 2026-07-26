/**
 * The cross-space queue registry, as data — which utility queue tables exist in THIS project and
 * how to read each one. Pure, never throws.
 *
 * Every utility space records its findings as rows in a queue table (the queue-table convention);
 * this registry is the dispatcher's only knowledge of its siblings. A recipe names the column that
 * carries the human-readable title, the columns worth showing as detail, and the `status` value
 * that means "still needs attention" (empty string = every row counts, e.g. an append-only log).
 *
 * @param tables The `db.tables()` listing — tolerated shapes: `[{ name, … }]` or plain `string[]`.
 * @returns One entry per registry table PRESENT in this project, in registry order.
 */
export function discoverQueueTables(
  tables: unknown,
): { table: string; space: string; label: string; titleColumn: string; detailColumns: string[]; statusFilter: string }[] {
  const KNOWN_QUEUES: Record<string, { space: string; label: string; titleColumn: string; detailColumns: string[]; statusFilter: string }> = {
    deadline_alerts: { space: 'utility-deadlines', label: 'Deadline alerts', titleColumn: 'label', detailColumns: ['dueAt', 'daysLeft'], statusFilter: 'open' },
    janitor_findings: { space: 'utility-janitor', label: 'Data-hygiene findings', titleColumn: 'detail', detailColumns: ['targetTable', 'kind'], statusFilter: 'proposed' },
    validation_violations: { space: 'utility-validator', label: 'Validation violations', titleColumn: 'reason', detailColumns: ['targetTable', 'rowId'], statusFilter: 'open' },
    insight_reports: { space: 'utility-insights', label: 'Insight digests', titleColumn: 'summary', detailColumns: ['period'], statusFilter: 'open' },
    audit_log: { space: 'utility-auditor', label: 'Change log', titleColumn: 'change', detailColumns: ['targetTable', 'rowId'], statusFilter: '' },
    archive_reports: { space: 'utility-archivist', label: 'Archive reports', titleColumn: 'kind', detailColumns: ['targetTable'], statusFilter: 'open' },
    ledger_reports: { space: 'utility-ledger', label: 'Ledger closes', titleColumn: 'periodStart', detailColumns: ['total', 'overBudget'], statusFilter: 'open' },
    intake_items: { space: 'utility-intake', label: 'Unrouted intake', titleColumn: 'source', detailColumns: ['status'], statusFilter: 'unrouted' },
    enrich_tasks: { space: 'utility-enricher', label: 'Enrichment proposals', titleColumn: 'query', detailColumns: ['status'], statusFilter: 'proposed' },
  };

  const present = new Set<string>();
  if (Array.isArray(tables)) {
    for (const t of tables) {
      if (typeof t === 'string') present.add(t);
      else if (t && typeof t === 'object' && typeof (t as { name?: unknown }).name === 'string') present.add((t as { name: string }).name);
    }
  }

  const out: { table: string; space: string; label: string; titleColumn: string; detailColumns: string[]; statusFilter: string }[] = [];
  for (const table of Object.keys(KNOWN_QUEUES)) {
    if (!present.has(table)) continue;
    const r = KNOWN_QUEUES[table]!;
    out.push({ table, space: r.space, label: r.label, titleColumn: r.titleColumn, detailColumns: [...r.detailColumns], statusFilter: r.statusFilter });
  }
  return out;
}
