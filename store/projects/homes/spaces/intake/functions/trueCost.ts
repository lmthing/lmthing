export interface CostLine {
  label: string;
  amount: number;
  basis: 'stated' | 'estimated';
  note?: string;
}

export interface TrueCostResult {
  trueCostMonthly: number;
  breakdown: CostLine[];
}

/**
 * Compute the all-in monthly cost of a listing, deterministically, with EVERY line
 * labelled `stated` (came from the listing) or `estimated` (the surveyor's model) —
 * never silently blended (spec §surveyor money math).
 *
 * rent mode:  rent (stated) + condo/HOA fees (stated if given) + a per-m² utilities
 *             estimate (electricity/water/gas/internet scaled by size).
 * buy mode:   an amortized monthly mortgage at a CITED reference rate over `termYears`
 *             on (price − downPayment), + monthly charges (condo + property tax est).
 *
 * The model narrates and supplies inputs; this function does the arithmetic so the
 * numbers are reproducible and testable. See `true-cost/`.
 */
export function trueCost(input: {
  mode: 'rent' | 'buy';
  priceAmount: number;
  currency: string;
  areaSqm?: number;
  statedFees?: { label: string; amount: number }[]; // condo fee, IMI, etc. as stated
  // buy-mode knobs (all cited by the surveyor when it calls):
  downPaymentPct?: number; // default 20
  annualRatePct?: number; // the cited reference rate, e.g. 3.5
  rateSource?: string; // where the rate came from — rides the mortgage line note
  termYears?: number; // default 30
  // rent-mode knob:
  utilitiesPerSqmMonthly?: number; // default 3.0 — a labelled estimate
}): TrueCostResult {
  const currency = input.currency || 'USD';
  const area = Math.max(0, input.areaSqm ?? 0);
  const breakdown: CostLine[] = [];

  if (input.mode === 'rent') {
    breakdown.push({ label: 'Rent', amount: round2(input.priceAmount), basis: 'stated' });
    for (const fee of input.statedFees ?? []) {
      breakdown.push({ label: fee.label, amount: round2(fee.amount), basis: 'stated' });
    }
    const perSqm = input.utilitiesPerSqmMonthly ?? 3.0;
    const utilities = area > 0 ? round2(area * perSqm) : round2(80); // fallback flat estimate
    breakdown.push({
      label: 'Utilities (est.)',
      amount: utilities,
      basis: 'estimated',
      note: area > 0 ? `${perSqm}/m² × ${area} m² — electricity, water, internet` : 'flat estimate — size unknown',
    });
  } else {
    const dpPct = input.downPaymentPct ?? 20;
    const ratePct = input.annualRatePct ?? 3.5;
    const term = input.termYears ?? 30;
    const principal = input.priceAmount * (1 - dpPct / 100);
    const monthlyRate = ratePct / 100 / 12;
    const n = term * 12;
    const mortgage =
      monthlyRate === 0
        ? principal / n
        : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
    breakdown.push({
      label: 'Mortgage (est.)',
      amount: round2(mortgage),
      basis: 'estimated',
      note: `${dpPct}% down, ${ratePct}% over ${term}y${input.rateSource ? ` — rate: ${input.rateSource}` : ''}`,
    });
    for (const fee of input.statedFees ?? []) {
      breakdown.push({ label: fee.label, amount: round2(fee.amount), basis: 'stated' });
    }
    // Recurring charges estimate when none stated (condo + property tax ~1%/yr).
    if (!(input.statedFees ?? []).length) {
      const tax = round2((input.priceAmount * 0.01) / 12);
      breakdown.push({
        label: 'Property tax + charges (est.)',
        amount: tax,
        basis: 'estimated',
        note: '~1%/yr of price, monthly',
      });
    }
  }

  const trueCostMonthly = round2(breakdown.reduce((sum, l) => sum + l.amount, 0));
  void currency;
  return { trueCostMonthly, breakdown };
}

function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}
