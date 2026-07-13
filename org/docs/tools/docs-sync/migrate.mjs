#!/usr/bin/env node
// docs-migrate — one-time (and re-runnable) rewrite of line citations to symbol anchors.
//
// For each `path:Lstart-Lend` in org/docs it finds the innermost named symbol whose
// range contains the cited lines and, when that symbol is a *clean fit*, rewrites the
// citation to `path#Symbol`. Where a symbol is not appropriate — non-code files
// (JSON/YAML/MD/…), a precise line inside a large function, a range that straddles
// two symbols, or an ambiguous name — the line citation is kept untouched.
//
// It never invents anchors: if the file or lines don't resolve, it leaves the text
// exactly as-is and reports it, so nothing silently degrades.
//
// Usage:
//   node migrate.mjs [--docs <dir>] [--repo-root <dir>] [--sdk-org-root <dir>] [--write] [--json]
//   (dry-run by default; --write edits files in place)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCitations, resolveRepoPath, collectMarkdown } from './citations.mjs';
import { scanSymbols, innermostEnclosing, isScannable } from './scan-symbols.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// A symbol is a "clean fit" for a line range when anchoring to it does not lose
// meaningful precision. Any one of:
//   - the citation starts at (or within 2 lines of) the symbol's own declaration, or
//   - the cited range covers at least this fraction of the symbol, or
//   - the symbol is small enough that "which line" barely matters.
const NEAR_DECL_LINES = 2;
const COVERAGE = 0.5;
const SMALL_SYMBOL_LINES = 30;

function isCleanFit(sym, lstart, lend) {
  if (sym.containerLen <= SMALL_SYMBOL_LINES) return true;
  if (lstart - sym.startLine <= NEAR_DECL_LINES) return true;
  const covered = (lend - lstart + 1) / sym.containerLen;
  if (covered >= COVERAGE) return true;
  return false;
}

function parseArgs(argv) {
  const a = { write: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--write') a.write = true;
    else if (v === '--json') a.json = true;
    else if (v === '--docs') a.docs = argv[++i];
    else if (v === '--repo-root') a.repoRoot = argv[++i];
    else if (v === '--sdk-org-root') a.sdkOrgRoot = argv[++i];
    else if (v === '--help' || v === '-h') a.help = true;
  }
  return a;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: docs-migrate [--docs <dir>] [--repo-root <dir>] [--sdk-org-root <dir>] [--write] [--json]');
    process.exit(0);
  }

  const repoRoot = args.repoRoot || path.resolve(here, '../../../..');
  const docsDir = args.docs || path.resolve(here, '../..');
  const sdkOrgRoot = args.sdkOrgRoot || process.env.SDK_ORG_ROOT || undefined;
  const opts = { repoRoot, sdkOrgRoot };

  const files = collectMarkdown(docsDir);
  const symCache = new Map();
  const getSyms = (abs) => {
    if (symCache.has(abs)) return symCache.get(abs);
    const syms = scanSymbols(fs.readFileSync(abs, 'utf8'), path.extname(abs));
    symCache.set(abs, syms);
    return syms;
  };

  const stats = {
    lineCitations: 0,
    migrated: 0,
    keptNonCode: 0,
    keptNoSymbol: 0,
    keptStraddle: 0,
    keptImprecise: 0,
    keptAmbiguous: 0,
    unresolvedFile: 0,
    outOfBounds: 0,
  };
  const samples = [];

  for (const file of files) {
    const md = fs.readFileSync(file, 'utf8');
    const rel = path.relative(repoRoot, file);
    const cites = parseCitations(md).filter((c) => c.kind === 'line');
    if (!cites.length) continue;

    // Build replacements, then apply right-to-left so indices stay valid.
    const edits = [];
    for (const c of cites) {
      stats.lineCitations++;
      const { abs, exists } = resolveRepoPath(c.path, opts);
      if (!exists) { stats.unresolvedFile++; continue; }
      const ext = path.extname(abs);
      if (!isScannable(ext)) { stats.keptNonCode++; continue; }

      const syms = getSyms(abs);
      const fileLines = syms.length ? syms[0].fileLines : fs.readFileSync(abs, 'utf8').split('\n').length;
      if (c.lstart > fileLines || c.lstart < 1) { stats.outOfBounds++; continue; }

      const sym = innermostEnclosing(syms, c.lstart, c.lend);
      if (!sym) { stats.keptNoSymbol++; continue; }
      // does the range straddle beyond the innermost symbol?
      if (c.lend > sym.endLine) { stats.keptStraddle++; continue; }
      if (!isCleanFit(sym, c.lstart, c.lend)) { stats.keptImprecise++; continue; }
      // avoid ambiguous bare names: if unqualified name is duplicated, keep the line.
      const sameName = syms.filter((s) => s.qualifiedName === sym.qualifiedName);
      if (sameName.length > 1) { stats.keptAmbiguous++; continue; }

      const replacement = `${c.path}#${sym.qualifiedName}`;
      edits.push({ index: c.index, length: c.length, replacement, from: c.raw });
      stats.migrated++;
      if (samples.length < 25) samples.push({ doc: rel, from: c.raw, to: replacement, sym: `${sym.kind} ${sym.qualifiedName}` });
    }

    if (args.write && edits.length) {
      edits.sort((a, b) => b.index - a.index);
      let next = md;
      for (const e of edits) next = next.slice(0, e.index) + e.replacement + next.slice(e.index + e.length);
      fs.writeFileSync(file, next);
    }
  }

  if (args.json) {
    console.log(JSON.stringify({ stats, samples }, null, 2));
  } else {
    const mode = args.write ? 'WROTE' : 'dry-run';
    console.log(`docs-migrate (${mode}): ${stats.lineCitations} line citations examined`);
    console.log(`  → ${stats.migrated} rewritten to symbol anchors`);
    console.log(`  kept as line anchors:`);
    console.log(`     ${stats.keptNonCode} non-code files (json/yaml/md/…)`);
    console.log(`     ${stats.keptNoSymbol} no enclosing named symbol`);
    console.log(`     ${stats.keptStraddle} range straddles symbol boundary`);
    console.log(`     ${stats.keptImprecise} precise line inside a large symbol`);
    console.log(`     ${stats.keptAmbiguous} ambiguous (duplicate name)`);
    console.log(`  skipped (reported, not touched):`);
    console.log(`     ${stats.unresolvedFile} file not found`);
    console.log(`     ${stats.outOfBounds} line out of bounds`);
    if (samples.length) {
      console.log(`\n  sample rewrites:`);
      for (const s of samples) console.log(`     ${s.from}\n       → ${s.to}   (${s.sym})`);
    }
    if (!args.write) console.log(`\n  (dry-run — re-run with --write to apply)`);
  }
}

main();
