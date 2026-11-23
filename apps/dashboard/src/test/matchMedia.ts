/**
 * Opt-in `window.matchMedia` stub for jsdom (which has none), driven by a
 * settable viewport width and colour scheme. Call `stubMatchMedia(width)` in a
 * test (or `beforeEach`) and `setViewportWidth(n)` / `setPrefersDark(dark)`
 * inside `act()` to cross a breakpoint or flip the device's scheme; listeners
 * registered through `addEventListener('change')` fire when a query's result
 * flips. Understands `(min-width: Npx)`, `(max-width: Npx)` and
 * `(prefers-color-scheme: light|dark)` joined by `and`; any other feature
 * (e.g. `pointer`) evaluates to `false`. The device starts out preferring light.
 */

type Listener = (event: MediaQueryListEvent) => void

export interface MatchMediaStub {
  /** Change the simulated viewport width and notify affected listeners. */
  setViewportWidth: (width: number) => void
  /** Change the simulated `prefers-color-scheme` and notify affected listeners. */
  setPrefersDark: (dark: boolean) => void
  /** Remove the stub from `window`. */
  restore: () => void
}

function evaluate(query: string, width: number, prefersDark: boolean): boolean {
  const features = query
    .split(/\band\b/i)
    .map((part) => part.trim())
    .filter(Boolean)
  if (features.length === 0) return false
  return features.every((feature) => {
    const scheme = /^\(\s*prefers-color-scheme\s*:\s*(light|dark)\s*\)$/.exec(feature)
    if (scheme) return (scheme[1] === 'dark') === prefersDark
    const match = /^\(\s*(min|max)-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)$/.exec(feature)
    if (!match) return false
    const px = Number(match[2])
    return match[1] === 'min' ? width >= px : width <= px
  })
}

export function stubMatchMedia(initialWidth: number): MatchMediaStub {
  let width = initialWidth
  let prefersDark = false
  const lists = new Set<{ query: string; matches: boolean; listeners: Set<Listener> }>()

  const matchMedia = (query: string): MediaQueryList => {
    const state = {
      query,
      matches: evaluate(query, width, prefersDark),
      listeners: new Set<Listener>(),
    }
    lists.add(state)
    const mql = {
      media: query,
      onchange: null,
      get matches() {
        return state.matches
      },
      addEventListener: (type: string, listener: Listener) => {
        if (type === 'change') state.listeners.add(listener)
      },
      removeEventListener: (type: string, listener: Listener) => {
        if (type === 'change') state.listeners.delete(listener)
      },
      addListener: (listener: Listener) => state.listeners.add(listener),
      removeListener: (listener: Listener) => state.listeners.delete(listener),
      dispatchEvent: () => false,
    }
    return mql as unknown as MediaQueryList
  }

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: matchMedia,
  })

  /** Re-evaluates every list and notifies the ones whose result flipped. */
  const refresh = () => {
    for (const state of lists) {
      const matches = evaluate(state.query, width, prefersDark)
      if (matches === state.matches) continue
      state.matches = matches
      for (const listener of state.listeners) {
        listener({ matches, media: state.query } as MediaQueryListEvent)
      }
    }
  }

  return {
    setViewportWidth(next) {
      width = next
      refresh()
    },
    setPrefersDark(next) {
      prefersDark = next
      refresh()
    },
    restore() {
      lists.clear()
      Reflect.deleteProperty(window, 'matchMedia')
    },
  }
}
