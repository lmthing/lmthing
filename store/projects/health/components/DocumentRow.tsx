import React from 'react';
import type { Document } from '@app/types';
import { Link } from '@app/runtime';

function statusClasses(status: string) {
  if (status === 'analyzed') return 'bg-success text-success-foreground';
  if (status === 'error') return 'bg-destructive text-destructive-foreground';
  return 'bg-warning text-warning-foreground';
}

function kindLabel(kind: string) {
  return kind.replace(/_/g, ' ');
}

export function DocumentRow({ document }: { document: Document }) {
  return (
    <Link
      href={`/documents/${document.id}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-foreground">{document.filename}</span>
          <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs uppercase text-muted-foreground">
            {kindLabel(document.kind)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">Uploaded {document.uploadedAt}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold uppercase ${statusClasses(document.status)}`}
      >
        {document.status}
      </span>
    </Link>
  );
}

export default DocumentRow;
