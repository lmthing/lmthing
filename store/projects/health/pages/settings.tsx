import React, { useEffect, useState } from 'react';
import type { Setting } from '@app/types';
import { useApi, useApiMutation, apiCall } from '@app/runtime';
import { Disclaimer } from '../components/Disclaimer';
import { SkeletonList, ErrorNote } from '../components/states';
import { BellIcon, LinkIcon, HeartIcon, CheckCircleIcon } from '../components/icons';

const METRIC_KINDS: { kind: string; label: string }[] = [
  { kind: 'weight', label: 'Weight' },
  { kind: 'resting_hr', label: 'Resting heart rate' },
  { kind: 'sleep_hours', label: 'Sleep hours' },
  { kind: 'bp_systolic', label: 'Blood pressure' },
  { kind: 'steps', label: 'Steps' },
];

interface IntegrationStatus {
  provider: string;
  label: string;
  status: 'disconnected' | 'connected' | 'error' | 'unavailable';
  lastError?: string;
  available: boolean;
}

function IntegrationsSection() {
  const { data, isLoading, error, refetch } = useApi<{ integrations: IntegrationStatus[] }>(
    'listIntegrations',
    {},
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const onConnect = async (provider: string) => {
    setBusy(provider);
    setNote(null);
    try {
      const res = (await apiCall('connectIntegration', { provider })) as {
        configured: boolean;
        authorizeUrl?: string;
        reason?: string;
      };
      if (res.configured && res.authorizeUrl) {
        window.location.href = res.authorizeUrl;
      } else {
        setNote(res.reason ?? 'Not available yet.');
      }
    } catch (e) {
      setNote((e as { message?: string })?.message ?? 'Could not start connection.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase text-muted-foreground">
        <LinkIcon className="h-4 w-4" /> Integrations
      </h2>
      {isLoading ? <SkeletonList rows={3} /> : null}
      {error ? <ErrorNote message="Couldn't load integrations." onRetry={refetch} /> : null}
      <div className="space-y-2">
        {(data?.integrations ?? []).map((i) => (
          <div
            key={i.provider}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{i.label}</p>
              <p className="text-xs text-muted-foreground">
                {i.status === 'connected'
                  ? 'Connected'
                  : i.status === 'unavailable'
                    ? 'Not configured on this pod yet'
                    : i.status === 'error'
                      ? i.lastError ?? 'Error'
                      : 'Not connected'}
              </p>
            </div>
            {i.provider === 'apple_health' ? (
              <span className="text-xs text-muted-foreground">Import via Documents</span>
            ) : i.status === 'connected' ? (
              <span className="inline-flex items-center gap-1 text-xs text-success">
                <CheckCircleIcon className="h-4 w-4" /> Synced
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onConnect(i.provider)}
                disabled={busy === i.provider || !i.available}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-50"
              >
                {busy === i.provider ? 'Connecting…' : i.available ? 'Connect' : 'Unavailable'}
              </button>
            )}
          </div>
        ))}
      </div>
      {note ? (
        <p className="rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">{note}</p>
      ) : null}
    </section>
  );
}

export default function Settings() {
  const { data: settings, isLoading, error, refetch } = useApi<Setting>('getSettings', {});
  const acceptDisclaimer = useApiMutation<Setting>('acceptDisclaimer', { invalidates: ['getSettings'] });
  const updateSettings = useApiMutation<Setting>('updateSettings', { invalidates: ['getSettings'] });

  const [pinned, setPinned] = useState<string[]>([]);
  const [channel, setChannel] = useState('in_app');
  const [email, setEmail] = useState('');
  const [telegram, setTelegram] = useState('');

  useEffect(() => {
    if (!settings) return;
    setPinned(Array.isArray(settings.pinnedMetrics) ? (settings.pinnedMetrics as string[]) : []);
    setChannel((settings as { notifyChannel?: string }).notifyChannel ?? 'in_app');
    setEmail((settings as { notifyEmail?: string }).notifyEmail ?? '');
    setTelegram((settings as { notifyTelegramChatId?: string }).notifyTelegramChatId ?? '');
  }, [settings]);

  const togglePin = (kind: string) => {
    setPinned((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]));
  };

  const savePins = () => updateSettings.mutate({ pinnedMetrics: pinned });
  const saveNotify = () =>
    updateSettings.mutate({
      notifyChannel: channel as 'in_app' | 'email' | 'telegram',
      notifyEmail: email,
      notifyTelegramChatId: telegram,
    });

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <h1 className="text-xl font-bold text-foreground">Settings</h1>

      {isLoading ? <SkeletonList rows={2} /> : null}
      {error ? <ErrorNote message="Failed to load settings." onRetry={refetch} /> : null}

      {settings ? (
        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Plan</span>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs font-bold uppercase text-foreground">
              {settings.tier}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Weekly research budget</span>
            <span className="text-sm text-foreground">${settings.weeklyBudgetUsd}</span>
          </div>
        </section>
      ) : null}

      {settings ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase text-muted-foreground">
            <HeartIcon className="h-4 w-4" /> Dashboard trends
          </h2>
          <p className="text-xs text-muted-foreground">Pin the metrics you want on the dashboard.</p>
          <div className="flex flex-wrap gap-2">
            {METRIC_KINDS.map((m) => {
              const on = pinned.includes(m.kind);
              return (
                <button
                  key={m.kind}
                  type="button"
                  onClick={() => togglePin(m.kind)}
                  aria-pressed={on}
                  className={
                    on
                      ? 'rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground'
                      : 'rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:bg-muted'
                  }
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={savePins}
            disabled={updateSettings.isPending}
            className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {updateSettings.isPending ? 'Saving…' : 'Save pinned metrics'}
          </button>
        </section>
      ) : null}

      {settings ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase text-muted-foreground">
            <BellIcon className="h-4 w-4" /> Reminders
          </h2>
          <p className="text-xs text-muted-foreground">
            Where dose, follow-up, and appointment reminders are delivered. External channels need
            server credentials configured on your pod; otherwise they stay in-app.
          </p>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          >
            <option value="in_app">In-app only</option>
            <option value="email">Email</option>
            <option value="telegram">Telegram</option>
          </select>
          {channel === 'email' ? (
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          ) : null}
          {channel === 'telegram' ? (
            <input
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              placeholder="Telegram chat id"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          ) : null}
          <button
            type="button"
            onClick={saveNotify}
            disabled={updateSettings.isPending}
            className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {updateSettings.isPending ? 'Saving…' : 'Save reminder settings'}
          </button>
        </section>
      ) : null}

      <IntegrationsSection />

      {settings && !settings.acceptedDisclaimer ? (
        <section className="space-y-3">
          <button
            type="button"
            disabled={acceptDisclaimer.isPending}
            onClick={() => acceptDisclaimer.mutate({})}
            className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {acceptDisclaimer.isPending ? 'Saving…' : 'I understand — this is not medical advice'}
          </button>
          {acceptDisclaimer.error ? (
            <p className="text-sm text-destructive">
              {(acceptDisclaimer.error as { message?: string })?.message ?? 'Failed to save acknowledgement.'}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-3 border-t border-border pt-4">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Disclaimer</h2>
        <Disclaimer />
      </section>
    </main>
  );
}
