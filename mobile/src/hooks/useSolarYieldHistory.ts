import { useEffect, useMemo, useState } from 'react'
import { yieldHistoryFromPoints, type FluxPoint, dailyYieldQuery } from '@renewvan/core/history'
import { queryInflux } from '@/lib/influx'
import { useSession } from '@/session/SessionProvider'
import type { Solar } from '@/types'
import type { LiveVan } from '@renewvan/core/van'
import { useNow } from './useNow'

/** Today's bar is the day's running maximum, so it is re-read now and then. */
const REFRESH_MS = 5 * 60_000

/**
 * A solar controller's daily harvest, newest first (index 0 is today), from the hub's InfluxDB
 * history. Falls back to `controllerLog` (the controller's own, much shorter, log from the bus)
 * while the query is loading, when InfluxDB is unreachable, or when it holds no days yet. The
 * points are indexed against the current day on every render, so the days stay right across
 * midnight; they belong to one controller and window, so another controller never shows them.
 */
export function useSolarYieldHistory(
  id: string | undefined,
  controllerLog: (number | null)[] | undefined,
  days: number,
): (number | null)[] | undefined {
  const [result, setResult] = useState<{ id: string; days: number; points: FluxPoint[] }>()
  const now = useNow(REFRESH_MS)
  const target = useSession().connection?.target
  // A direct broker connection has no hub, so no InfluxDB: the controller's log charts.
  const origin = target?.kind === 'hub' ? target.origin : undefined
  useEffect(() => {
    if (id === undefined || origin === undefined) return
    const abort = new AbortController()
    let inFlight = false
    const load = () => {
      // A slow hub must not stack queries: one in flight, the next tick tries again.
      if (inFlight) return
      inFlight = true
      queryInflux(origin, dailyYieldQuery({ id, days }), abort.signal)
        .then((points) => {
          if (abort.signal.aborted) return
          setResult({ id, days, points })
        })
        .catch((error: unknown) => {
          if (abort.signal.aborted) return
          // Offline hub: the controller's log still charts.
          console.warn('Solar history unavailable from InfluxDB', error)
        })
        .finally(() => {
          inFlight = false
        })
    }
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => {
      abort.abort()
      clearInterval(timer)
    }
  }, [id, origin, days])
  const fromInflux =
    result !== undefined && result.id === id && result.days === days
      ? yieldHistoryFromPoints(result.points, days, now)
      : undefined
  return fromInflux ?? controllerLog
}

/**
 * The first solar controller (the Live van's `firstSolar`) with its harvest history taken from the
 * hub's InfluxDB (see `useSolarYieldHistory`), for the pages that chart it. `undefined` until a
 * controller is complete.
 */
export function useFirstSolarWithHistory(
  first: LiveVan['firstSolar'],
  days: number,
): Solar | undefined {
  const record = first?.solar
  const history = useSolarYieldHistory(first?.id, record?.yield_history_wh, days)
  return useMemo(
    () => (record ? { ...record, yield_history_wh: history } : undefined),
    [record, history],
  )
}
