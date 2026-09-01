import path from 'node:path';
import { readdir } from 'node:fs/promises';
import ts from 'typescript';
import type { Extractor, JsonSchema, SpaceFn, Verdict } from '../format/types.ts';

interface Derived {
  schema: JsonSchema;
  degraded?: string;
}

/**
 * Builds schemas from source only.  The compiler program is deliberately never emitted or run:
 * it exists solely so aliases and sibling imports have the same meaning they have to TypeScript.
 */
export function createExtractor(spaceDir: string): Extractor {
  let programPromise: Promise<ts.Program> | undefined;

  async function program(): Promise<ts.Program> {
    programPromise ??= (async () => {
      const roots = await tsFiles(path.join(spaceDir, 'functions'));
      return ts.createProgram(roots, {
        target: ts.ScriptTarget.ES2023,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        strict: true,
        skipLibCheck: true,
      });
    })();
    return programPromise;
  }

  return {
    async extract(file: string, exportName: string): Promise<SpaceFn> {
      const sourceProgram = await program();
      const source = sourceProgram.getSourceFile(file);
      if (!source) throw new Error(`Cannot extract ${exportName}: ${file} is not in the space program`);
      const checker = sourceProgram.getTypeChecker();
      const moduleSymbol = checker.getSymbolAtLocation(source);
      const exported = moduleSymbol ? checker.getExportsOfModule(moduleSymbol) : [];
      const schemaExport = exported.find((symbol) => symbol.name === 'schema');
      const functionExport = exported.find((symbol) => symbol.name === exportName);
      if (!functionExport) throw new Error(`${file}: missing exported function "${exportName}"`);
      const declaration = functionExport.valueDeclaration ?? functionExport.declarations?.[0];
      if (!declaration || !ts.isFunctionLike(declaration)) {
        throw new Error(`${file}: export "${exportName}" must be a function with positional parameters`);
      }

      const description = clean(checker.symbolToString(functionExport) ? ts.displayPartsToString(functionExport.getDocumentationComment(checker)) : '');
      const order = declaration.parameters.map((parameter) => parameter.name.getText(source));
      if (schemaExport) {
        const explicit = explicitSchema(schemaExport, source);
        if (explicit) return { name: exportName, file, description, schema: explicit, order, verdict: { kind: 'explicit' } };
      }

      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      let verdict: Verdict = { kind: 'exact' };
      for (const parameter of declaration.parameters) {
        if (!ts.isIdentifier(parameter.name)) throw new Error(`${file}: destructured parameter exports are not supported`);
        const name = parameter.name.text;
        const type = checker.getTypeAtLocation(parameter);
        const derived = typeToSchema(type, checker, new Set<number>());
        const paramDoc = parameterDescription(declaration, name);
        const property = withDescription(derived.schema, paramDoc);
        if (derived.degraded) {
          property.description = joinDescription(property.description, `Schema degraded: ${derived.degraded}`);
          if (verdict.kind === 'exact') verdict = { kind: 'degraded', param: name, reason: derived.degraded };
        }
        properties[name] = property;
        if (!parameter.questionToken && !parameter.initializer && !typeIncludesUndefined(type)) required.push(name);
      }
      return {
        name: exportName,
        file,
        description,
        schema: { type: 'object', properties, ...(required.length ? { required } : {}) },
        order,
        verdict,
      };
    },
  };
}

async function tsFiles(dir: string): Promise<string[]> {
  let entries: import('node:fs').Dirent[];
  try { entries = await readdir(dir, { withFileTypes: true, encoding: 'utf8' }); } catch { return []; }
  const files = await Promise.all(entries.map(async (entry) => entry.isDirectory()
    ? tsFiles(path.join(dir, entry.name))
    : /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [path.join(dir, entry.name)] : []));
  return files.flat();
}

function explicitSchema(symbol: ts.Symbol, source: ts.SourceFile): JsonSchema | undefined {
  const declaration = symbol.valueDeclaration;
  if (!declaration || !ts.isVariableDeclaration(declaration) || !declaration.initializer) return undefined;
  const value = literalValue(declaration.initializer);
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonSchema : undefined;
}

/** Static object-literal reader; unlike importing it, this cannot execute author code. */
function literalValue(node: ts.Expression): unknown {
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) return literalValue(node.expression);
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return ts.isNumericLiteral(node) ? Number(node.text) : node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isArrayLiteralExpression(node)) {
    const values = node.elements.map((item) => ts.isSpreadElement(item) ? undefined : literalValue(item));
    return values.every((item) => item !== undefined) ? values : undefined;
  }
  if (ts.isObjectLiteralExpression(node)) {
    const result: Record<string, unknown> = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property) || ts.isComputedPropertyName(property.name)) return undefined;
      const key = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) || ts.isNumericLiteral(property.name)
        ? property.name.text : undefined;
      const value = literalValue(property.initializer);
      if (key === undefined || value === undefined) return undefined;
      result[key] = value;
    }
    return result;
  }
  return undefined;
}

function typeToSchema(type: ts.Type, checker: ts.TypeChecker, seen: Set<number>): Derived {
  if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return degraded('any or unknown cannot describe an input shape');
  if (type.flags & ts.TypeFlags.TypeParameter) return degraded('an unresolved generic type parameter cannot describe an input shape');
  if (type.flags & ts.TypeFlags.String) return { schema: { type: 'string' } };
  if (type.flags & (ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral)) return literalOrPrimitive(type, 'number');
  if (type.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral)) return literalOrPrimitive(type, 'boolean');
  if (type.flags & ts.TypeFlags.StringLiteral) return literalOrPrimitive(type, 'string');
  if (type.flags & ts.TypeFlags.Null) return { schema: { type: 'null' } };
  if (type.flags & ts.TypeFlags.Undefined) return { schema: { type: 'null' } };

  if (type.isUnion()) {
    const members = type.types.filter((member) => !(member.flags & ts.TypeFlags.Undefined));
    if (members.length === 1) return typeToSchema(members[0]!, checker, seen);
    const literals = members.map(literal);
    if (members.length && literals.every((value) => value !== undefined)) {
      return { schema: { enum: literals as (string | number | boolean | null)[] } };
    }
    const parts = members.map((member) => typeToSchema(member, checker, new Set(seen)));
    const issue = parts.find((part) => part.degraded)?.degraded;
    return { schema: { anyOf: parts.map((part) => part.schema) }, ...(issue ? { degraded: issue } : {}) };
  }

  if (checker.isArrayType(type) || checker.isTupleType(type)) {
    const argument = checker.getTypeArguments(type as ts.TypeReference)[0];
    if (!argument) return degraded('array element type could not be resolved', { type: 'array', items: {} });
    const item = typeToSchema(argument, checker, seen);
    return { schema: { type: 'array', items: item.schema }, ...(item.degraded ? { degraded: item.degraded } : {}) };
  }

  const id = (type as ts.Type & { id?: number }).id;
  if (id !== undefined && seen.has(id)) return degraded('recursive type cannot be represented as finite JSON Schema');
  const nested = new Set(seen);
  if (id !== undefined) nested.add(id);
  const stringIndex = type.getStringIndexType();
  if (stringIndex) {
    const value = typeToSchema(stringIndex, checker, nested);
    return { schema: { type: 'object', additionalProperties: value.schema }, ...(value.degraded ? { degraded: value.degraded } : {}) };
  }

  if (type.flags & ts.TypeFlags.Object) {
    const callSignatures = type.getCallSignatures();
    if (callSignatures.length) return degraded('function types are not JSON values');
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];
    let issue: string | undefined;
    for (const property of checker.getPropertiesOfType(type)) {
      const declaration = property.valueDeclaration ?? property.declarations?.[0];
      if (!declaration) continue;
      const value = typeToSchema(checker.getTypeOfSymbolAtLocation(property, declaration), checker, nested);
      properties[property.name] = withDescription(value.schema, clean(ts.displayPartsToString(property.getDocumentationComment(checker))));
      if (value.degraded) {
        issue ??= value.degraded;
        const existing = properties[property.name];
        if (existing) existing.description = joinDescription(existing.description, `Schema degraded: ${value.degraded}`);
      }
      if (!(property.flags & ts.SymbolFlags.Optional)) required.push(property.name);
    }
    return { schema: { type: 'object', properties, ...(required.length ? { required } : {}) }, ...(issue ? { degraded: issue } : {}) };
  }
  return degraded(`TypeScript type "${checker.typeToString(type)}" is not expressible as JSON Schema`);
}

function literalOrPrimitive(type: ts.Type, primitive: JsonSchema['type']): Derived {
  const value = literal(type);
  return value === undefined ? { schema: { type: primitive } } : { schema: { enum: [value] } };
}

function literal(type: ts.Type): string | number | boolean | null | undefined {
  if (type.flags & ts.TypeFlags.Null) return null;
  if (type.flags & ts.TypeFlags.StringLiteral) return (type as ts.StringLiteralType).value;
  if (type.flags & ts.TypeFlags.NumberLiteral) return (type as ts.NumberLiteralType).value;
  if (type.flags & ts.TypeFlags.BooleanLiteral) return (type as ts.Type & { intrinsicName: string }).intrinsicName === 'true';
  return undefined;
}

function typeIncludesUndefined(type: ts.Type): boolean {
  return type.isUnion() && type.types.some((member) => Boolean(member.flags & ts.TypeFlags.Undefined));
}
function degraded(reason: string, schema: JsonSchema = { type: 'object' }): Derived { return { schema, degraded: reason }; }
function clean(value: string): string { return value.replace(/\s+/g, ' ').trim(); }
function joinDescription(...values: (string | undefined)[]): string { return values.filter((value): value is string => Boolean(value)).join(' '); }
function withDescription(schema: JsonSchema, description: string): JsonSchema { return description ? { ...schema, description } : schema; }
function parameterDescription(declaration: ts.SignatureDeclarationBase, name: string): string {
  const tag = ts.getJSDocTags(declaration).find((candidate) => ts.isJSDocParameterTag(candidate) && candidate.name.getText() === name);
  return tag ? clean(typeof tag.comment === 'string' ? tag.comment : tag.comment?.map((part) => part.getText()).join('') ?? '') : '';
}
