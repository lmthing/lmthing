import React from 'react';
import { Link } from '@app/runtime';
import { Disclaimer } from '../components/Disclaimer';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <Link href="/" className="text-lg font-bold text-foreground hover:text-primary">
          lmthing.health
        </Link>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
            Dashboard
          </Link>
          <Link href="/labs" className="text-sm text-muted-foreground hover:text-primary">
            Labs
          </Link>
          <Link href="/symptoms" className="text-sm text-muted-foreground hover:text-primary">
            Symptoms
          </Link>
          <Link href="/documents" className="text-sm text-muted-foreground hover:text-primary">
            Documents
          </Link>
          <Link href="/visits" className="text-sm text-muted-foreground hover:text-primary">
            Visits
          </Link>
          <Link href="/insights" className="text-sm text-muted-foreground hover:text-primary">
            Insights
          </Link>
          <Link href="/goals" className="text-sm text-muted-foreground hover:text-primary">
            Goals
          </Link>
          <Link href="/medications" className="text-sm text-muted-foreground hover:text-primary">
            Medications
          </Link>
          <Link href="/settings" className="text-sm text-muted-foreground hover:text-primary">
            Settings
          </Link>
        </div>
      </nav>
      <div className="mx-auto max-w-4xl px-6 pt-4">
        <Disclaimer />
      </div>
      {children}
    </div>
  );
}
