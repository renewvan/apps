import { capabilitiesOf } from '@renewvan/core/drivers'
import { emptyRenewvanBusState, type RenewvanBusState } from '@/types'
import { energyCards } from './sections'

const capabilities = (partial: Partial<RenewvanBusState>) =>
  capabilitiesOf({ ...emptyRenewvanBusState, ...partial })

describe('energyCards', () => {
  it('is empty when the van has no energy device', () => {
    expect(energyCards(capabilities({}))).toEqual([])
  })

  it('lists only the cards the van has, in the default order', () => {
    expect(
      energyCards(
        capabilities({ chargers: { a: {} as never }, batteries: { house: {} as never } }),
      ),
    ).toEqual(['power', 'battery', 'chargers'])
    expect(energyCards(capabilities({ solar: { roof: {} as never } }))).toEqual(['solar'])
  })
})
