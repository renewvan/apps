import type { ComponentType } from 'react'
import {
  CarBattery,
  CloudSun,
  Droplet,
  Droplets,
  Heater as HeaterIcon,
  Map as MapIcon,
  Move3d,
  Sun,
  Waypoints,
} from 'lucide-react'
import type { StartWidgetId } from '@/hooks/useStartLayout'
import type { StartTileId } from '@/hooks/useStartTiles'
import { BatteryCard } from './BatteryCard'
import { FreshWaterCard, GreyWaterCard } from './FluidTankCard'
import { HeaterWidget } from './HeaterWidget'
import { MapCard } from './MapCard'
import { PowerFlowCard } from './PowerFlowCard'
import { SolarYieldCard } from './SolarYieldCard'
import { TiltCard } from './TiltCard'
import { WeatherCard } from './WeatherCard'
import type { StartWidgetProps } from './types'

export interface StartWidgetDefinition {
  id: StartWidgetId
  /** What the widget is called where the user picks, adds or removes it. */
  label: string
  icon: ComponentType<{ className?: string }>
  Component: ComponentType<StartWidgetProps>
}

/**
 * Every widget the phone Start page can show, by id. A widget is added here and in
 * `START_WIDGET_IDS`; the page and any editor read both and know nothing else about it.
 */
export const START_WIDGETS: Record<StartWidgetId, StartWidgetDefinition> = {
  weather: { id: 'weather', label: 'Weather', icon: CloudSun, Component: WeatherCard },
  map: { id: 'map', label: 'Map', icon: MapIcon, Component: MapCard },
  'power-flow': {
    id: 'power-flow',
    label: 'Power flow',
    icon: Waypoints,
    Component: PowerFlowCard,
  },
  battery: { id: 'battery', label: 'Battery', icon: CarBattery, Component: BatteryCard },
  heater: { id: 'heater', label: 'Heater', icon: HeaterIcon, Component: HeaterWidget },
  solar: { id: 'solar', label: 'Solar production', icon: Sun, Component: SolarYieldCard },
  tilt: { id: 'tilt', label: 'Tilt', icon: Move3d, Component: TiltCard },
  'fresh-water': {
    id: 'fresh-water',
    label: 'Fresh water',
    icon: Droplet,
    Component: FreshWaterCard,
  },
  'grey-water': {
    id: 'grey-water',
    label: 'Grey water',
    icon: Droplets,
    Component: GreyWaterCard,
  },
}

/** What the kiosk's Grid draws, by tile: the same components as `START_WIDGETS`. */
export const START_TILES: Record<
  StartTileId,
  { label: string; Component: ComponentType<StartWidgetProps> }
> = {
  weather: START_WIDGETS.weather,
  map: START_WIDGETS.map,
  power: START_WIDGETS['power-flow'],
  battery: START_WIDGETS.battery,
  heater: START_WIDGETS.heater,
  solar: START_WIDGETS.solar,
  tilt: START_WIDGETS.tilt,
  'fresh-water': START_WIDGETS['fresh-water'],
  'grey-water': START_WIDGETS['grey-water'],
}
