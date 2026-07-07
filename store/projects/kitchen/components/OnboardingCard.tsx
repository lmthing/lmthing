import React from 'react';
import { Link } from '@app/runtime';
import { Download, ClipboardList, ChefHat, Sparkles } from './icons';

/**
 * First-run guidance shown when there are no recipes yet. Three concrete ways to stock the
 * kitchen, plus a one-tap "seed starter recipes" so meal planning isn't dead on arrival.
 */
export function OnboardingCard({
  onSeed,
  seeding,
  onAskChef,
}: {
  onSeed: () => void;
  seeding: boolean;
  onAskChef: () => void;
}) {
  return (
    <div className="space-y-5 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ChefHat className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-foreground">Let&apos;s stock your kitchen</h2>
          <p className="text-sm text-muted-foreground">Three ways to get started — pick one.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link
          href="/recipes"
          className="flex flex-col gap-1.5 rounded-xl border border-border bg-background p-4 hover:border-primary/40"
        >
          <Download className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">Import a recipe</span>
          <span className="text-xs text-muted-foreground">Paste a URL or free text and we&apos;ll parse it.</span>
        </Link>

        <Link
          href="/pantry"
          className="flex flex-col gap-1.5 rounded-xl border border-border bg-background p-4 hover:border-primary/40"
        >
          <ClipboardList className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">Add your pantry</span>
          <span className="text-xs text-muted-foreground">Tell the keeper what you have on hand.</span>
        </Link>

        <button
          type="button"
          onClick={onAskChef}
          className="flex flex-col gap-1.5 rounded-xl border border-border bg-background p-4 text-left hover:border-primary/40"
        >
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">Ask the chef</span>
          <span className="text-xs text-muted-foreground">Just say what you want to cook this week.</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={onSeed}
          disabled={seeding}
          className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          {seeding ? 'Adding starter recipes…' : 'Add a few starter recipes'}
        </button>
        <span className="text-xs text-muted-foreground">
          Seeds 4 simple recipes so you can plan a week right away.
        </span>
      </div>
    </div>
  );
}

export default OnboardingCard;
