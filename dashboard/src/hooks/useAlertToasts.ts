import { toast } from '@heroui/react'
import { useEffect, useRef } from 'react'
import {
  alertOnScreen,
  desiredAlerts,
  reconcile,
  savedToHistory,
  type Alert,
} from '@renewvan/core/alerts'
import type { LiveVan } from '@renewvan/core/van'
import {
  acknowledgeAlertHistoryEntry,
  appendAlertHistoryEntry,
  resolveAlertHistoryEntry,
} from '@/lib/alertHistory'
import type { ConnectionStatus, TailscaleStatus } from './useRenewvanBus'

// The alerts as toasts, plus their persistent history (`lib/alertHistory.ts`). Which alerts are
// open, when they open and resolve, and the Demo mode rule are core's (`@renewvan/core/alerts`):
// this hook only shows them and writes them down.
//
// HeroUI's `toast.*` has no "toast per alert, upsert on change" primitive: each call mints a new
// id. A ref of the open alerts, by key, holds each one's live toast id and history entry id.
//
// Every alert is state-driven (the kiosk may sit unwatched: an alert must not disappear while its
// condition holds), so every toast has `timeout: 0`: it closes when core resolves the alert, when
// it leaves the screen (muted, or the real van's alert while the demo van is shown), or when the
// driver dismisses it. "Acknowledged" (`acknowledgedAt` in the history) is only the last: HeroUI
// fires the one `onClose` for every close, so `programmaticCloses` holds the ids this hook is
// closing itself, and `onClose` acknowledges only a close that is not in it.

interface OpenAlert {
  alert: Alert
  /** `null` while not on screen (muted, or another van's), or after the driver dismissed it. */
  toastId: string | null
  /** The driver dismissed the toast: it is not shown again while the alert stays open. */
  dismissed: boolean
  /** `null` for a demo alert: shown, never written to the persistent history (`savedToHistory`). */
  historyId: string | null
}

interface AlertToastArgs {
  /** The Live van: the demo one while Demo mode is on. */
  van: LiveVan
  status: ConnectionStatus
  tailscale: TailscaleStatus | null
  /** Kiosk preference (`useAlertsEnabled`): `false` suppresses toasts only; the history keeps
   * recording so nothing is lost while muted. */
  enabled: boolean
}

export function useAlertToasts({ van, status, tailscale, enabled }: AlertToastArgs): void {
  const openAlerts = useRef(new Map<string, OpenAlert>())
  const programmaticCloses = useRef(new Set<string>())

  useEffect(() => {
    const open = openAlerts.current
    const closeToast = (id: string) => {
      programmaticCloses.current.add(id)
      toast.close(id)
    }

    // The dashboard has no settle timer: the retained state counts as arrived once connected.
    const desired = desiredAlerts(van, { status, tailscale, settled: status === 'connected' })
    const current = [...open.values()].map((o) => o.alert)
    const { opened, resolved } = reconcile(current, desired, Date.now())
    for (const alert of resolved) {
      const entry = open.get(alert.key)
      if (entry === undefined) continue
      if (entry.toastId !== null) closeToast(entry.toastId)
      if (entry.historyId !== null) resolveAlertHistoryEntry(entry.historyId)
      open.delete(alert.key)
    }
    for (const alert of opened) {
      const { key, type, title, description } = alert
      const historyId = savedToHistory(alert)
        ? appendAlertHistoryEntry({ key, type, title, description })
        : null
      open.set(alert.key, { alert, toastId: null, dismissed: false, historyId })
    }

    for (const [key, entry] of open) {
      const shown = enabled && !entry.dismissed && alertOnScreen(entry.alert, van.demo)
      if (shown && entry.toastId === null) {
        const options = {
          description: entry.alert.description,
          timeout: 0,
          onClose: () => {
            if (programmaticCloses.current.delete(toastId)) return
            const now = open.get(key)
            if (now?.toastId === toastId) open.set(key, { ...now, toastId: null, dismissed: true })
            if (entry.historyId !== null) acknowledgeAlertHistoryEntry(entry.historyId)
          },
        }
        const toastId =
          entry.alert.type === 'error'
            ? toast.danger(entry.alert.title, options)
            : toast.warning(entry.alert.title, options)
        open.set(key, { ...entry, toastId })
      } else if (!shown && entry.toastId !== null) {
        // Off screen without the driver dismissing it: not an acknowledgement.
        closeToast(entry.toastId)
        open.set(key, { ...entry, toastId: null })
      }
    }
  }, [van, status, tailscale, enabled])
}
