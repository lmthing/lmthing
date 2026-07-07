import React, { useState } from 'react';
import { useApi, useApiMutation, apiCall, Link } from '@app/runtime';
import { SparklesIcon, TrendingDownIcon } from './icons';

interface AlertWithContext {
  id: string;
  searchId: string;
  searchTitle: string;
  listingId?: string;
  listingTitle?: string;
  kind: string;
  title: string;
  body?: string;
  read: boolean;
  createdAt: string;
}
interface AllAlerts {
  alerts: AlertWithContext[];
  unreadCount: number;
}

const ATTENTION_KINDS = new Set(['new_match', 'price_drop', 'digest', 'back_online']);

// The command-center top strip — the freshest high-value alerts across ALL
// searches as a horizontally scrollable row. The screen you check every morning.
export function NeedsYouNow() {
  const { data, refetch } = useApi<AllAlerts>('listAllAlerts', { unreadOnly: true, limit: 12 });
  const cards = (data?.alerts ?? []).filter((a) => ATTENTION_KINDS.has(a.kind));

  const save = useApiMutation<{ ok: boolean }>('saveListing', {
    invalidates: ['listAllAlerts', 'searchList'],
  });
  const dismiss = useApiMutation<{ ok: boolean }>('dismissListing', {
    invalidates: ['listAllAlerts', 'searchList'],
  });

  if (cards.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <SparklesIcon className="h-4 w-4 text-agent" />
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Needs you now
        </h2>
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {cards.map((a) => (
          <NeedsCard
            key={a.id}
            alert={a}
            onSave={() => a.listingId && save.mutate({ id: a.listingId })}
            onDismiss={(reason) => a.listingId && dismiss.mutate({ id: a.listingId, reason })}
            onDone={() => {
              void apiCall('markAlertRead', { id: a.id }).then(refetch);
            }}
          />
        ))}
      </div>
    </section>
  );
}

function NeedsCard({
  alert,
  onSave,
  onDismiss,
  onDone,
}: {
  alert: AlertWithContext;
  onSave: () => void;
  onDismiss: (reason: string) => void;
  onDone: () => void;
}) {
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState('');
  const to = alert.listingId ? `/listings/${alert.listingId}` : `/searches/${alert.searchId}`;

  return (
    <div className="flex w-72 shrink-0 flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {alert.kind === 'price_drop' ? (
          <TrendingDownIcon className="h-3.5 w-3.5 text-success" />
        ) : (
          <SparklesIcon className="h-3.5 w-3.5 text-agent" />
        )}
        <span className="truncate">{alert.searchTitle}</span>
      </div>
      <Link
        href={to}
        onClick={onDone}
        className="line-clamp-2 text-sm font-semibold text-foreground hover:text-primary"
      >
        {alert.title}
      </Link>
      {alert.body ? (
        <p className="line-clamp-2 text-xs text-muted-foreground">{alert.body}</p>
      ) : null}

      <div className="mt-auto flex items-center gap-1.5 pt-1">
        <Link
          href={to}
          onClick={onDone}
          className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground hover:bg-muted/70"
        >
          Open
        </Link>
        {alert.listingId ? (
          !dismissing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onSave();
                  onDone();
                }}
                className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setDismissing(true)}
                className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:border-destructive hover:text-destructive"
              >
                Dismiss
              </button>
            </>
          ) : (
            <div className="flex flex-1 items-center gap-1">
              <input
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why?"
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
              />
              <button
                type="button"
                onClick={() => {
                  onDismiss(reason.trim());
                  onDone();
                  setDismissing(false);
                }}
                className="shrink-0 rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground"
              >
                OK
              </button>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
