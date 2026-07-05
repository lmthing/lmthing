import React from 'react';

export function UrgencyBadge({ urgency }: { urgency: string }) {
  const classes =
    urgency === 'emergency'
      ? 'bg-destructive text-destructive-foreground'
      : urgency === 'urgent'
        ? 'bg-warning text-warning-foreground'
        : urgency === 'self_care'
          ? 'bg-success text-success-foreground'
          : 'bg-muted text-muted-foreground';

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${classes}`}>
      {urgency.replace('_', ' ')}
    </span>
  );
}

export default UrgencyBadge;
