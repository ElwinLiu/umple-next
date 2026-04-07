// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActionRow } from '../ActionRow'

afterEach(cleanup)

const icon = <span data-testid="icon">I</span>

describe('ActionRow', () => {
  it('shows no chevron when there are no children', () => {
    const { container } = render(
      <ActionRow icon={icon} label="Compiling" status="running" />,
    )
    expect(container.querySelector('svg.lucide-chevron-right')).toBeNull()
  })

  it('shows chevron and toggles content on click', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ActionRow icon={icon} label="Read code" status="done">
        <p>expanded content</p>
      </ActionRow>,
    )
    // Initially collapsed (status=done)
    expect(screen.queryByText('expanded content')).toBeNull()

    // Click the toggle button
    const btn = container.querySelector('button')!
    await user.click(btn)
    expect(screen.getByText('expanded content')).toBeDefined()

    // Click again to collapse
    await user.click(btn)
    expect(screen.queryByText('expanded content')).toBeNull()
  })

  it('auto-expands when status is approval', () => {
    render(
      <ActionRow icon={icon} label="Edit proposed" status="approval">
        <p>approval content</p>
      </ActionRow>,
    )
    expect(screen.getByText('approval content')).toBeDefined()
  })

  it('auto-expands when status is error', () => {
    render(
      <ActionRow icon={icon} label="Compile failed" status="error">
        <p>error details</p>
      </ActionRow>,
    )
    expect(screen.getByText('error details')).toBeDefined()
  })

  it('sets aria-expanded on the toggle button', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ActionRow icon={icon} label="Read code" status="done">
        <p>details</p>
      </ActionRow>,
    )
    const btn = container.querySelector('button')!
    expect(btn.getAttribute('aria-expanded')).toBe('false')

    await user.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })
})
