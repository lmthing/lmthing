import React, { useState } from 'react';
import { apiCall, useApiMutation } from '@app/runtime';
import { Sparkles, Clock, Check, Flame } from './icons';

interface Candidate {
  recipeId: string;
  title: string;
  prepMinutes: number;
  imageUrl?: string;
  coverage: number;
  rating: number | null;
  usesExpiring: boolean;
  reason: string;
}

/**
 * "Cook from what I have" — an on-demand, streaming-feeling request that ranks the recipe box by
 * what tonight can actually be cooked from the pantry (coverage + expiry urgency + taste history).
 * Candidates reveal one at a time; "Add to tonight" writes a plan_meals row via addMeal (which
 * fans out to the nutrition + shopping recompute hooks automatically).
 */
export function ImprovisePanel({ planId }: { planId: string | null | undefined }) {
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [shown, setShown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<string, boolean>>({});

  const addMeal = useApiMutation<{ id: string }>('addMeal', {
    invalidates: ['currentPlan', 'kitchenStats', 'planCoverage'],
  });

  const run = async () => {
    setLoading(true);
    setError(null);
    setCandidates([]);
    setShown(0);
    try {
      const res = (await apiCall('improviseTonight', { limit: 3 })) as { candidates: Candidate[] };
      const list = res?.candidates ?? [];
      setCandidates(list);
      // Reveal one at a time so a multi-second think feels alive.
      list.forEach((_, i) => setTimeout(() => setShown((n) => Math.max(n, i + 1)), i * 350));
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Could not improvise right now.');
    } finally {
      setLoading(false);
    }
  };

  const addToTonight = async (c: Candidate) => {
    if (!planId) return;
    try {
      await addMeal.mutate({
        planId,
        recipeId: c.recipeId,
        meal: 'dinner',
        rationale: `Improvised: ${c.reason}`,
      });
      setAdded((m) => ({ ...m, [c.recipeId]: true }));
    } catch {
      // surfaced by addMeal.error below
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-foreground">Cook from what I have</h2>
            <p className="text-xs text-muted-foreground">Ranked by your pantry, expiring items, and past ratings.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          {loading ? 'Thinking…' : 'What can I cook tonight?'}
        </button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {candidates.length > 0 ? (
        <div className="space-y-2">
          {candidates.slice(0, shown).map((c) => (
            <div
              key={c.recipeId}
              className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
            >
              {c.imageUrl ? (
                <img src={c.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
                  <Flame className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{c.title}</p>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {c.prepMinutes} min
                  </span>
                  <span>· {c.reason}</span>
                  {c.rating != null ? <span>· {c.rating}★ avg</span> : null}
                </p>
              </div>
              {added[c.recipeId] ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                  <Check className="h-3.5 w-3.5" /> Added
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => addToTonight(c)}
                  disabled={!planId || addMeal.isPending}
                  className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-50"
                >
                  Add to tonight
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {!planId && candidates.length > 0 ? (
        <p className="text-xs text-muted-foreground">Plan a week first to add these to a day.</p>
      ) : null}
      {addMeal.error ? (
        <p className="text-sm text-destructive">
          {(addMeal.error as { message?: string })?.message ?? 'Could not add the meal.'}
        </p>
      ) : null}
    </section>
  );
}

export default ImprovisePanel;
