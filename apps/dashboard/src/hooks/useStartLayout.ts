import { useStoredState } from '@/hooks/useStoredState'

/** Every widget the phone's Start page can show; each one is a component in `components/start/widgets`. */
export const START_WIDGET_IDS = [
  'weather',
  'map',
  'power-flow',
  'battery',
  'heater',
  'solar',
  'tilt',
  'fresh-water',
  'grey-water',
] as const

export type StartWidgetId = (typeof START_WIDGET_IDS)[number]

/** The phone Start page as shipped: every widget, in this order. */
export const DEFAULT_START_LAYOUT: readonly StartWidgetId[] = START_WIDGET_IDS

const STORAGE_KEY = 'renewvan-dashboard-start-layout'

function isWidgetId(value: unknown): value is StartWidgetId {
  return START_WIDGET_IDS.some((id) => id === value)
}

/**
 * The widget `'energy'` (a carousel of the power flow and the battery dial) became two widgets,
 * `'power-flow'` and `'battery'`; a layout stored before the split keeps both, in its place.
 */
function renamedWidget(value: unknown): unknown[] {
  return value === 'energy' ? ['power-flow', 'battery'] : [value]
}

/**
 * The stored layout: a JSON list of widget ids, in display order; a widget that is not listed is
 * not shown. Unknown ids (a widget removed in a later version) and repeats are dropped, so an old
 * or edited value never breaks the page. An empty list is a real choice (every widget removed);
 * nothing stored, or something that is not a list, reads as the default.
 */
export function parseStartLayout(stored: string | null): readonly StartWidgetId[] {
  if (stored === null) return DEFAULT_START_LAYOUT
  try {
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) return DEFAULT_START_LAYOUT
    return [...new Set(parsed.flatMap(renamedWidget).filter(isWidgetId))]
  } catch {
    return DEFAULT_START_LAYOUT
  }
}

/** A row of the Widgets list: a widget, or the divider between the shown ones and the hidden ones. */
export type WidgetSlot = StartWidgetId | 'divider'

/** The Widgets list's slots: the shown widgets in order, the divider, then the hidden ones as shipped. */
export function widgetSlots(layout: readonly StartWidgetId[]): WidgetSlot[] {
  return [...layout, 'divider', ...START_WIDGET_IDS.filter((id) => !layout.includes(id))]
}

/**
 * The layout after the widget in slot `from` is dropped on slot `to`: whatever lands above the
 * divider is shown, in that order. The same `layout` when nothing changes (the divider cannot be
 * moved, and the hidden widgets have no order of their own).
 */
export function layoutAfterDrop(
  layout: readonly StartWidgetId[],
  from: number,
  to: number,
): readonly StartWidgetId[] {
  const slots = widgetSlots(layout)
  if (slots[from] === 'divider') return layout
  const inRange = (i: number) => Number.isInteger(i) && i >= 0 && i < slots.length
  if (!inRange(from) || !inRange(to) || from === to) return layout
  const next = [...slots]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  const shown = next.slice(0, next.indexOf('divider')) as StartWidgetId[]
  return shown.length === layout.length && shown.every((id, i) => id === layout[i]) ? layout : shown
}

function serializeStartLayout(layout: readonly StartWidgetId[]): string {
  return JSON.stringify(layout)
}

/**
 * Which widgets the phone Start page shows and in what order. Kiosk-local preference with no bus
 * topic, persisted like `usePowerLayout`. Add, remove and reorder by setting a new list.
 */
export function useStartLayout() {
  return useStoredState<readonly StartWidgetId[]>(
    STORAGE_KEY,
    parseStartLayout,
    serializeStartLayout,
  )
}
