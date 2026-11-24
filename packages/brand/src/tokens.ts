// The one source of Renewvan's colours and corner radius. Edit here, then run
// `pnpm --filter @renewvan/brand generate`: it writes the CSS both apps import (tokens.web.css,
// tokens.native.css), mobile's hex palette (src/palette.ts) and every colour in the icons and app
// manifests. Self-contained (no imports): the generator loads it with Node's type stripping.

/** The artwork's colours. */
export const brand = {
  /** The logo's strokes and the background of every app icon. */
  blue: '#0385f7',
  /** The PWA's `theme_color` / `background_color` and the browser bar. */
  navy: '#0d1826',
} as const

/**
 * Fixed signal colours, the same in the light and dark themes (so not part of the `Theme`
 * records): the dial ring's alert amber and the three cold temperature bands. The warm bands
 * (`Comfortable`, `Warm`, `Hot`) read the theme's accent/warning/danger instead.
 */
export const signal = {
  /** A dial ring's alert amber (Tailwind amber-500): deliberately stronger than the theme's paler `warning`. */
  ringAlert: '#f59e0b',
  /** Temperature bands below `Comfortable`, with the text colour that reads on each. */
  freezing: '#3b82f6',
  cold: '#38bdf8',
  cool: '#67e8f9',
  freezingForeground: '#ffffff',
  coldForeground: '#0b1b2b',
  coolForeground: '#0b1b2b',
} as const

/**
 * HeroUI's base corner radius, in rem (4px). HeroUI derives its whole scale from it: `lg` is 1×,
 * `xl` 1.5×, `2xl` 2×, `3xl` 3× (the dashboard's `docs/design-principles.md`, "Corner radii").
 */
export const radiusRem = 0.25
/** HeroUI's `--field-radius`, for inputs. */
export const fieldRadiusRem = 0.25

/** A theme: HeroUI's colour variables, by name without the leading `--`. */
export type Theme = Readonly<Record<string, string>>

/**
 * The light theme. The UI accent (`accent`, `focus`) is the brand blue as oklch, a hair apart from
 * `brand.blue` (≈ `#0485f7`); its hue 253.83 also tints the neutrals.
 */
export const light: Theme = {
  accent: 'oklch(62.04% 0.195 253.83)',
  'accent-foreground': 'oklch(99.11% 0 0)',
  background: 'oklch(97.02% 0.0099 253.83)',
  border: 'oklch(90% 0.0099 253.83)',
  danger: 'oklch(65.32% 0.2374 25.74)',
  'danger-foreground': 'oklch(99.11% 0 0)',
  default: 'oklch(94% 0.0099 253.83)',
  'default-foreground': 'oklch(21.03% 0.0059 253.83)',
  'field-background': 'oklch(100% 0.005 253.83)',
  'field-border': 'transparent',
  'field-foreground': 'oklch(21.03% 0.0099 253.83)',
  'field-placeholder': 'oklch(55.17% 0.0198 253.83)',
  focus: 'oklch(62.04% 0.195 253.83)',
  foreground: 'oklch(21.03% 0.0099 253.83)',
  muted: 'oklch(55.17% 0.0198 253.83)',
  overlay: 'oklch(100% 0.003 253.83)',
  'overlay-foreground': 'oklch(21.03% 0.0099 253.83)',
  segment: 'oklch(100% 0.0099 253.83)',
  'segment-foreground': 'oklch(21.03% 0.0099 253.83)',
  separator: 'oklch(92% 0.0099 253.83)',
  success: 'oklch(73.29% 0.1973 150.81)',
  'success-foreground': 'oklch(21.03% 0.0059 150.81)',
  surface: 'oklch(100% 0.005 253.83)',
  'surface-foreground': 'oklch(21.03% 0.0099 253.83)',
  'surface-secondary': 'oklch(95.24% 0.0079 253.83)',
  'surface-secondary-foreground': 'oklch(21.03% 0.0099 253.83)',
  'surface-tertiary': 'oklch(93.73% 0.0079 253.83)',
  'surface-tertiary-foreground': 'oklch(21.03% 0.0099 253.83)',
  warning: 'oklch(78.19% 0.1616 72.33)',
  'warning-foreground': 'oklch(21.03% 0.0059 72.33)',
}

/** The dark theme: the same names as `light`. */
export const dark: Theme = {
  accent: 'oklch(62.04% 0.195 253.83)',
  'accent-foreground': 'oklch(99.11% 0 0)',
  background: 'oklch(12% 0.0099 253.83)',
  border: 'oklch(28% 0.0099 253.83)',
  danger: 'oklch(59.4% 0.2006 24.63)',
  'danger-foreground': 'oklch(99.11% 0 0)',
  default: 'oklch(27.4% 0.0099 253.83)',
  'default-foreground': 'oklch(99.11% 0 0)',
  'field-background': 'oklch(21.03% 0.0198 253.83)',
  'field-border': 'transparent',
  'field-foreground': 'oklch(99.11% 0.0099 253.83)',
  'field-placeholder': 'oklch(70.5% 0.0198 253.83)',
  focus: 'oklch(62.04% 0.195 253.83)',
  foreground: 'oklch(99.11% 0.0099 253.83)',
  muted: 'oklch(70.5% 0.0198 253.83)',
  overlay: 'oklch(21.03% 0.0198 253.83)',
  'overlay-foreground': 'oklch(99.11% 0.0099 253.83)',
  segment: 'oklch(39.64% 0.0099 253.83)',
  'segment-foreground': 'oklch(99.11% 0.0099 253.83)',
  separator: 'oklch(25% 0.0099 253.83)',
  success: 'oklch(73.29% 0.1973 150.81)',
  'success-foreground': 'oklch(21.03% 0.0059 150.81)',
  surface: 'oklch(21.03% 0.0198 253.83)',
  'surface-foreground': 'oklch(99.11% 0.0099 253.83)',
  'surface-secondary': 'oklch(25.7% 0.0149 253.83)',
  'surface-secondary-foreground': 'oklch(99.11% 0.0099 253.83)',
  'surface-tertiary': 'oklch(27.21% 0.0149 253.83)',
  'surface-tertiary-foreground': 'oklch(99.11% 0.0099 253.83)',
  warning: 'oklch(82.03% 0.1415 76.34)',
  'warning-foreground': 'oklch(21.03% 0.0059 76.34)',
}
