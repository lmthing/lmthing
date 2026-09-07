import { parseDocument } from 'yaml';

/**
 * Parse YAML frontmatter from a markdown file. Frontmatter is delimited by `---` on its own line
 * at the very start of the file.
 *
 * Stricter than the original `sdk/org/libs/core/src/spaces/frontmatter.ts` /
 * `dsh/packages/space-format/src/frontmatter.js` on two points, adopted from `mcp/src/format/`'s
 * implementation as the new unified default (Part A1 design decision #10 — see `dsh/PROGRESS.md`):
 * an unterminated `---` fence, and frontmatter that parses to something other than a mapping, both
 * now THROW instead of silently degrading to "the whole file is plain body text" / "empty data".
 * Both are real authoring mistakes that were previously invisible; nothing legitimate is rejected
 * by this tightening.
 *
 * Deliberately NOT adopted from mcp: mcp also `.trim()`s the body in the no-frontmatter case.
 * That's a separate, weaker-justified difference (cosmetic, not a caught-authoring-mistake) that a
 * real consumer (`@lmthing/dsh-space-knowledge`, reading a plain-markdown knowledge option's full
 * body) depends on NOT happening — caught by that package's own test suite. The no-frontmatter case
 * keeps returning the RAW, untrimmed text, exactly matching core/dsh's original behavior.
 *
 * `source` is an optional file path included in every error message for context.
 */
export function parseFrontmatter(text: string, source = ''): { data: Record<string, unknown>; body: string } {
  if (!text.startsWith('---')) return { data: {}, body: text };

  const firstLineEnd = text.indexOf('\n');
  if (firstLineEnd < 0 || text.slice(0, firstLineEnd).trim() !== '---') {
    return { data: {}, body: text };
  }

  const closeFence = /^---\s*$/m;
  closeFence.lastIndex = firstLineEnd + 1;
  const rest = text.slice(firstLineEnd + 1);
  const match = closeFence.exec(rest);
  if (!match || match.index === undefined) {
    throw new Error(`${source}: unterminated YAML frontmatter`);
  }

  const yamlText = rest.slice(0, match.index);
  const document = parseDocument(yamlText, { prettyErrors: false });
  if (document.errors.length > 0) {
    throw new Error(`${source}: ${document.errors.map((e) => e.message).join('; ')}`);
  }

  const value = document.toJS();
  if (value !== null && (typeof value !== 'object' || Array.isArray(value))) {
    throw new Error(`${source}: frontmatter must be a mapping`);
  }

  return {
    data: (value ?? {}) as Record<string, unknown>,
    body: rest.slice(match.index + match[0].length).trim(),
  };
}
