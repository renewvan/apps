import { describe, expect, it, vi } from 'vite-plus/test'
import { sendCommand } from './index'

function client(connected = true) {
  return { connected, publish: vi.fn() }
}

describe('sendCommand', () => {
  it('sends nothing without a client', () => {
    expect(sendCommand(null, false, 'renewvan/relay/relay_01/set', 'true')).toBe(false)
    expect(sendCommand(undefined, false, 'renewvan/relay/relay_01/set', 'true')).toBe(false)
  })

  it('sends nothing while disconnected: now or never, no offline queue', () => {
    const c = client(false)

    expect(sendCommand(c, false, 'renewvan/relay/relay_01/set', 'true')).toBe(false)
    expect(c.publish).not.toHaveBeenCalled()
  })

  it('sends nothing to the real van in Demo mode', () => {
    const c = client()

    expect(sendCommand(c, true, 'renewvan/relay/relay_01/set', 'true')).toBe(false)
    expect(c.publish).not.toHaveBeenCalled()
  })

  it.each([
    'renewvan/kiosk/display/brightness/set',
    'renewvan/hub/primary-battery/set',
    'renewvan/demo/enabled/set',
  ])('sends %s in Demo mode', (topic) => {
    const c = client()

    expect(sendCommand(c, true, topic, '1')).toBe(true)
    expect(c.publish).toHaveBeenCalledExactlyOnceWith(topic, '1', { qos: 1, retain: false })
  })

  it('sends at QoS 1, never retained', () => {
    const c = client()

    expect(sendCommand(c, false, 'renewvan/relay/relay_01/set', 'true')).toBe(true)
    expect(c.publish).toHaveBeenCalledExactlyOnceWith('renewvan/relay/relay_01/set', 'true', {
      qos: 1,
      retain: false,
    })
  })
})
