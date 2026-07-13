// Symbol scanner for org/docs citation anchors.
//
// Given a TS/TSX/JS source file, returns every *named, referenceable* declaration
// with its 1-indexed [startLine, endLine] range and a dotted qualified name
// (e.g. `Session.resume`, `TurnLoopDeps.streamFn`). Uses the TypeScript compiler
// API so ranges are exact — no regex heuristics.
//
// The scanner is the shared brain of both tools:
//   - migrate.mjs  turns `path:Lstart-Lend` into `path#QualifiedName` by finding the
//                  innermost symbol whose range fits the cited lines.
//   - check.mjs    resolves `path#QualifiedName` back to a real symbol (the CI gate).
//
// Kept deliberately dependency-light: only `typescript`.

import ts from 'typescript';

/** @typedef {{ name: string, qualifiedName: string, kind: string, startLine: number, endLine: number, containerLen: number }} Sym */

const SCANNABLE = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);

/** Is this file extension one the scanner understands? */
export function isScannable(ext) {
  return SCANNABLE.has(ext.toLowerCase());
}

function scriptKindFor(ext) {
  switch (ext.toLowerCase()) {
    case '.tsx':
    case '.jsx':
      return ts.ScriptKind.TSX;
    case '.js':
    case '.mjs':
    case '.cjs':
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.TS;
  }
}

/** Extract a declaration name from a node, or null if it has no stable name. */
function nameOf(node) {
  // Named declarations
  if (
    ts.isFunctionDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isModuleDeclaration(node)
  ) {
    return node.name && ts.isIdentifier(node.name) ? node.name.text : null;
  }
  // Class / interface / type-literal members
  if (
    ts.isMethodDeclaration(node) ||
    ts.isMethodSignature(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isPropertySignature(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isEnumMember(node)
  ) {
    const n = node.name;
    if (n && ts.isIdentifier(n)) return n.text;
    if (n && ts.isStringLiteral(n)) return n.text;
    return null;
  }
  if (ts.isConstructorDeclaration(node)) return 'constructor';
  return null;
}

// Container kinds contribute a segment to the qualified name of their members.
function isContainer(node) {
  return (
    ts.isClassDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isModuleDeclaration(node)
  );
}

function kindLabel(node) {
  if (ts.isFunctionDeclaration(node)) return 'function';
  if (ts.isClassDeclaration(node)) return 'class';
  if (ts.isInterfaceDeclaration(node)) return 'interface';
  if (ts.isTypeAliasDeclaration(node)) return 'type';
  if (ts.isEnumDeclaration(node)) return 'enum';
  if (ts.isModuleDeclaration(node)) return 'namespace';
  if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) return 'method';
  if (ts.isGetAccessorDeclaration(node)) return 'getter';
  if (ts.isSetAccessorDeclaration(node)) return 'setter';
  if (ts.isConstructorDeclaration(node)) return 'constructor';
  if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) return 'property';
  if (ts.isEnumMember(node)) return 'enum-member';
  if (ts.isVariableDeclaration(node)) return 'variable';
  return 'symbol';
}

/**
 * Scan a source string.
 * @param {string} source
 * @param {string} ext  file extension incl. dot, e.g. ".ts"
 * @returns {Sym[]}
 */
export function scanSymbols(source, ext = '.ts') {
  const sf = ts.createSourceFile('f' + ext, source, ts.ScriptTarget.Latest, /*setParentNodes*/ true, scriptKindFor(ext));
  /** @type {Sym[]} */
  const out = [];
  const totalLines = sf.getLineAndCharacterOfPosition(source.length).line + 1;

  const lineOf = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;

  const record = (node, name, prefix, startNode) => {
    const start = lineOf((startNode || node).getStart(sf));
    const end = lineOf(node.getEnd());
    const qualifiedName = prefix ? `${prefix}.${name}` : name;
    out.push({ name, qualifiedName, kind: kindLabel(node), startLine: start, endLine: end, containerLen: end - start + 1 });
    return qualifiedName;
  };

  // Collect only *referenceable* declarations: module-level names and the members of
  // containers (class/interface/enum/namespace). We deliberately do NOT descend into
  // executable bodies (function/method/arrow) — locals there are not stable anchors and
  // would let a citation resolve to a throwaway variable.
  const walk = (scope, prefix) => {
    ts.forEachChild(scope, (node) => {
      // `const x = …`, `let y = …` — record each declared name over the whole statement.
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (decl.name && ts.isIdentifier(decl.name)) {
            record(decl, decl.name.text, prefix, node); // start at the statement, end at the declarator
          }
        }
        return; // do not descend into initializers
      }

      const name = nameOf(node);
      if (!name) return; // unnamed statement (expression, export assignment, heritage…) — skip

      const qn = record(node, name, prefix);

      if (isContainer(node)) {
        if (ts.isModuleDeclaration(node)) {
          // namespace / module: recurse through its block with the qualified prefix
          if (node.body) walk(node.body, qn);
        } else {
          // class / interface / enum: recurse one level to capture members only
          walk(node, qn);
        }
      }
      // functions, methods, variables: recorded, but never descended into
    });
  };

  walk(sf, '');

  return out.map((s) => ({ ...s, fileLines: totalLines }));
}

/**
 * Find the innermost named symbol whose range fully contains [lstart, lend].
 * Returns null if none. Ties broken by the smallest (tightest) range.
 * @param {Sym[]} syms
 */
export function innermostEnclosing(syms, lstart, lend) {
  let best = null;
  for (const s of syms) {
    if (s.startLine <= lstart && s.endLine >= lend) {
      if (!best || s.containerLen < best.containerLen) best = s;
    }
  }
  return best;
}

/**
 * Resolve a symbol anchor against a scanned file.
 * Accepts an exact qualified-name match first, then a bare-name match.
 * Returns { sym, ambiguous } or null.
 * @param {Sym[]} syms
 * @param {string} anchor  e.g. "Session.resume" or "runTurnLoop"
 */
export function resolveAnchor(syms, anchor) {
  const qual = syms.filter((s) => s.qualifiedName === anchor);
  if (qual.length) return { sym: qual[0], ambiguous: qual.length > 1, matches: qual };
  const bare = syms.filter((s) => s.name === anchor);
  if (bare.length) return { sym: bare[0], ambiguous: bare.length > 1, matches: bare };
  return null;
}
