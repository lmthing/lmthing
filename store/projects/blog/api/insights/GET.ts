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

export const name = 'feedInsights';
export const description = 'Aggregate reading-engagement and personalization stats for the insights dashboard.';

export interface Input {}

export interface Output {
  totalRead: number;
  totalSaved: number;
  totalDismissed: number;
  byTag: { tag: string; count: number }[];
  byDay: { day: string; count: number }[];
  topTopics: { slug: string; weight: number }[];
}

interface Article {
  id: string;
  read: boolean;
  saved: boolean;
}

interface ReadingEvent {
  id: string;
  articleId: string;
  kind: string;
  dwellMs: number;
  tag: string;
  createdAt: string;
}

interface Topic {
  id: string;
  slug: string;
  weight: number;
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const articles = (await ctx.db.query('articles')) as Article[];
  const events = (await ctx.db.query('reading_events')) as ReadingEvent[];
  const topics = (await ctx.db.query('topics')) as Topic[];

  const totalRead = articles.filter((a) => a.read === true).length;
  const totalSaved = articles.filter((a) => a.saved === true).length;
  const totalDismissed = events.filter((e) => e.kind === 'dismiss').length;

  const tagCounts = new Map<string, number>();
  for (const e of events) {
    if (!e.tag) continue;
    tagCounts.set(e.tag, (tagCounts.get(e.tag) ?? 0) + 1);
  }
  const byTag = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  const dayCounts = new Map<string, number>();
  for (const e of events) {
    if (!e.createdAt) continue;
    const day = e.createdAt.slice(0, 10);
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }
  const byDay = [...dayCounts.entries()]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const topTopics = [...topics]
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    .slice(0, 8)
    .map((t) => ({ slug: t.slug, weight: t.weight }));

  return { totalRead, totalSaved, totalDismissed, byTag, byDay, topTopics };
}
