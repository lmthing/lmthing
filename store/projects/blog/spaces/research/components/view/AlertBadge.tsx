import React from 'react';

/**
 * A small inline badge for a subscription alert — shown in chat while the librarian is discussing
 * a match it just raised. Unread alerts read as a "new" pill; read alerts fade to a quiet outline.
 */
export function AlertBadge({ alert }: { alert: { title: string; read?: boolean } }) {
  const { title, read } = alert;

  return (
    <span
      className={
        read
          ? 'inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground'
          : 'inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground'
      }
    >
      {!read ? <span className="font-medium">new</span> : null}
      <span>{title}</span>
    </span>
  );
}

export default AlertBadge;
