import React, { useState } from 'react';
import type { Medication, AdherenceLog } from '@app/types';
import { useApi, useApiMutation } from '@app/runtime';
import { DoseChecklist } from '../components/DoseChecklist';
import { DoseRow } from '../components/DoseRow';
import { AdherenceBar } from '../components/AdherenceBar';
import { SkeletonList, EmptyState, ErrorNote } from '../components/states';

export default function Doses() {
  const {
    data: medications,
    isLoading: medsLoading,
    error: medsError,
    refetch: refetchMeds,
  } = useApi<Medication[]>('listMedications', {});
  const {
    data: doses,
    isLoading: dosesLoading,
    error: dosesError,
    refetch: refetchDoses,
  } = useApi<AdherenceLog[]>('listDoses', {});

  const logDose = useApiMutation<AdherenceLog>('logDose', {
    invalidates: ['listDoses'],
  });

  const [markingId, setMarkingId] = useState<string | null>(null);

  const onMark = async (medicationId: string) => {
    setMarkingId(medicationId);
    try {
      await logDose.mutate({ medicationId, status: 'taken' });
    } catch {
      // surfaced via logDose.error below
    } finally {
      setMarkingId(null);
    }
  };

  const isLoading = medsLoading || dosesLoading;
  const error = medsError || dosesError;

  const activeMedications = (medications ?? []).filter((m) => !m.endedAt);
  const doseList = doses ?? [];
  const nameById = new Map(activeMedications.map((m) => [m.id, m.name]));

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Today's doses</h1>

      {isLoading ? <SkeletonList rows={4} /> : null}

      {error ? (
        <ErrorNote
          message="Failed to load doses."
          onRetry={() => {
            refetchMeds();
            refetchDoses();
          }}
        />
      ) : null}

      {!isLoading && !error ? (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase text-muted-foreground">Checklist</h2>

            {activeMedications.length === 0 ? (
              <EmptyState
                title="No active medications"
                hint="Add a medication to build today's dose checklist."
                actions={[{ label: 'Add a medication', href: '/medications' }]}
              />
            ) : (
              <DoseChecklist medications={activeMedications} onMark={onMark} markingId={markingId} />
            )}

            {logDose.error ? (
              <ErrorNote
                message={(logDose.error as { message?: string })?.message ?? 'Failed to log dose.'}
              />
            ) : null}
          </section>

          <section className="space-y-3 border-t border-border pt-4">
            <h2 className="text-sm font-bold uppercase text-muted-foreground">Adherence</h2>
            <AdherenceBar doses={doseList} />
          </section>

          <section className="space-y-3 border-t border-border pt-4">
            <h2 className="text-sm font-bold uppercase text-muted-foreground">Recent doses</h2>

            {doseList.length === 0 ? (
              <EmptyState
                title="No doses logged yet"
                hint="Mark a dose on the checklist above and it will appear here with your adherence trend."
              />
            ) : (
              <div className="space-y-2">
                {doseList.map((d) => (
                  <DoseRow
                    key={d.id}
                    dose={d}
                    medicationName={nameById.get(d.medicationId) ?? 'Unknown medication'}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
