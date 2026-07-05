export interface MacroLine {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Sums an array of per-line macro contributions (e.g. one recipe's ingredient lines, each already
 * scaled to its quantity) into a single rounded total. Missing/undefined fields on any line are
 * treated as zero rather than throwing, since a line with a not-yet-estimated nutrition fact
 * should contribute nothing rather than break the sum. Rounding happens once, at the end, so
 * intermediate precision isn't lost line-by-line.
 */
export function sumMacros(lines: MacroLine[]): MacroTotals {
  const totals = lines.reduce(
    (acc, line) => ({
      calories: acc.calories + (line.calories || 0),
      protein: acc.protein + (line.protein || 0),
      carbs: acc.carbs + (line.carbs || 0),
      fat: acc.fat + (line.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return {
    calories: Math.round(totals.calories),
    protein: Math.round(totals.protein),
    carbs: Math.round(totals.carbs),
    fat: Math.round(totals.fat),
  };
}
