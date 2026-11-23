import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vite-plus/test'
import { DisplaySleepButton } from './DisplaySleepButton'

describe('DisplaySleepButton', () => {
  it('labels as sleep when the display is on', () => {
    render(<DisplaySleepButton displayPower="on" onSetPower={vi.fn()} />)
    expect(screen.getByRole('button')).toHaveAccessibleName(/sleep/i)
  })

  it('labels as wake when the display is off', () => {
    render(<DisplaySleepButton displayPower="off" onSetPower={vi.fn()} />)
    expect(screen.getByRole('button')).toHaveAccessibleName(/wake/i)
  })

  it('asks for the display off when tapped while on', async () => {
    const user = userEvent.setup()
    const onSetPower = vi.fn()
    render(<DisplaySleepButton displayPower="on" onSetPower={onSetPower} />)
    await user.click(screen.getByRole('button'))
    expect(onSetPower).toHaveBeenCalledExactlyOnceWith(false)
  })

  it('asks for the display on when tapped while off', async () => {
    const user = userEvent.setup()
    const onSetPower = vi.fn()
    render(<DisplaySleepButton displayPower="off" onSetPower={onSetPower} />)
    await user.click(screen.getByRole('button'))
    expect(onSetPower).toHaveBeenCalledExactlyOnceWith(true)
  })

  it('disables until the retained display-power topic arrives', () => {
    render(<DisplaySleepButton displayPower={null} onSetPower={vi.fn()} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
