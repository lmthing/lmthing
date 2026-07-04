import React from 'react';

export interface ShoppingRowItem {
  id: string | null;
  ingredient: string;
  unit: string;
  quantity: number;
  bought: boolean;
}

export function ShoppingRow({
  item,
  onToggle,
  pending,
}: {
  item: ShoppingRowItem;
  onToggle: (bought: boolean) => void;
  pending?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <input
        type="checkbox"
        checked={item.bought}
        disabled={pending}
        onChange={(e) => onToggle(e.target.checked)}
        className="h-4 w-4 rounded border-border"
      />
      <div
        className={
          item.bought
            ? 'min-w-0 flex-1 text-muted-foreground line-through'
            : 'min-w-0 flex-1 text-foreground'
        }
      >
        <span className="font-medium">{item.ingredient}</span>
        <span className="ml-2 text-sm text-muted-foreground">
          {item.quantity} {item.unit}
        </span>
      </div>
    </div>
  );
}
