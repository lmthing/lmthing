import React from 'react';
import type { Traveler } from '@app/types';
import { Link } from '@app/runtime';

export function TravelerCard({ traveler }: { traveler: Traveler }) {
  return (
    <Link
      href={`/travelers/${traveler.id}`}
      className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted"
    >
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium text-foreground">{traveler.name}</p>
        {traveler.homeCountry ? (
          <p className="text-sm text-muted-foreground">{traveler.homeCountry}</p>
        ) : null}
      </div>
      <span className="shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
        {traveler.role}
      </span>
    </Link>
  );
}
