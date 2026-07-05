import React from 'react';
import type { Interaction } from '@app/types';
import { SeverityBadge } from './SeverityBadge';
import { MarkdownBody } from './MarkdownBody';
import { Spinner } from './Spinner';

export function InteractionCard({ interaction }: { interaction: Interaction }) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium text-foreground">{interaction.otherName}</h3>
        <SeverityBadge severity={interaction.severity} />
      </div>

      {interaction.status === 'pending' ? (
        <Spinner label="Researching interaction…" />
      ) : (
        <MarkdownBody markdown={interaction.body ?? ''} />
      )}
    </div>
  );
}

export default InteractionCard;
