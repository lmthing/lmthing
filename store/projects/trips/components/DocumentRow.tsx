import React from 'react';
import type { Document } from '@app/types';
import { Link } from '@app/runtime';

function statusClass(status: string): string {
  if (status === 'analyzed') return 'text-primary';
  if (status === 'error') return 'text-destructive';
  return 'text-muted-foreground';
}

export function DocumentRow({ document }: { document: Document }) {
  return (
    <Link
      href={`/documents/${document.id}`}
      className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3 hover:bg-muted transition-colors"
    >
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium text-foreground">{document.filename ?? document.kind}</p>
        <p className="text-sm text-muted-foreground">{document.kind}</p>
      </div>
      <span className={`shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-xs ${statusClass(document.status)}`}>
        {document.status}
      </span>
    </Link>
  );
}
