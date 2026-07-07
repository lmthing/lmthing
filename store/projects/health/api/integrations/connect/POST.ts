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

export const name = 'connectIntegration';
export const description =
  'Begin connecting a wearable/portal/calendar provider. Returns the OAuth authorize URL to redirect to when server credentials are configured; otherwise returns { configured: false } and a reason so the UI can show a graceful "not yet available" state. No secrets are ever returned.';

export interface Input {
  provider: 'fitbit' | 'google_fit' | 'fhir' | 'google_calendar';
}

export interface Output {
  configured: boolean;
  authorizeUrl?: string;
  reason?: string;
}

const OAUTH: Record<string, { clientEnv: string; authorize: string; scopes: string }> = {
  fitbit: {
    clientEnv: 'FITBIT_CLIENT_ID',
    authorize: 'https://www.fitbit.com/oauth2/authorize',
    scopes: 'activity heartrate sleep weight',
  },
  google_fit: {
    clientEnv: 'GOOGLE_FIT_CLIENT_ID',
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: 'https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.body.read',
  },
  fhir: {
    clientEnv: 'FHIR_CLIENT_ID',
    authorize: '',
    scopes: 'patient/Observation.read patient/MedicationRequest.read',
  },
  google_calendar: {
    clientEnv: 'GOOGLE_CALENDAR_CLIENT_ID',
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: 'https://www.googleapis.com/auth/calendar.events',
  },
};

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const cfg = OAUTH[input.provider];
  if (!cfg) throw new HttpError(400, `unknown provider ${input.provider}`);

  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const clientId = env[cfg.clientEnv];
  const redirectBase = env.APP_PUBLIC_URL;

  if (!clientId || !cfg.authorize || !redirectBase) {
    return {
      configured: false,
      reason:
        `${input.provider} OAuth is not configured on this pod yet ` +
        `(needs ${cfg.clientEnv} + APP_PUBLIC_URL). ` +
        `Once configured, connecting works; meanwhile you can import an export file under Documents.`,
    };
  }

  // Track a disconnected row so the OAuth callback can find/update it.
  const existing = (await ctx.db.query('integrations', { where: { provider: input.provider } })) as Row[];
  if (existing.length === 0) {
    await ctx.db.insert('integrations', { provider: input.provider, status: 'disconnected', scopes: cfg.scopes });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: cfg.scopes,
    redirect_uri: `${redirectBase}/api/integrations/callback`,
    state: input.provider,
  });

  return { configured: true, authorizeUrl: `${cfg.authorize}?${params.toString()}` };
}
