/**
 * Nudge a single topic's weight from one engagement signal, clamped to a sane range `[0.1, 5]` so
 * no single event can zero out or runaway-inflate a topic. Deltas are intentionally small — weight
 * is meant to drift gradually across many reading events, not swing on one open or one dismiss:
 * `open` +0.15, `save` +0.4, `dwell` up to +0.5 (`dwellMs / 120000`, i.e. half a point per two
 * minutes of dwell, capped), `dismiss` -0.5.
 */
export function computeTopicWeights(
  current: number,
  signal: 'open' | 'save' | 'dwell' | 'dismiss',
  dwellMs?: number,
): number {
  let delta = 0;

  switch (signal) {
    case 'open':
      delta = 0.15;
      break;
    case 'save':
      delta = 0.4;
      break;
    case 'dwell':
      delta = Math.min((dwellMs ?? 0) / 120000, 0.5);
      break;
    case 'dismiss':
      delta = -0.5;
      break;
  }

  const next = current + delta;
  return Math.min(5, Math.max(0.1, Math.round(next * 100) / 100));
}
