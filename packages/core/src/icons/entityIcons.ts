// The icons an entity can ask for: its `icon` is a lucide component name as a string
// (`Refrigerator`). A curated list rather than lucide's whole set, which would put every icon in a
// bundle. Each app maps these names to its own lucide components (`lib/entityIcons.ts`: lucide-react
// on the dashboard, lucide-react-native on the phone) and reads a name outside them as no choice.

/** What the Settings picker offers a temperature probe, and a tank. */
export const TEMPERATURE_ICON_NAMES = [
  'Park',
  'Trees',
  'Armchair',
  'Cpu',
  'Thermometer',
  'Refrigerator',
  'Snowflake',
  'Sun',
  'Flame',
  'House',
  'Car',
  'Truck',
  'Droplet',
  'Wind',
  'Warehouse',
  'Bed',
  'Fan',
]

export const TANK_ICON_NAMES = [
  'Droplet',
  'Waves',
  'Toilet',
  'Fuel',
  'Flame',
  'ShowerHead',
  'Bath',
  'GlassWater',
  'Container',
  'Faucet',
]

/** What the Settings picker offers a relay channel: the load it switches. */
export const RELAY_ICON_NAMES = [
  'Lightbulb',
  'Lamp',
  'Refrigerator',
  'Microwave',
  'Tv',
  'Fan',
  'Wind',
  'Snowflake',
  'Sun',
  'Flame',
  'Droplet',
  'Waves',
  'Usb',
  'Zap',
  'Plug',
  'Bed',
  'Power',
]
