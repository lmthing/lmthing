#!/usr/bin/env node
// docs-check — the CI gate for the SYNC contract.
//
// Resolves every citation in org/docs against the current code:
//   path#Symbol      FAILS if the file is gone or the symbol no longer exists.
//   path:Lstart-Lend FAILS if the file is gone or the range is out of bounds.
//
// An unresolvable citation is, per SYNC.md, a bug you have just discovered: either
// the doc drifted from the code, or the code changed under the doc. Exit non-zero so
// the change cannot merge until the doc is fixed.
//
// Usage:
//   node check.mjs [--docs <dir>] [--repo-root <dir>] [--sdk-org-root <dir>] [--json]
//
// Defaults assume this file lives at <repo>/org/docs/tools/docs-sync/.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCitations, resolveRepoPath, collectMarkdown } from './citations.mjs';
import { scanSymbols, resolveAnchor, isScannable } from './scan-symbols.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const a = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--json') a.json = true;
    else if (v === '--docs') a.docs = argv[++i];
    else if (v === '--repo-root') a.repoRoot = argv[++i];
    else if (v === '--sdk-org-root') a.sdkOrgRoot = argv[++i];
    else if (v === '--baseline') a.baseline = argv[++i];
    else if (v === '--update-baseline') a.updateBaseline = argv[++i];
    else if (v === '--help' || v === '-h') a.help = true;
  }
  return a;
}

const keyOf = (f) => `${f.doc} :: ${f.raw}`;

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: docs-check [--docs <dir>] [--repo-root <dir>] [--sdk-org-root <dir>] [--baseline <file>] [--update-baseline <file>] [--json]');
    process.exit(0);
  }

  // <repo>/org/docs/tools/docs-sync/check.mjs  ->  repoRoot = <repo>, docs = <repo>/org/docs
  const repoRoot = args.repoRoot || path.resolve(here, '../../../..');
  const docsDir = args.docs || path.resolve(here, '../..');
  const sdkOrgRoot = args.sdkOrgRoot || process.env.SDK_ORG_ROOT || undefined;

  const opts = { repoRoot, sdkOrgRoot };
  const files = collectMarkdown(docsDir);

  // Cache scanned symbol tables per file — a hot file is cited dozens of times.
  const symCache = new Map();
  const getSyms = (abs) => {
    if (symCache.has(abs)) return symCache.get(abs);
    const src = fs.readFileSync(abs, 'utf8');
    const syms = scanSymbols(src, path.extname(abs));
    symCache.set(abs, syms);
    return syms;
  };
  const lineCount = (abs) => fs.readFileSync(abs, 'utf8').split('\n').length;

  const failures = [];
  let checked = 0;
  let symbolCount = 0;
  let lineCountCitations = 0;

  for (const file of files) {
    const md = fs.readFileSync(file, 'utf8');
    const rel = path.relative(repoRoot, file);
    for (const c of parseCitations(md)) {
      checked++;
      if (c.kind === 'symbol') symbolCount++;
      else lineCountCitations++;

      const { abs, exists } = resolveRepoPath(c.path, opts);
      if (!exists) {
        failures.push({ doc: rel, raw: c.raw, reason: `file not found: ${c.path}` });
        continue;
      }
      if (c.kind === 'symbol') {
        const ext = path.extname(abs);
        if (!isScannable(ext)) {
          failures.push({ doc: rel, raw: c.raw, reason: `symbol anchor on non-code file (${ext}); use a line anchor` });
          continue;
        }
        const res = resolveAnchor(getSyms(abs), c.symbol);
        if (!res) {
          failures.push({ doc: rel, raw: c.raw, reason: `symbol '${c.symbol}' not found in ${c.path}` });
        }
      } else {
        const n = lineCount(abs);
        if (c.lstart < 1 || c.lend < c.lstart || c.lstart > n) {
          failures.push({ doc: rel, raw: c.raw, reason: `line range ${c.lstart}-${c.lend} out of bounds (file has ${n} lines)` });
        }
      }
    }
  }

  // --update-baseline: write the current failures out as the accepted baseline and stop.
  if (args.updateBaseline) {
    const entries = failures.map(keyOf).sort();
    fs.writeFileSync(args.updateBaseline, JSON.stringify(entries, null, 2) + '\n');
    console.log(`wrote ${entries.length} known-failure(s) to ${path.relative(repoRoot, args.updateBaseline)}`);
    process.exit(0);
  }

  // --baseline: known pre-existing failures are tolerated (but reported); only NEW ones fail.
  // Baseline entries that now resolve are flagged as stale so the list burns down.
  let baseline = null;
  if (args.baseline && fs.existsSync(args.baseline)) {
    baseline = new Set(JSON.parse(fs.readFileSync(args.baseline, 'utf8')));
  }
  const currentKeys = new Set(failures.map(keyOf));
  const knownFailures = baseline ? failures.filter((f) => baseline.has(keyOf(f))) : [];
  const newFailures = baseline ? failures.filter((f) => !baseline.has(keyOf(f))) : failures;
  const staleBaseline = baseline ? [...baseline].filter((k) => !currentKeys.has(k)) : [];

  if (args.json) {
    console.log(JSON.stringify({ files: files.length, checked, symbolCount, lineCitations: lineCountCitations, newFailures, knownFailures, staleBaseline }, null, 2));
  } else {
    console.log(`docs-check: ${files.length} docs, ${checked} citations (${symbolCount} symbol, ${lineCountCitations} line)`);
    if (knownFailures.length) console.log(`  (${knownFailures.length} known pre-existing failure(s) in baseline — tolerated)`);
    if (staleBaseline.length) {
      console.log(`\n♻ ${staleBaseline.length} baseline entr(y/ies) now resolve — remove from baseline:`);
      for (const k of staleBaseline) console.log(`    ${k}`);
    }
    if (newFailures.length === 0) {
      console.log(baseline ? '✓ no new unresolved citations' : '✓ all citations resolve');
    } else {
      console.log(`\n✗ ${newFailures.length} NEW unresolved citation(s):\n`);
      for (const f of newFailures) console.log(`  ${f.doc}\n    ${f.raw}\n    → ${f.reason}\n`);
    }
  }
  process.exit(newFailures.length ? 1 : 0);
}

main();
