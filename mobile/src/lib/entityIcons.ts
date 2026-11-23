import {
  Armchair,
  Bath,
  Bed,
  Car,
  Container,
  Cpu,
  Droplet,
  Fan,
  Faucet,
  Flame,
  Fuel,
  GlassWater,
  House,
  Lamp,
  Lightbulb,
  Microwave,
  Park,
  Plug,
  Power,
  Refrigerator,
  ShowerHead,
  Snowflake,
  Sun,
  Thermometer,
  Toilet,
  Trees,
  Truck,
  Tv,
  Usb,
  Warehouse,
  Waves,
  Wind,
  Zap,
  type LucideIcon,
} from 'lucide-react-native'

/**
 * The lucide component for each icon name an entity can ask for (the names the Settings pickers
 * offer are `@renewvan/core/icons`). A curated list rather than lucide's whole set, which would put
 * every icon in the bundle; a name outside it reads as no choice, so the app picks one from the
 * entity itself.
 */
const ENTITY_ICONS: Record<string, LucideIcon> = {
  Park,
  Trees,
  Armchair,
  Cpu,
  Thermometer,
  Refrigerator,
  Snowflake,
  Sun,
  Flame,
  House,
  Car,
  Truck,
  Droplet,
  Wind,
  Warehouse,
  Bed,
  Fan,
  Waves,
  Toilet,
  Fuel,
  ShowerHead,
  Bath,
  GlassWater,
  Container,
  Faucet,
  Lightbulb,
  Lamp,
  Microwave,
  Usb,
  Plug,
  Zap,
  Tv,
  Power,
}

/** The icon for an entity's `icon` string, or `undefined` when it has none the dashboard knows. */
export function entityIcon(name: string | undefined): LucideIcon | undefined {
  return name === undefined ? undefined : ENTITY_ICONS[name]
}

export function entityIconOf(name: string): LucideIcon {
  return ENTITY_ICONS[name]
}
