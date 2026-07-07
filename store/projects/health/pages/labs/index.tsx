import React from 'react';
import type { LabResult } from '@app/types';
import { useApi } from '@app/runtime';
import { LabRow } from '../../components/LabRow';
import { SkeletonList, EmptyState, ErrorNote } from '../../components/states';

export default function Labs() {
  const { data: labs, isLoading, error, refetch } = useApi<LabResult[]>('listLabs', {});

  const list = labs ?? [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Lab results</h1>

      {isLoading ? <SkeletonList rows={4} /> : null}

      {error ? <ErrorNote message="Failed to load lab results." onRetry={refetch} /> : null}

      {!isLoading && !error && list.length === 0 ? (
        <EmptyState
          title="No lab results yet"
          hint="No lab results yet. Upload a lab PDF in Documents, or add one manually."
          actions={[{ label: 'Go to Documents', href: '/documents' }]}
        />
      ) : null}

      <div className="space-y-2">
        {list.map((lab) => (
          <LabRow key={lab.id} lab={lab} />
        ))}
      </div>
    </main>
  );
}
