import React from 'react';
import type { Search } from '@app/types';
import { useApi, Link } from '@app/runtime';
import { SearchCard } from '../components/SearchCard';
import { Spinner } from '../components/Spinner';

type SearchWithCounts = Search & { unreadAlerts: number; newListings: number };

export default function SearchList() {
  const { data: searches, isLoading, error } = useApi<SearchWithCounts[]>('searchList', {});

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Your searches</h1>
          <p className="text-sm text-muted-foreground">
            Every home hunt you&apos;re running — ranked, costed, and watched.
          </p>
        </div>
        <Link
          href="/new"
          className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          + New search
        </Link>
      </div>

      {isLoading ? <Spinner label="Loading your searches…" /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load searches.
        </div>
      ) : null}

      {!isLoading && !error && (searches ?? []).length === 0 ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-10 text-center">
          <p className="font-medium text-foreground">No searches yet</p>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            Describe what you&apos;re looking for and start pasting the alerts you already get —
            we&apos;ll clean, cost, and rank every listing for you.
          </p>
          <Link
            href="/new"
            className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Start a search
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(searches ?? []).map((s) => (
          <SearchCard key={s.id} search={s} />
        ))}
      </div>
    </main>
  );
}
