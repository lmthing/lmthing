import React from 'react';
import type { Setting } from '@app/types';
import { useApi, useApiMutation } from '@app/runtime';
import { Disclaimer } from '../components/Disclaimer';
import { Spinner } from '../components/Spinner';

export default function Settings() {
  const { data: settings, isLoading, error } = useApi<Setting>('getSettings', {});

  const acceptDisclaimer = useApiMutation<Setting>('acceptDisclaimer', {
    invalidates: ['getSettings'],
  });

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Settings</h1>

      {isLoading ? <Spinner /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load settings.
        </div>
      ) : null}

      {settings ? (
        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Plan</span>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs font-bold uppercase text-foreground">
              {settings.tier}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Weekly research budget</span>
            <span className="text-sm text-foreground">${settings.weeklyBudgetUsd}</span>
          </div>
        </section>
      ) : null}

      {settings && !settings.acceptedDisclaimer ? (
        <section className="space-y-3">
          <button
            type="button"
            disabled={acceptDisclaimer.isPending}
            onClick={() => acceptDisclaimer.mutate({})}
            className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {acceptDisclaimer.isPending ? 'Saving…' : 'I understand — this is not medical advice'}
          </button>
          {acceptDisclaimer.error ? (
            <p className="text-sm text-destructive">
              {(acceptDisclaimer.error as { message?: string })?.message ??
                'Failed to save acknowledgement.'}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-3 border-t border-border pt-4">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Disclaimer</h2>
        <Disclaimer />
      </section>
    </main>
  );
}
