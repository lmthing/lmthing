import React from 'react';

export function SeverityBadge({ severity }: { severity: string }) {
  const classes =
    severity === 'severe'
      ? 'bg-destructive text-destructive-foreground'
      : severity === 'moderate'
        ? 'bg-warning text-warning-foreground'
        : 'bg-muted text-muted-foreground';

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${classes}`}>
      {severity}
    </span>
  );
}

export default SeverityBadge;
