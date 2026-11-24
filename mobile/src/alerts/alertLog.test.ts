import { desiredAlerts } from '@renewvan/core/alerts'
import { liveVan } from '@renewvan/core/van'
import { applyAlerts, logReducer, parseAlertLog, storedLog, type AlertEntry } from './alertLog'
import { emptyRenewvanBusState, type Tank } from '@/types'

// The log's wiring only: which alerts are open is core's (`@renewvan/core/alerts`, tested there).

const okTank: Tank = {
  fluid_type: 'fresh_water',
  level_pct: 50,
  capacity_l: 100,
  status: 'ok',
  volume_since_full_l: 50,
  volume_since_empty_l: 50,
}
const alarmTank: Tank = { ...okTank, level_pct: 5, alarm_state: 'alarm' }

/** What core wants open for a van with one fresh-water tank, the demo van's when `demo`. */
const desired = (tank: Tank, demo = false) =>
  desiredAlerts(
    liveVan({
      state: { ...emptyRenewvanBusState, tanks: { t1: tank } },
      status: 'connected',
      settled: true,
      primaryBattery: null,
      relayGroups: {},
      relayGroupList: null,
      relayOrder: [],
      demoMode: demo,
    }),
    { status: 'connected', tailscale: null, settled: true },
  )

describe('applyAlerts', () => {
  it('logs a tank alarm on the Live van once, newest first', () => {
    const first = applyAlerts([], desired(alarmTank), 100)
    expect(first.entries.map((e) => [e.key, e.title])).toEqual([
      ['tank:t1', 'Fresh water tank alarm'],
    ])
    expect(first.opened).toEqual(first.entries)
    const again = applyAlerts(first.entries, desired(alarmTank), 200)
    expect(again.entries).toBe(first.entries)
  })

  it('keeps the row of a resolved alert, stamped', () => {
    const { entries } = applyAlerts([], desired(alarmTank), 100)
    const done = applyAlerts(entries, desired(okTank), 200)
    expect(done.entries.map((e) => e.resolvedAt)).toEqual([200])
    expect(done.resolved).toHaveLength(1)
  })

  it('drops a deleted open alert without a row once it clears', () => {
    const { entries } = applyAlerts([], desired(alarmTank), 100)
    const deleted = logReducer(entries, { type: 'remove', id: entries[0].id })
    expect(applyAlerts(deleted, desired(alarmTank), 200).opened).toEqual([])
    const cleared = applyAlerts(deleted, desired(okTank), 300)
    expect(cleared.entries).toEqual([])
    expect(cleared.resolved).toHaveLength(1)
  })

  it('shows a demo van alarm live but never stores it, and drops its row once it clears', () => {
    const demo = applyAlerts([], desired(alarmTank, true), 100)
    expect(demo.opened.map((e) => e.key)).toEqual(['demo:tank:t1'])
    expect(storedLog(demo.entries)).toEqual([])
    expect(applyAlerts(demo.entries, desired(alarmTank), 200).entries).toEqual([
      expect.objectContaining({ key: 'tank:t1' }),
    ])
  })

  it('keeps at most 200 rows', () => {
    const many: AlertEntry[] = Array.from({ length: 200 }, (_, i) => ({
      type: 'error',
      title: 't',
      description: 'd',
      id: `o${i}`,
      key: `tank:${i}`,
      createdAt: i,
      resolvedAt: i,
    }))
    expect(applyAlerts(many, desired(alarmTank), 999).entries).toHaveLength(200)
  })
})

describe('parseAlertLog', () => {
  it('reads back a log and drops rows that are not alerts', () => {
    const good = { id: 'a', key: 'k', type: 'warning', title: 't', description: 'd', createdAt: 1 }
    expect(parseAlertLog(JSON.stringify([good, { id: 'b' }, 3, null]))).toEqual([good])
  })

  it('treats nothing, junk or a non-array as an empty log', () => {
    expect(parseAlertLog(null)).toEqual([])
    expect(parseAlertLog('not json')).toEqual([])
    expect(parseAlertLog('{"a":1}')).toEqual([])
  })
})

describe('logReducer', () => {
  const row = (id: string, resolvedAt?: number): AlertEntry => ({
    id,
    key: `tank:${id}`,
    type: 'error',
    title: 't',
    description: 'd',
    createdAt: 1,
    resolvedAt,
  })
  const log = [row('open'), row('done', 5)]

  it('drops a resolved alert, and only hides an open one so it is not raised again at once', () => {
    expect(logReducer(log, { type: 'remove', id: 'done' })).toEqual([row('open')])
    expect(logReducer(log, { type: 'remove', id: 'open' })).toEqual([
      { ...row('open'), dismissed: true },
      row('done', 5),
    ])
  })

  it('clears every resolved alert and keeps the open ones', () => {
    expect(logReducer(log, { type: 'clearResolved' })).toEqual([row('open')])
  })
})
