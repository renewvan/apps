import { useEffect } from 'react'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useStoredState } from '@/hooks/useStoredState'

/** The look drawn: what `<html data-theme>` says. */
export type Theme = 'light' | 'dark'

/** What is chosen and stored: a fixed look, or `system` to follow the device's colour scheme. */
export type ThemeChoice = Theme | 'system'

const STORAGE_KEY = 'renewvan-dashboard-theme'

/** The kiosk's original always-on look (ticket 05), kept as the default for
 * anyone who's never touched the setting. */
const DEFAULT_THEME: ThemeChoice = 'dark'

function isThemeChoice(value: string | null): value is ThemeChoice {
  return value === 'system' || value === 'light' || value === 'dark'
}

function parseTheme(stored: string | null): ThemeChoice {
  return isThemeChoice(stored) ? stored : DEFAULT_THEME
}

/** The look a choice draws: `system` is the device's colour scheme, and changes with it. */
export function useResolvedTheme(choice: ThemeChoice): Theme {
  const deviceIsDark = useMediaQuery('(prefers-color-scheme: dark)')
  if (choice !== 'system') return choice
  return deviceIsDark ? 'dark' : 'light'
}

/**
 * Kiosk theme preference — defaults to dark and is chosen in Settings › General › Display &
 * Appearance (the phone drawer also flips it). Applies instantly (no reboot needed); persisted to
 * `localStorage` so the choice survives a reload/power cycle. Returns the stored choice, which
 * may be `system`: read the look it draws with `useResolvedTheme`.
 */
export function useTheme(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const [choice, setChoice] = useStoredState<ThemeChoice>(STORAGE_KEY, parseTheme)
  const theme = useResolvedTheme(choice)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return [choice, setChoice]
}
