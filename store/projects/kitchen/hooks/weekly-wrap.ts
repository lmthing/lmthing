// Weekly "kitchen wrap": every Sunday morning the coach synthesizes the week — meals cooked,
// favorites, waste avoided, macro adherence vs. target — into one high-value suggestions card.
// Declarative trigger form is used since a cron delegate drops structured input anyway; the coach
// self-queries the latest plan and gates itself to Sunday (like plan-week). suggestions has no hook
// of its own, so this chain is terminal (bounded).
export default {
  type: 'cron',
  daily: '09:00',
  trigger: 'nutrition/coach#wrap',
  budget: { maxEpisodes: 8, maxWallClockMs: 600000 },
};
