import React from 'react';
import type { Metric } from '@app/types';

const KIND_LABELS: Record<string, string> = {
  weight: 'Weight',
  resting_hr: 'Resting heart rate',
  sleep_hours: 'Sleep',
  bp_systolic: 'Blood pressure (systolic)',
  steps: 'Steps',
};

export function MetricChart({ kind, points }: { kind: string; points: Metric[] }) {
  const label = KIND_LABELS[kind] ?? kind;

  if (!points || points.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-bold text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">No measurements yet.</p>
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const width = 300;
  const height = 80;
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = points.length > 1 ? i * stepX : width / 2;
    const y = height - ((p.value - min) / range) * height;
    return `${x},${y}`;
  });

  const latest = points[points.length - 1];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm font-bold text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">
          {latest.value} {latest.unit}
        </p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full text-primary">
        <polyline points={coords.join(' ')} fill="none" stroke="currentColor" strokeWidth={2} />
      </svg>
    </div>
  );
}
