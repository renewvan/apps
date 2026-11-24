/**
 * A command in flight, as a client shows it. The app never claims a command worked because it was
 * sent: only the retained field on the bus says so (hub ADRs 0013 and 0021, "pending until the
 * retained field changes, then time out honestly"). These are the pure rules; each app keeps the
 * state, the timer and the toast.
 *
 * An entry is **pending** from the tap until the field it watches leaves the value it had then, and
 * **failed** once its give-up time passes with no change; a failed entry stays until the field
 * reaches the target on its own (or the command is sent again).
 */
export interface Pending<T = unknown> {
  /** The value the retained field had at the tap: any other value ends the wait. */
  from: unknown
  /** The value sent, for a control that shows its target while the field catches up. */
  to?: T
  failed: boolean
}

export type Pendings<K extends string = string, T = unknown> = Partial<Record<K, Pending<T>>>

/**
 * How long a command may leave its field unchanged before it is reported as failed. The heater's is
 * longer: a settings write is only confirmed by the Driver's next settings read.
 */
export const GIVE_UP_MS = { heater: 6000, relay: 4000 } as const

/** `pendings` with a command sent on `key`, from the field's current value, replacing any earlier one. */
export function track<K extends string, T = unknown>(
  pendings: Pendings<K, T>,
  key: K,
  from: unknown,
  to?: T,
): Pendings<K, T> {
  return { ...pendings, [key]: { from, to, failed: false } }
}

function applies(entry: Pending<unknown>, observed: unknown): boolean {
  if (!entry.failed) return observed === entry.from
  return entry.to === undefined || observed !== entry.to
}

/** The entry that still applies to `key` given the field's current value, or nothing once it settled. */
export function observe<K extends string, T = unknown>(
  pendings: Pendings<K, T>,
  key: K,
  observed: unknown,
): Pending<T> | undefined {
  const entry = pendings[key]
  return entry !== undefined && applies(entry, observed) ? entry : undefined
}

/**
 * `pendings` with every settled entry deleted (not just hidden, so a value that later returns to the
 * pre-command one can never re-show a stale target or a false failure), or null when nothing has
 * settled, so a caller can tell nothing changed.
 */
export function settle<K extends string, T = unknown>(
  pendings: Pendings<K, T>,
  read: (key: K) => unknown,
): Pendings<K, T> | null {
  let changed = false
  const next: Pendings<K, T> = {}
  for (const key of Object.keys(pendings) as K[]) {
    const entry = pendings[key]!
    if (applies(entry, read(key))) next[key] = entry
    else changed = true
  }
  return changed ? next : null
}

/**
 * What happens to `key` when its give-up time passes: a command whose field never moved fails
 * (`failed` is true, to say so); one that was answered, settled meanwhile or has failed already
 * changes nothing, so nothing is reported for it.
 */
export function giveUp<K extends string, T = unknown>(
  pendings: Pendings<K, T>,
  key: K,
  observed: unknown,
): { pendings: Pendings<K, T>; failed: boolean } {
  const entry = pendings[key]
  if (entry === undefined || entry.failed || observed !== entry.from) {
    return { pendings, failed: false }
  }
  return { pendings: { ...pendings, [key]: { ...entry, failed: true } }, failed: true }
}
