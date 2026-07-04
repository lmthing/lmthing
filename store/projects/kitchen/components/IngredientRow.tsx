import React from 'react';

export function IngredientRow({
  qty,
  unit,
  name,
  children,
}: {
  qty?: number;
  unit?: string;
  name: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <span className="font-medium text-foreground">{name}</span>
        {qty != null ? (
          <span className="ml-2 text-sm text-muted-foreground">
            {qty}
            {unit ? ` ${unit}` : ''}
          </span>
        ) : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}
