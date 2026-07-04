import React from 'react';

export interface Stats {
  metrics: number;
  labs: number;
  flagged: number;
  activeSymptoms: number;
  research: number;
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-lg border border-border bg-card px-4 py-3">
      <span className="text-2xl font-bold text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function HealthStats({ stats }: { stats: Stats }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Tile label="Measurements" value={stats.metrics ?? 0} />
      <Tile label="Lab results" value={stats.labs ?? 0} />
      <Tile label="Flagged" value={stats.flagged ?? 0} />
      <Tile label="Active symptoms" value={stats.activeSymptoms ?? 0} />
      <Tile label="Research" value={stats.research ?? 0} />
    </div>
  );
}
