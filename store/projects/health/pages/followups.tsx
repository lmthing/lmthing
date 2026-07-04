import React from 'react';
import type { Followup } from '@app/types';
import { useApi, apiCall } from '@app/runtime';
import { FollowupRow } from '../components/FollowupRow';
import { Spinner } from '../components/Spinner';

export default function Followups() {
  const { data: followups, isLoading, error, refetch } = useApi<Followup[]>('listFollowups', {});

  const onComplete = async (id: string) => {
    try {
      await apiCall('completeFollowup', { id });
      refetch();
    } catch {
      // best effort; list stays as-is on failure
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Follow-ups</h1>

      <section className="space-y-3">
        {isLoading ? <Spinner /> : null}

        {error ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load follow-ups.
          </div>
        ) : null}

        {!isLoading && !error && (followups ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No follow-ups yet.
          </div>
        ) : null}

        <div className="space-y-2">
          {(followups ?? []).map((f) => (
            <FollowupRow key={f.id} followup={f} onComplete={onComplete} />
          ))}
        </div>
      </section>
    </main>
  );
}
