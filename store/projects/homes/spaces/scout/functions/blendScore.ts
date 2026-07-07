/**
 * The taste-ranked relevance score (0..100) — a DETERMINISTIC blend the ranker
 * explains, not model arithmetic (spec §ranker). Inputs are evidence the ranker
 * maps onto taste dimensions; the number and its component breakdown are
 * reproducible so `scoreSummary` can cite exactly what moved it.
 *
 * Composition:
 *   base 60
 *   + Σ taste-note contributions  (note.weight × featureMatch ∈ [-1,1]) × 25
 *   − commute penalty             (each target over its max: up to −12 each)
 *   − flag penalty                (warning flags bite harder than soft ones)
 *   − budget penalty              (over budgetMax on true cost: steep)
 *   HARD CAP at 45 when a must-have / dealbreaker is violated — never top-ranked.
 *
 * Clamped 0..100. See `taste-learning/scoring-and-explanations`.
 */
export interface BlendInput {
  trueCostMonthly: number;
  budgetMax: number;
  /** per taste note: how well THIS listing matches it, −1 (opposes) .. 1 (matches). */
  noteMatches: { weight: number; match: number; dimension: string }[];
  /** per commute target: minutes over its max (0 or negative = within budget). */
  commuteOverBy: number[];
  flags: string[];
  /** a hard must-have this listing fails, or a dealbreaker note it hits. */
  violatesHardConstraint: boolean;
}

export interface BlendResult {
  score: number;
  components: { label: string; delta: number }[];
}

const WARNING_FLAGS = new Set(['size_overstated', 'photo_text_mismatch', 'scam_signals', 'possible_duplicate']);

export function blendScore(input: BlendInput): BlendResult {
  const components: { label: string; delta: number }[] = [];
  let score = 60;
  components.push({ label: 'base', delta: 60 });

  for (const n of input.noteMatches ?? []) {
    const delta = round1(clamp(n.weight, 0, 1) * clamp(n.match, -1, 1) * 25);
    if (delta !== 0) {
      components.push({ label: `${n.dimension} note`, delta });
      score += delta;
    }
  }

  for (const over of input.commuteOverBy ?? []) {
    if (over > 0) {
      const delta = -Math.min(12, round1(over * 0.6));
      components.push({ label: 'commute over max', delta });
      score += delta;
    }
  }

  for (const flag of input.flags ?? []) {
    const delta = WARNING_FLAGS.has(flag) ? -8 : -3;
    components.push({ label: `flag: ${flag}`, delta });
    score += delta;
  }

  if (input.budgetMax > 0 && input.trueCostMonthly > input.budgetMax) {
    const overPct = (input.trueCostMonthly - input.budgetMax) / input.budgetMax;
    const delta = -Math.min(30, round1(overPct * 100));
    components.push({ label: 'over budget (true cost)', delta });
    score += delta;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  if (input.violatesHardConstraint) {
    score = Math.min(score, 45); // capped — never surfaces as a top match
    components.push({ label: 'hard constraint violated — capped at 45', delta: 0 });
  }

  return { score, components };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : 0));
}
function round1(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 10) / 10;
}
