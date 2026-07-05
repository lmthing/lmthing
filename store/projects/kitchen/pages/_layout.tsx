import React from 'react';
import { Link } from '@app/runtime';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <Link href="/" className="text-lg font-bold text-foreground hover:text-primary">
          lmthing.kitchen
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
            This Week
          </Link>
          <Link href="/recipes" className="text-sm text-muted-foreground hover:text-primary">
            Recipes
          </Link>
          <Link href="/pantry" className="text-sm text-muted-foreground hover:text-primary">
            Pantry
          </Link>
          <Link href="/shopping" className="text-sm text-muted-foreground hover:text-primary">
            Shopping
          </Link>
          <Link href="/nutrition" className="text-sm text-muted-foreground hover:text-primary">
            Nutrition
          </Link>
          <Link href="/preferences" className="text-sm text-muted-foreground hover:text-primary">
            Preferences
          </Link>
          <Link href="/import" className="text-sm text-muted-foreground hover:text-primary">
            Import
          </Link>
          <Link href="/expiring" className="text-sm text-muted-foreground hover:text-primary">
            Expiring
          </Link>
        </div>
      </nav>
      {children}
    </div>
  );
}
