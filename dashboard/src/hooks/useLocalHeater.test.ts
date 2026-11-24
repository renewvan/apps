import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { useLocalHeater } from './useLocalHeater'

describe('useLocalHeater', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('offers no heater when disabled', () => {
    const { result } = renderHook(() => useLocalHeater(false))
    expect(result.current.heaters).toEqual({})
  })

  it('starts as an off heater with commands enabled', () => {
    const { result } = renderHook(() => useLocalHeater(true))
    expect(result.current.heaters.cabin).toMatchObject({ phase: 'off', commands_enabled: true })
  })

  it('walks a start through the phases and a stop through shutting down', () => {
    const { result } = renderHook(() => useLocalHeater(true))
    act(() => result.current.commands.setHeaterRunning('cabin', true))
    act(() => void vi.advanceTimersByTime(500))
    expect(result.current.heaters.cabin.phase).toBe('starting')
    act(() => void vi.advanceTimersByTime(2000))
    expect(result.current.heaters.cabin.phase).toBe('warming_up')
    act(() => void vi.advanceTimersByTime(2000))
    expect(result.current.heaters.cabin.phase).toBe('running')
    act(() => result.current.commands.setHeaterRunning('cabin', false))
    act(() => void vi.advanceTimersByTime(500))
    expect(result.current.heaters.cabin.phase).toBe('shutting_down')
    act(() => void vi.advanceTimersByTime(2000))
    expect(result.current.heaters.cabin.phase).toBe('off')
  })

  it('publishes the mode, thermostat and ventilating fields the Driver does, as Commands change them', () => {
    const { result } = renderHook(() => useLocalHeater(true))
    const { commands } = result.current
    act(() => commands.setHeaterThermostat('cabin', true))
    act(() => commands.setHeaterMode('cabin', 'power'))
    act(() => void vi.advanceTimersByTime(500))
    expect(result.current.heaters.cabin).toMatchObject({ mode: 'power', thermostat: true })
    act(() => commands.setHeaterSetpoint('cabin', 18))
    act(() => commands.setHeaterPowerLevel('cabin', 7))
    act(() => void vi.advanceTimersByTime(500))
    expect(result.current.heaters.cabin).toMatchObject({ setpoint_c: 18, power_level: 7 })
  })

  it('runs the fan with no warm-up on a ventilate Command, and a stop ends it', () => {
    const { result } = renderHook(() => useLocalHeater(true))
    act(() => result.current.commands.setHeaterVentilating('cabin', true))
    act(() => void vi.advanceTimersByTime(500))
    expect(result.current.heaters.cabin).toMatchObject({ phase: 'running', ventilating: true })
    act(() => result.current.commands.setHeaterRunning('cabin', false))
    act(() => void vi.advanceTimersByTime(500))
    expect(result.current.heaters.cabin).toMatchObject({
      phase: 'shutting_down',
      ventilating: false,
    })
  })

  it('counts down an armed timer from the start and stops the heater at zero', () => {
    const { result } = renderHook(() => useLocalHeater(true))
    act(() => result.current.setTimerMinutes(30))
    expect(result.current.timerMinutes).toBe(30)
    expect(result.current.endsAt).toBeUndefined()
    act(() => result.current.commands.setHeaterRunning('cabin', true))
    act(() => void vi.advanceTimersByTime(500))
    expect(result.current.endsAt).toBeDefined()
    act(() => void vi.advanceTimersByTime(5000))
    expect(result.current.heaters.cabin.phase).toBe('running')
    // 30 min after the start answered (0.5 s), 5.5 s have passed: the countdown ends now.
    act(() => void vi.advanceTimersByTime(30 * 60_000 - 5000))
    expect(result.current.heaters.cabin.phase).toBe('shutting_down')
    expect(result.current.endsAt).toBeUndefined()
    act(() => void vi.advanceTimersByTime(2000))
    expect(result.current.heaters.cabin.phase).toBe('off')
    // The armed duration stays for the next start.
    expect(result.current.timerMinutes).toBe(30)
  })

  it('arms from now while running, and Off or a Stop cancels the countdown', () => {
    const { result } = renderHook(() => useLocalHeater(true))
    act(() => result.current.commands.setHeaterRunning('cabin', true))
    act(() => void vi.advanceTimersByTime(5000))
    act(() => result.current.setTimerMinutes(60))
    expect(result.current.endsAt).toBeDefined()
    act(() => result.current.setTimerMinutes(0))
    expect(result.current.endsAt).toBeUndefined()
    act(() => result.current.setTimerMinutes(30))
    act(() => result.current.commands.setHeaterRunning('cabin', false))
    act(() => void vi.advanceTimersByTime(500))
    expect(result.current.endsAt).toBeUndefined()
  })

  it('starts the heater when an On-in timer reaches zero, without arming a stop', () => {
    const { result } = renderHook(() => useLocalHeater(true))
    act(() => result.current.setTimerKind('on'))
    act(() => result.current.setTimerMinutes(10))
    // The countdown is the start's, and the heater is still off.
    expect(result.current.timerKind).toBe('on')
    expect(result.current.endsAt).toBeDefined()
    expect(result.current.heaters.cabin.phase).toBe('off')
    act(() => void vi.advanceTimersByTime(10 * 60_000))
    expect(result.current.heaters.cabin.phase).toBe('starting')
    // It ran: no pending countdown, and it keeps running (On in sets no stop).
    expect(result.current.endsAt).toBeUndefined()
    act(() => void vi.advanceTimersByTime(60 * 60_000))
    expect(result.current.heaters.cabin.phase).toBe('running')
  })

  it('cancels a pending On-in countdown on a manual start or when the time goes back to 0', () => {
    const { result } = renderHook(() => useLocalHeater(true))
    act(() => result.current.setTimerKind('on'))
    act(() => result.current.setTimerMinutes(10))
    act(() => result.current.setTimerMinutes(0))
    expect(result.current.endsAt).toBeUndefined()
    act(() => result.current.setTimerMinutes(10))
    act(() => result.current.commands.setHeaterRunning('cabin', true))
    act(() => void vi.advanceTimersByTime(500))
    expect(result.current.endsAt).toBeUndefined()
  })

  it('keeps a fresh start alive when it lands inside the previous stop sequence', () => {
    const { result } = renderHook(() => useLocalHeater(true))
    act(() => result.current.commands.setHeaterRunning('cabin', false))
    act(() => void vi.advanceTimersByTime(500))
    expect(result.current.heaters.cabin.phase).toBe('shutting_down')
    // Start within the 2 s stop window: the stale pending "off" must not kill it.
    act(() => result.current.commands.setHeaterRunning('cabin', true))
    act(() => void vi.advanceTimersByTime(500))
    expect(result.current.heaters.cabin.phase).toBe('starting')
    // 2 s after the stop answered, the stale off fires right here: the start must survive it.
    act(() => void vi.advanceTimersByTime(1500))
    expect(result.current.heaters.cabin.phase).toBe('starting')
    act(() => void vi.advanceTimersByTime(500))
    expect(result.current.heaters.cabin.phase).toBe('warming_up')
    act(() => void vi.advanceTimersByTime(2000))
    expect(result.current.heaters.cabin.phase).toBe('running')
  })

  it('applies setpoint, mode and power level', () => {
    const { result } = renderHook(() => useLocalHeater(true))
    act(() => {
      result.current.commands.setHeaterSetpoint('cabin', 23)
      result.current.commands.setHeaterMode('cabin', 'power')
      result.current.commands.setHeaterPowerLevel('cabin', 5)
    })
    act(() => void vi.advanceTimersByTime(500))
    expect(result.current.heaters.cabin).toMatchObject({
      setpoint_c: 23,
      mode: 'power',
      power_level: 5,
    })
  })
})
