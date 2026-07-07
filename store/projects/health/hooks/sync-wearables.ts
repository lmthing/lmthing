type Row = Record<string, unknown>;
interface AsyncDb {
  query(table: string, opts?: { where?: Record<string, unknown> }): Promise<Row[]>;
  insert(table: string, values: Row | Row[]): Promise<Row | Row[]>;
  update(table: string, opts: { where: Record<string, unknown>; set: Record<string, unknown> }): Promise<number>;
}

// Imperative cron hook: hourly, pull fresh readings from any CONNECTED wearable/portal
// integration and map them into `metrics` (deduped by kind+recordedAt+source). Runs
// entirely in the Node handler via fetch — no agent, no model. When no integration is
// connected (the default until the user completes OAuth, which needs pod-side client
// creds), it is a graceful no-op so the app builds and runs with zero configuration.
export default {
  type: 'cron',
  every: '1h',
  handler: async ({ db }: { db: AsyncDb }) => {
    const integrations = await db.query('integrations', { where: { status: 'connected' } });
    if (integrations.length === 0) {
      // Nothing connected — nothing to sync. This is the normal, unconfigured state.
      return;
    }

    for (const integ of integrations) {
      const provider = String(integ.provider);
      try {
        // Each provider's REST pull would go here (Fitbit/Google Fit), mapping readings
        // to metric rows. Without a live token we skip rather than fabricate data.
        const token = integ.accessToken ? String(integ.accessToken) : '';
        if (!token) continue;

        const readings = await pullReadings(provider, token);
        if (readings.length === 0) continue;

        const existing = await db.query('metrics');
        const seen = new Set(
          existing.map((m) => `${m.kind}|${m.recordedAt}|${m.source}`),
        );
        const fresh = readings.filter(
          (r) => !seen.has(`${r.kind}|${r.recordedAt}|${provider}`),
        );
        if (fresh.length > 0) {
          await db.insert(
            'metrics',
            fresh.map((r) => ({ ...r, source: provider })),
          );
        }
        await db.update('integrations', {
          where: { id: integ.id },
          set: { lastSyncAt: new Date().toISOString(), lastError: null },
        });
      } catch (e) {
        await db.update('integrations', {
          where: { id: integ.id },
          set: { status: 'error', lastError: (e as Error)?.message ?? 'sync failed' },
        });
      }
    }
  },
};

/** Fetch recent metric readings from a provider. Returns [] until real OAuth is wired. */
async function pullReadings(
  _provider: string,
  _token: string,
): Promise<{ kind: string; value: number; unit: string; recordedAt: string }[]> {
  // Placeholder for the provider REST call. Intentionally returns nothing so an
  // unconfigured or partially-configured integration never invents metrics.
  return [];
}
