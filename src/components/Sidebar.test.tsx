import { render, screen, within } from '@testing-library/react'
import { Tabs } from '@heroui/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { stubMatchMedia, type MatchMediaStub } from '@/test/matchMedia'
import { Sidebar, type NavItem } from './Sidebar'

// HeroUI's Tabs read window.matchMedia (absent in jsdom).
let viewport: MatchMediaStub

beforeEach(() => {
  viewport = stubMatchMedia(1024)
})

const items: NavItem[] = [
  { id: 'tanks', label: 'Tanks', icon: <span data-testid="icon-tanks" /> },
  { id: 'power', label: 'Power', icon: <span data-testid="icon-power" /> },
  { id: 'settings', label: 'Settings', icon: <span data-testid="icon-settings" /> },
]

function renderSidebar({
  isMobile = false,
  selectedKey = 'tanks',
}: {
  isMobile?: boolean
  selectedKey?: string
} = {}) {
  return render(
    <Tabs
      selectedKey={selectedKey}
      onSelectionChange={() => {}}
      orientation={isMobile ? 'horizontal' : 'vertical'}
    >
      <Sidebar items={items} isMobile={isMobile} />
      <Tabs.Panel id="tanks">Tanks panel</Tabs.Panel>
      <Tabs.Panel id="power">Power panel</Tabs.Panel>
      <Tabs.Panel id="settings">Settings panel</Tabs.Panel>
    </Tabs>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  viewport.restore()
})

describe.each([
  { name: 'rail', isMobile: false },
  { name: 'bottom bar', isMobile: true },
])('Sidebar ($name)', ({ isMobile }) => {
  it('renders an icon for every item', () => {
    renderSidebar({ isMobile })
    for (const item of items) {
      expect(screen.getByTestId(`icon-${item.id}`)).toBeInTheDocument()
    }
  })

  it('labels each tab for accessibility', () => {
    renderSidebar({ isMobile })
    for (const item of items) {
      expect(screen.getByRole('tab', { name: item.label })).toBe(
        screen.getByTestId(`nav-${item.id}`),
      )
    }
  })

  it('marks only the selected tab as selected', () => {
    renderSidebar({ isMobile, selectedKey: 'power' })
    expect(screen.getByTestId('nav-power')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('nav-tanks')).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByTestId('nav-settings')).toHaveAttribute('aria-selected', 'false')
  })

  it('renders exactly one tablist', () => {
    renderSidebar({ isMobile })
    expect(screen.getAllByRole('tablist')).toHaveLength(1)
  })

  it('keeps Settings as the last tab', () => {
    renderSidebar({ isMobile })
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(items.length)
    expect(tabs.at(-1)).toHaveAccessibleName('Settings')
  })

  it('does not warn about a tab panel rendered before the tab list', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderSidebar({ isMobile })
    const messages = [...warn.mock.calls, ...error.mock.calls].map((args) => args.join(' '))
    expect(messages.filter((m) => /tab panel|tab id/i.test(m))).toEqual([])
  })
})

describe('Sidebar (rail)', () => {
  it('never renders visible text labels', () => {
    renderSidebar()
    // Panels carry their own text; match the label spans inside the tabs.
    for (const item of items) {
      expect(within(screen.getByTestId(`nav-${item.id}`)).queryByText(item.label)).toBeNull()
    }
  })
})

describe('Sidebar (bottom bar)', () => {
  it('shows each label under its icon, as the kiosk bottom bar and the Android app do', () => {
    renderSidebar({ isMobile: true })
    for (const item of items) {
      const tab = screen.getByTestId(`nav-${item.id}`)
      expect(within(tab).getByText(item.label)).toBeInTheDocument()
      expect(within(tab).getByTestId(`icon-${item.id}`)).toBeInTheDocument()
    }
  })

  it('shows the short name where an item has one, keeping the full one as the accessible name', () => {
    render(
      <Tabs selectedKey="temperature" onSelectionChange={() => {}} orientation="horizontal">
        <Sidebar
          items={[{ id: 'temperature', label: 'Temperature', short: 'Temp', icon: <span /> }]}
          isMobile
        />
        <Tabs.Panel id="temperature">Temperature panel</Tabs.Panel>
      </Tabs>,
    )
    const tab = screen.getByRole('tab', { name: 'Temperature' })
    expect(within(tab).getByText('Temp')).toBeInTheDocument()
  })

  it('puts the selected wash behind the icon only, not the label', () => {
    renderSidebar({ isMobile: true, selectedKey: 'power' })
    const tab = screen.getByTestId('nav-power')
    const indicator = tab.querySelector('[data-slot="tabs-indicator"]')
    expect(indicator).not.toBeNull()
    expect(indicator?.parentElement).toContainElement(screen.getByTestId('icon-power'))
    expect(indicator?.parentElement).not.toContainElement(within(tab).getByText('Power'))
  })

  it('puts the tablist in a navigation landmark that precedes the panel', () => {
    renderSidebar({ isMobile: true })
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    expect(nav).toContainElement(screen.getByRole('tablist'))
    expect(
      nav.compareDocumentPosition(screen.getByRole('tabpanel')) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

describe('Sidebar (brand)', () => {
  it('renders no brand, rail or bottom bar: the app header carries it', () => {
    const { unmount } = renderSidebar()
    expect(screen.queryByRole('img', { name: 'renewvan' })).not.toBeInTheDocument()
    unmount()
    renderSidebar({ isMobile: true })
    expect(screen.queryByRole('img', { name: 'renewvan' })).not.toBeInTheDocument()
  })

  it('is a closed icon rail in a complementary landmark on the kiosk', () => {
    renderSidebar()
    expect(screen.getByRole('complementary')).toContainElement(screen.getByRole('tablist'))
  })
})
