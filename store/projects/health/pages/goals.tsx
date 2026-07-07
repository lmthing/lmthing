import React, { useState } from 'react';
import type { Goal } from '@app/types';
import { useApi, useApiMutation, Chat } from '@app/runtime';
import { GoalCard } from '../components/GoalCard';
import { SkeletonList, EmptyState, ErrorNote } from '../components/states';

export default function Goals() {
  const { data: goals, isLoading, error, refetch } = useApi<Goal[]>('listGoals', {});

  const createGoal = useApiMutation<Goal>('createGoal', {
    invalidates: ['listGoals'],
  });

  const [title, setTitle] = useState('');
  const [metricKind, setMetricKind] = useState('');
  const [target, setTarget] = useState('');

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await createGoal.mutate({
        title: title.trim(),
        metricKind: metricKind.trim() || undefined,
        target: target.trim() ? Number(target) : undefined,
      });
      setTitle('');
      setMetricKind('');
      setTarget('');
    } catch {
      // surfaced via createGoal.error below
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Goals</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">New goal</h2>
        <form onSubmit={onCreate} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Goal (e.g. Lower resting heart rate)"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
          <div className="flex gap-3">
            <input
              value={metricKind}
              onChange={(e) => setMetricKind(e.target.value)}
              placeholder="Metric kind (optional)"
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              type="number"
              placeholder="Target (optional)"
              className="w-40 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={createGoal.isPending || !title.trim()}
            className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {createGoal.isPending ? 'Creating…' : 'Create goal'}
          </button>
          {createGoal.error ? (
            <ErrorNote
              message={(createGoal.error as { message?: string })?.message ?? 'Failed to create goal.'}
            />
          ) : null}
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Your goals</h2>

        {isLoading ? <SkeletonList rows={2} /> : null}

        {error ? <ErrorNote message="Failed to load goals." onRetry={refetch} /> : null}

        {!isLoading && !error && (goals ?? []).length === 0 ? (
          <EmptyState
            title="No goals yet"
            hint="Set a measurable goal above — like lowering your resting heart rate — and the coach can help you track progress."
          />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {(goals ?? []).map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
        </div>
      </section>

      <section className="space-y-3 border-t border-border pt-4">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Ask the coach</h2>
        <Chat agent="coaching/coach" />
      </section>
    </main>
  );
}
