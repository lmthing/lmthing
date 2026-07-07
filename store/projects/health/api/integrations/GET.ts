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

export const name = 'listIntegrations';
export const description =
  'List the wearable/portal/calendar integrations and their connection status for the Settings screen. Never returns raw tokens.';

export interface Input {}

/** A provider the app can connect to, with its current status (tokens redacted). */
export interface IntegrationStatus {
  provider: string;
  label: string;
  status: 'disconnected' | 'connected' | 'error' | 'unavailable';
  lastSyncAt?: string;
  lastError?: string;
  /** Whether the server currently has the credentials/keys to make this real. */
  available: boolean;
}

export interface Output {
  integrations: IntegrationStatus[];
}

const CATALOG: { provider: string; label: string; envKey: string }[] = [
  { provider: 'fitbit', label: 'Fitbit', envKey: 'FITBIT_CLIENT_ID' },
  { provider: 'google_fit', label: 'Google Fit', envKey: 'GOOGLE_FIT_CLIENT_ID' },
  { provider: 'apple_health', label: 'Apple Health (export file)', envKey: 'ALWAYS' },
  { provider: 'fhir', label: 'Patient portal (FHIR)', envKey: 'FHIR_CLIENT_ID' },
  { provider: 'google_calendar', label: 'Google Calendar', envKey: 'GOOGLE_CALENDAR_CLIENT_ID' },
];

export default async function handler(_input: Input, ctx: Ctx): Promise<Output> {
  const rows = (await ctx.db.query('integrations')) as Row[];
  const byProvider = new Map(rows.map((r) => [String(r.provider), r]));
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

  const integrations = CATALOG.map((c) => {
    // Apple Health has no cloud API — it is always "available" via export-file upload.
    const available = c.envKey === 'ALWAYS' || Boolean(env[c.envKey]);
    const row = byProvider.get(c.provider);
    let status: IntegrationStatus['status'] = 'disconnected';
    if (!available) status = 'unavailable';
    else if (row?.status === 'connected') status = 'connected';
    else if (row?.status === 'error') status = 'error';
    return {
      provider: c.provider,
      label: c.label,
      status,
      lastSyncAt: row?.lastSyncAt ? String(row.lastSyncAt) : undefined,
      lastError: row?.lastError ? String(row.lastError) : undefined,
      available,
    };
  });

  return { integrations };
}
