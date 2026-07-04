// A DATABASE hook — fires imperatively right after a feed item is inserted.
//
// Cron hooks are declarative-only (a `CronHookDef` carries `trigger: 'space/agent#action'`,
// never an imperative `handler`), so the self-contained enrichment that makes this demo's
// loop observable lives on a `database` hook instead. When a new item arrives without a
// summary, we fill a short placeholder so the index page immediately reflects it — the
// canonical add → db.insert → hook → db.update → page loop, with no external agent.
//
// The handler args are duck-typed (`row` + the project's async `db`); an app hook must not
// import runtime internals. This hook only listens on `insert`, and its own write is an
// `update`, so it never re-triggers itself (the loop guard also excludes self-writes).
export default {
  type: 'database' as const,
  on: { table: 'feed_items', event: 'insert' as const },
  handler: async ({ row, db }: {
    row: { id: string; title?: string; summary?: string };
    db: { update(table: string, opts: { where: Record<string, unknown>; set: Record<string, unknown> }): Promise<number> };
  }): Promise<void> => {
    if (!row?.id) return;
    if (!row.summary || row.summary.trim() === '') {
      await db.update('feed_items', {
        where: { id: row.id },
        set: { summary: `Saved: ${row.title ?? 'untitled'}` },
      });
    }
  },
};
