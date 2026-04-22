import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ThingMessage } from './index'

describe('ThingMessage', () => {
  it('should be defined', async () => {
    const mod = await import('./index')
    expect(mod).toBeDefined()
    expect(mod.ThingMessage).toBeDefined()
  })

  it('renders user message', () => {
    render(<ThingMessage role="user" content="Hello world" />)
    expect(screen.getByText('Hello world')).toBeDefined()
    expect(screen.getByText('You')).toBeDefined()
  })

  it('renders agent message', () => {
    render(<ThingMessage role="assistant" content="Hi there" />)
    expect(screen.getByText('Hi there')).toBeDefined()
    expect(screen.getByText('Agent')).toBeDefined()
  })
})
