import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { stubMatchMedia } from '@/test/matchMedia'
import { NameField } from './NameField'

// HeroUI's fields can read window.matchMedia (absent in jsdom).
beforeEach(() => stubMatchMedia(1024))

const nameField = () => screen.getByRole('textbox', { name: 'Name' })

describe('NameField', () => {
  it('commits the trimmed draft exactly once when Enter blurs the field', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<NameField name="Ceiling" onCommit={onCommit} />)

    await user.clear(nameField())
    await user.type(nameField(), 'Lamps{Enter}')

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith('Lamps')
  })

  it('commits once when the field is left without Enter', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<NameField name="Ceiling" onCommit={onCommit} />)

    await user.clear(nameField())
    await user.type(nameField(), 'Lamps')
    await user.tab()

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith('Lamps')
  })

  it('does not commit when the value is unchanged', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<NameField name="Ceiling" onCommit={onCommit} />)

    await user.tab()
    await user.tab()

    expect(onCommit).not.toHaveBeenCalled()
  })

  it('cancels the edit on Escape without committing, and shows the bus value again', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<NameField name="Ceiling" onCommit={onCommit} />)

    await user.clear(nameField())
    await user.type(nameField(), 'Lamps{Escape}')

    expect(onCommit).not.toHaveBeenCalled()
    expect(nameField()).toHaveValue('Ceiling')
  })

  it('does not commit an empty name', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<NameField name="Ceiling" onCommit={onCommit} />)

    await user.clear(nameField())
    await user.keyboard('{Enter}')

    expect(onCommit).not.toHaveBeenCalled()
  })

  it('does not commit a whitespace-only name', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<NameField name="Ceiling" onCommit={onCommit} />)

    await user.clear(nameField())
    await user.type(nameField(), '   {Enter}')

    expect(onCommit).not.toHaveBeenCalled()
  })

  it('refuses a name longer than maxBytes and flags the counter', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<NameField name="Van" onCommit={onCommit} maxBytes={8} />)

    await user.clear(nameField())
    await user.type(nameField(), 'Galley fridge')
    expect(screen.getByText('13 / 8 bytes')).toBeInTheDocument()
    await user.keyboard('{Enter}')

    expect(onCommit).not.toHaveBeenCalled()
  })
})
