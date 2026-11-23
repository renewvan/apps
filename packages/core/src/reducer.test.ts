import { describe, expect, it } from 'vite-plus/test'
import {
  emptyBusData,
  reduceBusMessage,
  routerHealthOf,
  visibleState,
  type BusData,
  type RenewvanBusState,
} from './index'

// What each topic does to the state: every message is a pure `reduceBusMessage` call with an
// injected receipt time, so nothing here needs a broker or a clock.

const NOW = 1_791_028_800_000 // 2026-10-03T12:00:00Z

type Message = [topic: string, payload: string]

function feed(messages: Message[], start: BusData = emptyBusData, now = NOW): BusData {
  return messages.reduce(
    (data, [topic, payload]) => reduceBusMessage(data, topic, payload, now),
    start,
  )
}

/** The real van: what the screens show while Demo mode is off. */
const real = (messages: Message[], start?: BusData): RenewvanBusState => feed(messages, start).real

describe('router entity', () => {
  it('starts with no routers, no health, and no receipt times', () => {
    expect(emptyBusData.real.routers).toEqual({})
    expect(routerHealthOf(visibleState(emptyBusData))).toBeNull()
    expect(emptyBusData.real.routerUpdatedAt).toEqual({})
  })

  it('accumulates router properties per id, JSON-scalars like other entities', () => {
    const state = real([
      ['renewvan/router/main/signal_rsrp_dbm', '-85'],
      ['renewvan/router/main/operator', '"26203"'],
      ['renewvan/router/backup/network_type', '"lte"'],
    ])
    expect(state.routers).toEqual({
      main: { signal_rsrp_dbm: -85, operator: '26203' },
      backup: { network_type: 'lte' },
    })
  })

  it('stamps the receipt time of the latest router property per id', () => {
    let data = reduceBusMessage(emptyBusData, 'renewvan/router/main/signal_rsrp_dbm', '-85', NOW)
    data = reduceBusMessage(data, 'renewvan/router/main/operator', '"26203"', NOW + 30_000)
    expect(data.real.routerUpdatedAt).toEqual({ main: NOW + 30_000 })
  })

  it('stamps the receipt time even when the router repeats a value: it is still alive', () => {
    const first = feed([['renewvan/router/main/signal_rsrp_dbm', '-85']])
    const again = reduceBusMessage(first, 'renewvan/router/main/signal_rsrp_dbm', '-85', NOW + 5)
    expect(again.real.routerUpdatedAt).toEqual({ main: NOW + 5 })
  })

  it("tracks the driver's health from renewvan/router/health, ignoring unknown payloads", () => {
    const online = feed([['renewvan/router/health', 'online']])
    expect(routerHealthOf(online.real)).toBe('online')
    const offline = feed([['renewvan/router/health', 'offline']], online)
    expect(routerHealthOf(offline.real)).toBe('offline')
    // An unknown payload is not a health: the Driver reads as Unknown again.
    const rebooting = feed([['renewvan/router/health', 'rebooting']], offline)
    expect(routerHealthOf(rebooting.real)).toBeNull()
  })

  it('reads an empty router/health payload as no health, not offline', () => {
    const data = feed([
      ['renewvan/router/health', 'online'],
      ['renewvan/router/health', ''],
    ])
    expect(routerHealthOf(data.real)).toBeNull()
  })

  it('drops the superseded renewvan/uplink/status topic entirely', () => {
    const data = feed([['renewvan/uplink/status', '{"path":"wifi","online":true}']])
    expect(data).toBe(emptyBusData)
    expect('uplink' in data).toBe(false)
  })
})

describe('display settings', () => {
  const display = (messages: Message[], start?: BusData) => feed(messages, start).kiosk

  it('starts every display setting null until a message arrives', () => {
    expect(emptyBusData.kiosk).toEqual({
      power: null,
      brightness: null,
      autoSleepEnabled: null,
      autoSleepTimeoutMinutes: null,
    })
  })

  it('reads the display power as a bare on or off, and ignores anything else', () => {
    expect(display([['renewvan/kiosk/display/power', 'on']]).power).toBe('on')
    expect(
      display([
        ['renewvan/kiosk/display/power', 'off'],
        ['renewvan/kiosk/display/power', 'dim'],
      ]).power,
    ).toBe('off')
  })

  it('parses auto-sleep-enabled as a boolean, and ignores anything else', () => {
    expect(display([['renewvan/kiosk/display/auto-sleep-enabled', 'true']]).autoSleepEnabled).toBe(
      true,
    )
    expect(
      display([
        ['renewvan/kiosk/display/auto-sleep-enabled', 'false'],
        ['renewvan/kiosk/display/auto-sleep-enabled', 'yes'],
      ]).autoSleepEnabled,
    ).toBe(false)
  })

  it('parses brightness as an integer within 0-100', () => {
    expect(display([['renewvan/kiosk/display/brightness', '70']]).brightness).toBe(70)
    expect(display([['renewvan/kiosk/display/brightness', '0']]).brightness).toBe(0)
    expect(display([['renewvan/kiosk/display/brightness', '100']]).brightness).toBe(100)
  })

  it.each([
    ['out of range', '150'],
    ['negative', '-1'],
    ['fractional', '42.5'],
    ['not a number', 'bright'],
  ])('ignores a brightness that is %s', (_, payload) => {
    expect(display([['renewvan/kiosk/display/brightness', payload]]).brightness).toBeNull()
  })

  // Changed from the dashboard, which read the empty payload (a cleared retained topic) as 0, a
  // black screen: it is not a brightness, so it is ignored.
  it('ignores an empty brightness payload instead of reading it as 0', () => {
    const data = display([
      ['renewvan/kiosk/display/brightness', '42'],
      ['renewvan/kiosk/display/brightness', ''],
    ])
    expect(data.brightness).toBe(42)
  })

  it('parses auto-sleep-timeout-minutes only when it is one of the preset choices', () => {
    const data = feed([['renewvan/kiosk/display/auto-sleep-timeout-minutes', '15']])
    expect(data.kiosk.autoSleepTimeoutMinutes).toBe(15)
    const seven = feed([['renewvan/kiosk/display/auto-sleep-timeout-minutes', '7']], data)
    expect(seven.kiosk.autoSleepTimeoutMinutes).toBe(15) // unchanged: 7 isn't a preset
  })

  // Changed from the dashboard, which read `Number(payload)` and so took `5.0`, ` 5` or `0x5`:
  // only the exact text the plugin publishes is a choice.
  it.each(['5.0', ' 5', '5 ', '0x5', '05', '"5"'])(
    'ignores a timeout of %j that only numerically equals a preset',
    (payload) => {
      const data = feed([['renewvan/kiosk/display/auto-sleep-timeout-minutes', payload]])
      expect(data.kiosk.autoSleepTimeoutMinutes).toBeNull()
    },
  )

  // Changed from the dashboard, where any other `renewvan/kiosk/*` topic fell through to the Driver
  // pattern, so `renewvan/kiosk/health` became a Driver called kiosk: the kiosk is a host plugin.
  it('swallows every other kiosk topic: the kiosk plugin is never a Driver', () => {
    const data = feed([
      ['renewvan/kiosk/health', 'online'],
      [
        'renewvan/kiosk/info',
        JSON.stringify({ driver: 'kiosk', product: 'x', source: 'y', version: 'v1' }),
      ],
      ['renewvan/kiosk/display/brightness/set', '50'],
      ['renewvan/kiosk/display/power/set', 'off'],
      ['renewvan/kiosk/display/unknown', '1'],
    ])
    expect(data).toBe(emptyBusData)
  })
})

describe('temperature entity', () => {
  it('accumulates identity and live fields per sensor id', () => {
    const state = real([
      ['renewvan/temperature/outdoor/name', '"Outdoor"'],
      ['renewvan/temperature/outdoor/unit', '"F"'],
      ['renewvan/temperature/outdoor/temperature_c', '31.5'],
      ['renewvan/temperature/outdoor/status', '"ok"'],
      ['renewvan/temperature/cpu/source', '"cpu"'],
    ])
    expect(state.temperatures).toEqual({
      outdoor: { name: 'Outdoor', unit: 'F', temperature_c: 31.5, status: 'ok' },
      cpu: { source: 'cpu' },
    })
  })

  it('ignores the <field>/set command topics, and reads the health topic as a Driver only', () => {
    const state = real([
      ['renewvan/temperature/health', 'online'],
      ['renewvan/temperature/outdoor/unit/set', '"F"'],
      ['renewvan/temperature/outdoor/name/set', '"x"'],
      ['renewvan/temperature/outdoor/status', '"ok"'],
    ])
    expect(state.temperatures).toEqual({ outdoor: { status: 'ok' } })
    expect(state.drivers).toEqual({ temperature: { health: 'online' } })
  })
})

describe('tilt entity', () => {
  it('accumulates tilt properties per id as JSON scalars', () => {
    const state = real([
      ['renewvan/tilt/tilt/roll_deg', '0.73'],
      ['renewvan/tilt/tilt/pitch_deg', '-2.22'],
      ['renewvan/tilt/tilt/status', '"ok"'],
    ])
    expect(state.tilt).toEqual({ tilt: { roll_deg: 0.73, pitch_deg: -2.22, status: 'ok' } })
  })

  it('ignores the level_zero command topic', () => {
    const state = real([
      ['renewvan/tilt/health', 'online'],
      ['renewvan/tilt/tilt/level_zero/set', 'now'],
      ['renewvan/tilt/tilt/status', '"ok"'],
    ])
    expect(state.tilt).toEqual({ tilt: { status: 'ok' } })
  })
})

describe('solar entity', () => {
  it('accumulates solar properties per controller id, strings unquoted', () => {
    const state = real([
      ['renewvan/solar/291/power_w', '412'],
      ['renewvan/solar/291/battery_voltage_v', '13.44'],
      ['renewvan/solar/291/yield_today_wh', '2140'],
      ['renewvan/solar/291/charge_state', '"bulk"'],
    ])
    expect(state.solar).toEqual({
      '291': { power_w: 412, battery_voltage_v: 13.44, yield_today_wh: 2140, charge_state: 'bulk' },
    })
  })

  it('keeps yield_history_wh as an array, newest first, with null slots left as null', () => {
    const state = real([['renewvan/solar/291/yield_history_wh', '[210,1840,null,0]']])
    expect(state.solar['291']?.yield_history_wh).toEqual([210, 1840, null, 0])
  })
})

describe('charger entity', () => {
  it('accumulates charger properties per id, with the source as a plain string', () => {
    const state = real([
      ['renewvan/charger/1/voltage_v', '13.39'],
      ['renewvan/charger/1/current_a', '18.2'],
      ['renewvan/charger/1/source', '"alternator"'],
    ])
    expect(state.chargers).toEqual({
      '1': { voltage_v: 13.39, current_a: 18.2, source: 'alternator' },
    })
  })
})

describe('tank and battery entities', () => {
  it('accumulates an entity one retained property at a time', () => {
    const state = real([
      ['renewvan/tank/fresh/level_pct', '62'],
      ['renewvan/tank/fresh/status', '"ok"'],
      ['renewvan/tank/fresh/fluid_type', '"fresh_water"'],
    ])
    expect(state.tanks.fresh).toEqual({ level_pct: 62, status: 'ok', fluid_type: 'fresh_water' })
  })

  it('parses string properties as JSON, so status is ok and not "ok" with quotes', () => {
    expect(
      real([['renewvan/battery/house/charge_state', '"bulk"']]).batteries.house.charge_state,
    ).toBe('bulk')
  })

  it('keeps an object property such as a GPS position whole', () => {
    const state = real([['renewvan/gps/main/position', '{"lat":47.98,"lon":7.83}']])
    expect(state.gps.main).toEqual({ position: { lat: 47.98, lon: 7.83 } })
  })
})

const validInfo = {
  driver: 'tank',
  product: 'Tank driver',
  source: 'ADS1115 (I2C)',
  publishes: ['tank'],
  version: 'v0.8.0',
}

describe('drivers', () => {
  it('populates a Driver from its retained info and health topics', () => {
    const state = real([
      ['renewvan/tank/info', JSON.stringify(validInfo)],
      ['renewvan/tank/health', 'online'],
    ])
    expect(state.drivers).toEqual({ tank: { info: validInfo, health: 'online' } })
  })

  it('clears info and health independently when their retained topic is emptied', () => {
    let data = feed([
      ['renewvan/tank/info', JSON.stringify(validInfo)],
      ['renewvan/tank/health', 'online'],
    ])
    data = feed([['renewvan/tank/health', '']], data)
    expect(data.real.drivers).toEqual({ tank: { info: validInfo } })

    data = feed(
      [
        ['renewvan/tank/health', 'offline'],
        ['renewvan/tank/info', ''],
      ],
      data,
    )
    expect(data.real.drivers).toEqual({ tank: { health: 'offline' } })

    // Nothing left to say about the Driver: it is gone, not an empty record.
    data = feed([['renewvan/tank/health', '']], data)
    expect(data.real.drivers).toEqual({})
  })

  it.each([
    ['not JSON', 'online'],
    ['a JSON array', '[]'],
    ['a JSON string', '"v0.8.0"'],
    ['null', 'null'],
    ['missing driver', JSON.stringify({ ...validInfo, driver: undefined })],
    ['missing product', JSON.stringify({ ...validInfo, product: undefined })],
    ['missing source', JSON.stringify({ ...validInfo, source: undefined })],
    ['missing version', JSON.stringify({ ...validInfo, version: undefined })],
    ['a non-string version', JSON.stringify({ ...validInfo, version: 8 })],
    ['publishes not a list', JSON.stringify({ ...validInfo, publishes: 'tank' })],
    ['publishes with a non-string', JSON.stringify({ ...validInfo, publishes: ['tank', 1] })],
  ])('reads info that is %s as no info', (_name, payload) => {
    const state = real([
      ['renewvan/tank/health', 'online'],
      ['renewvan/tank/info', payload],
    ])
    expect(state.drivers).toEqual({ tank: { health: 'online' } })
  })

  it('lets a malformed info replace a good one: the Driver then reads as no info', () => {
    const state = real([
      ['renewvan/tank/info', JSON.stringify(validInfo)],
      ['renewvan/tank/info', '{"driver":"tank"}'],
      ['renewvan/tank/health', 'online'],
    ])
    expect(state.drivers).toEqual({ tank: { health: 'online' } })
  })

  it('accepts info without publishes, and keeps its optional fields', () => {
    const info = {
      driver: 'relay',
      product: 'Relay driver',
      source: 'ESPHome GPIO',
      version: 'dev',
      manufacturer: 'acme',
      homepage: 'https://example.com/relay',
      board_serial: 'AA:BB:CC:DD:EE:FF',
    }
    expect(real([['renewvan/relay/info', JSON.stringify(info)]]).drivers).toEqual({
      relay: { info },
    })
  })

  it('drops an optional field that is not a string, keeping the rest of the info', () => {
    const payload = JSON.stringify({
      ...validInfo,
      manufacturer: 7,
      homepage: { a: 1 },
      board_serial: ['x'],
    })
    expect(real([['renewvan/tank/info', payload]]).drivers).toEqual({ tank: { info: validInfo } })
  })

  it('carries no key the info schema does not define', () => {
    const payload = JSON.stringify({ ...validInfo, extra: 'x' })
    expect(real([['renewvan/tank/info', payload]]).drivers).toEqual({ tank: { info: validInfo } })
  })

  it('keeps a valid ip', () => {
    const payload = JSON.stringify({ ...validInfo, driver: 'relay', ip: '192.168.10.57' })
    expect(real([['renewvan/relay/info', payload]]).drivers.relay.info).toEqual({
      ...validInfo,
      driver: 'relay',
      ip: '192.168.10.57',
    })
  })

  it.each(['0.0.0.0', '192.168.10', '192.168.10.256', '01.2.3.4', 'fe80::1', '', 5, null])(
    'drops an ip of %j that is not an IPv4 dotted quad, keeping the rest',
    (ip) => {
      const good = feed([
        [
          'renewvan/relay/info',
          JSON.stringify({ ...validInfo, driver: 'relay', ip: '192.168.10.57' }),
        ],
      ])
      const payload = JSON.stringify({ ...validInfo, driver: 'relay', ip })
      expect(feed([['renewvan/relay/info', payload]], good).real.drivers.relay.info).toEqual({
        ...validInfo,
        driver: 'relay',
      })
    },
  )

  it('reads a Driver with info and no health as having no health (Unknown), not offline', () => {
    const state = real([['renewvan/tank/info', JSON.stringify(validInfo)]])
    expect(state.drivers.tank).toBeDefined()
    expect(state.drivers.tank.health).toBeUndefined()
  })

  it('ignores a health payload that is not online or offline', () => {
    const state = real([
      ['renewvan/tank/health', 'online'],
      ['renewvan/tank/health', 'degraded'],
      ['renewvan/tank/info', JSON.stringify(validInfo)],
    ])
    expect(state.drivers.tank.info).toEqual(validInfo)
    expect(state.drivers.tank.health).toBeUndefined()
  })

  it('never reads demo as a Driver: renewvan/demo/health is the demo root, not a Driver', () => {
    const state = real([
      ['renewvan/demo/health', 'online'],
      ['renewvan/demo/info', JSON.stringify(validInfo)],
      ['renewvan/tank/health', 'online'],
    ])
    expect(state.drivers).toEqual({ tank: { health: 'online' } })
  })

  it('does not mistake other three-segment host topics for Drivers', () => {
    const state = real([
      ['renewvan/tailscale/status', '{"enabled":true}'],
      ['renewvan/hub/status', '{"ip":null,"hostname":null}'],
      ['renewvan/kiosk/display/power', 'on'],
      ['renewvan/tank/fresh/level_pct', '62'],
    ])
    expect(state.tanks).toEqual({ fresh: { level_pct: 62 } })
    expect(state.drivers).toEqual({})
  })

  it('keeps a Driver entity-neutral: info and health never create an entity', () => {
    const state = real([
      ['renewvan/tank/info', JSON.stringify(validInfo)],
      ['renewvan/tank/health', 'online'],
    ])
    expect(state.drivers.tank.health).toBe('online')
    expect(state.tanks).toEqual({})
  })
})

describe('entity driver and name', () => {
  it.each([
    ['battery', 'batteries'],
    ['solar', 'solar'],
    ['charger', 'chargers'],
    ['tank', 'tanks'],
    ['router', 'routers'],
    ['gps', 'gps'],
    ['temperature', 'temperatures'],
    ['tilt', 'tilt'],
    ['relay', 'relays'],
    ['heater', 'heaters'],
  ] as const)('keeps the owning driver and name of a %s instance', (domain, field) => {
    const state = real([
      [`renewvan/${domain}/a/driver`, '"venus"'],
      [`renewvan/${domain}/a/name`, '"Main bank"'],
    ])
    expect(state[field]).toEqual({ a: { driver: 'venus', name: 'Main bank' } })
  })

  it('clears a driver when its retained topic is emptied', () => {
    const state = real([
      ['renewvan/battery/512/driver', '"venus"'],
      ['renewvan/battery/512/soc_pct', '80'],
      ['renewvan/battery/512/driver', ''],
    ])
    expect(state.batteries['512']?.driver).toBeUndefined()
    expect(state.batteries['512']?.soc_pct).toBe(80)
  })

  it('ignores a driver or name that is not a string', () => {
    const state = real([
      ['renewvan/battery/512/driver', '42'],
      ['renewvan/battery/512/name', 'true'],
      ['renewvan/battery/512/soc_pct', '80'],
    ])
    expect(state.batteries['512']).toEqual({ soc_pct: 80 })
  })
})

describe('heater entity', () => {
  it('accumulates heater fields and ignores the echo of its own Commands', () => {
    const state = real([
      ['renewvan/heater/cabin/phase', '"running"'],
      ['renewvan/heater/cabin/setpoint_c', '21'],
      ['renewvan/heater/cabin/set', 'true'],
      ['renewvan/heater/cabin/phase', ''],
    ])
    expect(state.heaters).toEqual({ cabin: { phase: undefined, setpoint_c: 21 } })
  })

  it('lets only the fields the heater schema publishes land', () => {
    const state = real([
      ['renewvan/heater/cabin/phase', '"off"'],
      ['renewvan/heater/cabin/commands_enabled', 'true'],
      ['renewvan/heater/cabin/surprise', '1'],
    ])
    expect(state.heaters.cabin).toEqual({ phase: 'off', commands_enabled: true })
  })
})

describe('relay entity', () => {
  it('accumulates a relay name and state per id', () => {
    const state = real([
      ['renewvan/relay/relay_03/state', 'false'],
      ['renewvan/relay/relay_03/name', '"Water pump"'],
      ['renewvan/relay/relay_04/state', 'true'],
    ])
    expect(state.relays).toEqual({
      relay_03: { state: false, name: 'Water pump' },
      relay_04: { state: true },
    })
  })

  it('never reads a name as a state: a retained name must not switch a pump on', () => {
    const state = real([
      ['renewvan/relay/relay_03/state', 'false'],
      ['renewvan/relay/relay_03/name', '"Water pump"'],
    ])
    expect(state.relays.relay_03).toEqual({ state: false, name: 'Water pump' })
  })

  it('shows a relay that has a name but no state yet as having no known state', () => {
    const state = real([['renewvan/relay/relay_03/name', '"Water pump"']])
    expect(state.relays.relay_03).toEqual({ name: 'Water pump' })
  })

  it('drops the whole relay when its retained state is cleared (the relay is gone, not off)', () => {
    const state = real([
      ['renewvan/relay/relay_03/state', 'true'],
      ['renewvan/relay/relay_03/name', '"Pump"'],
      ['renewvan/relay/relay_04/state', 'true'],
      ['renewvan/relay/relay_03/state', ''],
    ])
    expect(Object.keys(state.relays)).toEqual(['relay_04'])
  })

  it('drops only the name when a retained name is cleared', () => {
    const state = real([
      ['renewvan/relay/relay_03/state', 'true'],
      ['renewvan/relay/relay_03/name', '"Water pump"'],
      ['renewvan/relay/relay_03/name', ''],
    ])
    expect(state.relays.relay_03).toEqual({ state: true })
  })

  it('ignores a name that is not a non-empty string', () => {
    const state = real([
      ['renewvan/relay/relay_03/state', 'true'],
      ['renewvan/relay/relay_03/name', '42'],
      ['renewvan/relay/relay_03/name', '""'],
    ])
    expect(state.relays.relay_03).toEqual({ state: true })
  })

  it('never reads a relay command as the relay state: the broker echoes our own set back', () => {
    const state = real([
      // `set` has four segments, so it reaches the entity reducer: only `state`, `name` and
      // `driver` may land.
      ['renewvan/relay/relay_03/set', 'true'],
      // `name/set` has five segments and never matches the entity pattern at all.
      ['renewvan/relay/relay_03/name/set', '"Water pump"'],
      ['renewvan/relay/relay_04/state', 'true'],
    ])
    expect(state.relays).toEqual({ relay_04: { state: true } })
  })

  it('ignores a state that is not a JSON boolean: a string "off" must not read as switched on', () => {
    const state = real([
      ['renewvan/relay/relay_03/state', 'false'],
      ['renewvan/relay/relay_03/state', '"off"'],
      ['renewvan/relay/relay_03/state', '"false"'],
      ['renewvan/relay/relay_03/state', '1'],
      ['renewvan/relay/relay_05/state', '"on"'],
    ])
    expect(state.relays.relay_03).toEqual({ state: false })
    expect(state.relays.relay_05).toBeUndefined()
  })

  it('lets a relay be called health or info: segment count, not the id, tells it from a Driver', () => {
    const state = real([['renewvan/relay/health/state', 'true']])
    expect(state.relays).toEqual({ health: { state: true } })
    expect(state.drivers).toEqual({})
  })
})

describe('tailscale status', () => {
  const status = { enabled: true, connected: true, ip: '100.64.0.1', hostname: 'van', peers: 2 }
  const tailscale = (...payloads: string[]) =>
    feed(payloads.map((p): Message => ['renewvan/tailscale/status', p])).tailscale

  it('reads a status that matches the schema', () => {
    expect(tailscale(JSON.stringify(status))).toEqual(status)
  })

  it('accepts a null ip and hostname while not connected', () => {
    const down = { enabled: true, connected: false, ip: null, hostname: null, peers: 0 }
    expect(tailscale(JSON.stringify(down))).toEqual(down)
  })

  it('carries no key the schema does not define', () => {
    expect(tailscale(JSON.stringify({ ...status, extra: 'x' }))).toEqual(status)
  })

  it('clears the status when the retained topic is cleared', () => {
    expect(tailscale(JSON.stringify(status), '')).toBeNull()
  })

  it.each([
    ['a bare boolean', 'true'],
    ['malformed JSON', '{"enabled":'],
    ['a missing field', JSON.stringify({ enabled: true, peers: 2 })],
    ['a non-boolean connected', JSON.stringify({ ...status, connected: 'yes' })],
    ['a numeric ip', JSON.stringify({ ...status, ip: 100 })],
    ['a fractional peer count', JSON.stringify({ ...status, peers: 1.5 })],
    ['a negative peer count', JSON.stringify({ ...status, peers: -1 })],
    ['an array', JSON.stringify([status])],
  ])('reads %s as no status, so the last one does not stay on screen', (_, payload) => {
    expect(tailscale(JSON.stringify(status), payload)).toBeNull()
  })
})

describe('hub status', () => {
  const status = { ip: '192.168.10.50', hostname: 'renewvan', version: 'v0.4.0' }
  const hubStatus = (...payloads: string[]) =>
    feed(payloads.map((p): Message => ['renewvan/hub/status', p])).hubStatus

  it('keeps the address of a hub plugin that predates the version field, without a version', () => {
    expect(hubStatus(JSON.stringify({ ip: '192.168.10.50', hostname: 'renewvan' }))).toEqual({
      ip: '192.168.10.50',
      hostname: 'renewvan',
    })
  })

  it('reads a status that matches the schema', () => {
    expect(hubStatus(JSON.stringify(status))).toEqual(status)
  })

  it('accepts a null ip while the Pi has no default route', () => {
    const noRoute = { ip: null, hostname: 'renewvan', version: 'dev' }
    expect(hubStatus(JSON.stringify(noRoute))).toEqual(noRoute)
  })

  it('carries no key the schema does not define', () => {
    expect(hubStatus(JSON.stringify({ ...status, extra: 'x' }))).toEqual(status)
  })

  it('clears the status when the retained topic is cleared', () => {
    expect(hubStatus(JSON.stringify(status), '')).toBeNull()
  })

  it.each([
    ['a bare string', '"192.168.10.50"'],
    ['malformed JSON', '{"ip":'],
    ['a missing hostname', JSON.stringify({ ip: '192.168.10.50', version: 'v0.4.0' })],
    ['a missing ip', JSON.stringify({ hostname: 'renewvan', version: 'v0.4.0' })],
    ['a numeric ip', JSON.stringify({ ...status, ip: 1 })],
    ['an empty version', JSON.stringify({ ...status, version: '' })],
    ['a numeric version', JSON.stringify({ ...status, version: 4 })],
    ['a null version', JSON.stringify({ ...status, version: null })],
    ['an array', JSON.stringify([status])],
  ])('reads %s as no status, so the last address does not stay on screen', (_, payload) => {
    expect(hubStatus(JSON.stringify(status), payload)).toBeNull()
  })

  it('does not mistake the three-segment topic for a Driver', () => {
    const data = feed([['renewvan/hub/status', JSON.stringify(status)]])
    expect(data.hubStatus).toEqual(status)
    expect(data.real.drivers).toEqual({})
  })
})

describe('primary battery', () => {
  const primary = (...payloads: string[]) =>
    feed(payloads.map((p): Message => ['renewvan/hub/primary-battery', p])).primaryBattery

  it('is unknown until the retained topic arrives', () => {
    expect(emptyBusData.primaryBattery).toBeNull()
  })

  it.each([
    ['auto', '"auto"', 'auto'],
    ['a battery id', '"512"', '512'],
  ])('reads %s as a JSON string', (_, payload, expected) => {
    expect(primary(payload)).toBe(expected)
  })

  it.each([
    ['an empty payload (cleared)', ''],
    ['an empty string', '""'],
    ['a number', '512'],
    ['an object', '{"id":"512"}'],
    ['bare text', 'auto'],
  ])('reads %s as unknown, replacing an earlier choice', (_, payload) => {
    expect(primary('"512"', payload)).toBeNull()
  })
})

describe('entity icons', () => {
  const icons = (...payloads: string[]) =>
    feed(payloads.map((p): Message => ['renewvan/hub/icons', p])).entityIcons

  it('is empty until the retained topic arrives', () => {
    expect(emptyBusData.entityIcons).toEqual({})
  })

  it('reads the map of <entity>/<id> to a name', () => {
    expect(icons('{"temperature/outdoor":"Park","tank/fresh":"Droplet"}')).toEqual({
      'temperature/outdoor': 'Park',
      'tank/fresh': 'Droplet',
    })
  })

  it('drops an entry that is not a string and keeps the rest', () => {
    expect(icons('{"tank/fresh":"Droplet","tank/grey":3,"tank/black":null}')).toEqual({
      'tank/fresh': 'Droplet',
    })
  })

  it.each([
    ['an empty payload (cleared)', ''],
    ['an array', '["Park"]'],
    ['a string', '"Park"'],
    ['bare text', 'Park'],
    ['null', 'null'],
  ])('reads %s as no icons, replacing an earlier map', (_, payload) => {
    expect(icons('{"tank/fresh":"Droplet"}', payload)).toEqual({})
  })
})

describe('relay groups, list and order', () => {
  it('starts with no groups, no list and no order', () => {
    expect(emptyBusData.relayGroups).toEqual({})
    expect(emptyBusData.relayGroupList).toBeNull()
    expect(emptyBusData.relayOrder).toEqual([])
  })

  it('reads relay id to group name, dropping an entry that is not a non-empty string', () => {
    const data = feed([
      ['renewvan/hub/relay-groups', '{"relay_01":"Lights","relay_02":"","relay_03":4}'],
    ])
    expect(data.relayGroups).toEqual({ relay_01: 'Lights' })
  })

  it.each([
    ['an empty payload (cleared)', ''],
    ['an array', '["Lights"]'],
    ['null', 'null'],
  ])('reads relay groups that are %s as none, replacing earlier ones', (_, payload) => {
    const data = feed([
      ['renewvan/hub/relay-groups', '{"relay_01":"Lights"}'],
      ['renewvan/hub/relay-groups', payload],
    ])
    expect(data.relayGroups).toEqual({})
  })

  it('reads the group list in order, dropping blanks, non-strings and repeats', () => {
    const data = feed([['renewvan/hub/relay-group-list', '["Lights","Water","",3,"Lights"]']])
    expect(data.relayGroupList).toEqual(['Lights', 'Water'])
  })

  it('reads an empty group list as an empty list, not as no list', () => {
    expect(feed([['renewvan/hub/relay-group-list', '[]']]).relayGroupList).toEqual([])
  })

  it.each([
    ['an empty payload (cleared)', ''],
    ['an object', '{"a":"Lights"}'],
    ['a string', '"Lights"'],
  ])('reads a group list that is %s as no list (null)', (_, payload) => {
    const data = feed([
      ['renewvan/hub/relay-group-list', '["Lights"]'],
      ['renewvan/hub/relay-group-list', payload],
    ])
    expect(data.relayGroupList).toBeNull()
  })

  it('reads the relay order first to last, dropping blanks, non-strings and repeats', () => {
    const data = feed([['renewvan/hub/relay-order', '["relay_02","relay_01","",7,"relay_02"]']])
    expect(data.relayOrder).toEqual(['relay_02', 'relay_01'])
  })

  it.each([
    ['an empty payload (cleared)', ''],
    ['an object', '{"a":"relay_01"}'],
  ])('reads a relay order that is %s as no order', (_, payload) => {
    const data = feed([
      ['renewvan/hub/relay-order', '["relay_01"]'],
      ['renewvan/hub/relay-order', payload],
    ])
    expect(data.relayOrder).toEqual([])
  })
})

describe('demo mode flag and roots', () => {
  const both: Message[] = [
    ['renewvan/battery/y/soc_pct', '12'],
    ['renewvan/demo/battery/x/soc_pct', '78'],
  ]

  it('shows the real van until the bus says Demo mode is on', () => {
    const data = feed(both)
    expect(data.demoMode).toBe(false)
    expect(visibleState(data).batteries).toEqual({ y: { soc_pct: 12 } })
  })

  it('follows renewvan/demo/enabled: on shows only the demo van, off only the real one', () => {
    const on = feed([['renewvan/demo/enabled', 'true']], feed(both))
    expect(on.demoMode).toBe(true)
    expect(visibleState(on).batteries).toEqual({ x: { soc_pct: 78 } })
    const off = feed([['renewvan/demo/enabled', 'false']], on)
    expect(off.demoMode).toBe(false)
    expect(visibleState(off).batteries).toEqual({ y: { soc_pct: 12 } })
  })

  it('keeps each root separate, so real values never leak into demo or back', () => {
    const data = feed([
      ['renewvan/battery/same/soc_pct', '12'],
      ['renewvan/demo/battery/same/soc_pct', '78'],
    ])
    expect(data.real.batteries.same.soc_pct).toBe(12)
    expect(data.demo.batteries.same.soc_pct).toBe(78)
  })

  it('drops a demo value when driver-demo clears its retained topic', () => {
    const data = feed([
      ['renewvan/demo/battery/x/soc_pct', '78'],
      // driver-demo removes a retained topic with an empty payload (ADR 0008).
      ['renewvan/demo/battery/x/soc_pct', ''],
    ])
    expect(data.demo.batteries.x?.soc_pct).toBeUndefined()
  })

  it.each(['', 'on', '"true"', 'null', '1', 'yes'])(
    'ignores %j on the enabled topic: only a JSON boolean is a state',
    (bad) => {
      const on = feed([['renewvan/demo/enabled', 'true']])
      expect(feed([['renewvan/demo/enabled', bad]], on)).toBe(on)
    },
  )

  it('takes router health from the active root only', () => {
    const data = feed([
      ['renewvan/router/health', 'online'],
      ['renewvan/demo/router/health', 'offline'],
    ])
    expect(routerHealthOf(visibleState(data))).toBe('online')
    const on = feed([['renewvan/demo/enabled', 'true']], data)
    expect(routerHealthOf(visibleState(on))).toBe('offline')
  })

  it('reads an empty demo router health as no health: the real one must not show through', () => {
    const data = feed([
      ['renewvan/router/health', 'online'],
      ['renewvan/demo/enabled', 'true'],
      ['renewvan/demo/router/health', 'offline'],
      // driver-demo clears its retained topic (ADR 0008).
      ['renewvan/demo/router/health', ''],
    ])
    expect(visibleState(data).drivers.router).toBeUndefined()
    expect(routerHealthOf(visibleState(data))).toBeNull()
  })

  it('applies a demo message to the demo root only, and stamps its router time there', () => {
    const data = feed([['renewvan/demo/router/main/uptime_s', '10']])
    expect(Object.keys(data.demo.routers)).toEqual(['main'])
    expect(data.demo.routerUpdatedAt).toEqual({ main: NOW })
    expect(data.real).toBe(emptyBusData.real)
  })

  it('never reads a demo entity as a real one: demo/ is not a domain', () => {
    const data = feed([
      ['renewvan/demo/battery/house/soc_pct', '78'],
      ['renewvan/demo/router/health', 'online'],
      ['renewvan/demo/enabled/set', 'true'],
    ])
    expect(data.demoMode).toBe(false)
    expect(data.real.batteries).toEqual({})
    expect(routerHealthOf(data.real)).toBeNull()
  })

  it('keeps the kiosk, tailscale and hub topics on the real root in Demo mode', () => {
    const data = feed([
      ['renewvan/demo/enabled', 'true'],
      ['renewvan/kiosk/display/brightness', '40'],
      [
        'renewvan/tailscale/status',
        JSON.stringify({ enabled: true, connected: true, ip: null, hostname: null, peers: 2 }),
      ],
      ['renewvan/hub/primary-battery', '"512"'],
    ])
    expect(data.kiosk.brightness).toBe(40)
    expect(data.tailscale?.peers).toBe(2)
    expect(data.primaryBattery).toBe('512')
  })

  it('ignores host topics under the demo root: the simulator does not simulate them', () => {
    const data = feed([
      ['renewvan/demo/kiosk/display/brightness', '40'],
      ['renewvan/demo/tailscale/status', '{"enabled":true}'],
      ['renewvan/demo/hub/primary-battery', '"512"'],
    ])
    expect(data.kiosk.brightness).toBeNull()
    expect(data.tailscale).toBeNull()
    expect(data.primaryBattery).toBeNull()
  })

  it('keeps each root own Drivers separate, so a real Driver never shows in demo or back', () => {
    const info = (version: string) =>
      JSON.stringify({ driver: 'tank', product: 'Tank driver', source: 'ADS1115', version })
    const data = feed([
      ['renewvan/tank/info', info('v0.8.0')],
      ['renewvan/tank/health', 'online'],
      ['renewvan/demo/tank/info', info('v9.9.9-demo')],
      ['renewvan/demo/venus/health', 'offline'],
    ])
    expect(Object.keys(data.real.drivers)).toEqual(['tank'])
    expect(data.real.drivers.tank.info?.version).toBe('v0.8.0')
    expect(data.demo.drivers).toEqual({
      tank: { info: expect.objectContaining({ version: 'v9.9.9-demo' }) },
      venus: { health: 'offline' },
    })
  })

  it('drops every demo Driver when driver-demo clears its retained topics', () => {
    const data = feed([
      ['renewvan/demo/venus/health', 'online'],
      ['renewvan/demo/venus/health', ''],
    ])
    expect(data.demo.drivers).toEqual({})
  })
})

describe('structural sharing', () => {
  it('keeps the same state when an entity topic repeats the value it already had', () => {
    const data = feed([
      ['renewvan/tank/fresh/level_pct', '62'],
      ['renewvan/gps/main/position', '{"lat":47.98,"lon":7.83}'],
    ])
    expect(reduceBusMessage(data, 'renewvan/tank/fresh/level_pct', '62', NOW)).toBe(data)
    expect(
      reduceBusMessage(data, 'renewvan/gps/main/position', '{"lat":47.98,"lon":7.83}', NOW),
    ).toBe(data)
  })

  it('replaces only the slice that changed, so untouched widgets can skip re-rendering', () => {
    const data = feed([
      ['renewvan/tank/fresh/level_pct', '62'],
      ['renewvan/gps/main/position', '{"lat":47.98,"lon":7.83}'],
    ])
    const changed = reduceBusMessage(data, 'renewvan/tank/fresh/level_pct', '61', NOW)
    expect(changed).not.toBe(data)
    expect(changed.real.tanks.fresh.level_pct).toBe(61)
    expect(changed.real.gps).toBe(data.real.gps)
    expect(changed.demo).toBe(data.demo)
  })

  it.each<Message>([
    ['renewvan/demo/enabled', 'true'],
    ['renewvan/kiosk/display/brightness', '42'],
    ['renewvan/hub/status', '{"ip":"192.168.10.50","hostname":"renewvan","version":"v0.4.0"}'],
    [
      'renewvan/tailscale/status',
      '{"enabled":true,"connected":true,"ip":null,"hostname":null,"peers":2}',
    ],
    ['renewvan/hub/icons', '{"tank/fresh":"Droplet"}'],
    ['renewvan/hub/primary-battery', '"auto"'],
    ['renewvan/hub/relay-groups', '{"relay_01":"Lights"}'],
    ['renewvan/hub/relay-group-list', '["Lights"]'],
    ['renewvan/hub/relay-order', '["relay_01"]'],
    ['renewvan/relay/relay_01/state', 'true'],
    ['renewvan/tank/info', JSON.stringify(validInfo)],
    ['renewvan/tank/health', 'online'],
  ])('keeps the same state when %s is re-published unchanged', (topic, payload) => {
    const data = feed([[topic, payload]])
    expect(data).not.toBe(emptyBusData)
    expect(reduceBusMessage(data, topic, payload, NOW + 1)).toBe(data)
  })

  it.each<Message>([
    ['renewvan/hub/status', ''],
    ['renewvan/tailscale/status', ''],
    ['renewvan/hub/icons', ''],
    ['renewvan/hub/primary-battery', ''],
    ['renewvan/hub/relay-groups', ''],
    ['renewvan/hub/relay-group-list', ''],
    ['renewvan/hub/relay-order', ''],
    ['renewvan/tank/health', ''],
    ['renewvan/relay/relay_01/state', ''],
  ])(
    'returns the empty state itself when %s is cleared before it ever arrived',
    (topic, payload) => {
      expect(reduceBusMessage(emptyBusData, topic, payload, NOW)).toBe(emptyBusData)
    },
  )

  it('returns the same object for a topic it does not know', () => {
    expect(reduceBusMessage(emptyBusData, 'renewvan/unknown/thing/x/y', 'on', NOW)).toBe(
      emptyBusData,
    )
    expect(reduceBusMessage(emptyBusData, 'elsewhere/tank/fresh/level_pct', '1', NOW)).toBe(
      emptyBusData,
    )
  })
})
