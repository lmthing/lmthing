import React from 'react';

const URGENCY_CLASS: Record<string, string> = {
  self_care: 'text-success',
  routine: 'text-muted-foreground',
  urgent: 'text-warning',
  emergency: 'text-destructive',
};

/**
 * A compact card showing the triage-nurse's urgency read and a short observation snippet — shown
 * in chat alongside a `triage_assessments` row. Always an observation, never a diagnosis; the full
 * body (including the mandatory "seek care now" escalation line) lives in the assessment's
 * markdown, not here.
 */
export function TriageObservation({
  question,
  urgency,
  snippet,
}: {
  question: string;
  urgency: string;
  snippet: string;
}) {
  const urgencyClass = URGENCY_CLASS[urgency] ?? 'text-muted-foreground';

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">{question}</h3>
        <span className={`text-xs font-bold uppercase ${urgencyClass}`}>{urgency.replace(/_/g, ' ')}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{snippet}</p>
    </div>
  );
}

export default TriageObservation;
