/** Return a short response for a selected tone.
 * @param tone The tone to select.
 */
export function pickTone(tone: 'warm' | 'terse'): string { return tone === 'warm' ? 'Warmly noted.' : 'Noted.'; }
