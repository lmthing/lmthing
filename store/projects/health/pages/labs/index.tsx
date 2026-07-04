import React from 'react';
import type { LabResult } from '@app/types';
import { useApi } from '@app/runtime';
import { LabRow } from '../../components/LabRow';
import { Spinner } from '../../components/Spinner';

export default function Labs() {
  const { data: labs, isLoading, error } = useApi<LabResult[]>('listLabs', {});

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Lab results</h1>

      {isLoading ? <Spinner /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load lab results.
        </div>
      ) : null}

      {!isLoading && !error && (labs ?? []).length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No lab results yet.
        </div>
      ) : null}

      <div className="space-y-2">
        {(labs ?? []).map((lab) => (
          <LabRow key={lab.id} lab={lab} />
        ))}
      </div>
    </main>
  );
}
