import React, { useState } from 'react';
import type { Listing } from '@app/types';
import { useApi } from '@app/runtime';
import { SearchTabs } from '../../../components/SearchTabs';
import { CompareTable } from '../../../components/CompareTable';
import { Spinner } from '../../../components/Spinner';
import { ChatIcon } from '../../../components/icons';
import { formatMoney } from '../../../components/format';

interface CompareRow {
  attribute: string;
  values: (string | number)[];
}
interface CompareResult {
  titles: string[];
  rows: CompareRow[];
}

function toMarkdown(res: CompareResult): string {
  const header = `| Attribute | ${res.titles.join(' | ')} |`;
  const sep = `| --- | ${res.titles.map(() => '---').join(' | ')} |`;
  const body = res.rows
    .map((r) => `| ${r.attribute} | ${r.values.map((v) => String(v)).join(' | ')} |`)
    .join('\n');
  return `${header}\n${sep}\n${body}\n`;
}

export default function SearchCompare({ params }: { params: { searchId: string } }) {
  const { searchId } = params;
  const [selected, setSelected] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

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

  const onExport = async () => {
    if (!compared) return;
    const md = toMarkdown(compared);
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: download as a file.
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'compare.md';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <SearchTabs searchId={searchId} active="compare" />

      <div>
        <h1 className="text-2xl font-bold text-foreground">Compare</h1>
        <p className="text-sm text-muted-foreground">
          Pick 2 to 4 listings to line up side by side — the best cell in each row is starred.
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

      {compared ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={onExport}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
            >
              {copied ? 'Copied ✓' : 'Copy as markdown'}
            </button>
          </div>
          <CompareTable titles={compared.titles} rows={compared.rows} />
          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            <ChatIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Want a verdict? Ask the <span className="font-medium text-foreground">Concierge</span>{' '}
              (bottom-right): “review these and suggest a viewing order” — it delegates to the ranker
              and weighs them against your learned taste.
            </span>
          </div>
        </div>
      ) : null}
    </main>
  );
}
