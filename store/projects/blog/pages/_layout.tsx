import React from 'react';
import { Link } from '@app/runtime';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <Link href="/" className="text-lg font-bold text-foreground hover:text-primary">
          lmthing.blog
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
            Feed
          </Link>
          <Link href="/topics" className="text-sm text-muted-foreground hover:text-primary">
            Topics
          </Link>
          <Link href="/digests" className="text-sm text-muted-foreground hover:text-primary">
            Digests
          </Link>
          <Link href="/insights" className="text-sm text-muted-foreground hover:text-primary">
            Insights
          </Link>
          <Link href="/discover" className="text-sm text-muted-foreground hover:text-primary">
            Discover
          </Link>
          <Link href="/preferences" className="text-sm text-muted-foreground hover:text-primary">
            Preferences
          </Link>
          <Link href="/collections" className="text-sm text-muted-foreground hover:text-primary">
            Collections
          </Link>
          <Link href="/briefings" className="text-sm text-muted-foreground hover:text-primary">
            Briefings
          </Link>
          <Link href="/alerts" className="text-sm text-muted-foreground hover:text-primary">
            Alerts
          </Link>
          <Link href="/search" className="text-sm text-muted-foreground hover:text-primary">
            Search
          </Link>
        </div>
      </nav>
      {children}
    </div>
  );
}
