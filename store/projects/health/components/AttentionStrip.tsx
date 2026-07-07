import React from 'react';
import { Link } from '@app/runtime';
import { EmptyState } from './states';
import {
  FlaskIcon,
  PillIcon,
  CalendarIcon,
  BellIcon,
  AlertIcon,
  ArrowRightIcon,
} from './icons';

interface AttentionItem {
  kind: 'lab' | 'followup' | 'dose' | 'appointment' | 'triage';
  severity: 'emergency' | 'urgent' | 'routine';
  title: string;
  detail: string;
  href: string;
  count?: number;
}

const ICON: Record<AttentionItem['kind'], (p: { className?: string }) => React.ReactElement> = {
  lab: FlaskIcon,
  followup: BellIcon,
  dose: PillIcon,
  appointment: CalendarIcon,
  triage: AlertIcon,
};

function toneClasses(severity: AttentionItem['severity']): string {
  if (severity === 'emergency') return 'border-destructive/50 bg-destructive/10 text-destructive';
  if (severity === 'urgent') return 'border-warning/50 bg-warning/10 text-warning';
  return 'border-border bg-card text-foreground';
}

/** Horizontally-scrollable strip of action cards synthesised by getAttention. */
export function AttentionStrip({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        tone="clear"
        title="All clear — nothing needs your attention today"
        hint="No flagged labs, due doses, or upcoming appointments right now."
      />
    );
  }

  return (
    <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
      {items.map((item, i) => {
        const Icon = ICON[item.kind];
        return (
          <Link
            key={`${item.kind}-${i}`}
            href={item.href}
            className={`group flex min-w-[15rem] max-w-xs snap-start flex-col justify-between gap-3 rounded-lg border p-4 transition-colors hover:opacity-90 ${toneClasses(
              item.severity,
            )}`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className={item.severity === 'routine' ? 'text-muted-foreground' : ''}>
                <Icon className="h-5 w-5" />
              </span>
              {item.severity !== 'routine' ? (
                <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-bold uppercase">
                  {item.severity}
                </span>
              ) : null}
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{item.title}</p>
              {item.detail ? (
                <p className={`truncate text-xs ${item.severity === 'routine' ? 'text-muted-foreground' : 'opacity-80'}`}>
                  {item.detail}
                </p>
              ) : null}
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium opacity-70 group-hover:opacity-100">
              View <ArrowRightIcon className="h-3.5 w-3.5" />
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export default AttentionStrip;
