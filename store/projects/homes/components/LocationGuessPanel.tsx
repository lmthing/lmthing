import React from 'react';
import type { LocationGuess } from '@app/types';
import { MarkdownBody } from './MarkdownBody';
import { MapPinIcon, ExternalLinkIcon } from './icons';

export function LocationGuessPanel({ guess }: { guess: LocationGuess }) {
  const confidencePct = Math.round(Math.max(0, Math.min(1, guess.confidence ?? 0)) * 100);
  const low = confidencePct < 40;
  const osmUrl = `https://www.openstreetmap.org/?mlat=${guess.lat}&mlon=${guess.lng}#map=17/${guess.lat}/${guess.lng}`;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <MapPinIcon className="h-4 w-4 text-agent" />
        <h3 className="font-semibold text-foreground">Probably here</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        ±{Math.round(guess.radiusM)} m ·{' '}
        <span className={low ? 'font-medium text-destructive' : 'font-medium text-agent'}>
          {confidencePct}% confidence
        </span>
        {low ? ' — treat this as a rough area, not a pin' : ''}
      </p>

      <MarkdownBody source={guess.method ?? ''} />

      <a
        href={osmUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        View on OpenStreetMap
        <ExternalLinkIcon className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
