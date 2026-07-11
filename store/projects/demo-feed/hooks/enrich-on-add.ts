// An EVENT hook — fires imperatively right after a feed item is inserted.
//
// Cron hooks are declarative-only (a `CronHookDef` carries `trigger: 'space/agent#action'`,
// never an imperative `handler`), so the self-contained enrichment that makes this demo's
// loop observable lives on an `event` hook instead. It subscribes to the synthetic raw-table
// event `project/db.feed_items.insert` (emitted for every committed insert; its `ctx.input`
// IS the written row). When a new item arrives without a summary, we fill a short placeholder
// so the index page immediately reflects it — the canonical add → db.insert → hook → db.update
// → page loop, with no external agent.
//
// The handler args are duck-typed (`input` = the row + the project's async `db`); an app hook
// must not import runtime internals. This hook only listens on `insert`, and its own write is
// an `update`, so it never re-triggers itself (the loop guard also excludes self-writes).
export default {
  type: 'event' as const,
  on: { event: 'project/db.feed_items.insert' },
  handler: async ({ input, db }: {
    input: { id: string; title?: string; summary?: string };
    db: { update(table: string, opts: { where: Record<string, unknown>; set: Record<string, unknown> }): Promise<number> };
  }): Promise<void> => {
    if (!input?.id) return;
    if (!input.summary || input.summary.trim() === '') {
      await db.update('feed_items', {
        where: { id: input.id },
        set: { summary: `Saved: ${input.title ?? 'untitled'}` },
      });
    }
  },
};
