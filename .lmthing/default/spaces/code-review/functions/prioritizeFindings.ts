/**
 * Prioritize code review findings into blockers and nits lanes.
 * @param findings The list of review findings to prioritize.
 */
export function prioritizeFindings(findings: Array<{ file: string; note: string; severity: 'blocker' | 'nit' }>): { blockers: string[]; nits: string[] } {
  const blockers: string[] = [];
  const nits: string[] = [];
  for (const finding of findings) {
    const formatted = `${finding.file}: ${finding.note}`;
    if (finding.severity === 'blocker') {
      blockers.push(formatted);
    } else {
      nits.push(formatted);
    }
  }
  return { blockers, nits };
}
