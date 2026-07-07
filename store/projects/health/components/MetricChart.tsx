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
  const pad = 6; // keep the stroke and endpoint dot inside the viewBox
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;

  const pts = points.map((p, i) => {
    const x = points.length > 1 ? i * stepX : width / 2;
    const y = pad + (height - 2 * pad) * (1 - (p.value - min) / range);
    return { x, y };
  });
  const line = pts.map((c) => `${c.x},${c.y}`).join(' ');
  const area = `${pts[0].x},${height} ${line} ${pts[pts.length - 1].x},${height}`;

  const latest = points[points.length - 1];
  const first = points[0];
  const delta = latest.value - first.value;
  const last = pts[pts.length - 1];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm font-bold text-foreground">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-sm font-medium text-foreground">
            {latest.value} {latest.unit}
          </p>
          {points.length > 1 && delta !== 0 ? (
            <span className="text-xs text-muted-foreground">
              {delta > 0 ? '▲' : '▼'} {Math.abs(Number(delta.toFixed(2)))}
            </span>
          ) : null}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-16 w-full text-primary"
      >
        <polygon points={area} fill="currentColor" fillOpacity={0.1} stroke="none" />
        <polyline
          points={line}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={last.x} cy={last.y} r={3} fill="currentColor" />
      </svg>
    </div>
  );
}
