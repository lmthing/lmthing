import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TabBar } from './index'

const tabs = [
  { id: 'tab1', label: 'Tab 1' },
  { id: 'tab2', label: 'Tab 2' },
]

describe('TabBar', () => {
  it('renders all tabs', () => {
    render(<TabBar tabs={tabs} />)
    expect(screen.getByRole('tab', { name: 'Tab 1' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Tab 2' })).toBeInTheDocument()
  })

  it('applies tab-bar class to container', () => {
    render(<TabBar tabs={tabs} data-testid="tabbar" />)
    expect(screen.getByTestId('tabbar')).toHaveClass('tab-bar')
  })

  it('marks active tab with tab-bar__tab--active', () => {
    render(<TabBar tabs={tabs} activeTab="tab1" />)
    expect(screen.getByRole('tab', { name: 'Tab 1' })).toHaveClass('tab-bar__tab--active')
    expect(screen.getByRole('tab', { name: 'Tab 2' })).not.toHaveClass('tab-bar__tab--active')
  })

  it('calls onTabChange when a tab is clicked', async () => {
    const onTabChange = vi.fn()
    render(<TabBar tabs={tabs} onTabChange={onTabChange} />)
    await userEvent.click(screen.getByRole('tab', { name: 'Tab 2' }))
    expect(onTabChange).toHaveBeenCalledWith('tab2')
  })
})
