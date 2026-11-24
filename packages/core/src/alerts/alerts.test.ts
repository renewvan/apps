import { describe, expect, it } from 'vite-plus/test'
import {
  emptyRenewvanBusState,
  type Battery,
  type DriverHealth,
  type RenewvanBusState,
  type Tank,
  type TailscaleStatus,
} from '../types'
import { liveVan, type LiveVan } from '../van'
import {
  ALERT_KEYS,
  alertOnScreen,
  desiredAlerts,
  reconcile,
  savedToHistory,
  type Alert,
  type AlertLink,
} from './index'

const okTank: Tank = {
  fluid_type: 'fresh_water',
  capacity_l: 100,
  level_pct: 50,
  status: 'ok',
  volume_since_full_l: 50,
  volume_since_empty_l: 50,
}
const alarmTank: Tank = { ...okTank, level_pct: 5, alarm_state: 'alarm' }
const lowStarter: Battery = {
  soc_pct: 80,
  voltage_v: 13.2,
  current_a: 1,
  power_w: 13,
  starter_voltage_v: 11,
  starter_voltage_alarm: 'low',
}
const tankDriver = (health: DriverHealth) => ({
  tank: {
    info: { driver: 'tank', product: 'tank', source: 'test', version: 'v1', publishes: ['tank'] },
    health,
  },
})

const van = (state: Partial<RenewvanBusState> = {}, demo = false): LiveVan =>
  liveVan({
    state: { ...emptyRenewvanBusState, ...state },
    status: 'connected',
    settled: true,
    primaryBattery: null,
    relayGroups: {},
    relayGroupList: null,
    relayOrder: [],
    demoMode: demo,
  })
const link = (over: Partial<AlertLink> = {}): AlertLink => ({
  status: 'connected',
  tailscale: null,
  settled: true,
  ...over,
})
const down: TailscaleStatus = {
  enabled: true,
  connected: false,
  ip: null,
  hostname: null,
  peers: 0,
}

/** The open alerts after `desired` is applied to `open` at `now`: what each app keeps. */
function step(open: Alert[], desired: ReturnType<typeof desiredAlerts>, now: number): Alert[] {
  const { opened, resolved } = reconcile(open, desired, now)
  const gone = new Set(resolved.map((a) => a.id))
  return [...opened, ...open.filter((a) => !gone.has(a.id))]
}

describe('desiredAlerts', () => {
  it('raises a tank in alarm, the starter battery low, a lost hub and a down Tailscale', () => {
    const desired = desiredAlerts(
      van({ tanks: { t1: alarmTank }, batteries: { b: lowStarter } }),
      link({ status: 'disconnected', tailscale: down }),
    )
    expect(Object.keys(desired.holding).sort()).toEqual([
      'mqtt-connection',
      'starter-battery',
      'tailscale-connection',
      'tank:t1',
    ])
    expect(desired.holding['tank:t1']).toEqual({
      type: 'error',
      title: 'Fresh water tank alarm',
      description: 'Level requires attention.',
    })
    expect(desired.holding['starter-battery']).toEqual({
      type: 'warning',
      title: 'Starter battery low',
      description: 'Drive the van, or run an emergency charge from VictronConnect.',
    })
    expect(desired.holding['mqtt-connection'].title).toBe('Hub connection lost')
    expect(desired.holding['tailscale-connection'].title).toBe('Tailscale disconnected')
  })

  it('raises nothing for a quiet van, and nothing about a Tailscale it has not heard of', () => {
    expect(desiredAlerts(van({ tanks: { t1: okTank } }), link()).holding).toEqual({})
  })

  it('never raises an alarm from a tank that is not reporting: partial, or its Driver offline', () => {
    const partial = van({ tanks: { t1: { alarm_state: 'alarm' } as Tank } })
    expect(desiredAlerts(partial, link()).holding).toEqual({})
    const offline = van({ tanks: { t1: alarmTank }, drivers: tankDriver('offline') })
    expect(desiredAlerts(offline, link()).holding).toEqual({})
  })
})

describe('reconcile', () => {
  const alarm = desiredAlerts(van({ tanks: { t1: alarmTank } }), link())
  const quiet = desiredAlerts(van({ tanks: { t1: okTank } }), link())

  it('opens a new alert once, with its key, id and time', () => {
    const first = reconcile([], alarm, 100)
    expect(first.opened).toEqual([
      {
        key: 'tank:t1',
        id: 'tank:t1-100',
        createdAt: 100,
        type: 'error',
        title: 'Fresh water tank alarm',
        description: 'Level requires attention.',
      },
    ])
    const again = reconcile(first.opened, alarm, 200)
    expect(again).toEqual({ opened: [], resolved: [] })
  })

  it('resolves an alert whose condition cleared, stamping when', () => {
    const open = reconcile([], alarm, 100).opened
    expect(reconcile(open, quiet, 200).resolved).toEqual([{ ...open[0], resolvedAt: 200 }])
  })

  it('reads only the open alerts: a resolved one comes back as a fresh alert', () => {
    const open = reconcile([], alarm, 100).opened
    const closed = reconcile(open, quiet, 200).resolved
    const back = reconcile(closed, alarm, 300)
    expect(back.opened.map((a) => a.id)).toEqual(['tank:t1-300'])
    expect(back.resolved).toEqual([])
  })

  it('keeps the extra fields an app stores on an open alert', () => {
    const open = reconcile([], alarm, 100).opened.map((a) => ({ ...a, dismissed: true }))
    expect(reconcile(open, quiet, 200).resolved[0].dismissed).toBe(true)
  })

  it('does not resolve a tank alarm whose Driver went offline: its level is unknown, not fine', () => {
    const open = reconcile([], alarm, 100).opened
    const dead = desiredAlerts(
      van({ tanks: { t1: { ...okTank } }, drivers: tankDriver('offline') }),
      link(),
    )
    expect(reconcile(open, dead, 200)).toEqual({ opened: [], resolved: [] })
  })

  it('does not resolve a tank alarm while the tank is Silent, nor the starter alert while a battery is', () => {
    const open = reconcile(
      [],
      desiredAlerts(van({ tanks: { t1: alarmTank }, batteries: { b: lowStarter } }), link()),
      100,
    ).opened
    const silent = desiredAlerts(
      van({
        tanks: { t1: { fluid_type: 'fresh_water' } as Tank },
        batteries: { b: { name: 'SmartShunt' } } as never,
      }),
      link(),
    )
    expect(reconcile(open, silent, 200).resolved).toEqual([])
  })

  it('resolves a tank alarm once its tank is gone from the bus', () => {
    const open = reconcile([], alarm, 100).opened
    expect(reconcile(open, desiredAlerts(van(), link()), 200).resolved).toHaveLength(1)
  })

  it('does not resolve van alerts before the retained state has settled, but does the hub one', () => {
    const open = reconcile(
      [],
      desiredAlerts(van({ tanks: { t1: alarmTank } }), link({ status: 'disconnected' })),
      100,
    ).opened
    const unsettled = desiredAlerts(van(), link({ settled: false }))
    expect(reconcile(open, unsettled, 200).resolved.map((a) => a.key)).toEqual(['mqtt-connection'])
  })

  it('holds the hub connection alert while a reconnect is under way', () => {
    const open = reconcile([], desiredAlerts(van(), link({ status: 'disconnected' })), 100).opened
    const connecting = desiredAlerts(van(), link({ status: 'connecting', settled: false }))
    expect(reconcile(open, connecting, 200)).toEqual({ opened: [], resolved: [] })
  })
})

describe('Demo mode', () => {
  const real = reconcile([], desiredAlerts(van({ tanks: { t1: alarmTank } }), link()), 100).opened
  const demoAlarm = desiredAlerts(van({ tanks: { t1: alarmTank } }, true), link())
  const demoQuiet = desiredAlerts(van({ tanks: { t1: okTank } }, true), link())

  it('raises the demo van alerts under their own keys, next to the real ones', () => {
    expect(Object.keys(demoAlarm.holding)).toEqual(['demo:tank:t1'])
    expect(reconcile(real, demoAlarm, 200).opened.map((a) => a.key)).toEqual(['demo:tank:t1'])
  })

  it('never saves a demo alert to history; every other alert is', () => {
    const [demo] = reconcile([], demoAlarm, 100).opened
    expect(savedToHistory(demo)).toBe(false)
    expect(savedToHistory(real[0])).toBe(true)
    expect(savedToHistory({ key: ALERT_KEYS.hubLink })).toBe(true)
  })

  it('keeps the real van alerts open while the demo van is shown, and resolves them after if cleared', () => {
    expect(reconcile(real, demoQuiet, 200).resolved).toEqual([])
    const back = desiredAlerts(van({ tanks: { t1: okTank } }), link())
    expect(reconcile(real, back, 300).resolved.map((a) => a.key)).toEqual(['tank:t1'])
  })

  it('resolves the demo alerts once Demo mode ends', () => {
    const demo = reconcile([], demoAlarm, 100).opened
    const off = desiredAlerts(van({ tanks: { t1: alarmTank } }), link())
    expect(reconcile(demo, off, 200).resolved.map((a) => a.key)).toEqual(['demo:tank:t1'])
  })

  it('shows the van alerts of the van on screen and the link alerts always', () => {
    const [demo] = reconcile([], demoAlarm, 100).opened
    const hub = { key: ALERT_KEYS.hubLink }
    expect([alertOnScreen(real[0], false), alertOnScreen(demo, false)]).toEqual([true, false])
    expect([alertOnScreen(real[0], true), alertOnScreen(demo, true)]).toEqual([false, true])
    expect([alertOnScreen(hub, false), alertOnScreen(hub, true)]).toEqual([true, true])
  })

  it('a real alarm still open after a demo round trip is the same alert, not a second one', () => {
    let open = real
    open = step(open, demoAlarm, 200)
    open = step(open, desiredAlerts(van({ tanks: { t1: alarmTank } }), link()), 300)
    expect(open).toEqual(real)
  })
})
