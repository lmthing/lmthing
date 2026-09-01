/** Deliberately throw a predictable error for callers.
 */
export function throwsError(): never { throw new Error('probe failure'); }
