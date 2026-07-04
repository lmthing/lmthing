import React from 'react';

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 p-6 text-muted-foreground">
      <span className="inline-block h-3 w-3 rounded-full bg-muted-foreground animate-pulse" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
