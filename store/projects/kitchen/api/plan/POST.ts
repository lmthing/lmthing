type Row = Record<string, unknown>;
interface Db {
  query(table: string, opts?: { where?: Record<string, unknown>; include?: string[]; orderBy?: string | { column: string; dir?: 'asc' | 'desc' }; limit?: number; offset?: number }): Promise<Row[]>;
  insert(table: string, values: Row | Row[]): Promise<Row | Row[]>;
  update(table: string, opts: { where: Record<string, unknown>; set: Record<string, unknown> }): Promise<number>;
  remove(table: string, opts: { where: Record<string, unknown> }): Promise<number>;
}
type Ctx = {
  db: Db;
  spawn: (ref: string, input?: unknown, opts?: { onError?: (e: unknown) => void }) => Promise<{ runId: string }>;
  apiCall: (name: string, input?: unknown) => Promise<unknown>;
};

export const name = 'generatePlan';
export const description = "Create (or reuse) this week's meal plan and kick off the chef planner to fill it with meals.";

export interface Input {
  weekStart?: string;
}

export interface Output {
  planId: string;
  status: string;
}

interface MealPlan {
  id: string;
  weekStart: string;
  status: string;
}

function mondayOf(date: Date): string {
  const day = date.getDay();
  const diff = (day + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - diff);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const weekStart = input.weekStart ?? mondayOf(new Date());

  const existing = (await ctx.db.query('meal_plans', {
    where: { weekStart },
  })) as MealPlan[];

  let planId: string;
  if (existing[0]) {
    planId = existing[0].id;
  } else {
    const created = (await ctx.db.insert('meal_plans', {
      weekStart,
      status: 'planning',
    })) as MealPlan;
    planId = created.id;
  }

  await ctx.spawn('chef/planner#plan', { planId }, {
    onError: async () => {
      // best-effort: leave the plan visibly still in 'planning' if the chef run fails
      await ctx.db.update('meal_plans', {
        where: { id: planId },
        set: { status: 'planning' },
      });
    },
  });

  return { planId, status: 'planning' };
}
