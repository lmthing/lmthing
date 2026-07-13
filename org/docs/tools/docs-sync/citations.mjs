// Parse citations out of an org/docs markdown file, and map a cited repo path to
// a real file on disk.
//
// Two citation grammars are recognised:
//   path#Symbol            symbol anchor (preferred)  e.g. sdk/org/libs/core/src/eval/turn-loop.ts#runTurnLoop
//   path:Lstart-Lend       line anchor (fallback)     e.g. sdk/org/libs/css/src/tokens/tokens.json:42-58
//   path:Lstart            single line                e.g. cloud/gateway/src/lib/tokens.ts:88
//
// A "citation" is only one we can resolve: its path must contain a slash and start
// at a known repo root. Route params (`:spaceId/...`), bare relative fragments and
// URLs are ignored — they are not file references.

import fs from 'node:fs';
import path from 'node:path';

// Top-level directories of the lmthing monorepo that citations may point into.
export const KNOWN_ROOTS = [
  'sdk', 'cloud', 'store', 'devops', 'com', 'social', 'team', 'space', 'blog', 'casa', 'org',
];

// A repo path: known-root segment, then one or more path segments, then a code-ish extension.
const PATH = String.raw`(?:${KNOWN_ROOTS.join('|')})(?:/[\w.@-]+)+\.(?:tsx?|mtsx?|ctsx?|jsx?|mjs|cjs|json|ya?ml|md|sh|css|html)`;

// Symbol anchor:  path#Ident(.Ident)*     — dotted qualified names allowed.
const SYMBOL_RE = new RegExp(String.raw`(${PATH})#([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)`, 'g');
// Line anchor:    path:Lstart(-Lend)?     — the "L" is optional (both `:300` and `:L300` seen).
const LINE_RE = new RegExp(String.raw`(${PATH}):L?(\d+)(?:-L?(\d+))?`, 'g');

/**
 * Parse every resolvable citation in a markdown string.
 * @param {string} md
 * @returns {Array<{kind:'symbol'|'line', path:string, symbol?:string, lstart?:number, lend?:number, index:number, length:number, raw:string}>}
 */
export function parseCitations(md) {
  const found = [];
  let m;
  SYMBOL_RE.lastIndex = 0;
  while ((m = SYMBOL_RE.exec(md))) {
    found.push({ kind: 'symbol', path: m[1], symbol: m[2], index: m.index, length: m[0].length, raw: m[0] });
  }
  LINE_RE.lastIndex = 0;
  while ((m = LINE_RE.exec(md))) {
    const lstart = parseInt(m[2], 10);
    const lend = m[3] ? parseInt(m[3], 10) : lstart;
    found.push({ kind: 'line', path: m[1], lstart, lend, index: m.index, length: m[0].length, raw: m[0] });
  }
  found.sort((a, b) => a.index - b.index);
  return found;
}

/**
 * Map a cited repo path to an absolute filesystem path.
 * `sdk/org/<x>` lives in the sdk/org submodule; when that submodule is not checked
 * out (as in a docs-only clone) it is remapped to `opts.sdkOrgRoot`.
 * @param {string} citePath
 * @param {{ repoRoot: string, sdkOrgRoot?: string }} opts
 * @returns {{ abs: string, exists: boolean }}
 */
export function resolveRepoPath(citePath, opts) {
  const { repoRoot, sdkOrgRoot } = opts;
  let abs;
  if (citePath.startsWith('sdk/org/')) {
    const submodule = path.join(repoRoot, 'sdk/org');
    const rel = citePath.slice('sdk/org/'.length);
    // Prefer the real submodule if populated; otherwise fall back to the standalone org clone.
    const inSub = path.join(submodule, rel);
    if (fs.existsSync(inSub)) abs = inSub;
    else if (sdkOrgRoot) abs = path.join(sdkOrgRoot, rel);
    else abs = inSub;
  } else {
    abs = path.join(repoRoot, citePath);
  }
  return { abs, exists: fs.existsSync(abs) };
}

/** Recursively collect *.md files under a directory. */
export function collectMarkdown(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      out.push(...collectMarkdown(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}
