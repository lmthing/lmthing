/**
 * Stable identity for one intake delivery — pure, never throws.
 *
 * Keyed on the source plus a deterministic hash of the payload text, so the same delivery arriving
 * twice (a webhook retry, a re-run of an importer) dedupes, while a genuinely different payload
 * from the same source gets its own key. djb2-xor is inlined: it is stable across processes and
 * platforms, which `String.prototype.hashCode`-style ad-hoc schemes are not.
 *
 * @returns e.g. `webhook-stripe:1f3a9c2b`
 */
export function computeIntakeKey(source: unknown, payloadJson: unknown): string {
  const text = typeof payloadJson === 'string' ? payloadJson : (() => {
    try { return JSON.stringify(payloadJson) ?? ''; } catch { return String(payloadJson); }
  })();

  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  const hash = h.toString(16).padStart(8, '0');

  const cleanSource = String(source ?? 'unknown').trim().replace(/[:\s]+/g, '_').slice(0, 80) || 'unknown';
  return `${cleanSource}:${hash}`;
}
