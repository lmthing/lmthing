import { stat } from 'node:fs/promises';
import { build } from 'esbuild';
import type { SpaceFn } from '../format/types.ts';

export interface InvokeResult {
  ok: boolean;
  /** Always JSON-safe: undefined becomes null and exceptional JS values are tagged. */
  value: unknown;
  error?: string;
}

interface CachedModule { mtimeMs: number; module: Record<string, unknown>; }
const modules = new Map<string, CachedModule>();

/** Compile and invoke one normal ESM space-function module. No host globals are supplied. */
export async function invokeFn(fn: SpaceFn, args: Record<string, unknown>): Promise<InvokeResult> {
  try {
    const module = await loadModule(fn.file);
    const callable = module[fn.name];
    if (typeof callable !== 'function') throw new Error(`${fn.file}: export "${fn.name}" is not a function`);
    const result = await callable(...fn.order.map((name) => args[name]));
    return { ok: true, value: jsonValue(result) };
  } catch (error) {
    return { ok: false, value: null, error: errorMessage(error) };
  }
}

async function loadModule(file: string): Promise<Record<string, unknown>> {
  const mtimeMs = (await stat(file)).mtimeMs;
  const cached = modules.get(file);
  if (cached && cached.mtimeMs === mtimeMs) return cached.module;
  const output = await build({
    entryPoints: [file],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    sourcemap: false,
  });
  const text = output.outputFiles[0]?.text;
  if (!text) throw new Error(`${file}: esbuild produced no module`);
  // A distinct data URL is also Node's module-cache key, so replacing a changed source reloads it.
  const url = `data:text/javascript;base64,${Buffer.from(`${text}\n// ${mtimeMs}`).toString('base64')}`;
  const module = await import(url) as Record<string, unknown>;
  modules.set(file, { mtimeMs, module });
  return module;
}

/**
 * JSON has no undefined, bigint, -0, non-finite number, or cycles.  Preserve each exceptional
 * value explicitly rather than letting JSON.stringify throw or silently turn it into something else.
 */
function jsonValue(value: unknown, ancestors = new Map<object, string>(), at = '$'): unknown {
  if (value === undefined) return null;
  if (typeof value === 'bigint') return { $type: 'bigint', value: value.toString() };
  if (typeof value === 'number') {
    if (Object.is(value, -0)) return { $type: 'number', value: '-0' };
    if (!Number.isFinite(value)) return { $type: 'number', value: String(value) };
    return value;
  }
  if (typeof value === 'string' || typeof value === 'boolean' || value === null) return value;
  if (typeof value === 'function' || typeof value === 'symbol') return { $type: typeof value, value: String(value) };
  if (value instanceof Date) return value.toJSON();
  if (typeof value === 'object') {
    const prior = ancestors.get(value);
    if (prior) return { $type: 'circular', path: prior };
    ancestors.set(value, at);
    let result: unknown;
    if (Array.isArray(value)) result = value.map((item, index) => jsonValue(item, ancestors, `${at}[${index}]`));
    else {
      const record: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value)) record[key] = jsonValue(item, ancestors, `${at}.${key}`);
      result = record;
    }
    ancestors.delete(value);
    return result;
  }
  return String(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : typeof error === 'string' ? error : String(error);
}
