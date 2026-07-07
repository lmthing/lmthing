import React from 'react';
import { Link, useParams } from '@app/runtime';
import { HomeIcon, PlusIcon } from '../components/icons';
import { AlertsBell } from '../components/AlertsBell';
import { SearchSwitcher } from '../components/SearchSwitcher';
import { ConciergeDock } from '../components/ConciergeDock';

export default function Layout({ children }: { children: React.ReactNode }) {
  // The router provides matched route params here — `searchId` is present on
  // /searches/:searchId/* routes, letting us show the search switcher in-context.
  const params = useParams<{ searchId?: string }>();

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 text-lg font-bold text-foreground hover:text-primary"
          >
            <HomeIcon className="h-5 w-5 text-primary" />
            <span className="hidden sm:inline">lmthing.homes</span>
          </Link>
          {params.searchId ? <SearchSwitcher currentId={params.searchId} /> : null}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="hidden rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground sm:block"
          >
            Searches
          </Link>
          <Link
            href="/new"
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
          >
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline">New Search</span>
          </Link>
          <AlertsBell />
        </div>
      </nav>

      {children}

      <ConciergeDock />
    </div>
  );
}
