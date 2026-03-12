import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { FieldCard } from './index'

describe('FieldCard', () => {
  it('should be defined', async () => {
    const mod = await import('./index')
    expect(mod).toBeDefined()
    expect(mod.FieldCard).toBeDefined()
  })

  it('renders the field path', () => {
    render(<FieldCard id="f1" path="knowledge/science" />)
    expect(screen.getByText('knowledge/science')).toBeDefined()
  })
})
