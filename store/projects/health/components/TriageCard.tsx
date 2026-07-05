import React from 'react';
import type { TriageAssessment } from '@app/types';
import { Link } from '@app/runtime';
import { UrgencyBadge } from './UrgencyBadge';

export function TriageCard({ assessment }: { assessment: TriageAssessment }) {
  return (
    <Link
      href={`/triage/${assessment.id}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{assessment.question}</p>
        <p className="text-sm text-muted-foreground">{assessment.status}</p>
      </div>
      <UrgencyBadge urgency={assessment.urgency} />
    </Link>
  );
}

export default TriageCard;
