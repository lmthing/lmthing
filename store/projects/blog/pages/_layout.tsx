import React from 'react';
import { Link, resolveAppBase, useApi } from '@app/runtime';

interface NavItem {
  to: string;
  label: string;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Feed' },
  { to: '/discover', label: 'Discover' },
  { to: '/topics', label: 'Topics' },
  { to: '/collections', label: 'Collections' },
  { to: '/digests', label: 'Digests' },
  { to: '/briefings', label: 'Briefings' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/subscriptions', label: 'Subscriptions' },
  { to: '/insights', label: 'Insights' },
  { to: '/search', label: 'Search' },
  { to: '/preferences', label: 'Preferences' },
];

interface Alert {
  read?: boolean;
}

/** The current route relative to the app base (`/topics`, `/feed/…`, `/`). */
function useClientPath(): string {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const base = resolveAppBase(pathname);
  const rest = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  return rest.length > 0 ? rest : '/';
}

function isActive(current: string, to: string): boolean {
  if (to === '/') return current === '/';
  return current === to || current.startsWith(`${to}/`);
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const current = useClientPath();
  const { data: alerts } = useApi<Alert[]>('listAlerts', { unreadOnly: true });
  const unread = (alerts ?? []).filter((a) => a.read !== true).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-card">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-1 gap-y-2 px-4 py-2.5 sm:px-6">
          <Link
            href="/"
            className="mr-2 flex items-center gap-1.5 text-base font-bold tracking-tight text-foreground hover:opacity-80"
          >
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
            lmthing<span className="text-primary">.blog</span>
          </Link>

          <div className="flex flex-1 flex-wrap items-center gap-1">
            {NAV.map((item) => {
              const active = isActive(current, item.to);
              const showBadge = item.to === '/alerts' && unread > 0;
              return (
                <Link
                  key={item.to}
                  href={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={
                    active
                      ? 'inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground'
                      : 'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground'
                  }
                >
                  {item.label}
                  {showBadge ? (
                    <span
                      className={
                        active
                          ? 'inline-flex min-w-4 items-center justify-center rounded-full bg-primary-foreground px-1 text-[0.65rem] font-bold text-primary'
                          : 'inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] font-bold text-primary-foreground'
                      }
                    >
                      {unread}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      {children}
    </div>
  );
}
