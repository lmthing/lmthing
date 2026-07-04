import React, { useEffect, useState } from 'react';
import type { PackingItem } from '@app/types';
import { useApi, useApiMutation } from '@app/runtime';
import { TripTabs } from '../../../components/TripTabs';
import { PackingRow } from '../../../components/PackingRow';
import { Spinner } from '../../../components/Spinner';

const CATEGORIES = ['clothing', 'gear', 'documents', 'toiletries', 'electronics', 'other'];

function groupByCategory(items: PackingItem[]): { category: string; items: PackingItem[] }[] {
  const map = new Map<string, PackingItem[]>();
  for (const item of items) {
    const category = item.category || 'other';
    const bucket = map.get(category);
    if (bucket) bucket.push(item);
    else map.set(category, [item]);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([category, catItems]) => ({ category, items: catItems }));
}

export default function TripPacking({ params }: { params: { tripId: string } }) {
  const { tripId } = params;
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState('other');
  const [polling, setPolling] = useState(false);

  const generatePacking = useApiMutation<{ ok: true; runId: string }>('generatePacking', {
    invalidates: ['packingList'],
  });
  const addPackingItem = useApiMutation<PackingItem>('addPackingItem', {
    invalidates: ['packingList'],
  });

  const { data, isLoading, error } = useApi<{ items: PackingItem[] }>(
    'packingList',
    { id: tripId },
    { refetchInterval: polling ? 4000 : undefined },
  );

  const items = data?.items ?? [];

  useEffect(() => {
    setPolling(!isLoading && items.length === 0);
  }, [isLoading, items.length]);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    try {
      await addPackingItem.mutate({ tripId, label: label.trim(), category });
      setLabel('');
      setCategory('other');
    } catch {
      // surfaced via addPackingItem.error below
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <TripTabs tripId={tripId} active="packing" />

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Packing list</h1>
        <button
          type="button"
          onClick={() => generatePacking.mutate({ id: tripId })}
          disabled={generatePacking.isPending}
          className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          {generatePacking.isPending ? 'Generating…' : 'Generate list'}
        </button>
      </div>

      {generatePacking.isPending ? (
        <div className="rounded-lg border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
          The packer is building your list…
        </div>
      ) : null}

      <form
        onSubmit={onAdd}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4"
      >
        <div className="flex-1 space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="item-label">
            Add an item
          </label>
          <input
            id="item-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="rain jacket"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="item-category">
            Category
          </label>
          <select
            id="item-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={addPackingItem.isPending || !label.trim()}
          className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {isLoading ? <Spinner /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load packing list.
        </div>
      ) : null}

      {!isLoading && !error && items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No items yet. Generate a list or add one above.
        </div>
      ) : null}

      <div className="space-y-6">
        {groupByCategory(items).map((group) => (
          <div key={group.category} className="space-y-2">
            <h2 className="text-sm font-bold uppercase text-muted-foreground">{group.category}</h2>
            <div className="space-y-2">
              {group.items.map((item) => (
                <PackingRow key={item.id} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
