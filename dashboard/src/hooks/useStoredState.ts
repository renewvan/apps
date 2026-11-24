import {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from 'react'

/** `localStorage.getItem` that reads as `null` where storage is missing, blocked or throws. */
export function readStorage(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/** `localStorage.setItem` that gives up silently (private mode, quota, blocked): the choice then lasts until reload. */
export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Nothing to do: the in-memory state is still right, it is only not persisted.
  }
}

// The stored strings are the one source of truth, so every reader of a key sees the same value.
// A string that could not be written (private mode, quota) is held here instead, for this page load.
const unwritten = new Map<string, string>()
const listeners = new Map<string, Set<() => void>>()

function storedString(key: string): string | null {
  return unwritten.get(key) ?? readStorage(key)
}

function storeString(key: string, raw: string): void {
  writeStorage(key, raw)
  if (readStorage(key) === raw) unwritten.delete(key)
  else unwritten.set(key, raw)
  listeners.get(key)?.forEach((listener) => listener())
}

function subscribe(key: string, listener: () => void): () => void {
  const forKey = listeners.get(key) ?? new Set()
  listeners.set(key, forKey)
  forKey.add(listener)
  return () => forKey.delete(listener)
}

/**
 * State kept in `localStorage` under `key`, one value per key: every component that reads a key
 * reads the same value and re-renders when anyone changes it, so a preference needs no provider
 * (the header, the shell and Settings each call its hook and can never disagree). `parse` turns
 * what is stored (`null` when nothing is, or when storage cannot be read) into a value and must
 * fall back to the default for anything it does not recognise; `serialize` turns the value back
 * into the string to store. Both should be module-level functions. Storage failures never throw:
 * the value then lasts until reload.
 */
export function useStoredState<T>(
  key: string,
  parse: (raw: string | null) => T,
  serialize: (value: T) => string = String,
): [T, Dispatch<SetStateAction<T>>] {
  const raw = useSyncExternalStore(
    useCallback((listener: () => void) => subscribe(key, listener), [key]),
    () => storedString(key),
  )
  // Parsed again only when the stored string changes, so an object value keeps its reference.
  const value = useMemo(() => parse(raw), [parse, raw])

  // What is read is stored, so a default or a repaired value outlives a later change of default.
  useEffect(() => {
    if (raw !== serialize(value)) writeStorage(key, serialize(value))
  }, [key, raw, serialize, value])

  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (action) => {
      const next =
        typeof action === 'function'
          ? (action as (current: T) => T)(parse(storedString(key)))
          : action
      storeString(key, serialize(next))
    },
    [key, parse, serialize],
  )

  return [value, setValue]
}
