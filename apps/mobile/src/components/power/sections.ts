import type { Capability } from '@/lib/capabilities'
import type { EntityType } from '@/lib/drivers'

export type EnergyCard = 'power' | 'battery' | 'solar' | 'chargers'

export const ENERGY_CARD_LABELS: Record<EnergyCard, string> = {
  power: 'Power',
  battery: 'Battery',
  solar: 'Solar production',
  chargers: 'Chargers',
}

/** The Energy cards the van has, in their default order: a battery gives the flow and the dial. */
export function energyCards(capabilities: Record<EntityType, Capability>): EnergyCard[] {
  const cards: [EnergyCard, EntityType][] = [
    ['power', 'battery'],
    ['battery', 'battery'],
    ['solar', 'solar'],
    ['chargers', 'charger'],
  ]
  return cards.filter(([, type]) => capabilities[type].state === 'present').map(([id]) => id)
}
