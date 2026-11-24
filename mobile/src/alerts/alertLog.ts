import { reconcile, savedToHistory, type Alert, type DesiredAlerts } from '@renewvan/core/alerts'

// The phone's alert log: the dashboard's alert history (`lib/alertHistory.ts`), with the system
// notification (`notifications.ts`) for its toast. Which alerts are open, when they open and
// resolve, and the Demo mode rule are core's (`@renewvan/core/alerts`); this is the log they are
// written to. The log is the only memory, so an alert still open across an app restart is not
// opened twice.

export interface AlertEntry extends Alert {
  /** Set once the condition cleared; absent while the alert is open. */
  resolvedAt?: number
  /** Deleted by the user while still open: off the list, but kept so it is not raised again until it clears. */
  dismissed?: boolean
}

// Plenty for a phone; caps storage without an expiry policy.
const MAX_ENTRIES = 200

/**
 * Applies core's transitions to the log at `now`: the opened alerts go first, newest first; a
 * resolved one keeps its row, stamped, unless it was deleted while open or is a demo alert (never
 * history, so it goes once it ends). Returns the same `entries` array when nothing changed, so it
 * can run on every render.
 */
export function applyAlerts(
  entries: AlertEntry[],
  desired: DesiredAlerts,
  now: number,
): { entries: AlertEntry[]; opened: AlertEntry[]; resolved: AlertEntry[] } {
  const { opened, resolved } = reconcile(entries, desired, now)
  if (opened.length === 0 && resolved.length === 0) return { entries, opened, resolved }
  const closed = new Map(resolved.map((e) => [e.id, e]))
  const next = entries.flatMap((entry) => {
    const done = closed.get(entry.id)
    if (done === undefined) return [entry]
    return done.dismissed || !savedToHistory(done) ? [] : [done]
  })
  return { entries: [...opened, ...next].slice(0, MAX_ENTRIES), opened, resolved }
}

/** What is written to storage: the log without the demo alerts, which are never saved. */
export const storedLog = (entries: AlertEntry[]): AlertEntry[] => entries.filter(savedToHistory)

/** Reads the stored log; whatever is not a well-formed entry (another app version) is dropped. */
export function parseAlertLog(raw: string | null): AlertEntry[] {
  let stored: unknown
  try {
    stored = JSON.parse(raw ?? '[]')
  } catch {
    return []
  }
  if (!Array.isArray(stored)) return []
  return stored.filter(
    (e): e is AlertEntry =>
      typeof e === 'object' &&
      e !== null &&
      typeof e.id === 'string' &&
      typeof e.key === 'string' &&
      (e.type === 'error' || e.type === 'warning') &&
      typeof e.title === 'string' &&
      typeof e.description === 'string' &&
      typeof e.createdAt === 'number' &&
      (e.resolvedAt === undefined || typeof e.resolvedAt === 'number') &&
      (e.dismissed === undefined || typeof e.dismissed === 'boolean'),
  )
}

/** The log changes only through these: set whole (bus diff, stored copy, sign-out), or pruned by the user. */
export type AlertAction =
  | { type: 'set'; entries: AlertEntry[] }
  | { type: 'remove'; id: string }
  | { type: 'clearResolved' }

/** Deleting a resolved alert drops it; deleting an open one only dismisses it (see `AlertEntry.dismissed`). */
export function logReducer(entries: AlertEntry[], action: AlertAction): AlertEntry[] {
  switch (action.type) {
    case 'set':
      return action.entries
    case 'remove':
      return entries.flatMap((e) => {
        if (e.id !== action.id) return [e]
        return e.resolvedAt === undefined ? [{ ...e, dismissed: true }] : []
      })
    case 'clearResolved':
      return entries.filter((e) => e.resolvedAt === undefined)
  }
}
