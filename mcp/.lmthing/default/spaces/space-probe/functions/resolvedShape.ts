import type { ProbeSpec } from './types.js';
/** Format a probe specification imported from this space.
 * @param spec The imported probe specification.
 */
export function resolvedShape(spec: ProbeSpec): string { return `${spec.label}:${spec.retries}`; }
