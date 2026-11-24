import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { renderSettings } from '@/test/renderSettings'
import type { Tilt } from '@/types'

const URL = '/?page=settings&view=instance&instance=tilt%3Atilt'
const OK: Tilt = { roll_deg: -1.2, pitch_deg: 0.4, status: 'ok' }

/** The tilt Driver's retained info and its health. */
const tiltDriver = (health: 'online' | 'offline') => ({
  tilt: {
    info: {
      driver: 'tilt',
      product: 'GY-521 tilt sensor',
      source: 'MPU-6050',
      version: 'v0.3.0',
      publishes: ['tilt'],
    },
    health,
  },
})

function open(tilt: Tilt = OK, health: 'online' | 'offline' = 'online') {
  const setTiltLevel = vi.fn()
  const resetTiltLevel = vi.fn()
  const rendered = renderSettings(
    { setTiltLevel, resetTiltLevel },
    { bus: { tilt: { tilt }, drivers: tiltDriver(health) }, url: URL },
  )
  return { ...rendered, setTiltLevel, resetTiltLevel }
}

describe('Settings › Devices › Tilt › Details', () => {
  it('shows the live roll and pitch', () => {
    open()
    expect(screen.getByText('-1.2°')).toBeInTheDocument()
    expect(screen.getByText('+0.4°')).toBeInTheDocument()
  })

  it('asks in a dialog before setting level, and sends nothing on cancel', async () => {
    const { user, setTiltLevel } = open()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Set level' }))
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText(/parked on level ground/)).toBeInTheDocument()
    expect(setTiltLevel).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(setTiltLevel).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('sets level for this sensor once confirmed, then closes the dialog', async () => {
    const { user, setTiltLevel } = open()

    await user.click(screen.getByRole('button', { name: 'Set level' }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Set level' }),
    )

    expect(setTiltLevel).toHaveBeenCalledExactlyOnceWith('tilt')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('resets the level in one tap', async () => {
    const { user, resetTiltLevel } = open()

    await user.click(screen.getByRole('button', { name: 'Reset' }))

    expect(resetTiltLevel).toHaveBeenCalledExactlyOnceWith('tilt')
  })

  it('reads unknown, not the last retained angles, while its Driver is offline', () => {
    open(OK, 'offline')
    expect(screen.queryByText('-1.2°')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set level' })).toBeDisabled()
    expect(screen.getByText(/The sensor is not reporting/)).toBeInTheDocument()
  })

  it('cannot set level while the sensor reports an error', () => {
    open({ ...OK, status: 'sensor_error' })
    expect(screen.getByRole('button', { name: 'Set level' })).toBeDisabled()
  })
})
