import React from 'react';
import { Link } from '@app/runtime';
import { Icon, type IconName } from './icons';

/**
 * An actionable empty state — never a dead end. Shows an icon, a headline, a
 * one-line explanation, and (optionally) a primary CTA that either links
 * somewhere useful or fires an inline action. Design tokens only.
 */
export function EmptyState({
  icon,
  title,
  message,
  ctaLabel,
  ctaHref,
  onCta,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCta?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
      {icon ? (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon name={icon} className="h-5 w-5" />
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="font-semibold text-foreground">{title}</p>
        {message ? <p className="mx-auto max-w-sm text-sm text-muted-foreground">{message}</p> : null}
      </div>
      {ctaLabel && ctaHref ? (
        <Link
          href={ctaHref}
          className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {ctaLabel}
        </Link>
      ) : ctaLabel && onCta ? (
        <button
          type="button"
          onClick={onCta}
          className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {ctaLabel}
        </button>
      ) : null}
    </div>
  );
}

/** An actionable error box with an optional Retry. Token-correct destructive styling. */
export function ErrorState({
  message = 'Something went wrong.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive p-4 text-sm text-destructive">
      <span>{message}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-md border border-destructive px-3 py-1 text-xs font-medium hover:bg-destructive hover:text-destructive-foreground"
        >
          <Icon name="refresh" className="h-3.5 w-3.5" /> Retry
        </button>
      ) : null}
    </div>
  );
}
