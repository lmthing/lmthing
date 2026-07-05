import React from 'react';
import type { Deal } from '@app/types';
import { useApiMutation } from '@app/runtime';
import { MarkdownBody } from './MarkdownBody';

const STATUSES = ['active', 'taken', 'expired'];

export function DealCard({ deal }: { deal: Deal }) {
  const updateDeal = useApiMutation<Deal>('updateDeal', {
    invalidates: ['listDeals'],
  });

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-foreground">{deal.title}</p>
          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
            {deal.kind}
          </span>
        </div>
        <span className="shrink-0 font-medium text-foreground">
          save {deal.estimatedSavings.toFixed(2)} {deal.currency}
        </span>
      </div>

      {deal.description ? <MarkdownBody source={deal.description} /> : null}

      <div className="flex items-center justify-between gap-4">
        {deal.url ? (
          <a
            href={deal.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary hover:underline"
          >
            View deal
          </a>
        ) : (
          <span />
        )}
        <select
          value={deal.status}
          onChange={(e) => updateDeal.mutate({ id: deal.id, status: e.target.value })}
          disabled={updateDeal.isPending}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground disabled:opacity-50"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
