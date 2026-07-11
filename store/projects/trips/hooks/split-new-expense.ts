export default {
  type: 'event',
  on: { event: 'project/db.expenses.insert' },
  budget: { maxEpisodes: 16, maxWallClockMs: 300000 },
  handler: async ({ input, db, delegate }: { input: any; db: any; delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown> }) => {
    // Idempotence — skip if shares already exist for this expense.
    const shares = await db.query('expense_shares', { where: { expenseId: input.id } });
    if (Array.isArray(shares) && shares.length) return;
    // The treasurer self-scans the expense and writes the split expense_shares rows.
    await delegate('finance/treasurer', 'split', { input: { expenseId: input.id } });
  },
};
