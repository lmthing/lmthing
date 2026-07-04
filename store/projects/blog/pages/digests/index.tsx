import React from 'react';
import { useApi, useApiMutation } from '@app/runtime';
import { DigestCard, type DigestLike } from '../../components/DigestCard';
import { Spinner } from '../../components/Spinner';

export default function Digests() {
  const { data: digests, isLoading, error } = useApi<DigestLike[]>('listDigests', {});

  const buildDigest = useApiMutation<{ digestId: string; status: string }>('buildDigest', {
    invalidates: ['listDigests'],
  });

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Digests</h1>
        <button
          type="button"
          disabled={buildDigest.isPending}
          onClick={() => buildDigest.mutate({})}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          {buildDigest.isPending ? 'Building…' : 'Build digest'}
        </button>
      </div>

      {buildDigest.error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          {(buildDigest.error as { message?: string })?.message ?? 'Failed to build digest.'}
        </div>
      ) : null}

      {isLoading ? <Spinner /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load digests.
        </div>
      ) : null}

      {!isLoading && !error && (digests ?? []).length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No digests yet. Build one above.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {(digests ?? []).map((d) => (
          <DigestCard key={d.id} digest={d} />
        ))}
      </div>
    </main>
  );
}
