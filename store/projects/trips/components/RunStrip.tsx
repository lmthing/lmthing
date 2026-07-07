import React, { useEffect } from 'react';
import { useApi } from '@app/runtime';
import { SparklesIcon, CheckIcon, AlertTriangleIcon } from './icons';

// Live agent-progress pills. Polls `getTripActivity` (which reconciles stale
// "running" rows to "done") and renders each recent run as a pill. Running runs
// get a gentle pulse; done/error get a resolved icon. This turns the five
// background specialist agents from an invisible backend into a visible feature.

interface AgentRun {
  id: string;
  kind: string;
  label: string;
  status: 'running' | 'done' | 'error';
  detail?: string;
}

interface Activity {
  runs: AgentRun[];
  runningCount: number;
}

export function RunStrip({ tripId }: { tripId: string }) {
  const { data, refetch } = useApi<Activity>('getTripActivity', { id: tripId }, {});
  const runningCount = data?.runningCount ?? 0;

  // Poll: fast (4s) while work is in flight, slow (15s) otherwise so newly
  // kicked-off runs (e.g. from the copilot) still appear promptly.
  useEffect(() => {
    const period = runningCount > 0 ? 4000 : 15000;
    const t = setInterval(() => refetch(), period);
    return () => clearInterval(t);
  }, [refetch, runningCount]);

  const runs = data?.runs ?? [];
  // Show anything running, plus the few most-recent resolved runs for context.
  const running = runs.filter((r) => r.status === 'running');
  const recent = runs.filter((r) => r.status !== 'running').slice(0, 3);
  const shown = [...running, ...recent];

  if (shown.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-live="polite">
      {shown.map((run) => {
        const isRunning = run.status === 'running';
        const isError = run.status === 'error';
        return (
          <span
            key={run.id}
            title={run.detail || run.label}
            className={
              'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ' +
              (isError
                ? 'border-destructive text-destructive'
                : isRunning
                  ? 'border-border bg-muted text-foreground'
                  : 'border-border bg-card text-muted-foreground')
            }
          >
            {isError ? (
              <AlertTriangleIcon className="h-3.5 w-3.5" />
            ) : isRunning ? (
              <SparklesIcon className="h-3.5 w-3.5 animate-pulse text-agent" />
            ) : (
              <CheckIcon className="h-3.5 w-3.5 text-success" />
            )}
            {run.label}
            {isRunning ? <span className="animate-pulse">…</span> : null}
          </span>
        );
      })}
    </div>
  );
}
