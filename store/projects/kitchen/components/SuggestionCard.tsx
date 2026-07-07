import React from 'react';
import type { Suggestion, Ingredient, Recipe } from '@app/types';
import { Clock, Repeat, Activity, Lightbulb, X } from './icons';
import { renderInline } from './MarkdownBody';

export type SuggestionWithRefs = Suggestion & {
  ingredient?: Ingredient | null;
  recipe?: Recipe | null;
};

const TYPE_META: Record<string, { label: string; Icon: typeof Clock }> = {
  'use-it-up': { label: 'Use it up', Icon: Clock },
  substitution: { label: 'Substitution', Icon: Repeat },
  nutrition: { label: 'Nutrition', Icon: Activity },
};

export function SuggestionCard({
  suggestion,
  onDismiss,
}: {
  suggestion: SuggestionWithRefs;
  onDismiss: (id: string) => void;
}) {
  const meta = TYPE_META[suggestion.type] ?? { label: suggestion.type, Icon: Lightbulb };
  const Icon = meta.Icon;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {meta.label}
        </span>
        <p className="font-semibold text-foreground">{suggestion.title}</p>
        {suggestion.body ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {renderInline(suggestion.body)}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(suggestion.id)}
        aria-label="Dismiss suggestion"
        className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default SuggestionCard;
