import React, { useState } from 'react';
import { Chat } from '@app/runtime';
import { SparkleIcon } from './icons';

/**
 * Inline "Explain plainly" affordance for any clinical artifact (a flagged lab, an
 * interaction finding, a research report, a triage note). One tap reveals the owning
 * specialist's <Chat> dock and a suggested plain-language question, so the user gets a
 * lay summary of their own data without hunting for which of five agents to ask.
 *
 * (The <Chat> widget doesn't accept a seed message, so we surface the exact question to
 * ask; the specialist grounds its answer in the record it can read.)
 */
export function ExplainPlainly({
  agent,
  suggestion,
  label = 'Explain plainly',
}: {
  agent: string;
  suggestion: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full border border-agent/40 bg-agent/5 px-3 py-1 text-xs font-medium text-agent hover:bg-agent/10"
      >
        <SparkleIcon className="h-3.5 w-3.5" />
        {open ? 'Hide explanation' : label}
      </button>

      {open ? (
        <div className="space-y-2 rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">
            Ask in plain language — for example: <span className="italic text-foreground">“{suggestion}”</span>
          </p>
          <Chat agent={agent} />
        </div>
      ) : null}
    </div>
  );
}

export default ExplainPlainly;
