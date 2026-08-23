/**
 * Ported verbatim (semantics unchanged) from
 * sdk/org/libs/core/src/tasklist/condition-dsl.ts. Small, dependency-free
 * hand-rolled parser — no raw JS eval. Grammar:
 *
 *   expr     = clause (WS* ("AND"|"OR") WS* clause)*
 *   clause   = path WS+ op WS+ literal
 *   path     = identifier ("." identifier)*
 *   op       = "==" | "!=" | ">" | "<" | ">=" | "<="
 *   literal  = string | number | "true" | "false" | "null"
 */

function getAtPath(obj, path) {
  let current = obj
  for (const key of path) {
    if (current === null || current === undefined) return undefined
    if (typeof current === 'object' && !Array.isArray(current)) {
      current = current[key]
    } else {
      return undefined
    }
  }
  return current
}

function parseLiteral(s) {
  const t = s.trim()
  if (t === 'true') return true
  if (t === 'false') return false
  if (t === 'null') return null

  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1)
  }

  const n = Number(t)
  if (!isNaN(n) && t !== '') return n

  return t
}

function isNullish(v) {
  return v === null || v === undefined
}

function compareValues(left, op, right) {
  switch (op) {
    case '==':
      if (isNullish(left) && isNullish(right)) return true
      return left === right
    case '!=':
      if (isNullish(left) && isNullish(right)) return false
      return left !== right
    case '>':
      return left > right
    case '<':
      return left < right
    case '>=':
      return left >= right
    case '<=':
      return left <= right
    default:
      return false
  }
}

const OPS = ['>=', '<=', '==', '!=', '>', '<']

function parseClause(s) {
  for (const op of OPS) {
    const idx = s.indexOf(op)
    if (idx === -1) continue

    const pathStr = s.slice(0, idx).trim()
    const literalStr = s.slice(idx + op.length).trim()

    if (!pathStr || !literalStr) continue

    const path = pathStr.split('.')
    return { path, op, literal: parseLiteral(literalStr) }
  }

  throw new Error(`Cannot parse condition clause: "${s}"`)
}

function tokenize(expr) {
  const tokens = []
  const parts = expr.split(/\b(AND|OR)\b/i)

  for (const rawPart of parts) {
    const part = rawPart.trim()
    if (part.toUpperCase() === 'AND') {
      tokens.push({ type: 'and' })
    } else if (part.toUpperCase() === 'OR') {
      tokens.push({ type: 'or' })
    } else if (part) {
      tokens.push({ type: 'clause', clause: parseClause(part) })
    }
  }

  return tokens
}

/**
 * @param {string} expr
 * @param {Record<string, unknown>} outputs
 * @returns {boolean}
 */
export function evaluateCondition(expr, outputs) {
  const tokens = tokenize(expr)
  if (tokens.length === 0) return true

  let result = null
  let pendingOp = null

  for (const token of tokens) {
    if (token.type === 'and' || token.type === 'or') {
      pendingOp = token.type
      continue
    }

    const { clause } = token
    const left = getAtPath(outputs, clause.path)
    const clauseResult = compareValues(left, clause.op, clause.literal)

    if (result === null) {
      result = clauseResult
    } else if (pendingOp === 'and') {
      result = result && clauseResult
    } else if (pendingOp === 'or') {
      result = result || clauseResult
    }

    pendingOp = null
  }

  return result ?? true
}

/**
 * Top-level identifiers a condition/forEach expression references (before the
 * first "."), used by compile.js to verify every reference names a task
 * already available (a `dependsOn` entry) at compile time — see compile.js's
 * doc comment for why this is a stricter, compile-time-checked requirement
 * than LMThing's own runtime evaluation.
 * @param {string} expr
 * @returns {string[]}
 */
export function referencedTaskIds(expr) {
  const ids = new Set()
  const parts = expr.split(/\b(AND|OR)\b/i)
  for (const rawPart of parts) {
    const part = rawPart.trim()
    if (!part || part.toUpperCase() === 'AND' || part.toUpperCase() === 'OR') continue
    const clause = parseClause(part)
    ids.add(clause.path[0])
  }
  return [...ids]
}
