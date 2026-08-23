import ts from 'typescript'

/**
 * Best-effort STATIC extraction of a space component's prop types, using the
 * same parse-never-execute technique as `space-tasklist`'s
 * `extractCodeNodeMeta` (`ts.createSourceFile`, walk statements; the source is
 * never imported or evaluated — it is browser-targeted TSX with JSX and React
 * imports that would not run under Node anyway).
 *
 * ## Fail-SOFT, deliberately — this is the opposite policy to space-tasklist
 *
 * `space-tasklist`'s compiler REFUSES to compile when it meets a field it
 * cannot honor (`capabilities`, `canDelegateTo`, `onFail`, ...), because
 * silently dropping one of those would hand a node privileges or a failure
 * path its author did not ask for — a correctness/privilege boundary.
 *
 * Nothing here is a boundary. A prop type this extractor fails to recognize
 * costs only precision: the `display` tool still works, the model still passes
 * whatever props it likes through the tool's open `props: json` parameter, and
 * the only loss is a slightly less-guided schema and a slightly less useful
 * authoring warning. So this module NEVER throws and never aborts on a
 * surprise:
 *
 *  - one unrecognized/untyped property  -> that property alone is dropped,
 *    the rest of the component still extracts;
 *  - a shape it cannot read at all (default-only export, `React.memo(...)`,
 *    a re-export from another module, a named interface reference instead of
 *    an inline object type, more or fewer than one parameter, a syntax error)
 *    -> `null` for the whole component, meaning "fall back to the open
 *    `props: json` parameter for this one".
 *
 * Do not "fix" this into a fail-loud check by analogy with the tasklist
 * compiler. See dsh/packages/README.md.
 *
 * ## Known, deliberate v1 limitations
 *
 *  - Only an INLINE object type literal is read:
 *    `({ title }: { title: string })`. A parameter typed by a named
 *    interface/type alias (`(props: ArticlePreviewProps)`) returns `null`,
 *    even when that alias is declared in the very same file. Resolving local
 *    aliases is a real but deferrable enhancement.
 *  - Recognized property types are exactly `string`, `number`, `boolean`, and
 *    the array forms `string[]`/`number[]`/`boolean[]`. Unions, generics
 *    (including `Array<string>`), nested object literals, `any`, and an
 *    un-annotated property are dropped individually.
 */

/** Keyword type nodes this extractor understands, mapped to a dsh scalar ValueSchemaSpec type. */
const SCALAR_BY_KIND = new Map([
  [ts.SyntaxKind.StringKeyword, 'string'],
  [ts.SyntaxKind.NumberKeyword, 'number'],
  [ts.SyntaxKind.BooleanKeyword, 'boolean'],
])

function hasModifier(node, kind) {
  return (node.modifiers ?? []).some((m) => m.kind === kind)
}

/**
 * Map one TS type node to a dsh `ValueSchemaSpec`, or `undefined` when this
 * extractor does not recognize it (caller drops the property).
 * @param {ts.TypeNode | undefined} typeNode
 */
function typeNodeToValueSchema(typeNode) {
  if (!typeNode) return undefined

  const scalar = SCALAR_BY_KIND.get(typeNode.kind)
  if (scalar) return { type: scalar }

  if (ts.isArrayTypeNode(typeNode)) {
    const itemScalar = SCALAR_BY_KIND.get(typeNode.elementType.kind)
    if (itemScalar) return { type: 'array', items: { type: itemScalar } }
    return undefined
  }

  return undefined
}

/**
 * Locate the single parameter list of the component declaration named
 * `componentName`, or `null` when the declaration is not in a shape this
 * extractor reads. Never throws.
 * @param {ts.SourceFile} sf
 * @param {string} componentName
 * @returns {ts.NodeArray<ts.ParameterDeclaration> | null}
 */
function findComponentParameters(sf, componentName) {
  /**
   * Names exported from a LOCAL declaration: `export { Name }`. A re-export
   * from another module (`export { Name } from './x'`) is deliberately NOT
   * collected — there is no local declaration to read, so `found` stays null
   * and the whole extraction falls back to the open `props: json`.
   */
  const localExports = new Set()

  for (const stmt of sf.statements) {
    if (!ts.isExportDeclaration(stmt) || !stmt.exportClause) continue
    if (!ts.isNamedExports(stmt.exportClause)) continue
    if (stmt.moduleSpecifier) continue
    for (const spec of stmt.exportClause.elements) {
      localExports.add(spec.name.text)
    }
  }

  let found = null // { parameters, exported, isDefault }

  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name?.text === componentName) {
      found = {
        parameters: stmt.parameters,
        exported: hasModifier(stmt, ts.SyntaxKind.ExportKeyword),
        isDefault: hasModifier(stmt, ts.SyntaxKind.DefaultKeyword),
      }
      continue
    }
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || decl.name.text !== componentName) continue
        const init = decl.initializer
        // `const Name = React.memo(...)` / any other call or expression is not
        // a shape whose parameter list is statically readable -> stays null.
        if (!init || !(ts.isArrowFunction(init) || ts.isFunctionExpression(init))) continue
        found = {
          parameters: init.parameters,
          exported: hasModifier(stmt, ts.SyntaxKind.ExportKeyword),
          isDefault: false,
        }
      }
    }
  }

  if (!found) return null
  // A default export carries no stable name for the model's `component` enum to
  // agree with, so the plan treats it as out of scope for v1.
  if (found.isDefault) return null
  if (!found.exported && !localExports.has(componentName)) return null
  return found.parameters
}

/**
 * Extract a dsh `ParameterSchemaSpec` for one component's props.
 *
 * @param {string} source        the component file's raw text
 * @param {string} componentName the exported component name (== the file basename)
 * @returns {Record<string, object> | null} a ParameterSchemaSpec-shaped map, or
 *   `null` when nothing useful could be extracted (caller falls back to an open
 *   `props: json`). Never throws.
 */
export function extractPropsSchema(source, componentName) {
  try {
    const sf = ts.createSourceFile(
      `${componentName}.tsx`,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    )

    const parameters = findComponentParameters(sf, componentName)
    if (!parameters || parameters.length !== 1) return null

    const typeNode = parameters[0].type
    // Only an INLINE object type literal, per the limitation above. A
    // TypeReference (named interface/alias) deliberately falls back to null.
    if (!typeNode || !ts.isTypeLiteralNode(typeNode)) return null

    /** @type {Record<string, object>} */
    const schema = {}
    for (const member of typeNode.members) {
      if (!ts.isPropertySignature(member)) continue
      const nameNode = member.name
      if (!nameNode || !(ts.isIdentifier(nameNode) || ts.isStringLiteralLike(nameNode))) continue

      const value = typeNodeToValueSchema(member.type)
      if (!value) continue // unrecognized/untyped prop -> drop this one only

      schema[nameNode.text] = member.questionToken ? value : { ...value, required: true }
    }

    // Nothing recognized -> behave exactly like "no schema at all" rather than
    // handing the caller an empty map that validates everything vacuously.
    if (Object.keys(schema).length === 0) return null
    return schema
  } catch {
    // Fail-soft by contract (see the module doc comment): an unparseable file
    // degrades to the open `props: json` parameter, never to a mount failure.
    return null
  }
}
