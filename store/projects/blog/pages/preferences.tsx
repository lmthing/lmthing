import React, { useState } from 'react';
import type { Source, Setting } from '@app/types';
import { useApi, useApiMutation } from '@app/runtime';
import { SourceRow } from '../components/SourceRow';
import { Spinner } from '../components/Spinner';
import { SourceHealthBar, type SourceHealthLike } from '../components/SourceHealthBar';

export default function Preferences() {
  const { data: sources, isLoading, error } = useApi<Source[]>('listSources', {});
  const { data: settings } = useApi<Setting>('getSettings', {});
  const {
    data: sourceHealth,
    isLoading: sourceHealthLoading,
    error: sourceHealthError,
  } = useApi<SourceHealthLike[]>('sourceHealth', {});

  const removeSource = useApiMutation<{ ok: boolean }>('removeSource', {
    invalidates: ['listSources'],
  });
  const addSource = useApiMutation<Source>('addSource', {
    invalidates: ['listSources'],
  });

  const [kind, setKind] = useState<'rss' | 'search'>('rss');
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('');

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    try {
      await addSource.mutate({ kind, value: value.trim(), label: label.trim() || undefined });
      setValue('');
      setLabel('');
    } catch {
      // error surfaced below via addSource.error
    }
  };

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Preferences</h1>
        {settings ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Tier: <span className="text-foreground">{settings.tier}</span> · Weekly budget: $
            {settings.weeklyBudgetUsd} · Max free sources: {settings.maxFreeSources}
          </p>
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Add source</h2>
        <form onSubmit={onAdd} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex gap-3">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as 'rss' | 'search')}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="rss">RSS</option>
              <option value="search">Search</option>
            </select>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={kind === 'rss' ? 'https://example.com/feed.xml' : 'search query'}
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
          <button
            type="submit"
            disabled={addSource.isPending || !value.trim()}
            className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {addSource.isPending ? 'Adding…' : 'Add source'}
          </button>
          {addSource.error ? (
            <p className="text-sm text-destructive">
              {(addSource.error as { message?: string })?.message ?? 'Failed to add source.'}
            </p>
          ) : null}
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Sources</h2>

        {isLoading ? <Spinner /> : null}
        {error ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load sources.
          </div>
        ) : null}
        {!isLoading && !error && (sources ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No sources yet. Add one above.
          </div>
        ) : null}

        <div className="space-y-2">
          {(sources ?? []).map((s) => (
            <SourceRow key={s.id} source={s} onRemove={() => removeSource.mutate({ id: s.id })} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Source health</h2>

        {sourceHealthLoading ? <Spinner /> : null}
        {sourceHealthError ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load source health.
          </div>
        ) : null}
        {!sourceHealthLoading && !sourceHealthError && (sourceHealth ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No source health data yet.
          </div>
        ) : null}

        <div className="space-y-2">
          {(sourceHealth ?? []).map((row) => (
            <SourceHealthBar key={row.id} row={row} />
          ))}
        </div>
      </section>
    </main>
  );
}
