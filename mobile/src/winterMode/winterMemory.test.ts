import type { HubPower } from '@renewvan/core/winterMode'
import {
  EMPTY_WINTER_MEMORY,
  nextWinterMemory,
  parseWinterMemory,
  type WinterMemory,
} from './winterMemory'

const one: HubPower = {
  kind: 'one',
  claim: { driver: 'esp32-van', relayId: 'van-01', online: true },
}
const none: HubPower = { kind: 'none' }

describe('nextWinterMemory', () => {
  it("remembers Winter mode from the hub's true, and the board that powers the hub", () => {
    const next = nextWinterMemory(EMPTY_WINTER_MEMORY, {
      status: 'connected',
      winterMode: true,
      hubPower: one,
    })
    expect(next).toEqual({ winterMode: true, hubPower: { driver: 'esp32-van', relayId: 'van-01' } })
  })

  it('keeps both while the bus is unreachable', () => {
    const memory: WinterMemory = {
      winterMode: true,
      hubPower: { driver: 'esp32-van', relayId: 'van-01' },
    }
    const next = nextWinterMemory(memory, {
      status: 'disconnected',
      winterMode: null,
      hubPower: none,
    })
    expect(next).toBe(memory)
  })

  it('forgets Winter mode once the bus is back and the hub reports false', () => {
    const memory: WinterMemory = {
      winterMode: true,
      hubPower: { driver: 'esp32-van', relayId: 'van-01' },
    }
    const next = nextWinterMemory(memory, { status: 'connected', winterMode: false, hubPower: one })
    expect(next).toEqual({ ...memory, winterMode: false })
  })

  it('keeps the Hub power board when more than one board claims it', () => {
    const memory: WinterMemory = {
      winterMode: false,
      hubPower: { driver: 'esp32-van', relayId: 'van-01' },
    }
    const conflict: HubPower = {
      kind: 'conflict',
      claims: [one.claim, { driver: 'esp32-b', relayId: 'b-01', online: true }],
    }
    expect(
      nextWinterMemory(memory, { status: 'connected', winterMode: false, hubPower: conflict }),
    ).toBe(memory)
  })
})

describe('parseWinterMemory', () => {
  it('reads what was stored', () => {
    const memory = { winterMode: true, hubPower: { driver: 'esp32-van', relayId: 'van-01' } }
    expect(parseWinterMemory(JSON.stringify(memory))).toEqual(memory)
  })

  it.each([null, '', 'nope', '[]', '{"winterMode":"yes","hubPower":{"driver":1}}'])(
    'is empty for %p',
    (raw) => {
      expect(parseWinterMemory(raw)).toEqual(EMPTY_WINTER_MEMORY)
    },
  )
})
