/**
 * Split iteration findings into what MUST be fixed before the app is called done and what is
 * polish worth doing only if there is room.
 *
 * An inspection pass over a live project app produces a flat finding list; an iteration pass
 * needs two different lanes, because a broken thing and an unpolished thing do not belong in
 * the same queue — a fix blocks the gate, a polish does not. This is the same split the
 * view-spec validators make: a broken contract or an orphan page is a defect, while a
 * blank-section layout choice is not.
 *
 * Each finding names its `area` (`"api"`, `"views"`, `"database"`, `"hooks"`, `"shell"`, …) and
 * its `detail`; the emitted items are `"area: detail"` strings so a downstream fixer reads the
 * where and the what in one line. Ordering is preserved within each lane — the caller's
 * severity-first ordering is the priority order.
 */
export function planIteration(findings: Array<{ area: string; detail: string; severity: "fix" | "polish" }>): { fixes: string[]; polish: string[] } {
  const fixes: string[] = [];
  const polish: string[] = [];
  for (const finding of findings) {
    const item = `${finding.area}: ${finding.detail}`;
    if (finding.severity === 'fix') fixes.push(item);
    else polish.push(item);
  }
  return { fixes, polish };
}