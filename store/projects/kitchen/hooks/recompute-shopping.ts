export default {
  type: 'database',
  on: { table: 'plan_meals', event: 'insert' },
  budget: { maxEpisodes: 6 },
  // The planner inserts one plan_meals row per day (up to 7 per week); the per-hook
  // coalesce collapses that whole burst of inserts into a single shopper run instead of
  // firing recompute once per row. The shopper only ever writes shopping_list, and this
  // hook only listens on plan_meals inserts, so the shopper's own writes never re-trigger
  // it (self-write exclusion) — the loop is bounded to one recompute per plan-meals burst.
  handler: async ({ row, delegate }: { row: any; delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown> }) => {
    await delegate('chef/shopper', 'recompute', { input: { planId: row.planId } });
  },
};
