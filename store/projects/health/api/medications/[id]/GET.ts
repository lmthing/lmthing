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

import { HttpError } from '@app/runtime';

export const name = 'getMedication';
export const description = 'Get a medication by id, with its dose history and interaction findings hydrated.';

export interface Input {
  id: string;
}

interface AdherenceLog {
  id: string;
  medicationId: string;
  scheduledAt: string;
  takenAt?: string;
  status: string;
  note?: string;
}

interface Interaction {
  id: string;
  medicationId: string;
  otherName: string;
  severity: string;
  body?: string;
  status: string;
  createdAt: string;
}

interface Medication {
  id: string;
  name: string;
  dose?: string;
  schedule?: string;
  startedAt: string;
  endedAt?: string;
  note?: string;
  refillsRemaining?: number;
  reminderTime?: string;
  doses: AdherenceLog[];
  interactions: Interaction[];
}

export type Output = Medication;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('medications', {
    where: { id: input.id },
    include: ['doses', 'interactions'],
  })) as Medication[];

  const medication = rows[0];
  if (!medication) {
    throw new HttpError(404, 'medication not found');
  }

  medication.doses = medication.doses ?? [];
  medication.interactions = medication.interactions ?? [];

  return medication;
}
