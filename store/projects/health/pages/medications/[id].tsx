import React from 'react';
import type { Medication, AdherenceLog, Interaction } from '@app/types';
import { useApi, useApiMutation, Chat, Link } from '@app/runtime';
import { MedicationDetail } from '../../components/MedicationDetail';
import { AdherenceBar } from '../../components/AdherenceBar';
import { InteractionCard } from '../../components/InteractionCard';
import { SkeletonList, EmptyState, ErrorNote, AIWorking } from '../../components/states';
import { ExplainPlainly } from '../../components/ExplainPlainly';

type MedicationRecord = Medication & { doses: AdherenceLog[]; interactions: Interaction[] };

export default function MedicationDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: medication, isLoading, error, refetch } = useApi<MedicationRecord>('getMedication', { id });

  const checkInteractions = useApiMutation<{ interactionId: string; status: string }>('checkInteractions', {
    invalidates: ['getMedication', 'listInteractions'],
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <SkeletonList rows={4} />
      </main>
    );
  }

  if (error || !medication) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-6">
        <Link href="/medications" className="text-sm text-muted-foreground hover:text-primary">
          ← All medications
        </Link>
        <ErrorNote message="Medication not found." onRetry={refetch} />
      </main>
    );
  }

  const doses = Array.isArray(medication.doses) ? medication.doses : [];
  const interactions = Array.isArray(medication.interactions) ? medication.interactions : [];

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <Link href="/medications" className="text-sm text-muted-foreground hover:text-primary">
          ← All medications
        </Link>
      </div>

      <MedicationDetail medication={medication} />

      <section className="space-y-3 border-t border-border pt-4">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Adherence</h2>
        <AdherenceBar doses={doses} />
      </section>

      <section className="space-y-3 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase text-muted-foreground">Interactions</h2>
          <button
            type="button"
            disabled={checkInteractions.isPending}
            onClick={() => checkInteractions.mutate({ medicationId: medication.id })}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {checkInteractions.isPending ? 'Checking…' : 'Check interactions'}
          </button>
        </div>

        {checkInteractions.error ? (
          <ErrorNote
            message={(checkInteractions.error as { message?: string })?.message ?? 'Failed to check interactions.'}
          />
        ) : null}

        {interactions.length === 0 ? (
          <EmptyState
            title="No interaction findings yet"
            hint="Run “Check interactions” and the pharmacist will screen this medication against your others."
          />
        ) : (
          <>
            <div className="space-y-2">
              {interactions.map((i) =>
                i.status === 'pending' ? (
                  <AIWorking key={i.id} agent="The pharmacist" />
                ) : (
                  <InteractionCard key={i.id} interaction={i} />
                ),
              )}
            </div>
            <ExplainPlainly
              agent="pharmacy/pharmacist"
              suggestion="Explain this interaction in plain language."
            />
          </>
        )}
      </section>

      <section className="space-y-3 border-t border-border pt-4">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Ask the pharmacist</h2>
        <Chat agent="pharmacy/pharmacist" />
      </section>
    </main>
  );
}
