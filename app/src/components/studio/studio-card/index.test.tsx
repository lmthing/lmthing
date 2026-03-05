import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StudioCard } from './index'

describe('StudioCard', () => {
  it('should be defined', async () => {
    const mod = await import('./index')
    expect(mod).toBeDefined()
    expect(mod.StudioCard).toBeDefined()
  })

  it('renders the studio name', () => {
    render(<StudioCard id="s1" name="My Studio" />)
    expect(screen.getByText('My Studio')).toBeDefined()
  })

  it('renders description when provided', () => {
    render(<StudioCard id="s1" name="My Studio" description="A test studio" />)
    expect(screen.getByText('A test studio')).toBeDefined()
  })
})
