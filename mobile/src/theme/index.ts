import { palettes, radiusRem, fieldRadiusRem, type Palette } from '@renewvan/brand'
import { useUniwind } from 'uniwind'

// The theme tokens as sRGB hex (`@renewvan/brand`, generated from its `src/tokens.ts`): React
// Native has no CSS custom properties or oklch. Same names as the CSS variables, so a component
// ported from the dashboard reads the same token it read there.
export { palettes, type Palette }

const { light, dark } = palettes

export interface Theme {
  colors: Palette
  isDark: boolean
  scheme: 'light' | 'dark'
}

/**
 * The palette for the app's light/dark theme: the one Uniwind styles HeroUI with, so hand-drawn
 * parts and the controls always change over together (`applyTheme` in `src/preferences`).
 */
export function useTheme(): Theme {
  const isDark = useUniwind().theme === 'dark'
  return { colors: isDark ? dark : light, isDark, scheme: isDark ? 'dark' : 'light' }
}

/** `#rrggbb` at an opacity, for the soft washes the dashboard builds with `color-mix`. */
export function alpha(hex: string, opacity: number): string {
  const value = Math.round(Math.min(1, Math.max(0, opacity)) * 255)
  return `${hex}${value.toString(16).padStart(2, '0')}`
}

/**
 * The corner radii: HeroUI's scale from the one token, `--radius` (`@renewvan/brand`, 0.25rem, 4px),
 * as `src/global.css` gives it to HeroUI Native. A part we draw takes the radius of the HeroUI
 * component it resembles (the dashboard's `docs/design-principles.md`, "Corner radii"): 12 for
 * buttons, toggles, steppers and cards (`3xl`), 8 for chips, badges (the DEMO badge too) and
 * Settings rows (`2xl`), 6 for notes, banners and map overlays (`xl`), 4 for level bars and fields
 * (`lg`). A circle only for what is round by nature. Never a number or a pill.
 */
const base = radiusRem * 16
export const radius = {
  sm: base * 0.5,
  md: base * 0.75,
  lg: base,
  xl: base * 1.5,
  '2xl': base * 2,
  '3xl': base * 3,
  field: fieldRadiusRem * 16,
} as const

/** The page gutter and card radius every screen shares. */
export const layout = { gutter: 16, gap: 12, radius: radius['3xl'] } as const
