import React from 'react';

/**
 * A triangulated location guess — shown on the listing detail page next to (never instead of)
 * the claimed pin. Always frames itself as an advisory guess with a radius and a confidence, and
 * always shows its citations (`method`) so the user can judge how much to trust it.
 */
export function LocationGuessCard({
  radiusM,
  confidence,
  method,
}: {
  radiusM: number;
  confidence: number;
  method: string;
}) {
  const confidenceLabel = confidence >= 0.7 ? 'High confidence' : confidence >= 0.4 ? 'Moderate confidence' : 'Low confidence';

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">Estimated location</span>
        <span className="text-xs text-muted-foreground">{confidenceLabel}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Within ~{radiusM >= 1000 ? `${(radiusM / 1000).toFixed(1)} km` : `${radiusM} m`} of the marked point —
        this is a triangulated guess, not the confirmed address.
      </p>
      <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
        <div
          className="h-1.5 rounded-full bg-primary"
          style={{ width: `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%` }}
        />
      </div>
      <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{method}</p>
    </div>
  );
}

export default LocationGuessCard;
