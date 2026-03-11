import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Avatar, AvatarFallback } from './index'

describe('Avatar', () => {
  it('renders a fallback', () => {
    render(
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    )
    expect(screen.getByText('AB')).toBeInTheDocument()
  })

  it('applies avatar class', () => {
    render(
      <Avatar data-testid="avatar">
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    )
    expect(screen.getByTestId('avatar')).toHaveClass('avatar')
  })

  it('applies avatar--sm for sm size', () => {
    render(
      <Avatar data-testid="avatar" size="sm">
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    )
    expect(screen.getByTestId('avatar')).toHaveClass('avatar--sm')
  })

  it('applies avatar--lg for lg size', () => {
    render(
      <Avatar data-testid="avatar" size="lg">
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    )
    expect(screen.getByTestId('avatar')).toHaveClass('avatar--lg')
  })
})
