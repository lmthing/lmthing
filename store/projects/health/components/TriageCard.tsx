import React from 'react';
import type { TriageAssessment } from '@app/types';
import { Link } from '@app/runtime';
import { UrgencyBadge } from './UrgencyBadge';

// Color the whole card by urgency so a serious result is unmissable (semantic
// tokens only — never a raw color). Routine/self-care stay calm.
function toneClasses(urgency: string): string {
  if (urgency === 'emergency') return 'border-destructive/50 bg-destructive/10 hover:bg-destructive/15';
  if (urgency === 'urgent') return 'border-warning/50 bg-warning/10 hover:bg-warning/15';
  return 'border-border bg-card hover:bg-muted';
}

export function TriageCard({ assessment }: { assessment: TriageAssessment }) {
  return (
    <Link
      href={`/triage/${assessment.id}`}
      className={`flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors ${toneClasses(
        assessment.urgency,
      )}`}
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
