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

export const name = 'planCalendar';
export const description =
  "Export a week's meal plan as an iCalendar (ICS) feed — one dinner event per slot with the recipe title and prep time — so the plan shows up in any calendar app. Zero-auth, one-way; the client downloads the .ics text.";

export interface Input {
  id: string;
}

export interface Output {
  ics: string;
  filename: string;
  eventCount: number;
}

interface PlanMeal {
  id: string;
  recipeId: string;
  day: string;
  meal: string;
}
interface MealPlan {
  id: string;
  weekStart: string;
  meals: PlanMeal[];
}
interface Recipe {
  id: string;
  title: string;
  prepMinutes?: number;
}

function esc(s: string): string {
  return (s ?? '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
}

function dayStamp(day: string): string {
  // All-day-ish evening event: date-only VALUE=DATE keeps it timezone-simple.
  const d = new Date(day);
  if (Number.isNaN(d.getTime())) return day.replace(/-/g, '');
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${dd}`;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('meal_plans', {
    where: { id: input.id },
    include: ['meals'],
  })) as MealPlan[];
  const plan = rows[0];
  const meals = plan?.meals ?? [];

  const recipes = (await ctx.db.query('recipes')) as Recipe[];
  const byId = new Map(recipes.map((r) => [r.id, r]));

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//lmthing.kitchen//meal-plan//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:Kitchen — week of ${esc(plan?.weekStart ?? '')}`,
  ];

  let eventCount = 0;
  for (const m of meals) {
    const recipe = byId.get(m.recipeId);
    if (!recipe) continue;
    const stamp = dayStamp(m.day);
    const label = `${m.meal.charAt(0).toUpperCase()}${m.meal.slice(1)}: ${recipe.title}`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${m.id}@lmthing.kitchen`,
      `DTSTART;VALUE=DATE:${stamp}`,
      `SUMMARY:${esc(label)}`,
      `DESCRIPTION:${esc(`${recipe.prepMinutes ?? 30} min prep`)}`,
      'END:VEVENT',
    );
    eventCount += 1;
  }

  lines.push('END:VCALENDAR');

  return {
    ics: lines.join('\r\n'),
    filename: `kitchen-week-${plan?.weekStart ?? 'plan'}.ics`,
    eventCount,
  };
}
