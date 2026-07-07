import React, { useState } from 'react';
import type { Listing } from '@app/types';
import { useApi } from '@app/runtime';
import { SearchTabs } from '../../../components/SearchTabs';
import { CompareTable } from '../../../components/CompareTable';
import { Spinner } from '../../../components/Spinner';
import { formatMoney } from '../../../components/format';

interface CompareRow {
  attribute: string;
  values: (string | number)[];
}
interface CompareResult {
  titles: string[];
  rows: CompareRow[];
}

export default function SearchCompare({ params }: { params: { searchId: string } }) {
  const { searchId } = params;
  const [selected, setSelected] = useState<string[]>([]);

  const { data: listings, isLoading, error } = useApi<Listing[]>('listingFeed', { id: searchId });

  const canCompare = selected.length >= 2 && selected.length <= 4;

  const { data: compared, isLoading: comparing } = useApi<CompareResult>(
    'compareListings',
    { id: searchId, ids: selected.join(',') },
    { enabled: canCompare },
  );

  const toggle = (id: string) => {
    setSelected((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      if (ids.length >= 4) return ids;
      return [...ids, id];
    });
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <SearchTabs searchId={searchId} active="compare" />

      <div>
        <h1 className="text-2xl font-bold text-foreground">Compare</h1>
        <p className="text-sm text-muted-foreground">
          Pick 2 to 4 listings to line up side by side.
        </p>
      </div>

      {isLoading ? <Spinner label="Loading listings…" /> : null}
      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load listings.
        </div>
      ) : null}

      {!isLoading && !error && (listings ?? []).length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No listings to compare yet.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(listings ?? []).map((l) => {
          const checked = selected.includes(l.id);
          const disabled = !checked && selected.length >= 4;
          return (
            <label
              key={l.id}
              className={
                'flex items-start gap-3 rounded-lg border p-3 text-sm transition-colors ' +
                (checked ? 'border-primary bg-muted' : 'border-border bg-card') +
                (disabled ? ' opacity-50' : ' cursor-pointer hover:border-primary')
              }
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(l.id)}
              />
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">{l.title}</span>
                <span className="text-xs text-muted-foreground">
                  {formatMoney(l.priceAmount, l.currency)}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {selected.length > 0 && selected.length < 2 ? (
        <p className="text-sm text-muted-foreground">Pick at least one more to compare.</p>
      ) : null}

      {comparing ? <Spinner label="Comparing…" /> : null}

      {compared ? <CompareTable titles={compared.titles} rows={compared.rows} /> : null}
    </main>
  );
}
