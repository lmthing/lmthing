import React from 'react';
import { RefreshIcon } from './icons';

// A recoverable error box: the destructive-toned message + a Retry button wired
// to a caller-supplied refetch (typically `useApi().refetch`). Errors should be
// recoverable, not final.

export function ErrorState({
  message = 'Something went wrong.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
      <span>{message}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-destructive px-3 py-1.5 text-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          <RefreshIcon className="h-4 w-4" />
          Retry
        </button>
      ) : null}
    </div>
  );
}
