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

export const name = 'addContact';
export const description = 'Add a member of the care team for quick reference and care-summary exports.';

export interface Input {
  name: string;
  role?: string;
  organization?: string;
  phone?: string;
  email?: string;
  note?: string;
}

export interface CareContact {
  id: string;
  name: string;
  role: string;
  organization?: string;
  phone?: string;
  email?: string;
  note?: string;
  createdAt: string;
}

export type Output = CareContact;

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  if (!input.name) {
    throw new HttpError(400, 'name is required');
  }

  const created = (await ctx.db.insert('care_contacts', {
    name: input.name,
    role: input.role ?? 'other',
    organization: input.organization,
    phone: input.phone,
    email: input.email,
    note: input.note,
  })) as CareContact;

  return created;
}
