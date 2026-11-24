import { fireEvent, render, screen } from '@testing-library/react-native'
import { liveVan } from '@renewvan/core/van'
import { emptyRenewvanBusState, type Battery, type Charger, type RenewvanBusState } from '@/types'
import { PowerFlow } from './PowerFlow'

// Icons are drawing only; lucide ships ES modules Jest does not transform.
jest.mock('lucide-react-native', () => new Proxy({ __esModule: true }, { get: () => () => null }))

// The light theme; uniwind's runtime needs the native styling Jest does not have.
jest.mock('uniwind', () => ({ useUniwind: () => ({ theme: 'light' }) }))

// A Victron BlueSmart AC charger without shore power: its Driver keeps the identity retained and
// clears the live values, `voltage_v` among them.
const BLUESMART = { driver: 'vedirect', name: 'BlueSmart', source: 'ac' } as Charger
const HOUSE: Battery = { soc_pct: 78, voltage_v: 13.4, current_a: 12.5, power_w: 168 }

/** The Live van's flow over a bus holding `chargers`, their Driver's health as given. */
function flowWith(chargers: Record<string, Charger>, health: 'online' | 'offline' = 'online') {
  const state: RenewvanBusState = {
    ...emptyRenewvanBusState,
    batteries: { house: HOUSE },
    chargers,
    drivers: {
      vedirect: {
        info: {
          driver: 'vedirect',
          product: 'VE.Direct',
          source: 'test',
          version: '1',
          publishes: ['charger'],
        },
        health,
      },
    },
  }
  return liveVan({
    state,
    status: 'connected',
    settled: true,
    primaryBattery: null,
    relayGroups: {},
    relayGroupList: null,
    relayOrder: [],
    winterMode: null,
    demoMode: false,
  }).flow
}

/** Draws the flow at a phone card's width: it draws nothing until it knows it. */
async function draw(flow: ReturnType<typeof flowWith>, layout: 'van-tiles' | 'van-orbs') {
  await render(<PowerFlow flow={flow} layout={layout} />)
  await fireEvent(screen.getByTestId('power-flow'), 'layout', {
    nativeEvent: { layout: { width: 360, height: 300 } },
  })
}

describe('Energy flow with a Silent BlueSmart', () => {
  it.each(['van-tiles', 'van-orbs'] as const)(
    'keeps Shore power as Off in %s, with no wire and no watts',
    async (layout) => {
      await draw(flowWith({ bluesmart: BLUESMART }), layout)
      expect(screen.getByLabelText('Shore power: Off')).toBeTruthy()
      expect(screen.getByText('Off')).toBeTruthy()
      expect(screen.queryByTestId('power-wire-shore')).toBeNull()
      expect(screen.getByTestId('power-wire-loads')).toBeTruthy()
    },
  )

  it('reads Driver offline while its Driver is offline', async () => {
    await draw(flowWith({ bluesmart: BLUESMART }, 'offline'), 'van-tiles')
    expect(screen.getByLabelText('Shore power: Driver offline')).toBeTruthy()
  })

  it('draws it with its watts and its wire once it reports', async () => {
    // A trickle under the idle floor: the wire and the van stay still, so nothing animates.
    await draw(flowWith({ bluesmart: { ...BLUESMART, voltage_v: 13.6, power_w: 3 } }), 'van-tiles')
    expect(screen.getByLabelText('Shore power: 3 W')).toBeTruthy()
    expect(screen.getByTestId('power-wire-shore')).toBeTruthy()
  })

  it('draws no Shore source on a van with no charger', async () => {
    await draw(flowWith({}), 'van-tiles')
    expect(screen.queryByLabelText(/^Shore power/)).toBeNull()
  })
})
