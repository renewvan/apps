import type { PowerLayout } from '@/hooks/usePowerLayout'
import type { HeaterPageProps } from '@/components/heater/HeaterPage'

/**
 * What every Start-page widget is handed: the display choices and what a tap does. A widget reads
 * the van itself (`useLiveVan`), picks what it needs and draws itself (including its own empty
 * state), so the page does not know what any widget shows.
 */
export interface StartWidgetProps {
  /** The Power page's layout choice; the Power flow widget draws the same one. */
  powerLayout: PowerLayout
  /** Glow behind the dial fill: dark theme only. */
  isDark: boolean
  /** Whether the map widget draws the dark map: the Map page's choice, which can differ from the app theme. */
  mapIsDark: boolean
  /** The van marker's colour on the map widget; empty is the theme accent. */
  vanColor?: string
  /** The current time, refreshed slowly; tank severity reads it. */
  now: Date
  /** A tank widget's Configure button: opens that tank's settings. */
  onConfigureTank: (id: string) => void
  /** What drives the heater; the Heater widget draws its own empty state without one. */
  heater?: HeaterPageProps
  /** A power-flow source: opens its device in Settings, by its `instanceKey`. */
  onOpenInstance?: (key: string) => void
}
