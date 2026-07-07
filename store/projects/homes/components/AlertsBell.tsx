import React, { useEffect, useRef, useState } from 'react';
import { useApi, apiCall, Link } from '@app/runtime';
import { BellIcon, XIcon, TrendingDownIcon, SparklesIcon } from './icons';
import { formatDateTime } from './format';

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

const KIND_TONE: Record<string, string> = {
  new_match: 'text-agent',
  price_drop: 'text-success',
  gone: 'text-muted-foreground',
  back_online: 'text-primary',
  digest: 'text-primary',
};

function KindGlyph({ kind }: { kind: string }) {
  if (kind === 'price_drop') return <TrendingDownIcon className="h-4 w-4 text-success" />;
  if (kind === 'new_match') return <SparklesIcon className="h-4 w-4 text-agent" />;
  return <BellIcon className={`h-4 w-4 ${KIND_TONE[kind] ?? 'text-muted-foreground'}`} />;
}

// The global alerts bell — the single highest-value nav fix. Unread count badge,
// a popover unioning every search's alerts (unread-first), deep-linking to the
// listing or feed. Polls every 30s so a fresh match shows without a reload.
export function AlertsBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const { data, refetch } = useApi<AllAlerts>(
    'listAllAlerts',
    { limit: 25 },
    { refetchInterval: 30000 },
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const alerts = data?.alerts ?? [];
  const unread = data?.unreadCount ?? 0;

  const markRead = async (id: string) => {
    try {
      await apiCall('markAlertRead', { id });
      refetch();
    } catch {
      // best-effort
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Alerts — ${unread} unread` : 'Alerts'}
        aria-expanded={open}
        className="relative rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground"
      >
        <BellIcon className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-agent px-1 text-[0.6rem] font-bold text-agent-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,90vw)] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold text-foreground">
              Alerts{unread > 0 ? ` · ${unread} unread` : ''}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close alerts"
              className="rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                You&apos;re all caught up.
              </p>
            ) : (
              alerts.map((a) => {
                const to = a.listingId ? `/listings/${a.listingId}` : `/searches/${a.searchId}`;
                return (
                  <div
                    key={a.id}
                    className={
                      'flex items-start gap-2.5 border-b border-border px-4 py-3 last:border-b-0 ' +
                      (a.read ? '' : 'bg-muted/40')
                    }
                  >
                    <span className="mt-0.5 shrink-0">
                      <KindGlyph kind={a.kind} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={to}
                        onClick={() => {
                          void markRead(a.id);
                          setOpen(false);
                        }}
                        className="block text-sm font-medium text-foreground hover:text-primary"
                      >
                        {a.title}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.searchTitle}
                        {a.createdAt ? ` · ${formatDateTime(a.createdAt)}` : ''}
                      </p>
                    </div>
                    {!a.read ? (
                      <button
                        type="button"
                        onClick={() => markRead(a.id)}
                        className="shrink-0 rounded px-1.5 py-0.5 text-[0.65rem] text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Mark read"
                      >
                        Mark read
                      </button>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
