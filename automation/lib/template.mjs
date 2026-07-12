/**
 * template.mjs — the tiny prompt templating language.
 *
 *   {{include:sibling.md}}   inline a sibling file (one level, resolved before var substitution)
 *   {{var}}                  substitute a variable (task, round, roundMode, taskIndex, taskCount,
 *                            progressFile, branch, subagents, originalPrompt, + any vars() key)
 *
 * The {{subagents}} variable is rendered from a [{name, scope, model?}] array into a numbered
 * block; each subagent's `scope` is itself run through var substitution so it may contain {{task}}.
 * Unknown {{...}} placeholders are left intact and reported via the returned `warnings`.
 *
 * Zero dependencies — Node built-ins only.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const INCLUDE_RE = /\{\{include:([^}]+)\}\}/g;
const VAR_RE = /\{\{([a-zA-Z_][\w.]*)\}\}/g;

/** Expand {{include:...}} one level, relative to the including file's directory. */
export function expandIncludes(text, baseDir, seen = new Set()) {
  return text.replace(INCLUDE_RE, (_m, rel) => {
    const file = resolve(baseDir, rel.trim());
    if (seen.has(file)) return `<!-- include cycle skipped: ${rel.trim()} -->`;
    seen.add(file);
    let body;
    try {
      body = readFileSync(file, 'utf8');
    } catch {
      return `<!-- missing include: ${rel.trim()} -->`;
    }
    // one level of nesting: expand includes inside the included file too, cycle-guarded
    return expandIncludes(body, dirname(file), seen);
  });
}

/** Render a [{name, scope, model?}] list into a numbered instruction block. */
export function renderSubagents(subagents, vars) {
  if (!Array.isArray(subagents) || subagents.length === 0) {
    return '(none — run this task in a single session without fanning out)';
  }
  return subagents
    .map((s, i) => {
      const scope = substituteVars(String(s.scope ?? ''), vars).text;
      const model = s.model ? ` _(model: ${s.model})_` : '';
      return `${i + 1}. **${s.name}**${model} — ${scope}`;
    })
    .join('\n');
}

/** Substitute {{var}} placeholders. Returns { text, warnings } (unknown vars left intact). */
export function substituteVars(text, vars) {
  const warnings = [];
  const out = text.replace(VAR_RE, (m, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key) && vars[key] != null) {
      return String(vars[key]);
    }
    warnings.push(key);
    return m;
  });
  return { text: out, warnings: [...new Set(warnings)] };
}

/**
 * Render a template file: read it, expand includes, then substitute variables (including a
 * pre-rendered {{subagents}} block built from `subagents`).
 * Returns { text, warnings }.
 */
export function renderTemplate(templateFile, { vars = {}, subagents = [] } = {}) {
  const raw = readFileSync(templateFile, 'utf8');
  const included = expandIncludes(raw, dirname(templateFile));
  const fullVars = { ...vars, subagents: renderSubagents(subagents, vars) };
  return substituteVars(included, fullVars);
}

/** Render a template given its text already in memory (used for the built-in continuation wrapper). */
export function renderString(text, { vars = {}, subagents = [] } = {}) {
  const fullVars = { ...vars, subagents: renderSubagents(subagents, vars) };
  return substituteVars(text, fullVars);
}
