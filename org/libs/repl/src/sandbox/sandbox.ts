import vm from 'node:vm'
import React from 'react'
import type { ScopeEntry, LineResult } from '../session/types'
import { executeLine } from './executor'
import { extractDeclarations } from '../parser/ast-utils'

const BLOCKED_GLOBALS = [
  'process', 'require', 'module', 'exports', '__filename', '__dirname',
  'eval', 'Function',
]

export interface SandboxOptions {
  timeout?: number
  globals?: Record<string, unknown>
  /** Resource limits for the sandbox. */
  resourceLimits?: SandboxResourceLimits
}

export interface SandboxResourceLimits {
  /** Max total execution time in ms across all lines (default: 300_000 = 5 min). */
  maxTotalExecutionMs?: number
  /** Max number of lines that can be executed (default: 5000). */
  maxLines?: number
  /** Max number of declared variables (default: 500). */
  maxVariables?: number
}

export interface SandboxResourceUsage {
  totalExecutionMs: number
  linesExecuted: number
  variableCount: number
  limits: Required<SandboxResourceLimits>
}

/**
 * The REPL sandbox — manages a persistent vm.Context for line-by-line execution.
 */
export class Sandbox {
  private context: vm.Context
  private declaredNames = new Set<string>()
  private lineCount = 0
  private timeout: number
  private totalExecutionMs = 0
  private resourceLimits: Required<SandboxResourceLimits>

  constructor(options: SandboxOptions = {}) {
    this.timeout = options.timeout ?? 30_000
    this.resourceLimits = {
      maxTotalExecutionMs: options.resourceLimits?.maxTotalExecutionMs ?? 300_000,
      maxLines: options.resourceLimits?.maxLines ?? 5000,
      maxVariables: options.resourceLimits?.maxVariables ?? 500,
    }

    // Create context with safe globals
    const contextGlobals: Record<string, unknown> = {
      React,
      console,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      Promise,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Date,
      Math,
      JSON,
      Map,
      Set,
      WeakMap,
      WeakSet,
      RegExp,
      Error,
      TypeError,
      RangeError,
      SyntaxError,
      ReferenceError,
      Symbol,
      Uint8Array,
      Int32Array,
      Float64Array,
      ArrayBuffer,
      DataView,
      URL,
      URLSearchParams,
      TextEncoder,
      TextDecoder,
      structuredClone,
      atob: globalThis.atob,
      btoa: globalThis.btoa,
      ...options.globals,
    }

    this.context = vm.createContext(contextGlobals)

    // Block dangerous globals
    for (const name of BLOCKED_GLOBALS) {
      Object.defineProperty(this.context, name, {
        get() {
          throw new Error(`${name} is not available in the sandbox`)
        },
        configurable: false,
      })
    }
  }

  /**
   * Execute a line of TypeScript in the sandbox.
   */
  async execute(code: string): Promise<LineResult> {
    // Enforce resource limits
    if (this.lineCount >= this.resourceLimits.maxLines) {
      throw new Error(`Sandbox resource limit: max ${this.resourceLimits.maxLines} lines exceeded`)
    }
    if (this.totalExecutionMs >= this.resourceLimits.maxTotalExecutionMs) {
      throw new Error(`Sandbox resource limit: max ${this.resourceLimits.maxTotalExecutionMs}ms total execution time exceeded`)
    }

    this.lineCount++

    // Track declarations before execution
    const declarations = extractDeclarations(code)
    for (const name of declarations) {
      if (this.declaredNames.size >= this.resourceLimits.maxVariables && !this.declaredNames.has(name)) {
        throw new Error(`Sandbox resource limit: max ${this.resourceLimits.maxVariables} variables exceeded`)
      }
      this.declaredNames.add(name)
    }

    const startMs = Date.now()
    const result = await executeLine(code, this.lineCount, this.context, this.timeout)
    this.totalExecutionMs += Date.now() - startMs

    return result
  }

  /**
   * Inject a value into the sandbox's global scope.
   */
  inject(name: string, value: unknown): void {
    this.context[name] = value
  }

  /**
   * Get a value from the sandbox scope.
   */
  getValue(name: string): unknown {
    return this.context[name]
  }

  /**
   * Get all user-declared variable names.
   */
  getDeclaredNames(): string[] {
    return [...this.declaredNames]
  }

  /**
   * Get the current scope as ScopeEntry[].
   */
  getScope(): ScopeEntry[] {
    const entries: ScopeEntry[] = []
    for (const name of this.declaredNames) {
      try {
        const value = this.context[name]
        entries.push({
          name,
          type: describeType(value),
          value: truncateValue(value),
        })
      } catch {
        entries.push({ name, type: 'unknown', value: '<error reading>' })
      }
    }
    return entries
  }

  /**
   * Get the line count.
   */
  getLineCount(): number {
    return this.lineCount
  }

  /**
   * Get the raw vm.Context (for advanced use).
   */
  getContext(): vm.Context {
    return this.context
  }

  /**
   * Get current resource usage and limits.
   */
  getResourceUsage(): SandboxResourceUsage {
    return {
      totalExecutionMs: this.totalExecutionMs,
      linesExecuted: this.lineCount,
      variableCount: this.declaredNames.size,
      limits: { ...this.resourceLimits },
    }
  }

  /**
   * Snapshot all declared variable values (deep clone via structuredClone).
   */
  snapshotScope(): { values: Map<string, unknown>; declaredNames: Set<string> } {
    const values = new Map<string, unknown>()
    for (const name of this.declaredNames) {
      try {
        const val = this.context[name]
        // structuredClone handles most JS types; fall back to identity for non-cloneable
        values.set(name, typeof val === 'function' ? val : structuredClone(val))
      } catch {
        values.set(name, this.context[name])
      }
    }
    return { values, declaredNames: new Set(this.declaredNames) }
  }

  /**
   * Restore sandbox scope from a snapshot. Removes variables not in the snapshot,
   * restores values for those that are, and updates declaredNames.
   */
  restoreScope(snapshot: { values: Map<string, unknown>; declaredNames: Set<string> }): void {
    // Remove variables that didn't exist at checkpoint time
    for (const name of this.declaredNames) {
      if (!snapshot.declaredNames.has(name)) {
        try { this.context[name] = undefined } catch { /* ignore */ }
      }
    }
    // Restore checkpoint values
    for (const [name, value] of snapshot.values) {
      try { this.context[name] = value } catch { /* ignore */ }
    }
    this.declaredNames = new Set(snapshot.declaredNames)
  }

  /**
   * Destroy the sandbox.
   */
  destroy(): void {
    // vm.Context doesn't have an explicit destroy,
    // but we can null out the reference for GC
    this.declaredNames.clear()
  }
}

function describeType(val: unknown): string {
  if (val === null) return 'null'
  if (val === undefined) return 'undefined'
  if (Array.isArray(val)) {
    if (val.length === 0) return 'Array'
    const firstType = describeType(val[0])
    return `Array<${firstType}>`
  }
  const t = typeof val
  if (t === 'object') {
    const name = (val as object).constructor?.name
    return name && name !== 'Object' ? name : 'Object'
  }
  return t
}

function truncateValue(val: unknown, maxLen = 50): string {
  if (val === null) return 'null'
  if (val === undefined) return 'undefined'
  if (typeof val === 'function') return `[Function: ${val.name || 'anonymous'}]`
  if (typeof val === 'symbol') return val.toString()

  try {
    let str: string
    if (typeof val === 'string') {
      str = JSON.stringify(val)
    } else if (Array.isArray(val)) {
      const preview = val.slice(0, 3).map(v => truncateValue(v, 20)).join(', ')
      str = val.length > 3 ? `[${preview}, ... +${val.length - 3}]` : `[${preview}]`
    } else if (typeof val === 'object') {
      const keys = Object.keys(val as object)
      const preview = keys.slice(0, 5).join(', ')
      str = keys.length > 5 ? `{${preview}, ... +${keys.length - 5}}` : `{${preview}}`
    } else {
      str = String(val)
    }

    if (str.length > maxLen) {
      return str.slice(0, maxLen - 3) + '...'
    }
    return str
  } catch {
    return '[value]'
  }
}
