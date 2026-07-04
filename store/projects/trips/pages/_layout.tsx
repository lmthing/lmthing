import React from 'react';
import { Link } from '@app/runtime';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <Link href="/" className="text-lg font-bold text-foreground hover:text-primary">
          lmthing.trips
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
            My Trips
          </Link>
          <Link href="/new" className="text-sm text-muted-foreground hover:text-primary">
            New Trip
          </Link>
        </div>
      </nav>
      {children}
    </div>
  );
}
