export default {
  type: 'event',
  on: { event: 'project/db.plan_meals.insert' },
  budget: { maxEpisodes: 6 },
  // ctx.input IS the inserted plan_meals row. The planner inserts one row per day (up to 7
  // per week); the per-hook coalesce collapses that whole burst of inserts into a single
  // shopper run instead of firing recompute once per row. The shopper only ever writes
  // shopping_list, and this hook only listens on plan_meals inserts, so the shopper's own
  // writes never re-trigger it (self-write exclusion) — the loop is bounded to one
  // recompute per plan-meals burst.
  handler: async ({ input, delegate }: { input: any; delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<{ ok: boolean; result: unknown; error?: string; sessionId?: string }> }) => {
    await delegate('chef/shopper', 'recompute', { input: { planId: input.planId } });
  },
};
