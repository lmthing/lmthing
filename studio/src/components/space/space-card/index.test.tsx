import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SpaceCard } from './index'

describe('SpaceCard', () => {
  it('should be defined', async () => {
    const mod = await import('./index')
    expect(mod).toBeDefined()
    expect(mod.SpaceCard).toBeDefined()
  })

  it('renders the space name', () => {
    render(<SpaceCard id="sp1" name="My Space" />)
    expect(screen.getByText('My Space')).toBeDefined()
  })
})
