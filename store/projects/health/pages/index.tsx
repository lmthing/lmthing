import React, { useState } from 'react';
import type { Metric } from '@app/types';
import { useApi, useApiMutation } from '@app/runtime';
import { HealthStats, type Stats } from '../components/HealthStats';
import { MetricChart } from '../components/MetricChart';
import { Spinner } from '../components/Spinner';

const TRACKED_KINDS = ['weight', 'resting_hr', 'sleep_hours'];

function MetricSection({ kind }: { kind: string }) {
  const { data, isLoading } = useApi<Metric[]>('listMetrics', { kind });

  if (isLoading) return <Spinner />;

  return <MetricChart kind={kind} points={data ?? []} />;
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useApi<Stats>('healthStats', {});

  const logMetric = useApiMutation<Metric>('logMetric', {
    invalidates: ['healthStats'],
  });

  const [kind, setKind] = useState('weight');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('kg');

  const onLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || !unit.trim()) return;
    try {
      await logMetric.mutate({
        kind,
        value: Number(value),
        unit: unit.trim(),
      });
      setValue('');
    } catch {
      // surfaced via logMetric.error below
    }
  };

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Dashboard</h1>

      {statsLoading ? <Spinner /> : null}
      {stats ? <HealthStats stats={stats} /> : null}

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Trends</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRACKED_KINDS.map((k) => (
            <MetricSection key={k} kind={k} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Log a measurement</h2>
        <form onSubmit={onLog} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex gap-3">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="weight">Weight</option>
              <option value="resting_hr">Resting heart rate</option>
              <option value="sleep_hours">Sleep hours</option>
              <option value="bp_systolic">Blood pressure (systolic)</option>
              <option value="steps">Steps</option>
            </select>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Value"
              type="number"
              className="w-32 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Unit"
              className="w-24 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={logMetric.isPending || !value.trim() || !unit.trim()}
            className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {logMetric.isPending ? 'Logging…' : 'Log measurement'}
          </button>
          {logMetric.error ? (
            <p className="text-sm text-destructive">
              {(logMetric.error as { message?: string })?.message ?? 'Failed to log measurement.'}
            </p>
          ) : null}
        </form>
      </section>
    </main>
  );
}
