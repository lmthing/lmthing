import React from 'react';

export function FlagBadge({ flag }: { flag: string }) {
  const classes =
    flag === 'normal'
      ? 'bg-success text-success-foreground'
      : flag === 'low'
        ? 'bg-warning text-warning-foreground'
        : flag === 'high'
          ? 'bg-destructive text-destructive-foreground'
          : 'bg-muted text-muted-foreground';

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${classes}`}>
      {flag}
    </span>
  );
}
