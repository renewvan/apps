import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import type { ReactNode } from 'react'
import { desiredAlerts } from '@renewvan/core/alerts'
import { useRenewvanBus } from '@/bus/RenewvanBusProvider'
import { useLiveVan } from '@/bus/LiveVanProvider'
import { usePreferences } from '@/preferences/PreferencesProvider'
import { useSession } from '@/session/SessionProvider'
import { applyAlerts, logReducer, parseAlertLog, storedLog, type AlertEntry } from './alertLog'
import { dismissAlert, notifyAlert, useOpenAlertsOnTap } from './notifications'

// The alert log, kept on the phone and kept current from the Live van: the dashboard's alert history
// (`useAlertToasts` + `useAlertHistory`) as one provider. What an alert is and when it opens or
// resolves is core's alert rules (`@renewvan/core/alerts`); this is the state, the storage and the
// notifications around it. In Demo mode the demo van's alerts are listed and notified like any
// other, but never stored (`storedLog`).

const STORAGE_KEY = 'renewvan.alertHistory.v1'

interface AlertsValue {
  /** What the list shows, newest first: the log without the alerts the user deleted while open. */
  entries: AlertEntry[]
  /** Alerts whose condition still holds and that have not been deleted. */
  openCount: number
  /** Deletes one alert. An open one stays quiet until its condition clears, then may come back. */
  remove: (id: string) => void
  /** Deletes every resolved alert. */
  clearResolved: () => void
}

const AlertsContext = createContext<AlertsValue | null>(null)

export function AlertsProvider({ children }: { children: ReactNode }) {
  const { status, settled, tailscale } = useRenewvanBus()
  const van = useLiveVan()
  const { connection } = useSession()
  const { alertsEnabled } = usePreferences()
  const [entries, dispatch] = useReducer(logReducer, [])
  const [loaded, setLoaded] = useState(false)
  useOpenAlertsOnTap()

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => dispatch({ type: 'set', entries: parseAlertLog(raw) }))
      // A log that cannot be read starts empty for this run.
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  useEffect(() => {
    if (loaded)
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(storedLog(entries))).catch(() => {})
  }, [entries, loaded])

  // Every render: it is a cheap diff that changes nothing (and returns the same array) unless an
  // alert opened or resolved. Signed out there is no van to raise alerts about.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- every render, on purpose
  useEffect(() => {
    if (!loaded || connection === null) return
    const desired = desiredAlerts(van, { status, tailscale, settled })
    const next = applyAlerts(entries, desired, Date.now())
    if (next.entries === entries) return
    dispatch({ type: 'set', entries: next.entries })
    for (const entry of next.resolved) dismissAlert(entry).catch(() => {})
    if (alertsEnabled) for (const entry of next.opened) notifyAlert(entry).catch(() => {})
  })

  // Another van's alerts are not this one's: signing out forgets the log along with the van.
  useEffect(() => {
    if (loaded && connection === null) dispatch({ type: 'set', entries: [] })
  }, [loaded, connection])

  const value = useMemo<AlertsValue>(() => {
    const visible = entries.filter((e) => !e.dismissed)
    return {
      entries: visible,
      openCount: visible.filter((e) => e.resolvedAt === undefined).length,
      remove: (id) => {
        const entry = entries.find((e) => e.id === id)
        if (entry) dismissAlert(entry).catch(() => {})
        dispatch({ type: 'remove', id })
      },
      clearResolved: () => dispatch({ type: 'clearResolved' }),
    }
  }, [entries])
  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>
}

export function useAlerts(): AlertsValue {
  const value = useContext(AlertsContext)
  if (value === null) throw new Error('useAlerts needs an AlertsProvider above it')
  return value
}
