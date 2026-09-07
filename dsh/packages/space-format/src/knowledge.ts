import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.ts';
import type { KnowledgeDomain, KnowledgeField, KnowledgeTree } from './types.ts';

async function dirExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** Sorted directory listing — deterministic enumeration order (Part A1 design decision #5,
 *  adopted from `mcp/src/format/knowledge.ts`'s `directories()`). */
async function listDirSorted(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).sort();
  } catch {
    return [];
  }
}

/** Allowed frontmatter keys for a knowledge option file (`knowledge/<domain>/<field>/<slug>.md`). */
const KNOWLEDGE_OPTION_ALLOWED_KEYS = new Set(['description', 'icon', 'color', 'label']);

/**
 * Validate a knowledge option file's frontmatter against the spec allow-list: `description` is
 * required when frontmatter is present; `icon`/`color`/`label` are optional; no other keys are
 * allowed. Plain markdown (no frontmatter) is always valid. Throws (fail-loud).
 *
 * Returns the validated `{ description, title }` (both undefined for a plain-markdown option), so
 * the caller can populate the prompt without reading the file a second time.
 */
export function validateKnowledgeOptionFrontmatter(
  raw: string,
  source: string,
): { description?: string; title?: string } {
  const { data } = parseFrontmatter(raw, source);
  if (Object.keys(data).length === 0) return {};

  if (typeof data['description'] !== 'string' || data['description'].length === 0) {
    throw new Error(`Knowledge option "${source}" has frontmatter but is missing required key "description"`);
  }

  const unknownKeys = Object.keys(data).filter((k) => !KNOWLEDGE_OPTION_ALLOWED_KEYS.has(k));
  if (unknownKeys.length > 0) {
    throw new Error(
      `Knowledge option "${source}" has disallowed frontmatter key(s): ${unknownKeys.join(', ')}. Allowed keys: description (required), icon, color, label`,
    );
  }
  return {
    description: data['description'],
    title: typeof data['label'] === 'string' ? data['label'] : undefined,
  };
}

/**
 * Load `knowledge/<domain>/<field>/<option>.md` under `dir` into a {@link KnowledgeTree}.
 *
 * Merges the two prior implementations (Part A1 design decision #5): core/dsh's richer per-field
 * metadata (`type`/`variableName`/`default`, read from a field's `index.md` frontmatter — entirely
 * absent from `mcp/src/format`'s `KnowledgeField`) with `mcp/src/format/knowledge.ts`'s sorted,
 * deterministic enumeration. `optionTitles` is a new, purely additive field (not present in either
 * prior implementation's `KnowledgeField`) surfacing an option's `label:` frontmatter — mcp's own
 * knowledge.ts exposes this as `KnowledgeOption.title`; this port keeps the existing
 * parallel-Record shape every consumer already reads (`options`/`optionDescriptions`) and adds a
 * third parallel Record rather than restructuring to nested per-option objects, so no existing
 * consumer needs to change to keep working.
 */
export async function loadKnowledge(dir: string): Promise<KnowledgeTree> {
  const knowledgeDir = join(dir, 'knowledge');
  const domains: Record<string, KnowledgeDomain> = {};

  if (!(await dirExists(knowledgeDir))) return { domains };

  for (const domainSlug of await listDirSorted(knowledgeDir)) {
    const domainDir = join(knowledgeDir, domainSlug);
    if (!(await dirExists(domainDir))) continue;

    const fields: Record<string, KnowledgeField> = {};

    for (const fieldSlug of await listDirSorted(domainDir)) {
      const fieldDir = join(domainDir, fieldSlug);
      if (!(await dirExists(fieldDir))) continue;

      let type = 'string';
      let variableName = fieldSlug;
      let defaultValue: unknown;
      let fieldDescription: string | undefined;

      const metaPath = join(fieldDir, 'index.md');
      if (await fileExists(metaPath)) {
        const raw = await readFile(metaPath, 'utf8');
        const { data, body } = parseFrontmatter(raw, metaPath);
        if (typeof data['type'] === 'string') type = data['type'];
        if (typeof data['variable'] === 'string') variableName = data['variable'];
        if ('default' in data) defaultValue = data['default'];
        if (body && body.trim()) fieldDescription = body.trim();
      }

      const options: Record<string, string> = {};
      const optionDescriptions: Record<string, string> = {};
      const optionTitles: Record<string, string> = {};

      for (const optFile of await listDirSorted(fieldDir)) {
        if (!optFile.endsWith('.md') || optFile === 'index.md') continue;
        const optionSlug = optFile.slice(0, -3);
        const optionPath = join(fieldDir, optFile);
        const { description, title } = validateKnowledgeOptionFrontmatter(await readFile(optionPath, 'utf8'), optionPath);
        options[optionSlug] = optionPath;
        if (description) optionDescriptions[optionSlug] = description;
        if (title) optionTitles[optionSlug] = title;
      }

      const field: KnowledgeField = { slug: fieldSlug, type, variableName, options, optionDescriptions, optionTitles };
      if (defaultValue !== undefined) field.default = defaultValue;
      if (fieldDescription) field.description = fieldDescription;
      fields[fieldSlug] = field;
    }

    const domain: KnowledgeDomain = { slug: domainSlug, fields };
    const domainIndexPath = join(domainDir, 'index.md');
    if (await fileExists(domainIndexPath)) {
      const { body } = parseFrontmatter(await readFile(domainIndexPath, 'utf8'), domainIndexPath);
      if (body) domain.description = body;
    }

    domains[domainSlug] = domain;
  }

  return { domains };
}
