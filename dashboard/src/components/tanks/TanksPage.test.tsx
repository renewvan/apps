import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { stubMatchMedia, type MatchMediaStub } from '@/test/matchMedia'
import { testLiveVan } from '@/test/liveVan'
import { LiveVanContext } from '@/hooks/useLiveVan'
import type { RenewvanBusState, Tank } from '@/types'
import { TanksPage } from './TanksPage'

const KIOSK_WIDTH = 800
const JUST_BELOW_KIOSK_WIDTH = 799

function tank(overrides: Partial<Tank> = {}): Tank {
  return {
    fluid_type: 'fresh_water',
    capacity_l: 100,
    level_pct: 62,
    status: 'ok',
    volume_since_full_l: 0,
    volume_since_empty_l: 0,
    ...overrides,
  }
}

const FRESH = tank()
const GREY = tank({ fluid_type: 'grey_water', capacity_l: 80, level_pct: 41 })

let viewport: MatchMediaStub
const onConfigure = vi.fn()
function renderAt(
  width: number,
  tanks: Record<string, Partial<Tank>>,
  drivers: RenewvanBusState['drivers'] = {},
) {
  viewport = stubMatchMedia(width)
  return render(
    <LiveVanContext.Provider value={testLiveVan({ tanks, drivers })}>
      <TanksPage onConfigure={onConfigure} />
    </LiveVanContext.Provider>,
  )
}

afterEach(() => {
  onConfigure.mockClear()
  cleanup()
  viewport.restore()
})

describe.each([
  ['kiosk', KIOSK_WIDTH],
  ['phone', JUST_BELOW_KIOSK_WIDTH],
])('TanksPage (%s)', (_name, width) => {
  it('renders a card per tank, fresh water before grey, whatever the input order', () => {
    renderAt(width, { grey: GREY, fresh: FRESH })
    const names = screen.getAllByText(/^(Fresh|Grey) water$/).map((el) => el.textContent)
    expect(names).toEqual(['Fresh water', 'Grey water'])
  })

  it('shows the Fault badge and the sensor-fault reason instead of litres', () => {
    renderAt(width, { fresh: tank({ status: 'short_circuit' }) })
    expect(screen.getByText('Fault')).toBeInTheDocument()
    expect(screen.getByText('Short circuit')).toBeInTheDocument()
    expect(screen.queryByText(/\u2113/)).not.toBeInTheDocument()
  })

  it('opens the settings of the tank whose card is tapped', async () => {
    renderAt(width, { grey: GREY, fresh: FRESH })

    const buttons = screen.getAllByRole('button', { name: /settings$/ })
    await userEvent.click(buttons[1])

    expect(onConfigure).toHaveBeenCalledExactlyOnceWith('grey')
  })

  it('shows the empty state when no tank has reported', () => {
    renderAt(width, {})
    expect(screen.getByText('No tank data yet.')).toBeInTheDocument()
    expect(screen.getByText('Waiting for readings from the Renewvan hub.')).toBeInTheDocument()
  })

  it('keeps a Silent tank listed, as Not reporting, with no level', () => {
    // Its Driver kept the identity retained and cleared the readings.
    renderAt(width, { fresh: FRESH, grey: { fluid_type: 'grey_water', capacity_l: 80 } })
    expect(screen.getByText('Fresh water')).toBeInTheDocument()
    expect(screen.getByText('Grey water')).toBeInTheDocument()
    expect(screen.getByText('Not reporting')).toBeInTheDocument()
    expect(screen.getAllByText('62%')).toHaveLength(1)
  })

  it('opens the settings of a Silent tank too', async () => {
    renderAt(width, { grey: { fluid_type: 'grey_water', capacity_l: 80 } })
    await userEvent.click(screen.getByRole('button', { name: 'Grey water settings' }))
    expect(onConfigure).toHaveBeenCalledWith('grey')
  })

  it('reads a tank whose Driver is offline as Driver offline', () => {
    renderAt(
      width,
      { grey: { fluid_type: 'grey_water', capacity_l: 80 } },
      {
        tank: {
          info: {
            driver: 'tank',
            product: 'tank',
            source: 'test',
            version: '1',
            publishes: ['tank'],
          },
          health: 'offline',
        },
      },
    )
    expect(screen.getByText('Driver offline')).toBeInTheDocument()
  })

  it('renders one tank and three tanks (the layout is not hardcoded to two)', () => {
    const { unmount } = renderAt(width, { fresh: FRESH })
    expect(screen.getAllByRole('button', { name: /settings$/ })).toHaveLength(1)
    unmount()
    viewport.restore()
    renderAt(width, {
      fresh: FRESH,
      grey: GREY,
      black: tank({ fluid_type: 'black_water' }),
    })
    expect(screen.getAllByRole('button', { name: /settings$/ })).toHaveLength(3)
  })

  it('orders any other tank after fresh and grey, by id', () => {
    renderAt(width, {
      propane: tank({ fluid_type: 'lpg' }),
      black: tank({ fluid_type: 'black_water' }),
      grey: GREY,
      fresh: FRESH,
    })
    const names = screen
      .getAllByText(/^(Fresh water|Grey water|Black water|LPG)$/)
      .map((el) => el.textContent)
    expect(names).toEqual(['Fresh water', 'Grey water', 'Black water', 'LPG'])
  })
})

describe('TanksPage layout switch', () => {
  it('draws the scale (card layout) at 800px', () => {
    renderAt(KIOSK_WIDTH, { fresh: FRESH })
    expect(screen.getAllByTestId('tank-scale')).toHaveLength(1)
  })

  it('draws rows with no scale at 799px', () => {
    renderAt(JUST_BELOW_KIOSK_WIDTH, { fresh: FRESH })
    expect(screen.queryByTestId('tank-scale')).not.toBeInTheDocument()
  })
})
