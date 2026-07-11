type Row = Record<string, unknown>;
interface AsyncDb {
  query(table: string, opts?: { where?: Record<string, unknown> }): Promise<Row[]>;
  insert(table: string, values: Row | Row[]): Promise<Row | Row[]>;
  update(table: string, opts: { where: Record<string, unknown>; set: Record<string, unknown> }): Promise<number>;
}
interface HookArgs {
  input: Row;
  db: AsyncDb;
}

// Imperative event hook: subscribes to `project/db.integrations.update` — the synthetic
// event a db write to the `integrations` table emits (its `ctx.input` IS the written row).
// It fires when the OAuth callback flips a provider to `status: 'connected'` with a live
// token, pulls fresh readings from that ONE wearable/portal integration, and maps them
// into `metrics` (deduped by kind+recordedAt+source). Runs entirely in the Node handler
// via fetch — no agent, no model.
//
// The runtime supports imperative handlers on `event` hooks (not on `cron`, which is
// declarative agent-trigger only), so an integration write is the right pure-Node signal:
// a wearable is only worth syncing right after it connects. Until real OAuth is wired
// (needs pod-side client creds), `pullReadings` returns [] and the handler is a graceful
// no-op — it returns BEFORE any write, so the app builds and runs with zero configuration
// and the handler's own `integrations` writes can never re-fire it into a loop.
export default {
  type: 'event',
  on: { event: 'project/db.integrations.update' },
  handler: async ({ input, db }: HookArgs) => {
    // Only act when this integration just became connected AND carries a token.
    if (String(input.status) !== 'connected') return;
    const token = input.accessToken ? String(input.accessToken) : '';
    if (!token) return;

    const provider = String(input.provider);
    try {
      // The provider's REST pull would go here (Fitbit/Google Fit), mapping readings to
      // metric rows. Without a live token it returns nothing rather than fabricate data.
      const readings = await pullReadings(provider, token);
      if (readings.length === 0) return;

      const existing = await db.query('metrics');
      const seen = new Set(existing.map((m) => `${m.kind}|${m.recordedAt}|${m.source}`));
      const fresh = readings.filter((r) => !seen.has(`${r.kind}|${r.recordedAt}|${provider}`));
      if (fresh.length > 0) {
        await db.insert('metrics', fresh.map((r) => ({ ...r, source: provider })));
      }
      await db.update('integrations', {
        where: { id: input.id },
        set: { lastSyncAt: new Date().toISOString(), lastError: null },
      });
    } catch (e) {
      await db.update('integrations', {
        where: { id: input.id },
        set: { status: 'error', lastError: (e as Error)?.message ?? 'sync failed' },
      });
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
