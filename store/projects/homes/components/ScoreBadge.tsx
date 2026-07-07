import React from 'react';

// The AI-signature element: a conic-gradient ring in the agent accent, filled
// proportionally to the match score. Muted + "scoring…" while score === 0
// (not yet ranked by the ranker).

export function ScoreBadge({
  score,
  size = 'md',
}: {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const value = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
  const scoring = !score || score <= 0;

  const dims = size === 'lg' ? 'h-20 w-20' : size === 'sm' ? 'h-11 w-11' : 'h-16 w-16';
  const numberSize = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-sm' : 'text-lg';

  return (
    <div
      className={`relative shrink-0 rounded-full ${dims}`}
      style={{
        background: scoring
          ? 'var(--muted)'
          : `conic-gradient(var(--agent) ${value * 3.6}deg, var(--muted) 0deg)`,
      }}
      title={scoring ? 'Not yet scored' : `Match score ${value} / 100`}
    >
      <div className="absolute inset-[3px] flex flex-col items-center justify-center rounded-full bg-card text-center">
        {scoring ? (
          <span className="px-1 text-[0.6rem] leading-tight text-muted-foreground">
            {size === 'sm' ? '…' : 'scoring…'}
          </span>
        ) : (
          <>
            <span className={`font-bold leading-none text-agent ${numberSize}`}>{value}</span>
            {size !== 'sm' ? (
              <span className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">match</span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
