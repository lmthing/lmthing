import React from 'react';
import { Link } from '@app/runtime';
import { PlaneIcon, PlusIcon } from '../components/icons';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold text-foreground hover:text-primary"
        >
          <PlaneIcon className="h-5 w-5 text-primary" />
          lmthing.trips
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            My Trips
          </Link>
          <Link
            href="/new"
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
          >
            <PlusIcon className="h-4 w-4" />
            New Trip
          </Link>
        </div>
      </nav>
      {children}
    </div>
  );
}
