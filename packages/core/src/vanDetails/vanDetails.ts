/**
 * What a client knows about its own van: free text the owner types in Settings, kept on that
 * device (the hub has no schema for it yet). Not the Live van, which is what the bus says about
 * the van right now. Every field is a string, empty until filled in: `kms` is kept as typed (with
 * the owner's own separators or unit) because nothing computes with it.
 */
export interface VanDetails {
  name: string
  brand: string
  model: string
  kms: string
  plate: string
  /** The van's colour on the map, `#rrggbb`; empty is the theme accent (the default blue). */
  color: string
}

/** The text fields in the order Settings shows them. */
export const VAN_FIELDS: readonly Exclude<keyof VanDetails, 'color'>[] = [
  'name',
  'brand',
  'model',
  'kms',
  'plate',
]

export const VAN_LABELS: Record<keyof VanDetails, string> = {
  name: 'Name',
  brand: 'Brand',
  model: 'Model',
  kms: 'Kms.',
  plate: 'Plate',
  color: 'Colour',
}

/**
 * Swatches Settings offers beside the default blue and a typed hex. These are the owner's choice of
 * paint for their van's map marker, not the brand's palette, so they live here and not in
 * `@renewvan/brand`.
 */
export const VAN_COLOR_PRESETS: readonly string[] = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#a855f7',
  '#ec4899',
  '#e5e7eb',
  '#1f2937',
]

export const HEX_COLOR = /^#[0-9a-f]{6}$/i

export const EMPTY_VAN_DETAILS: VanDetails = {
  name: '',
  brand: '',
  model: '',
  kms: '',
  plate: '',
  color: '',
}

/**
 * The details out of whatever was stored. Field by field, so an edited or older value with a wrong
 * type reads as empty for that field alone instead of discarding the rest, and a colour that is
 * not `#rrggbb` is dropped.
 */
export function readVanDetails(stored: unknown): VanDetails {
  if (typeof stored !== 'object' || stored === null) return EMPTY_VAN_DETAILS
  const record = stored as Record<string, unknown>
  const read = (key: keyof VanDetails) => {
    const value = record[key]
    return typeof value === 'string' ? value : ''
  }
  return {
    name: read('name'),
    brand: read('brand'),
    model: read('model'),
    kms: read('kms'),
    plate: read('plate'),
    color: HEX_COLOR.test(read('color')) ? read('color') : '',
  }
}
