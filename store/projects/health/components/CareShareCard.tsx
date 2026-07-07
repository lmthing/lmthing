import React from 'react';
import type { CareShare } from '@app/types';
import { Link } from '@app/runtime';
import { fmtDate } from './format';

function statusClasses(status: string) {
  if (status === 'ready') return 'bg-success text-success-foreground';
  return 'bg-secondary text-secondary-foreground';
}

export function CareShareCard({ share }: { share: CareShare }) {
  return (
    <Link
      href={`/shares/${share.id}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{share.title}</p>
        <p className="text-sm text-muted-foreground">
          {share.scope} · {fmtDate(share.createdAt)}
        </p>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold uppercase ${statusClasses(share.status)}`}>
        {share.status}
      </span>
    </Link>
  );
}

export default CareShareCard;
