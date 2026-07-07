import React from 'react';
import type { Commute } from '@app/types';
import { MODE_GLYPH } from './format';

interface CommuteTargetLite {
  label: string;
  maxMinutes: number;
}

export function CommuteChips({
  commutes,
  targets,
}: {
  commutes: Commute[];
  targets?: CommuteTargetLite[];
}) {
  if (!commutes || commutes.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {commutes.map((c) => {
        const target = targets?.find((t) => t.label === c.targetLabel);
        const overMax = !!target && c.minutes > target.maxMinutes;
        return (
          <span
            key={c.id}
            title={c.basis}
            className={
              overMax
                ? 'rounded-full border border-destructive px-2 py-0.5 text-xs text-destructive'
                : 'rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground'
            }
          >
            {MODE_GLYPH[c.mode] ?? ''} {c.targetLabel} {Math.round(c.minutes)} min
            {overMax ? ` (max ${target!.maxMinutes})` : ''}
          </span>
        );
      })}
    </div>
  );
}
