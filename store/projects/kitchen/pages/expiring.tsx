import React from 'react';
import type { Ingredient, Suggestion } from '@app/types';
import { useApi, useApiMutation } from '@app/runtime';
import { ExpiringRow } from '../components/ExpiringRow';
import { SuggestionCard, type SuggestionWithRefs } from '../components/SuggestionCard';
import { Spinner } from '../components/Spinner';

export default function Expiring() {
  const {
    data: expiring,
    isLoading: loadingExpiring,
    error: expiringError,
  } = useApi<Ingredient[]>('listExpiring', { withinDays: 7 });

  const {
    data: suggestions,
    isLoading: loadingSuggestions,
    error: suggestionsError,
  } = useApi<SuggestionWithRefs[]>('listSuggestions', {});

  const dismissSuggestion = useApiMutation<{ ok: boolean }>('dismissSuggestion', {
    invalidates: ['listSuggestions'],
  });

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <h1 className="text-xl font-bold text-foreground">Expiring &amp; suggestions</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Expiring soon</h2>

        {loadingExpiring ? <Spinner /> : null}

        {expiringError ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load expiring ingredients.
          </div>
        ) : null}

        {!loadingExpiring && !expiringError && (expiring ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            Nothing expiring in the next week.
          </div>
        ) : null}

        <div className="space-y-2">
          {(expiring ?? []).map((ing) => (
            <ExpiringRow key={ing.id} ingredient={ing} />
          ))}
        </div>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Suggestions</h2>

        {loadingSuggestions ? <Spinner /> : null}

        {suggestionsError ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load suggestions.
          </div>
        ) : null}

        {!loadingSuggestions && !suggestionsError && (suggestions ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No suggestions right now.
          </div>
        ) : null}

        <div className="space-y-2">
          {(suggestions ?? []).map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              onDismiss={(id) => dismissSuggestion.mutate({ id })}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
