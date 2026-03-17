import { describe, it, expect } from 'vitest'
import * as repl from './index'

describe('index (barrel export)', () => {
  it('exports Session', () => {
    expect(repl.Session).toBeDefined()
  })

  it('exports config utilities', () => {
    expect(repl.createDefaultConfig).toBeDefined()
    expect(repl.validateConfig).toBeDefined()
    expect(repl.mergeConfig).toBeDefined()
  })

  it('exports Sandbox', () => {
    expect(repl.Sandbox).toBeDefined()
  })

  it('exports StreamController', () => {
    expect(repl.StreamController).toBeDefined()
  })

  it('exports parser utilities', () => {
    expect(repl.isCompleteStatement).toBeDefined()
    expect(repl.detectGlobalCall).toBeDefined()
    expect(repl.parseStatement).toBeDefined()
    expect(repl.extractDeclarations).toBeDefined()
    expect(repl.recoverArgumentNames).toBeDefined()
  })

  it('exports context utilities', () => {
    expect(repl.generateScopeTable).toBeDefined()
    expect(repl.compressCodeWindow).toBeDefined()
    expect(repl.getDecayLevel).toBeDefined()
    expect(repl.buildSystemPrompt).toBeDefined()
    expect(repl.buildStopMessage).toBeDefined()
  })

  it('exports hook system', () => {
    expect(repl.HookRegistry).toBeDefined()
    expect(repl.matchPattern).toBeDefined()
    expect(repl.executeHooks).toBeDefined()
  })

  it('exports security utilities', () => {
    expect(repl.wrapFunction).toBeDefined()
    expect(repl.FunctionRegistry).toBeDefined()
    expect(repl.sanitizeJSX).toBeDefined()
    expect(repl.isJSXSafe).toBeDefined()
  })

  it('exports catalog system', () => {
    expect(repl.loadCatalog).toBeDefined()
    expect(repl.mergeCatalogs).toBeDefined()
    expect(repl.formatCatalogForPrompt).toBeDefined()
  })

  it('exports RPC', () => {
    expect(repl.ReplSessionServer).toBeDefined()
    expect(repl.connectToRepl).toBeDefined()
  })

  it('exports tasklist reminder message builder', () => {
    expect(repl.buildTasklistReminderMessage).toBeDefined()
  })

  it('exports stream utilities', () => {
    expect(repl.serialize).toBeDefined()
    expect(repl.createLineAccumulator).toBeDefined()
    expect(repl.createBracketState).toBeDefined()
  })

  it('exports async and globals', () => {
    expect(repl.AsyncManager).toBeDefined()
    expect(repl.createGlobals).toBeDefined()
    expect(repl.transpile).toBeDefined()
  })
})
