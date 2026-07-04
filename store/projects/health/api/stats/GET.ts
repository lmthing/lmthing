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

export const name = 'healthStats';
export const description = 'Summary counts: total metrics logged, lab results, flagged (abnormal) labs, active symptoms, and research reports.';

export interface Input {}

export interface Output {
  metrics: number;
  labs: number;
  flagged: number;
  activeSymptoms: number;
  research: number;
}

interface LabResult {
  id: string;
  flag: string;
}

interface Symptom {
  id: string;
  endedAt?: string;
}

export default async function handler(_input: Input, ctx: Ctx): Promise<Output> {
  const metrics = await ctx.db.query('metrics');
  const labs = (await ctx.db.query('lab_results')) as LabResult[];
  const symptoms = (await ctx.db.query('symptoms')) as Symptom[];
  const research = await ctx.db.query('research');

  const flagged = labs.filter((l) => l.flag !== 'normal').length;
  const activeSymptoms = symptoms.filter((s) => s.endedAt == null).length;

  return {
    metrics: metrics.length,
    labs: labs.length,
    flagged,
    activeSymptoms,
    research: research.length,
  };
}
