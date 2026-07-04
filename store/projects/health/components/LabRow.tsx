import React from 'react';
import type { LabResult } from '@app/types';
import { Link } from '@app/runtime';
import { FlagBadge } from './FlagBadge';

export function LabRow({ lab }: { lab: LabResult }) {
  const hasLow = lab.refLow != null;
  const hasHigh = lab.refHigh != null;
  const range =
    hasLow || hasHigh ? `ref ${hasLow ? lab.refLow : '—'}–${hasHigh ? lab.refHigh : '—'}` : null;

  return (
    <Link
      href={`/labs/${lab.id}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">
          {lab.panel} · {lab.analyte}
        </p>
        <p className="text-sm text-muted-foreground">
          {lab.value} {lab.unit}
          {range ? ` (${range})` : ''}
        </p>
      </div>
      <FlagBadge flag={lab.flag} />
    </Link>
  );
}
