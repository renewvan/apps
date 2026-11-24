import { act, renderHook } from '@testing-library/react'

/** A preference's own hook (`useTheme`, `useStartLayout`, ...): its value, then its setter. */
type PreferenceHook<T> = () => readonly [T, (value: T) => void]

/**
 * What a preference's hook reads now. Every reader of a key shares one stored value
 * (`useStoredState`), so a test reads what a view stored with a fresh call of the same hook.
 */
export function storedPreference<T>(useHook: () => readonly [T, unknown]): T {
  const { result, unmount } = renderHook(useHook)
  const value = result.current[0]
  unmount()
  return value
}

/** Stores `value` through the preference's own hook, as its Settings view would. */
export function storePreference<T>(useHook: PreferenceHook<T>, value: T): void {
  const { result, unmount } = renderHook(useHook)
  act(() => result.current[1](value))
  unmount()
}
