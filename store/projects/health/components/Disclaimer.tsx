import React from 'react';

export function Disclaimer() {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
      <span className="font-bold text-warning">Not medical advice.</span> This app is an
      informational research aid over your own data — it does not diagnose or treat. Always
      consult a qualified clinician.
    </div>
  );
}
