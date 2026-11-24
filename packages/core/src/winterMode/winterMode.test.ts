import { describe, expect, it } from 'vite-plus/test'
import type { DriverRecord } from '../types'
import {
  hubPowerOf,
  relaysLeftOn,
  rememberedWinterMode,
  reservedRelayIds,
  winterModeCard,
  winterModeProblem,
  type HubPower,
  type WinterModeGateInput,
} from './winterMode'

function board(hubPower?: string, health: 'online' | 'offline' = 'online'): DriverRecord {
  return {
    health,
    info: {
      driver: 'x',
      product: 'p',
      source: 's',
      version: 'v1',
      publishes: ['relay'],
      ...(hubPower ? { hub_power: hubPower } : {}),
    },
  }
}

const one: HubPower = {
  kind: 'one',
  claim: { driver: 'esp32-front', relayId: 'front-01', online: true },
}

describe('hubPowerOf', () => {
  it('is none when no Driver announces hub_power', () => {
    expect(hubPowerOf({ 'esp32-front': board(), tank: {} })).toEqual({ kind: 'none' })
  })

  it("is the one board's relay, with its health", () => {
    expect(hubPowerOf({ 'esp32-front': board('front-01', 'offline') })).toEqual({
      kind: 'one',
      claim: { driver: 'esp32-front', relayId: 'front-01', online: false },
    })
  })

  it('is a conflict when two boards claim it, in Driver key order', () => {
    const power = hubPowerOf({ 'esp32-rear': board('rear-01'), 'esp32-front': board('front-01') })
    expect(power.kind).toBe('conflict')
    expect(reservedRelayIds(power)).toEqual(['front-01', 'rear-01'])
  })
})

describe('reservedRelayIds', () => {
  it('is empty without Hub power and the one relay with it', () => {
    expect(reservedRelayIds({ kind: 'none' })).toEqual([])
    expect(reservedRelayIds(one)).toEqual(['front-01'])
  })
})

describe('winterModeProblem', () => {
  const ready: WinterModeGateInput = {
    demo: false,
    status: 'connected',
    hubPower: one,
    heaters: { air2d: { phase: 'off' } },
    winterMode: false,
  }

  it('is null when the van is ready', () => {
    expect(winterModeProblem(ready)).toBeNull()
  })

  it.each<[string, Partial<WinterModeGateInput>, RegExp]>([
    ['Demo mode', { demo: true }, /Demo mode/],
    ['no Hub power', { hubPower: { kind: 'none' } }, /No relay board/],
    [
      'two boards',
      {
        hubPower: {
          kind: 'conflict',
          claims: [
            { driver: 'esp32-front', relayId: 'front-01', online: true },
            { driver: 'esp32-rear', relayId: 'rear-01', online: true },
          ],
        },
      },
      /esp32-front, esp32-rear/,
    ],
    ['the hub not connected', { status: 'disconnected' }, /not connected/],
    [
      'the board offline',
      { hubPower: { kind: 'one', claim: { ...one.claim, online: false } } },
      /offline/,
    ],
    ['a heater running', { heaters: { air2d: { phase: 'running' } } }, /heater off/],
    ['a heater shutting down', { heaters: { air2d: { phase: 'shutting_down' } } }, /heater off/],
    ['Winter mode already starting', { winterMode: true }, /already/],
  ])('says why with %s', (_, change, reason) => {
    expect(winterModeProblem({ ...ready, ...change })).toMatch(reason)
  })

  it('lets a heater with no phase reported through, as the hub plugin does', () => {
    expect(winterModeProblem({ ...ready, heaters: { air2d: {} } })).toBeNull()
  })
})

describe('relaysLeftOn', () => {
  it('lists the relays on, never Hub power, in id order', () => {
    const relays = {
      'front-10': { state: true },
      'front-01': { state: true },
      'front-02': { state: true },
      'front-03': { state: false },
      'front-04': {},
    }
    expect(relaysLeftOn(relays, one)).toEqual(['front-02', 'front-10'])
  })
})

describe('rememberedWinterMode', () => {
  it("remembers the hub's true", () => {
    expect(rememberedWinterMode(false, 'connected', true)).toBe(true)
  })

  it('keeps the memory while the hub is gone or its state has not arrived', () => {
    expect(rememberedWinterMode(true, 'disconnected', true)).toBe(true)
    expect(rememberedWinterMode(true, 'connecting', false)).toBe(true)
    expect(rememberedWinterMode(true, 'connected', null)).toBe(true)
  })

  it('forgets only when the hub is reached again and reports false', () => {
    expect(rememberedWinterMode(true, 'connected', false)).toBe(false)
  })
})

describe('winterModeCard', () => {
  const idle = {
    sent: 'idle',
    reported: false,
    problem: null,
    connected: true,
  } as const

  it('is ready when nothing was sent and the van is ready', () => {
    expect(winterModeCard(idle)).toEqual({ kind: 'ready', canStart: true })
  })

  it('says why and holds the button while there is a problem', () => {
    expect(winterModeCard({ ...idle, problem: 'Switch the heater off first.' })).toEqual({
      kind: 'problem',
      problem: 'Switch the heater off first.',
      canStart: false,
    })
  })

  it('waits for the hub, button held, once sent', () => {
    expect(winterModeCard({ ...idle, sent: 'waiting' })).toEqual({
      kind: 'waiting',
      canStart: false,
    })
  })

  it('is starting once the hub reports it, whatever was sent or is wrong', () => {
    expect(winterModeCard({ ...idle, sent: 'unanswered', reported: true, problem: 'x' })).toEqual({
      kind: 'starting',
      canStart: false,
    })
  })

  it('says the start failed when the hub, still reached, did not report it', () => {
    expect(winterModeCard({ ...idle, sent: 'unanswered' })).toEqual({
      kind: 'failed',
      canStart: true,
    })
  })

  it('shows a problem that arose after a failed start instead of the failure', () => {
    expect(
      winterModeCard({ ...idle, sent: 'unanswered', problem: 'Switch the heater off first.' }),
    ).toEqual({ kind: 'problem', problem: 'Switch the heater off first.', canStart: false })
  })

  it('says the hub was lost, not that the start failed, when the link dropped unanswered', () => {
    expect(
      winterModeCard({
        sent: 'unanswered',
        reported: false,
        problem: 'The hub is not connected.',
        connected: false,
      }),
    ).toEqual({ kind: 'lost', canStart: false })
  })
})
