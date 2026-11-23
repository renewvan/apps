import type { Capability } from '@/lib/capabilities'
import type { EntityType } from '@/lib/drivers'

/**
 * Home's widget catalogue: what the app can draw and what it needs from the van. The widgets and
 * their order are the dashboard's phone Start page (`START_WIDGET_IDS` in its
 * `hooks/useStartLayout.ts`, labels from `components/start/widgets/registry.tsx`); the dashboard
 * has no copy of this file. Weather is its temperatures only: the app has no forecast yet.
 */

/** What a widget needs: nothing (`always`), every listed type (`all`), or at least one (`any`). */
export type WidgetNeeds = 'always' | { all: readonly EntityType[] } | { any: readonly EntityType[] }

export type WidgetId =
  'weather' | 'map' | 'energy' | 'heater' | 'solar' | 'tilt' | 'fresh-water' | 'grey-water'

export interface WidgetDef {
  id: WidgetId
  label: string
  needs: WidgetNeeds
  /** On for a new layout; the rest are optional. */
  defaultOn: boolean
}

/** Every widget, in default order. All on, as on the dashboard. */
export const WIDGETS: readonly WidgetDef[] = [
  { id: 'weather', label: 'Weather', needs: { all: ['temperature'] }, defaultOn: true },
  // The map falls back to the phone's own GPS, so it needs no driver.
  { id: 'map', label: 'Map', needs: 'always', defaultOn: true },
  {
    id: 'energy',
    label: 'Energy',
    needs: { any: ['battery', 'solar', 'charger'] },
    defaultOn: true,
  },
  { id: 'heater', label: 'Heater', needs: { all: ['heater'] }, defaultOn: true },
  { id: 'solar', label: 'Solar production', needs: { all: ['solar'] }, defaultOn: true },
  { id: 'tilt', label: 'Tilt', needs: { all: ['tilt'] }, defaultOn: true },
  { id: 'fresh-water', label: 'Fresh water', needs: { all: ['tank'] }, defaultOn: true },
  { id: 'grey-water', label: 'Grey water', needs: { all: ['tank'] }, defaultOn: true },
]

export const DEFAULT_WIDGET_IDS: readonly WidgetId[] = WIDGETS.filter((w) => w.defaultOn).map(
  (w) => w.id,
)

export type WidgetAvailability = 'loading' | 'available' | 'unavailable'

/**
 * Whether the van has what a widget needs. `loading` while a needed type has no evidence and the
 * bus has not settled (show a skeleton); `unavailable` once it has. An offline Driver is still
 * `available`: its widget stays, dimmed. Availability is never stored, only derived at render.
 */
export function widgetAvailability(
  id: WidgetId,
  capabilities: Record<EntityType, Capability>,
): WidgetAvailability {
  const { needs } = WIDGETS.find((w) => w.id === id)!
  if (needs === 'always') return 'available'
  const types = 'all' in needs ? needs.all : needs.any
  const states = types.map((t) => capabilities[t].state)
  const met = 'all' in needs ? states.every((s) => s === 'present') : states.includes('present')
  if (met) return 'available'
  return states.includes('loading') ? 'loading' : 'unavailable'
}
