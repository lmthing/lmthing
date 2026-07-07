import React from 'react';
import { Link, resolveAppBase } from '@app/runtime';
import {
  CalendarDays,
  BookOpen,
  Package,
  ShoppingCart,
  Activity,
  Settings,
  Download,
  Timer,
} from '../components/icons';

interface NavItem {
  to: string;
  label: string;
  Icon: typeof CalendarDays;
}

const NAV: NavItem[] = [
  { to: '/', label: 'This Week', Icon: CalendarDays },
  { to: '/recipes', label: 'Recipes', Icon: BookOpen },
  { to: '/pantry', label: 'Pantry', Icon: Package },
  { to: '/shopping', label: 'Shopping', Icon: ShoppingCart },
  { to: '/nutrition', label: 'Nutrition', Icon: Activity },
  { to: '/expiring', label: 'Expiring', Icon: Timer },
  { to: '/import', label: 'Import', Icon: Download },
  { to: '/preferences', label: 'Preferences', Icon: Settings },
];

/** The current route relative to the app base (`/recipes`, `/recipes/…`, `/`). */
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-1 gap-y-2 px-4 py-2.5 sm:px-6">
          <Link
            href="/"
            className="mr-2 flex items-center gap-1.5 text-base font-bold tracking-tight text-foreground hover:opacity-80"
          >
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
            lmthing<span className="text-primary">.kitchen</span>
          </Link>

          <div className="flex flex-1 flex-wrap items-center gap-1">
            {NAV.map((item) => {
              const active = isActive(current, item.to);
              const Icon = item.Icon;
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
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {item.label}
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
