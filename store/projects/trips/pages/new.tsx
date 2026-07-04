import React, { useState } from 'react';
import { useApiMutation, navigate } from '@app/runtime';

export default function NewTrip() {
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budgetUsd, setBudgetUsd] = useState('');

  const createTrip = useApiMutation<{ tripId: string; status: string }>('createTrip', {
    invalidates: ['tripList'],
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !brief.trim()) return;
    try {
      const res = await createTrip.mutate({
        title: title.trim(),
        brief: brief.trim(),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        budgetUsd: budgetUsd ? Number(budgetUsd) : undefined,
      });
      navigate(`/trips/${res.tripId}/plan`);
    } catch {
      // surfaced via createTrip.error below
    }
  };

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">Plan a new trip</h1>

      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Portugal, October"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="brief">
            Describe your trip
          </label>
          <textarea
            id="brief"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            required
            rows={4}
            placeholder="5 days in Portugal, mid-October, mid-budget, we like food and walking"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="startDate">
              Start date
            </label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="endDate">
              End date
            </label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="budgetUsd">
            Budget (USD, optional)
          </label>
          <input
            id="budgetUsd"
            type="number"
            min="0"
            value={budgetUsd}
            onChange={(e) => setBudgetUsd(e.target.value)}
            placeholder="2000"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
        </div>

        {createTrip.error ? (
          <p className="text-sm text-destructive">
            {(createTrip.error as { message?: string })?.message ?? 'Failed to create trip.'}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={createTrip.isPending || !title.trim() || !brief.trim()}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          {createTrip.isPending ? 'Starting the concierge…' : 'Start planning'}
        </button>
      </form>
    </main>
  );
}
