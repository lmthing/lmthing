import { describe, it, expect } from 'vitest'
import { connectToRepl } from './client'

describe('rpc/client', () => {
  it('throws when capnweb is not available', () => {
    expect(() => connectToRepl()).toThrow('connectToRepl requires capnweb')
  })

  it('accepts custom URL', () => {
    expect(() => connectToRepl('ws://custom:4000')).toThrow('ws://custom:4000')
  })
})
