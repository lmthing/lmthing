import React, { useState } from 'react';
import { useApi } from '@app/runtime';
import { SearchResults, type SearchResultsData } from '../components/SearchResults';
import { Spinner } from '../components/Spinner';

export default function Search() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');

  const {
    data: results,
    isLoading,
    error,
  } = useApi<SearchResultsData>(
    'search',
    { q: submittedQuery },
    { enabled: !!submittedQuery },
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSubmittedQuery(query.trim());
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Search</h1>

      <form onSubmit={onSubmit} className="flex gap-3 rounded-lg border border-border bg-card p-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search articles, briefings, collections…"
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        />
        <button
          type="submit"
          disabled={!query.trim()}
          className="shrink-0 rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          Search
        </button>
      </form>

      {isLoading ? <Spinner /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to search.
        </div>
      ) : null}

      {!submittedQuery ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          Enter a query above to search.
        </div>
      ) : null}

      {submittedQuery && !isLoading && !error ? <SearchResults results={results} /> : null}
    </main>
  );
}
