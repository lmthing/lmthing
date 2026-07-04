/**
 * Tally a batch of reading events into a per-tag engagement summary plus overall counts. Signal
 * weights mirror how strongly each action implies genuine interest: an `open` is a weak positive
 * (+1), a `save` is a strong positive (+3), sustained `dwell` time contributes a fractional
 * positive capped at +3 per event (`dwellMs / 60000`, i.e. one point per minute, so a runaway
 * dwell timer can't dominate the tally), and a `dismiss` is a clear negative (-2).
 */
export function summarizeEngagement(
  events: { kind: string; tag?: string; dwellMs?: number }[],
): { byTag: Record<string, number>; opens: number; saves: number; dismisses: number } {
  const byTag: Record<string, number> = {};
  let opens = 0;
  let saves = 0;
  let dismisses = 0;

  for (const event of events) {
    const tag = event.tag ?? 'untagged';
    let delta = 0;

    switch (event.kind) {
      case 'open':
        delta = 1;
        opens += 1;
        break;
      case 'save':
        delta = 3;
        saves += 1;
        break;
      case 'dwell':
        delta = Math.min((event.dwellMs ?? 0) / 60000, 3);
        break;
      case 'dismiss':
        delta = -2;
        dismisses += 1;
        break;
      default:
        delta = 0;
    }

    byTag[tag] = (byTag[tag] ?? 0) + delta;
  }

  return { byTag, opens, saves, dismisses };
}
