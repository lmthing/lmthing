import { describe, it, expect } from 'vitest'
import type { ReplSession, SessionEvent, SessionSnapshot, ScopeEntry, SerializedJSX } from './interface'

describe('rpc/interface', () => {
  it('ReplSession interface can be implemented', () => {
    const mock: ReplSession = {
      sendMessage: async () => {},
      submitForm: async () => {},
      cancelAsk: async () => {},
      cancelTask: async () => {},
      pause: async () => {},
      resume: async () => {},
      intervene: async () => {},
      getSnapshot: async () => ({
        status: 'idle',
        blocks: [],
        scope: [],
        asyncTasks: [],
        activeFormId: null,
      }),
      subscribe: async function* () {},
    }
    expect(mock).toBeDefined()
    expect(typeof mock.sendMessage).toBe('function')
  })

  it('SessionEvent type covers all event types', () => {
    const events: SessionEvent[] = [
      { type: 'code', lines: '', blockId: '' },
      { type: 'status', status: 'executing' },
      { type: 'scope', entries: [] },
    ]
    expect(events).toHaveLength(3)
  })

  it('SessionSnapshot has all fields', () => {
    const snap: SessionSnapshot = {
      status: 'idle',
      blocks: [],
      scope: [],
      asyncTasks: [],
      activeFormId: null,
    }
    expect(snap.status).toBe('idle')
  })

  it('ScopeEntry has expected shape', () => {
    const entry: ScopeEntry = { name: 'x', type: 'number', value: '42' }
    expect(entry.name).toBe('x')
  })

  it('SerializedJSX has expected shape', () => {
    const jsx: SerializedJSX = {
      component: 'div',
      props: {},
      children: [{ component: 'span', props: { children: 'hi' } }],
    }
    expect(jsx.component).toBe('div')
  })
})
