import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SubjectItem } from './index'

describe('SubjectItem', () => {
  it('should be defined', async () => {
    const mod = await import('./index')
    expect(mod).toBeDefined()
    expect(mod.SubjectItem).toBeDefined()
  })

  it('renders subject name and path', () => {
    render(<SubjectItem id="sub1" name="Physics" path="knowledge/science/physics" />)
    expect(screen.getByText('Physics')).toBeDefined()
    expect(screen.getByText('knowledge/science/physics')).toBeDefined()
  })
})
