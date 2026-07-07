import React, { useState } from 'react';
import type { CareShare } from '@app/types';
import { useApi, useApiMutation } from '@app/runtime';
import { CareShareCard } from '../../components/CareShareCard';
import { SkeletonList, EmptyState, ErrorNote } from '../../components/states';

export default function Shares() {
  const { data: shares, isLoading, error, refetch } = useApi<CareShare[]>('listShares', {});

  const createShare = useApiMutation<CareShare>('createShare', {
    invalidates: ['listShares'],
  });

  const [title, setTitle] = useState('');
  const [scope, setScope] = useState('summary');

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createShare.mutate({
        title: title.trim() || undefined,
        scope,
      });
      setTitle('');
      setScope('summary');
    } catch {
      // surfaced via createShare.error below
    }
  };

  const list = shares ?? [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Care summaries</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Create a care summary</h2>
        <form onSubmit={onCreate} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (e.g. Summary for cardiology)"
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-40 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="summary">Summary</option>
              <option value="full">Full</option>
              <option value="labs">Labs</option>
              <option value="meds">Medications</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={createShare.isPending}
            className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {createShare.isPending ? 'Creating…' : 'Create summary'}
          </button>
          {createShare.error ? (
            <ErrorNote
              message={(createShare.error as { message?: string })?.message ?? 'Failed to create summary.'}
            />
          ) : null}
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Your summaries</h2>

        {isLoading ? <SkeletonList rows={3} /> : null}
        {error ? <ErrorNote message="Failed to load summaries." onRetry={refetch} /> : null}

        {!isLoading && !error && list.length === 0 ? (
          <EmptyState
            title="No care summaries yet"
            hint="Create a shareable summary of your record — the coordinator compiles it, then you can print or hand it to a clinician."
          />
        ) : null}

        <div className="space-y-2">
          {list.map((s) => (
            <CareShareCard key={s.id} share={s} />
          ))}
        </div>
      </section>
    </main>
  );
}
