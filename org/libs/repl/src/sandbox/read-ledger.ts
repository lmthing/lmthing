/**
 * Tracks which file paths have been read by the agent this session.
 * Used to enforce the read-before-patch safety gate for diff operations.
 */
export interface ReadLedger {
  paths: Set<string>
}

export function createReadLedger(): ReadLedger {
  return { paths: new Set() }
}

export function recordRead(ledger: ReadLedger, path: string): void {
  ledger.paths.add(path)
}

export function hasBeenRead(ledger: ReadLedger, path: string): boolean {
  return ledger.paths.has(path)
}
