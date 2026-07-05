import React from 'react';
import type { Setting } from '@app/types';
import { useApi, useApiMutation, Chat } from '@app/runtime';
import { PreferencesForm, type SettingsPatch } from '../components/PreferencesForm';
import { Spinner } from '../components/Spinner';

export default function Preferences() {
  const { data: settings, isLoading, error } = useApi<Setting>('getSettings', {});

  const updateSettings = useApiMutation<Setting>('updateSettings', {
    invalidates: ['getSettings'],
  });

  const onSave = (patch: SettingsPatch) => {
    updateSettings.mutate(patch).catch(() => {
      // surfaced via updateSettings.error below
    });
  };

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <h1 className="text-xl font-bold text-foreground">Preferences</h1>

      {isLoading ? <Spinner /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load preferences.
        </div>
      ) : null}

      {!isLoading && !error && !settings ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No preferences yet.
        </div>
      ) : null}

      {settings ? (
        <>
          <PreferencesForm value={settings} onSave={onSave} saving={updateSettings.isPending} />
          {updateSettings.error ? (
            <p className="text-sm text-destructive">
              {(updateSettings.error as { message?: string })?.message ?? 'Failed to save preferences.'}
            </p>
          ) : null}
        </>
      ) : null}

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Ask the nutrition coach</h2>
        <Chat agent="nutrition/coach" />
      </section>
    </main>
  );
}
