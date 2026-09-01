import { parseDocument } from 'yaml';

/** Markdown split at an opening, column-zero YAML frontmatter fence. */
export interface Frontmatter {
  data: Record<string, unknown>;
  body: string;
}

export function parseFrontmatter(text: string, path = ''): Frontmatter {
  if (!text.startsWith('---')) return { data: {}, body: text.trim() };
  const firstLineEnd = text.indexOf('\n');
  if (firstLineEnd < 0 || text.slice(0, firstLineEnd).trim() !== '---') {
    return { data: {}, body: text.trim() };
  }
  const close = /^---\s*$/m;
  close.lastIndex = firstLineEnd + 1;
  const rest = text.slice(firstLineEnd + 1);
  const match = close.exec(rest);
  if (!match || match.index === undefined) {
    throw new Error(`${path}: unterminated YAML frontmatter`);
  }
  const yamlText = rest.slice(0, match.index);
  const document = parseDocument(yamlText, { prettyErrors: false });
  if (document.errors.length > 0) {
    throw new Error(`${path}: ${document.errors.map((error) => error.message).join('; ')}`);
  }
  const value = document.toJS();
  if (value !== null && (typeof value !== 'object' || Array.isArray(value))) {
    throw new Error(`${path}: frontmatter must be a mapping`);
  }
  return { data: (value ?? {}) as Record<string, unknown>, body: rest.slice(match.index + match[0].length).trim() };
}
