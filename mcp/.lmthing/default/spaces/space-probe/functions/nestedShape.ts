/** Read a two-level nested probe configuration.
 * @param input The nested configuration with its tuning values.
 */
export function nestedShape(input: { probe: { depth: number; enabled: boolean } }): string { return input.probe.enabled ? String(input.probe.depth) : 'off'; }
