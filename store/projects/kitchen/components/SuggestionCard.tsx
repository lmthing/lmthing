import React from 'react';
import type { Suggestion, Ingredient, Recipe } from '@app/types';

export type SuggestionWithRefs = Suggestion & {
  ingredient?: Ingredient | null;
  recipe?: Recipe | null;
};

const TYPE_LABEL: Record<string, string> = {
  'use-it-up': 'Use it up',
  substitution: 'Substitution',
  nutrition: 'Nutrition',
};

export function SuggestionCard({
  suggestion,
  onDismiss,
}: {
  suggestion: SuggestionWithRefs;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0 flex-1 space-y-1">
        <span className="inline-block rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
          {TYPE_LABEL[suggestion.type] ?? suggestion.type}
        </span>
        <p className="font-medium text-foreground">{suggestion.title}</p>
        {suggestion.body ? <p className="text-sm text-muted-foreground">{suggestion.body}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(suggestion.id)}
        className="shrink-0 rounded-md bg-secondary px-3 py-1 text-xs text-secondary-foreground"
      >
        Dismiss
      </button>
    </div>
  );
}

export default SuggestionCard;
