export interface CostLine {
  ingredient: string;
  unit: string;
  quantity: number;
  /** per-unit price from `ingredients.costPerUnit`; 0/undefined = unknown. */
  costPerUnit?: number;
}

export interface CostedLine extends CostLine {
  estCost: number;
  costKnown: boolean;
}

export interface TripCostEstimate {
  lines: CostedLine[];
  /** sum of all known line costs, rounded to cents. */
  estimatedCost: number;
  /** how many lines had no `costPerUnit` and were treated as 0. */
  unknownCount: number;
}

/**
 * Estimate the cost of a shopping trip: multiply each line's `quantity` by its `costPerUnit` and
 * sum. Deterministic and conservative — a line with no known `costPerUnit` contributes 0 to the
 * total and is flagged (`costKnown: false`, counted in `unknownCount`) rather than guessed, so the
 * headline `estimatedCost` never invents a price. The caller surfaces `unknownCount` to the user so
 * a low estimate driven by missing prices isn't mistaken for a cheap shop.
 */
export function estimateTripCost(lines: CostLine[]): TripCostEstimate {
  const costed: CostedLine[] = lines.map((l) => {
    const costKnown = typeof l.costPerUnit === 'number' && l.costPerUnit > 0;
    const estCost = costKnown ? round2(l.quantity * (l.costPerUnit as number)) : 0;
    return { ...l, estCost, costKnown };
  });
  return {
    lines: costed,
    estimatedCost: round2(costed.reduce((s, l) => s + l.estCost, 0)),
    unknownCount: costed.filter((l) => !l.costKnown).length,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
