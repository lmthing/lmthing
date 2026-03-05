import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Sidebar, SidebarItem } from './index'

describe('Sidebar', () => {
  it('renders a nav element', () => {
    render(<Sidebar>Content</Sidebar>)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('applies sidebar class', () => {
    render(<Sidebar>Content</Sidebar>)
    expect(screen.getByRole('navigation')).toHaveClass('sidebar')
  })

  it('applies sidebar--collapsed when collapsed is true', () => {
    render(<Sidebar collapsed>Content</Sidebar>)
    expect(screen.getByRole('navigation')).toHaveClass('sidebar--collapsed')
  })
})

describe('SidebarItem', () => {
  it('renders children', () => {
    render(<SidebarItem>Home</SidebarItem>)
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('applies sidebar__item class', () => {
    render(<SidebarItem data-testid="item">Home</SidebarItem>)
    expect(screen.getByTestId('item')).toHaveClass('sidebar__item')
  })

  it('applies sidebar__item--active when active is true', () => {
    render(<SidebarItem data-testid="item" active>Home</SidebarItem>)
    expect(screen.getByTestId('item')).toHaveClass('sidebar__item--active')
  })
})
