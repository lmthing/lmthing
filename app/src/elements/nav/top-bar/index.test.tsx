import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TopBar } from './index'

describe('TopBar', () => {
  it('renders a header element', () => {
    render(<TopBar />)
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })

  it('applies top-bar class', () => {
    render(<TopBar data-testid="topbar" />)
    expect(screen.getByTestId('topbar')).toHaveClass('top-bar')
  })

  it('renders title when provided', () => {
    render(<TopBar title="My Studio" />)
    expect(screen.getByText('My Studio')).toHaveClass('top-bar__title')
  })

  it('renders actions when provided', () => {
    render(<TopBar actions={<button>Save</button>} />)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('renders children', () => {
    render(<TopBar><span>Extra</span></TopBar>)
    expect(screen.getByText('Extra')).toBeInTheDocument()
  })
})
