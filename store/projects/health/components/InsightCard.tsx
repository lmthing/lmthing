import React from 'react';
import type { Insight } from '@app/types';
import { MarkdownBody } from './MarkdownBody';
import { fmtDate } from './format';

function kindClasses(kind: string) {
  if (kind === 'trend') return 'bg-accent text-accent-foreground';
  if (kind === 'correlation') return 'bg-primary text-primary-foreground';
  if (kind === 'anomaly') return 'bg-warning text-warning-foreground';
  return 'bg-muted text-muted-foreground';
}

export function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${kindClasses(insight.kind)}`}>
          {insight.kind}
        </span>
        {insight.metricKind ? (
          <span className="text-xs uppercase text-muted-foreground">{insight.metricKind}</span>
        ) : null}
      </div>
      <div className="text-sm">
        <MarkdownBody markdown={insight.body ?? ''} />
      </div>
      <p className="text-xs text-muted-foreground">{fmtDate(insight.createdAt)}</p>
    </div>
  );
}

export default InsightCard;
