import React from 'react';

export interface Stats {
  metrics: number;
  labs: number;
  flagged: number;
  activeSymptoms: number;
  research: number;
}

function Tile({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  const active = alert && value > 0;
  return (
    <div
      className={`flex min-w-[7rem] flex-1 flex-col items-center rounded-lg border px-4 py-3 ${
        active ? 'border-destructive/40 bg-destructive/10' : 'border-border bg-card'
      }`}
    >
      <span className={`text-2xl font-bold ${active ? 'text-destructive' : 'text-foreground'}`}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function HealthStats({ stats }: { stats: Stats }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Tile label="Measurements" value={stats.metrics ?? 0} />
      <Tile label="Lab results" value={stats.labs ?? 0} />
      <Tile label="Flagged" value={stats.flagged ?? 0} alert />
      <Tile label="Active symptoms" value={stats.activeSymptoms ?? 0} alert />
      <Tile label="Research" value={stats.research ?? 0} />
    </div>
  );
}
