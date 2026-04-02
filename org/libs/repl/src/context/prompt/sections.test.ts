/**
 * Tests for Prompt Builder section functions
 */

import { describe, it, expect } from 'vitest'
import { buildRoleSection } from '../../context/prompt/sections/role'
import { buildGlobalsSection } from '../../context/prompt/sections/globals'
import { buildScopeSection } from '../../context/prompt/sections/scope'
import { buildComponentsSection } from '../../context/prompt/sections/components'
import { buildFunctionsSection } from '../../context/prompt/sections/functions'
import { buildAgentsSection } from '../../context/prompt/sections/agents'
import { buildKnowledgeSection } from '../../context/prompt/sections/knowledge'
import { buildRulesSection } from '../../context/prompt/sections/rules'
import { buildInstructSection } from '../../context/prompt/sections/instruct'
import { FocusController } from '../../context/prompt/focus'
import type { SystemPromptConfig } from '../../context/prompt/config'

// ── Role Section ──────────────────────────────────────────────────────────────

describe('buildRoleSection', () => {
  it('returns non-empty role content', () => {
    const result = buildRoleSection()
    expect(result).toContain('agent')
    expect(result).toContain('TypeScript code')
  })

  it('contains key instructions for agent behavior', () => {
    const result = buildRoleSection()
    expect(result).toContain('line-by-line')
    expect(result).toContain('sandbox')
  })
})

// ── Globals Section ────────────────────────────────────────────────────────────

describe('buildGlobalsSection', () => {
  it('returns globals with all documentation when expanded', () => {
    const focus = new FocusController(null)
    const result = buildGlobalsSection({}, focus)

    expect(result).toContain('stop(')
    expect(result).toContain('display(')
    expect(result).toContain('ask(')
    expect(result).toContain('tasklist(')
  })

  it('collapses when globals is NOT in focus', () => {
    const focus = new FocusController(new Set(['functions']))
    const result = buildGlobalsSection({}, focus)

    // When globals is not in focus, it should show collapsed
    expect(result).toContain('Global functions')
  })

  it('includes class signatures when provided', () => {
    const focus = new FocusController(null)
    const config = { classSignatures: 'Available Classes:\n  TestClass' }
    const result = buildGlobalsSection(config, focus)

    expect(result).toContain('TestClass')
  })
})

// ── Scope Section ──────────────────────────────────────────────────────────────

describe('buildScopeSection', () => {
  it('includes workspace scope when provided', () => {
    const scope = 'x = 1\ny = 2'
    const result = buildScopeSection(scope, undefined, undefined)

    expect(result).toContain('x = 1')
    expect(result).toContain('y = 2')
  })

  it('includes pinned memory when provided', () => {
    const pinned = 'userSchema: {...}'
    const result = buildScopeSection('', pinned, undefined)

    expect(result).toContain('Pinned Memory')
    expect(result).toContain('userSchema')
  })

  it('includes agent memos when provided', () => {
    const memo = 'key: value'
    const result = buildScopeSection('', undefined, memo)

    expect(result).toContain('Agent Memos')
    expect(result).toContain('key: value')
  })

  it('includes file block documentation', () => {
    const result = buildScopeSection('')
    expect(result).toContain('File Blocks')
    expect(result).toContain('four-backtick')
  })
})

// ── Components Section ───────────────────────────────────────────────────────

describe('buildComponentsSection', () => {
  it('includes form components when provided', () => {
    const formSigs = 'Select(options: ["a", "b"])'
    const result = buildComponentsSection(formSigs, undefined)

    expect(result).toContain('Select')
    expect(result).toContain('Form Components')
  })

  it('includes display components when provided', () => {
    const viewSigs = 'RecipeCard(name)'
    const result = buildComponentsSection(undefined, viewSigs)

    expect(result).toContain('RecipeCard')
    expect(result).toContain('Display Components')
  })

  it('shows collapsed when not in focus', () => {
    const focus = new FocusController(new Set(['functions']))
    const formSigs = 'Select'
    const result = buildComponentsSection(formSigs, undefined, focus)

    expect(result).toContain('focus')
    expect(result).toContain('components available')
  })
})

// ── Functions Section ───────────────────────────────────────────────────────

describe('buildFunctionsSection', () => {
  it('includes function signatures when provided', () => {
    const fnSigs = 'function test()'
    const result = buildFunctionsSection(fnSigs, undefined)

    expect(result).toContain('function test()')
  })

  it('includes class signatures when provided', () => {
    const classSigs = 'class User'
    const result = buildFunctionsSection(undefined, classSigs)

    expect(result).toContain('Available Classes')
    expect(result).toContain('class User')
  })

  it('collapses independently for functions vs classes', () => {
    const focus = new FocusController(new Set(['classes']))
    const result = buildFunctionsSection('fn()', 'class C', focus)

    expect(result).toContain('functions available')
    expect(result).toContain('class C')
  })
})

// ── Agents Section ─────────────────────────────────────────────────────────────

describe('buildAgentsSection', () => {
  it('returns empty when no agent content', () => {
    const result = buildAgentsSection(undefined, undefined)
    expect(result).toBe('')
  })

  it('includes agent tree when provided', () => {
    const agentTree = 'cooking:\n  recipe_advisor'
    const result = buildAgentsSection(agentTree, undefined)

    expect(result).toContain('cooking')
    expect(result).toContain('recipe_advisor')
  })

  it('includes knowledge namespace when provided', () => {
    const knowledgeNs = 'knowledge.writer()'
    const result = buildAgentsSection(undefined, knowledgeNs)

    expect(result).toContain('knowledge.writer')
  })

  it('collapses when not in focus', () => {
    const focus = new FocusController(new Set(['functions']))
    const agentTree = 'agent content'
    const result = buildAgentsSection(agentTree, undefined, focus)

    expect(result).toContain('collapsed')
  })
})

// ── Knowledge Section ────────────────────────────────────────────────────────

describe('buildKnowledgeSection', () => {
  it('returns empty when no knowledge tree', () => {
    const result = buildKnowledgeSection(undefined)
    expect(result).toBe('')
  })

  it('includes knowledge tree when provided', () => {
    const knowledgeTree = 'recipes:\n  italian'
    const result = buildKnowledgeSection(knowledgeTree)

    expect(result).toContain('recipes')
    expect(result).toContain('italian')
  })

  it('shows collapsed with domain count when not in focus', () => {
    const focus = new FocusController(new Set(['functions']))
    const knowledgeTree = 'domain1:\n  field1\ndomain2:\n  field2'
    const result = buildKnowledgeSection(knowledgeTree, focus)

    expect(result).toContain('knowledge domains available')
    expect(result).toContain('focus("knowledge")')
  })
})

// ── Rules Section ─────────────────────────────────────────────────────────────

describe('buildRulesSection', () => {
  it('includes all execution rules when expanded', () => {
    const focus = new FocusController(null)
    const result = buildRulesSection(focus)

    expect(result).toContain('<rules>')
    expect(result).toContain('</rules>')
    expect(result).toContain('Output ONLY valid TypeScript')
  })

  it('shows rule count when collapsed', () => {
    const focus = new FocusController(new Set(['functions']))
    const result = buildRulesSection(focus)

    expect(result).toContain('rules')
  })
})

// ── Instruct Section ────────────────────────────────────────────────────────

describe('buildInstructSection', () => {
  it('returns empty when no instructions', () => {
    const result = buildInstructSection(undefined)
    expect(result).toBe('')
  })

  it('includes instructions when provided', () => {
    const instruct = 'Custom agent instructions here.'
    const result = buildInstructSection(instruct)

    expect(result).toContain('Custom agent instructions')
    expect(result).toContain('<instructions>')
  })
})

// ── Focus Controller Integration ───────────────────────────────────────────

describe('FocusController', () => {
  it('expands all sections when no focus set', () => {
    const focus = new FocusController(null)

    expect(focus.isExpanded('globals')).toBe(true)
    expect(focus.isExpanded('functions')).toBe(true)
    expect(focus.isExpanded('knowledge')).toBe(true)
  })

  it('only expands focused sections', () => {
    const focus = new FocusController(new Set(['globals', 'functions']))

    expect(focus.isExpanded('globals')).toBe(true)
    expect(focus.isExpanded('functions')).toBe(true)
    expect(focus.isExpanded('knowledge')).toBe(false)
  })

  it('handles string-based section names', () => {
    const focus = new FocusController(new Set(['globals', 'invalid-name']))

    expect(focus.isExpanded('globals')).toBe(true)
    expect(focus.isExpanded('invalid-name')).toBe(false) // filtered out
  })
})

// ── SystemPromptConfig Integration ──────────────────────────────────────────

describe('SystemPromptConfig', () => {
  it('accepts all configuration options', () => {
    const config: SystemPromptConfig = {
      scope: 'x = 1',
      functionSignatures: 'function f()',
      formSignatures: 'Form',
      viewSignatures: 'View',
      classSignatures: 'Class',
      instruct: 'Instructions',
      knowledgeTree: 'Knowledge',
      agentTree: 'Agents',
      knowledgeNamespacePrompt: 'Knowledge NS',
      pinnedBlock: 'Pinned',
      memoBlock: 'Memo',
      focusSections: new Set(['globals']),
    }

    expect(config.scope).toBe('x = 1')
    expect(config.focusSections).toContain('globals')
  })
})
