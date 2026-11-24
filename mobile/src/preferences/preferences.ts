// The app's own settings: what this phone's owner chose for this phone. They live on the phone
// (the dashboard keeps its equivalents in the kiosk's browser storage, which nothing remote can
// reach), apart from everything shared on the bus, which Settings changes for every client.

import { EMPTY_VAN_DETAILS, readVanDetails, type VanDetails } from '@renewvan/core/vanDetails'
import { DEFAULT_WIDGET_IDS, WIDGETS, type WidgetId } from '@/lib/widgets'
import { CARD_PAGES, parseCardLayout, type CardLayout, type CardPage } from './cardLayout'

/** Home's widgets, in their shipped order. */
export const WIDGET_IDS: readonly WidgetId[] = WIDGETS.map((w) => w.id)
export const WIDGET_LABELS = Object.fromEntries(WIDGETS.map((w) => [w.id, w.label])) as Record<
  WidgetId,
  string
>

/**
 * This phone's Home: every widget it has seen, in order, and the ones it hid. A widget in neither
 * (new in a release) is placed at its default position and shown only if it is on by default.
 * Availability is never stored: a type the van lacks is filtered at render time.
 */
export interface HomeLayout {
  order: readonly WidgetId[]
  hidden: readonly WidgetId[]
}

export const DEFAULT_HOME_LAYOUT: HomeLayout = {
  order: WIDGET_IDS,
  hidden: WIDGETS.filter((w) => !w.defaultOn).map((w) => w.id),
}

/** The widgets Home shows, in order. */
export function shownWidgets(layout: HomeLayout): readonly WidgetId[] {
  const order = [...layout.order]
  WIDGET_IDS.forEach((id, index) => {
    if (order.includes(id) || layout.hidden.includes(id)) return
    if (!DEFAULT_WIDGET_IDS.includes(id)) return
    // After the nearest widget before it in the catalogue that is already placed, else first.
    const before = WIDGET_IDS.slice(0, index)
      .reverse()
      .find((w) => order.includes(w))
    order.splice(before === undefined ? 0 : order.indexOf(before) + 1, 0, id)
  })
  return order.filter((id) => !layout.hidden.includes(id))
}

/** The layout that shows `shown`, in that order, and hides every other widget. */
export function homeLayoutOf(shown: readonly WidgetId[]): HomeLayout {
  const hidden = WIDGET_IDS.filter((id) => !shown.includes(id))
  return { order: [...shown, ...hidden], hidden }
}

/**
 * Applies an edit of the listed widgets (`available`) without dropping the others. Each unlisted shown
 * widget stays next to the nearest listed neighbour that is still shown: before the next one it
 * preceded, else after the previous one it trailed.
 */
export function homeLayoutWithAvailable(
  current: HomeLayout,
  available: readonly WidgetId[],
  shown: readonly WidgetId[],
): HomeLayout {
  const before = shownWidgets(current)
  const listed = before.filter((id) => available.includes(id))
  const lead: WidgetId[] = []
  const ahead = new Map<WidgetId, WidgetId[]>()
  const behind = new Map<WidgetId, WidgetId[]>()
  const put = (map: Map<WidgetId, WidgetId[]>, key: WidgetId, id: WidgetId) =>
    map.set(key, [...(map.get(key) ?? []), id])
  before.forEach((id, index) => {
    if (available.includes(id)) return
    const around = (ids: readonly WidgetId[]) => ids.find((w) => shown.includes(w))
    const next = around(before.slice(index + 1).filter((w) => listed.includes(w)))
    const prev = around(
      before
        .slice(0, index)
        .filter((w) => listed.includes(w))
        .reverse(),
    )
    if (next) put(ahead, next, id)
    else if (prev) put(behind, prev, id)
    else lead.push(id)
  })
  return homeLayoutOf([
    ...lead,
    ...shown.flatMap((id) => [...(ahead.get(id) ?? []), id, ...(behind.get(id) ?? [])]),
  ])
}

export type ThemeChoice = 'system' | 'light' | 'dark'
export type DevicesSort = 'driver' | 'entity'

/**
 * How the power-flow diagram is drawn, as the dashboard's Power page setting. The dashboard also
 * knows two layouts without the van (`tiles`, `orbs`); like its own Settings, the app offers the
 * two with it.
 */
export const POWER_LAYOUTS = ['van-tiles', 'van-orbs'] as const
export type PowerLayout = (typeof POWER_LAYOUTS)[number]
export const POWER_LAYOUT_LABELS: Record<PowerLayout, string> = {
  'van-tiles': 'Van tiles',
  'van-orbs': 'Van orbs',
}
export const POWER_LAYOUT_HINTS: Record<PowerLayout, string> = {
  'van-tiles':
    'The van at the centre, filled to its charge, with boxed readings plugged into it by flowing lines.',
  'van-orbs':
    'The van at the centre, filled to its charge, with round readings plugged into it by flowing lines.',
}

export interface Preferences {
  /** Light, dark, or whatever the phone is set to. */
  theme: ThemeChoice
  homeLayout: HomeLayout
  /** Each page's cards as arranged on this phone (Home's are `homeLayout`); absent until edited. */
  pageLayouts: Partial<Record<CardPage, CardLayout>>
  /** How Settings › Devices lists them. */
  devicesSort: DevicesSort
  /** The Power tab's diagram, and the Start tab's Power flow widget, which draws the same one. */
  powerLayout: PowerLayout
  /** Whether a new alert is posted as a system notification. The Alerts screen records them either way. */
  alertsEnabled: boolean
  van: VanDetails
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  homeLayout: DEFAULT_HOME_LAYOUT,
  pageLayouts: {},
  devicesSort: 'driver',
  powerLayout: 'van-tiles',
  alertsEnabled: true,
  van: EMPTY_VAN_DETAILS,
}

function isWidgetId(value: unknown): value is WidgetId {
  return WIDGET_IDS.some((id) => id === value)
}

function widgetIds(value: unknown): WidgetId[] {
  return Array.isArray(value) ? [...new Set(value.filter(isWidgetId))] : []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parsePageLayouts(stored: Record<string, unknown>): Preferences['pageLayouts'] {
  const saved = isRecord(stored.pageLayouts) ? stored.pageLayouts : {}
  const layouts: Preferences['pageLayouts'] = {}
  for (const page of CARD_PAGES) {
    const layout = parseCardLayout(saved[page])
    if (layout) layouts[page] = layout
  }
  // Before pages had layouts, Levels › Temperature only had its hidden sensors.
  const hiddenTemperatures = parseCardLayout({ hidden: stored.hiddenTemperatures })
  if (!layouts.temperature && hiddenTemperatures && hiddenTemperatures.hidden.length > 0) {
    layouts.temperature = hiddenTemperatures
  }
  return layouts
}

/**
 * Reads what was stored. Every field is checked on its own and falls back to its default, so a
 * value written by an older or newer version of the app never breaks the rest.
 */
export function parsePreferences(raw: string | null): Preferences {
  let stored: unknown
  try {
    stored = JSON.parse(raw ?? 'null')
  } catch {
    return DEFAULT_PREFERENCES
  }
  if (!isRecord(stored)) return DEFAULT_PREFERENCES
  return {
    theme:
      stored.theme === 'light' || stored.theme === 'dark' || stored.theme === 'system'
        ? stored.theme
        : DEFAULT_PREFERENCES.theme,
    // The old `startLayout` is discarded: its widgets are not these.
    homeLayout: isRecord(stored.homeLayout)
      ? { order: widgetIds(stored.homeLayout.order), hidden: widgetIds(stored.homeLayout.hidden) }
      : DEFAULT_HOME_LAYOUT,
    pageLayouts: parsePageLayouts(stored),
    devicesSort: stored.devicesSort === 'entity' ? 'entity' : 'driver',
    powerLayout: stored.powerLayout === 'van-orbs' ? 'van-orbs' : 'van-tiles',
    alertsEnabled: stored.alertsEnabled !== false,
    van: readVanDetails(stored.van),
  }
}

/** `list` with the item at `from` moved to `to`; unchanged when either is out of range. */
export function moved<T>(list: readonly T[], from: number, to: number): readonly T[] {
  const inRange = (i: number) => Number.isInteger(i) && i >= 0 && i < list.length
  if (!inRange(from) || !inRange(to) || from === to) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** An editor's slots: the shown cards in order, a divider, then the hidden ones in default order. */
export function widgetSlots<T extends string>(
  shown: readonly T[],
  widgets: readonly T[] = WIDGET_IDS as readonly string[] as readonly T[],
): (T | 'divider')[] {
  return [...shown, 'divider', ...widgets.filter((id) => !shown.includes(id))]
}

/**
 * The shown cards after the card in slot `from` is dropped on slot `to`: whatever lands above
 * the divider is shown, in that order. The same `shown` when nothing changes (the divider cannot be
 * dragged, and the hidden cards have no order of their own).
 */
export function layoutAfterDrop<T extends string>(
  shown: readonly T[],
  from: number,
  to: number,
  widgets: readonly T[] = WIDGET_IDS as readonly string[] as readonly T[],
): readonly T[] {
  const slots = widgetSlots(shown, widgets)
  if (slots[from] === 'divider') return shown
  const next = moved(slots, from, to)
  const after = next.slice(0, next.indexOf('divider')) as T[]
  return after.length === shown.length && after.every((id, i) => id === shown[i]) ? shown : after
}

export function isDefaultLayout(layout: HomeLayout): boolean {
  const shown = shownWidgets(layout)
  return (
    shown.length === DEFAULT_WIDGET_IDS.length &&
    shown.every((id, i) => id === DEFAULT_WIDGET_IDS[i])
  )
}
