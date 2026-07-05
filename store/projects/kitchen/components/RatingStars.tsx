import React from 'react';
import { Star } from 'lucide-react';

export function RatingStars({
  value,
  onRate,
}: {
  value: number | null;
  onRate?: (n: number) => void;
}) {
  const current = value ?? 0;

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onRate}
          onClick={() => onRate?.(n)}
          className={onRate ? 'cursor-pointer' : 'cursor-default'}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
        >
          <Star
            className={n <= current ? 'h-4 w-4 fill-current text-primary' : 'h-4 w-4 text-muted-foreground'}
          />
        </button>
      ))}
    </div>
  );
}

export default RatingStars;
