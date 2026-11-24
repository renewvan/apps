import { act, renderHook } from '@testing-library/react-native'
import { GIVE_UP_MS } from '@renewvan/core/pending'
import type { Heater } from '@/types'
import { useHeaterController } from './useHeaterController'

const mockShow = jest.fn()
jest.mock('heroui-native', () => ({ useToast: () => ({ toast: { show: mockShow } }) }))

const RUNNING: Heater = {
  name: 'Cabin heater',
  phase: 'running',
  status_code: '3.0',
  error_code: 0,
  mode: 'heater_temperature',
  setpoint_c: 21,
  power_level: 4,
  commands_enabled: true,
}
const OFF: Heater = { ...RUNNING, phase: 'off', status_code: '0.1' }

const commands = {
  setHeaterRunning: jest.fn(),
  setHeaterMode: jest.fn(),
  setHeaterVentilating: jest.fn(),
  setHeaterThermostat: jest.fn(),
  setHeaterSetpoint: jest.fn(),
  setHeaterPowerLevel: jest.fn(),
  setHeaterCommandsEnabled: jest.fn(),
}

function setup(heater: Heater, frozen = false) {
  return renderHook(
    (props: { heater: Heater; frozen: boolean }) =>
      useHeaterController('cabin', props.heater, props.frozen, commands),
    { initialProps: { heater, frozen } },
  )
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
})
afterEach(() => jest.useRealTimers())

describe('useHeaterController', () => {
  it('sends the tap as core decided it and waits for the heater to read it back', async () => {
    const { result, rerender } = await setup(RUNNING)
    await act(async () => void result.current.dispatch({ kind: 'setpoint', celsius: 22 }))
    expect(commands.setHeaterSetpoint).toHaveBeenCalledWith('cabin', 22)
    expect(result.current.view).toMatchObject({ dialBusy: true, dialValue: 22 })
    await rerender({ heater: { ...RUNNING, setpoint_c: 22 }, frozen: false })
    expect(result.current.view.dialBusy).toBe(false)
    await act(async () => {
      jest.advanceTimersByTime(GIVE_UP_MS.heater)
    })
    expect(mockShow).not.toHaveBeenCalled()
  })

  it('reports a command the heater never confirmed, once, and goes back to the real value', async () => {
    const { result } = await setup(RUNNING)
    await act(async () => void result.current.dispatch({ kind: 'setpoint', celsius: 20 }))
    await act(async () => {
      jest.advanceTimersByTime(GIVE_UP_MS.heater)
    })
    expect(mockShow).toHaveBeenCalledTimes(1)
    expect(mockShow).toHaveBeenCalledWith({
      variant: 'danger',
      label: "Target didn't change",
      description: 'Cabin heater',
    })
    expect(result.current.view).toMatchObject({ dialBusy: false, dialValue: 21 })
  })

  it('sends nothing while frozen', async () => {
    const { result } = await setup(RUNNING, true)
    await act(async () => void result.current.dispatch({ kind: 'stop' }))
    expect(commands.setHeaterRunning).not.toHaveBeenCalled()
  })

  it('stops first, then reaches the mode the stop was for once the heater is off', async () => {
    const FAN: Heater = { ...RUNNING, mode: 'power', ventilating: true }
    const { result, rerender } = await setup(FAN)
    await act(
      async () => void result.current.dispatch({ kind: 'stopThenMode', then: 'temperature' }),
    )
    expect(commands.setHeaterRunning).toHaveBeenCalledWith('cabin', false)
    expect(commands.setHeaterMode).not.toHaveBeenCalled()
    await rerender({ heater: { ...OFF, mode: 'power' }, frozen: false })
    expect(commands.setHeaterMode).toHaveBeenCalledWith('cabin', 'heater_temperature')
  })
})
