import React from 'react';
import type { Search } from '@app/types';
import { useApi, useApiMutation, Link } from '@app/runtime';
import { SearchCard } from '../components/SearchCard';
import { NeedsYouNow } from '../components/NeedsYouNow';
import { Spinner } from '../components/Spinner';

type SearchWithCounts = Search & {
  unreadAlerts: number;
  newListings: number;
  tracked: number;
  shortlisted: number;
  bestScore: number;
  lastCaptureAt?: string;
};

export default function SearchList() {
  const { data: searches, isLoading, error, refetch } =
    useApi<SearchWithCounts[]>('searchList', {});

  const updateSearch = useApiMutation<Search>('updateSearch', { invalidates: ['searchList'] });

  const onToggleStatus = (id: string, next: string) => {
    updateSearch.mutate({ id, status: next });
  };

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

      <NeedsYouNow />

      {isLoading ? <Spinner label="Loading your searches…" /> : null}

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive p-4 text-sm text-destructive">
          <span>Failed to load searches.</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-md border border-destructive px-2 py-1 text-xs hover:bg-muted"
          >
            Retry
          </button>
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
          <SearchCard key={s.id} search={s} onToggleStatus={onToggleStatus} />
        ))}
      </div>
    </main>
  );
}
