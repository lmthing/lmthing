// Subscribes to the synthetic db event fired when the planner slots meals into
// plan_meals (a top-level/chat write, which dispatches in the main process). The planner
// inserts one row per day (up to 7 per week); the per-hook coalesce collapses that whole
// burst of inserts into a single nutritionist run instead of firing once per row.
// Declarative trigger form is used (not an imperative handler): the nutritionist
// self-queries plan_meals whose meal_nutrition is missing and computes it. meal_nutrition
// has no hook of its own, so this chain is terminal (bounded).
export default {
  type: 'event',
  on: { event: 'project/db.plan_meals.insert' },
  trigger: 'nutrition/nutritionist#compute',
  budget: { maxEpisodes: 8, maxWallClockMs: 600000 },
};
