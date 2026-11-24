import { describe, expect, it } from 'vite-plus/test'
import {
  emptyRenewvanBusState,
  type Battery,
  type Charger,
  type DriverHealth,
  type Gps,
  type RenewvanBusState,
  type Solar,
  type Tank,
  type TemperatureSensor,
} from '../types'
import { instanceStateText, liveVan, type LiveVanInput } from './liveVan'

const battery = (soc: number, extra: Partial<Battery> = {}): Battery => ({
  soc_pct: soc,
  voltage_v: 13.2,
  current_a: 1,
  power_w: 13,
  ...extra,
})

const solar = (powerW: number): Solar => ({ power_w: powerW, battery_voltage_v: 13.4 })

const tank = (fluid: Tank['fluid_type'], level = 50): Tank => ({
  fluid_type: fluid,
  capacity_l: 100,
  level_pct: level,
  status: 'ok',
  volume_since_full_l: 0,
  volume_since_empty_l: 0,
})

const FIX: Gps = {
  fix_quality: 'gps',
  satellites_in_use: 7,
  latitude: 48,
  longitude: 7.8,
} as Gps

/** A Driver with info that publishes `types`, and its health (absent: no health yet). */
const driver = (key: string, types: string[], health?: DriverHealth) => ({
  [key]: {
    info: { driver: key, product: key, source: 'test', version: 'v1.0.0', publishes: types },
    ...(health && { health }),
  },
})

function input(
  state: Partial<RenewvanBusState> = {},
  rest: Partial<Omit<LiveVanInput, 'state'>> = {},
): LiveVanInput {
  return {
    state: { ...emptyRenewvanBusState, ...state },
    primaryBattery: null,
    relayGroups: {},
    relayGroupList: null,
    relayOrder: [],
    demoMode: false,
    status: 'connected',
    settled: true,
    ...rest,
  }
}

const van = (...args: Parameters<typeof input>) => liveVan(input(...args))

describe('liveVan: complete entities only', () => {
  it('drops the records that have not fully arrived, keeping the complete ones', () => {
    const v = van({
      tanks: { fresh: tank('fresh_water'), grey: { fluid_type: 'grey_water' } as Tank },
      batteries: { house: battery(80), half: { soc_pct: 50 } as Battery },
      solar: { roof: solar(100), half: { power_w: 5 } as Solar },
      chargers: { dcdc: { voltage_v: 14 }, half: { source: 'ac' } as Charger },
      gps: { gps0: FIX, half: { fix_quality: 'gps' } as Gps },
    })
    expect(Object.keys(v.tanks)).toEqual(['fresh'])
    expect(Object.keys(v.batteries)).toEqual(['house'])
    expect(Object.keys(v.solar)).toEqual(['roof'])
    expect(Object.keys(v.chargers)).toEqual(['dcdc'])
  })

  it('lists the complete tanks in the Tanks page order, and the first of each fluid', () => {
    const v = van({
      tanks: {
        zeta: tank('fresh_water', 10),
        grey: tank('grey_water'),
        fresh: tank('fresh_water', 90),
        half: { fluid_type: 'black_water' } as Tank,
      },
    })
    expect(v.tankIds).toEqual(['fresh', 'grey', 'zeta'])
    // Arrival order picks the fluid's tank, as every Start widget and ring did.
    expect(v.tanksByFluid.fresh_water).toEqual({ id: 'zeta', tank: tank('fresh_water', 10) })
    expect(v.tanksByFluid.grey_water?.id).toBe('grey')
    expect(v.tanksByFluid.black_water).toBeUndefined()
  })

  it('takes the first complete GPS record, with or without a position', () => {
    const noFix = { fix_quality: 'no_fix', satellites_in_use: 0 } as Gps
    expect(van({ gps: { half: { fix_quality: 'gps' } as Gps, gps0: noFix } }).gps).toEqual({
      id: 'gps0',
      record: noFix,
    })
    expect(van().gps).toBeUndefined()
  })
})

describe('liveVan: batteries and power', () => {
  const batteries = { '10': battery(10), '9': battery(9), half: { soc_pct: 1 } as Battery }

  it('resolves Auto to the first complete battery by sorted id', () => {
    expect(van({ batteries }).primaryBattery).toEqual({
      id: '9',
      battery: battery(9),
      mode: 'auto',
    })
  })

  it('reads the chosen battery while it is complete', () => {
    expect(van({ batteries }, { primaryBattery: '10' }).primaryBattery?.id).toBe('10')
  })

  it('falls back to Auto when the chosen battery is missing or incomplete', () => {
    expect(van({ batteries }, { primaryBattery: 'half' }).primaryBattery).toMatchObject({
      id: '9',
      mode: 'fallback',
    })
    expect(van({ batteries }, { primaryBattery: 'gone' }).primaryBattery?.mode).toBe('fallback')
  })

  it('has no Primary battery while none is complete', () => {
    expect(van({ batteries: { half: { soc_pct: 1 } as Battery } }).primaryBattery).toBeUndefined()
  })

  it('reads the starter battery, from a monitor or an alternator charger', () => {
    expect(van().starterBattery).toBeUndefined()
    expect(
      van({ batteries: { house: battery(80, { starter_voltage_v: 12.6 }) } }).starterBattery,
    ).toEqual({ voltage: 12.6, low: false, source: 'battery' })
    expect(
      van({
        chargers: {
          dcdc: {
            voltage_v: 14,
            source: 'alternator',
            input_voltage_v: 11.9,
            input_voltage_alarm: 'low',
          },
        },
      }).starterBattery,
    ).toEqual({ voltage: 11.9, low: true, source: 'charger' })
  })

  it('takes the first complete solar controller, with its id', () => {
    const v = van({ solar: { half: { power_w: 1 } as Solar, roof: solar(240) } })
    expect(v.firstSolar).toEqual({ id: 'roof', solar: solar(240) })
    expect(van().firstSolar).toBeUndefined()
  })

  it('draws one power snapshot from the Primary battery', () => {
    const v = van(
      { batteries: { a: battery(50, { power_w: -40 }), b: battery(90, { power_w: 200 }) } },
      { primaryBattery: 'b' },
    )
    expect(v.flow.nodes.battery).toMatchObject({ present: true, instance: 'battery:b' })
    expect(v.flow.nodes.battery.watts).toBe(200)
  })

  it('draws an absent battery in the snapshot while no battery is complete', () => {
    expect(van().flow.nodes.battery.present).toBe(false)
  })
})

describe('liveVan: tilt', () => {
  const tilt = { tilt: { roll_deg: 1, pitch_deg: 4, status: 'ok' as const } }

  it('reads the first tilt record while its Driver is online', () => {
    const v = van({ tilt, drivers: driver('tilt', ['tilt'], 'online') })
    expect(v.tilt).toEqual({ record: tilt.tilt, driverOffline: false })
  })

  it('reads tilt as unknown while its Driver is offline, though the angles stay retained', () => {
    const v = van({ tilt, drivers: driver('tilt', ['tilt'], 'offline') })
    expect(v.tilt).toEqual({ record: undefined, driverOffline: true })
  })

  it('reads the tilt again once the Driver is back', () => {
    const offline = input({ tilt, drivers: driver('tilt', ['tilt'], 'offline') })
    const back = { ...offline.state, drivers: driver('tilt', ['tilt'], 'online') }
    expect(liveVan({ ...offline, state: back }).tilt.record).toEqual(tilt.tilt)
  })

  it('keeps a tilt that no Driver has announced, or whose health has not arrived', () => {
    expect(van({ tilt }).tilt.record).toEqual(tilt.tilt)
    expect(van({ tilt, drivers: driver('tilt', ['tilt']) }).tilt.record).toEqual(tilt.tilt)
  })
})

describe('liveVan: what can be controlled', () => {
  it('trusts the heater only while every heater Driver is online', () => {
    const online = driver('autoterm', ['heater'], 'online')
    expect(van({ drivers: online }).heaterTrust).toEqual({
      driverOnline: true,
      demo: false,
      controllable: true,
    })
    expect(
      van({ drivers: { ...online, ...driver('webasto', ['heater'], 'offline') } }).heaterTrust
        .driverOnline,
    ).toBe(false)
    // Info but no health yet: half-started, not trusted.
    expect(van({ drivers: driver('autoterm', ['heater']) }).heaterTrust.driverOnline).toBe(false)
  })

  it('does not trust a heater no Driver publishes', () => {
    expect(van({ heaters: { cabin: { phase: 'running' } } }).heaterTrust).toEqual({
      driverOnline: false,
      demo: false,
      controllable: false,
    })
  })

  it('shows Demo mode as not controllable, whatever the Driver says', () => {
    const v = van(
      {
        drivers: {
          ...driver('autoterm', ['heater'], 'online'),
          ...driver('relay', ['relay'], 'online'),
        },
      },
      { demoMode: true },
    )
    expect(v.demo).toBe(true)
    expect(v.heaterTrust).toEqual({ driverOnline: true, demo: true, controllable: false })
    expect(v.relayTrust).toEqual({ driverOnline: true, demo: true, controllable: false })
  })

  it('trusts the relays only while every relay Driver is online', () => {
    expect(van({ drivers: driver('esp32-a', ['relay'], 'online') }).relayTrust.controllable).toBe(
      true,
    )
    expect(van({ drivers: driver('esp32-a', ['relay'], 'offline') }).relayTrust).toEqual({
      driverOnline: false,
      demo: false,
      controllable: false,
    })
    expect(van({ relays: { r1: { state: true } } }).relayTrust.driverOnline).toBe(false)
    // Info but no health yet: half-started, not trusted.
    expect(van({ drivers: driver('esp32-a', ['relay']) }).relayTrust.driverOnline).toBe(false)
  })
})

describe('liveVan: router', () => {
  it('chooses the first router, with its Driver health and when it last spoke', () => {
    const v = van({
      routers: { rut: { operator: '26203' }, other: { operator: '1' } } as never,
      routerUpdatedAt: { rut: 1000, other: 2000 },
      drivers: { router: { health: 'online' } },
    })
    expect(v.router).toEqual({
      id: 'rut',
      record: { operator: '26203' },
      health: 'online',
      updatedAt: 1000,
    })
  })

  it('has a health but no record while the router Driver has spoken and its data has not', () => {
    expect(van({ drivers: { router: { health: 'offline' } } }).router).toEqual({
      id: undefined,
      record: undefined,
      health: 'offline',
      updatedAt: undefined,
    })
    expect(van().router.health).toBeNull()
  })
})

describe('liveVan: capabilities', () => {
  const offlineTanks = {
    tanks: { fresh: tank('fresh_water') },
    drivers: driver('tank', ['tank'], 'offline'),
  }

  it('reads a type as present, with its count and offline Driver', () => {
    expect(van(offlineTanks).capabilities.tank).toEqual({
      state: 'present',
      count: 1,
      offline: true,
      controllable: false,
    })
    expect(van(offlineTanks).capabilities.gps.state).toBe('absent')
  })

  it('reads a missing type as loading until the bus has settled', () => {
    expect(van({}, { settled: false }).capabilities.gps.state).toBe('loading')
  })

  it('reads nothing as offline while the hub link is down: the banner says so', () => {
    expect(van(offlineTanks, { status: 'disconnected' }).capabilities.tank.offline).toBe(false)
    expect(van(offlineTanks, { status: 'connecting' }).capabilities.tank.state).toBe('present')
  })
})

describe('liveVan: Drivers and relay groups', () => {
  it('lists the Driver rows, a fallback row for a type no Driver claims', () => {
    const v = van({
      drivers: driver('tank', ['tank'], 'online'),
      gps: { gps0: FIX },
    })
    expect(v.drivers.map((row) => row.key)).toEqual(['domain:gps', 'tank'])
  })

  it('resolves the relay groups, Unassigned last until the hub moves it', () => {
    expect(van().relayGroups.list).toEqual([
      'Lights',
      'Appliances',
      'USB',
      'Water',
      'Heating',
      'Unassigned',
    ])
    expect(van({}, { relayGroupList: ['Unassigned', 'Lights'] }).relayGroups.list).toEqual([
      'Unassigned',
      'Lights',
    ])
  })

  it('carries the relay assignments and order as the hub has them', () => {
    const v = van({}, { relayGroups: { r1: 'Lights' }, relayOrder: ['r2', 'r1'] })
    expect(v.relayGroups.assignments).toEqual({ r1: 'Lights' })
    expect(v.relayGroups.order).toEqual(['r2', 'r1'])
  })
})

describe('liveVan: references', () => {
  it('returns the previous Live van while nothing it shows has changed', () => {
    const first = van({ tanks: { fresh: tank('fresh_water') } })
    // A new bus state with the same content (every message replaces the state object).
    const again = liveVan(input({ tanks: { fresh: tank('fresh_water') } }), first)
    expect(again).toBe(first)
  })

  it('keeps every unchanged part, and replaces only what changed', () => {
    const first = van({ tanks: { fresh: tank('fresh_water') }, gps: { gps0: FIX } })
    const next = liveVan(
      input({ tanks: { fresh: tank('fresh_water', 20) }, gps: { gps0: FIX } }),
      first,
    )
    expect(next).not.toBe(first)
    expect(next.gps).toBe(first.gps)
    expect(next.capabilities).toBe(first.capabilities)
    expect(next.tanks).not.toBe(first.tanks)
    expect(next.tanks.fresh.level_pct).toBe(20)
  })
})

describe('liveVan: Silent instances', () => {
  // A Victron BlueSmart AC charger without shore power: its Driver keeps the identity retained and
  // clears the live values, `voltage_v` among them.
  const BLUESMART = { driver: 'vedirect', name: 'BlueSmart', source: 'ac' } as Charger
  const vedirect = (health?: DriverHealth) => driver('vedirect', ['charger'], health)

  it('keeps a charger whose live values its online Driver cleared, as Silent', () => {
    const v = van({ chargers: { bluesmart: BLUESMART }, drivers: vedirect('online') })
    expect(v.instances.charger).toEqual([{ id: 'bluesmart', state: 'silent', record: BLUESMART }])
    // The reporting map stays what the calculations read.
    expect(v.chargers).toEqual({})
  })

  it('reads the same charger as unknown while its Driver is offline', () => {
    const v = van({ chargers: { bluesmart: BLUESMART }, drivers: vedirect('offline') })
    expect(v.instances.charger).toEqual([{ id: 'bluesmart', state: 'unknown', record: BLUESMART }])
  })

  it('reads it as reporting once its voltage arrives', () => {
    const live = { ...BLUESMART, voltage_v: 13.6, power_w: 120 }
    const v = van({ chargers: { bluesmart: live }, drivers: vedirect('online') })
    expect(v.instances.charger).toEqual([{ id: 'bluesmart', state: 'reporting', record: live }])
    expect(v.chargers).toEqual({ bluesmart: live })
  })

  it('never draws a Silent instance in the power flow, the Primary battery or the starter', () => {
    const v = van({
      batteries: { '0': { name: 'House', driver: 'vedirect' } as Battery, '1': battery(70) },
      solar: { roof: { name: 'Roof', driver: 'vedirect' } as Solar },
      chargers: {
        bluesmart: BLUESMART,
        orion: { driver: 'vedirect', name: 'Orion', source: 'alternator' } as Charger,
      },
      drivers: vedirect('online'),
    })
    expect(v.primaryBattery?.id).toBe('1')
    expect(v.starterBattery).toBeUndefined()
    expect(v.flow.nodes.shore.present).toBe(false)
    expect(v.flow.nodes.alternator.present).toBe(false)
    expect(v.flow.nodes.solar.present).toBe(false)
    expect(v.firstSolar).toBeUndefined()
    expect(v.instances.battery.map(({ id, state }) => [id, state])).toEqual([
      ['0', 'silent'],
      ['1', 'reporting'],
    ])
  })

  it('lists every entity type it shows, each instance with its state', () => {
    const v = van({
      tanks: {
        grey: { name: 'Grey', fluid_type: 'grey_water', capacity_l: 80 } as Tank,
        fresh: tank('fresh_water'),
      },
      solar: { roof: { name: 'Roof' } as Solar, rear: solar(40) },
      temperatures: {
        outdoor: { name: 'Outdoor', unit: 'C', source: 'w1' } as TemperatureSensor,
        indoor: { name: 'Indoor', unit: 'C', source: 'w1', status: 'ok', temperature_c: 20 },
      },
      relays: { 'relay-01': { driver: 'esp32-a', name: 'Lights' } },
      drivers: driver('esp32-a', ['relay'], 'online'),
    })
    const states = (list: { id: string; state: string }[]) => list.map((i) => [i.id, i.state])
    // Each in the order its page lists it: tanks and sensors their own, the rest by id.
    expect(states(v.instances.tank)).toEqual([
      ['fresh', 'reporting'],
      ['grey', 'silent'],
    ])
    expect(states(v.instances.solar)).toEqual([
      ['rear', 'reporting'],
      ['roof', 'silent'],
    ])
    expect(states(v.instances.temperature)).toEqual([
      ['outdoor', 'silent'],
      ['indoor', 'reporting'],
    ])
    expect(states(v.instances.relay)).toEqual([['relay-01', 'silent']])
    expect(v.tankIds).toEqual(['fresh'])
  })

  it('attributes an instance with no driver to every Driver that publishes its type', () => {
    const legacy = { tanks: { grey: { fluid_type: 'grey_water' } as Tank } }
    const state = (drivers: RenewvanBusState['drivers']) =>
      van({ ...legacy, drivers }).instances.tank[0].state
    expect(state(driver('tank', ['tank'], 'offline'))).toBe('unknown')
    // One of its possible Drivers is online: it may be that one's, so it is only Silent.
    expect(
      state({ ...driver('tank', ['tank'], 'offline'), ...driver('b', ['tank'], 'online') }),
    ).toBe('silent')
    // Nothing says its Driver is offline: no Driver publishes tanks, or its health is not known.
    expect(state({})).toBe('silent')
    expect(state(driver('tank', ['tank']))).toBe('silent')
  })

  it('reads an instance whose named Driver is not on the bus as Silent', () => {
    expect(van({ chargers: { bluesmart: BLUESMART } }).instances.charger[0].state).toBe('silent')
  })

  it('reads a relay as unknown while its Driver is not online, whatever its state says', () => {
    const relays = { 'relay-01': { driver: 'esp32-a', state: true } }
    const state = (health?: DriverHealth) =>
      van({ relays, drivers: driver('esp32-a', ['relay'], health) }).instances.relay[0].state
    expect(state('online')).toBe('reporting')
    expect(state('offline')).toBe('unknown')
    expect(state()).toBe('unknown')
  })
})

describe('instanceStateText', () => {
  it('reads a Silent charger as Off, any other Silent instance as Not reporting', () => {
    expect(instanceStateText('charger', 'silent')).toBe('Off')
    expect(instanceStateText('solar', 'silent')).toBe('Not reporting')
    expect(instanceStateText('tank', 'silent')).toBe('Not reporting')
  })

  it('reads an unknown instance as Driver offline', () => {
    expect(instanceStateText('charger', 'unknown')).toBe('Driver offline')
    expect(instanceStateText('temperature', 'unknown')).toBe('Driver offline')
  })
})
