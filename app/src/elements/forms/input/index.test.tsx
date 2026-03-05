import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Input } from './index'

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  it('applies input class', () => {
    render(<Input data-testid="input" />)
    expect(screen.getByTestId('input')).toHaveClass('input')
  })

  it('applies input--error class when error is true', () => {
    render(<Input data-testid="input" error />)
    expect(screen.getByTestId('input')).toHaveClass('input--error')
  })

  it('forwards value and onChange', () => {
    render(<Input data-testid="input" defaultValue="hello" />)
    expect(screen.getByTestId('input')).toHaveValue('hello')
  })

  it('forwards disabled prop', () => {
    render(<Input data-testid="input" disabled />)
    expect(screen.getByTestId('input')).toBeDisabled()
  })
})
