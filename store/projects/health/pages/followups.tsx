import React from 'react';
import type { Followup } from '@app/types';
import { useApi, apiCall } from '@app/runtime';
import { FollowupRow } from '../components/FollowupRow';
import { SkeletonList, EmptyState, ErrorNote } from '../components/states';

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
        {isLoading ? <SkeletonList rows={3} /> : null}

        {error ? <ErrorNote message="Failed to load follow-ups." onRetry={refetch} /> : null}

        {!isLoading && !error && (followups ?? []).length === 0 ? (
          <EmptyState
            title="No follow-ups yet"
            hint="Follow-ups are created from your triage assessments and visit briefs. When something needs a check-in, it will show up here."
            tone="clear"
          />
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
