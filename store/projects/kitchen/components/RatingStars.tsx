import React from 'react';
import { StarIcon } from './icons';

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
          <StarIcon
            filled={n <= current}
            className={n <= current ? 'h-3.5 w-3.5 text-primary' : 'h-3.5 w-3.5 text-muted-foreground'}
          />
        </button>
      ))}
    </div>
  );
}

export default RatingStars;
