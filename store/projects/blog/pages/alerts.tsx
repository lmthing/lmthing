import React from 'react';
import { useApi, apiCall, Link } from '@app/runtime';
import { AlertRow, type AlertLike } from '../components/AlertRow';
import { Spinner } from '../components/Spinner';

export default function Alerts() {
  const { data: alerts, isLoading, error, refetch } = useApi<AlertLike[]>('listAlerts', {
    unreadOnly: false,
  });

  const unreadCount = (alerts ?? []).filter((a) => !a.read).length;

  const onMarkRead = async (id: string) => {
    try {
      await apiCall('markAlertRead', { id });
      refetch?.();
    } catch {
      // ignore — non-critical action
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-foreground">Alerts</h1>
          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground">
            {unreadCount} unread
          </span>
        </div>
        <Link href="/subscriptions" className="text-sm text-primary hover:underline">
          Manage subscriptions →
        </Link>
      </div>
      <p className="-mt-3 text-sm text-muted-foreground">
        Alerts are raised by your subscriptions when a new article matches.
      </p>

      {isLoading ? <Spinner /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load alerts.
        </div>
      ) : null}

      {!isLoading && !error && (alerts ?? []).length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No alerts yet.
        </div>
      ) : null}

      <div className="space-y-2">
        {(alerts ?? []).map((a) => (
          <AlertRow key={a.id} alert={a} onMarkRead={() => onMarkRead(a.id)} />
        ))}
      </div>
    </main>
  );
}
