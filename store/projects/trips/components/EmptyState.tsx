import React from 'react';
import { Link } from '@app/runtime';

// A standard empty state: icon + headline + one-line hint + an optional primary
// action, so every empty list offers a next step instead of a dead end.

type IconType = ({ className }: { className?: string }) => React.ReactElement;

export function EmptyState({
  icon: Icon,
  title,
  hint,
  actionLabel,
  actionHref,
  onAction,
}: {
  icon?: IconType;
  title: string;
  hint?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-8 text-center">
      {Icon ? (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="font-medium text-foreground">{title}</p>
        {hint ? <p className="mx-auto max-w-sm text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:opacity-90"
        >
          {actionLabel}
        </Link>
      ) : actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:opacity-90"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
