/**
 * Parse a fully qualified agent ref.
 * @param ref The three-part ref, e.g. "default/space-probe/probe".
 * @returns The parsed parts plus the normalized qualified form.
 * @throws When the ref does not have exactly three non-empty parts.
 */
export function parseRef(ref: string): { project: string; space: string; slug: string; qualified: string } {
  const parts = ref.split('/').filter((part) => part.length > 0);
  if (parts.length !== 3) throw new Error(`agent ref must be <project>/<space>/<slug>, got: ${ref}`);
  return { project: parts[0]!, space: parts[1]!, slug: parts[2]!, qualified: parts.join('/') };
}