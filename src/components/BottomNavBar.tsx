import { Tabs } from '@heroui/react'
import { cn } from '@/lib/utils'
import type { NavItem } from '@/components/Sidebar'

/**
 * The bottom bar's tabs, the phone's and the kiosk's alike, drawn as the Android app's (Material 3
 * navigation bar): each tab is its icon above its label, and the selected one has a pill-shaped
 * accent wash behind the icon only, not the whole tab. The pill is HeroUI's sliding
 * `Tabs.Indicator`, placed inside the icon's box so it takes that box's size. The visible label
 * is the item's `short` name where it has one (so seven tabs fit a phone); the tab's accessible
 * name is always the full `label`.
 */
export function NavBarList({ items }: { items: NavItem[] }) {
  return (
    <Tabs.List aria-label="Navigation" className="w-full flex-1 bg-transparent! p-0!">
      {items.map((item) => (
        <Tabs.Tab
          key={item.id}
          id={item.id}
          aria-label={item.label}
          data-testid={`nav-${item.id}`}
          className="text-muted data-[selected=true]:text-accent h-14! min-w-0 flex-1 flex-col! justify-center! gap-1 rounded-none! px-0!"
        >
          <span className="relative flex h-8 w-14 max-w-full shrink-0 items-center justify-center">
            <Tabs.Indicator className="bg-accent/15! rounded-full! shadow-none!" />
            <span className="relative">{item.icon}</span>
          </span>
          <span className="max-w-full truncate px-1 text-xs leading-none font-medium">
            {item.short ?? item.label}
          </span>
        </Tabs.Tab>
      ))}
    </Tabs.List>
  )
}

export interface BottomNavBarProps {
  items: NavItem[]
  /** Slid away: the caller drives it from `useAutoHide` (see `App`). */
  hidden: boolean
}

/**
 * Kiosk primary navigation as a bottom bar: ONE HeroUI `Tabs.List` (the caller owns the
 * `Tabs` root and the panels). Controlled: `App` owns the auto-hide state and runs
 * `useAutoHide` once. It must not live in here: React Aria renders everything inside `Tabs`
 * a second time, hidden, to build its collection, so a hook in this component would run twice
 * and the hidden copy would keep hiding a pinned bar. The bar slides away when `hidden` and a
 * touch anywhere brings it back. Absolutely positioned inside the `Tabs` root so it can
 * precede the panels in the DOM (React Aria warns otherwise); it never pushes the panes.
 * Translucent and blurred. While it is up the parent publishes a bottom inset
 * (`--navbar-inset-bottom`) that a page may pad itself by, and drops it to 0 as the bar slides
 * away.
 */
export function BottomNavBar({ items, hidden }: BottomNavBarProps) {
  return (
    <nav
      aria-label="Primary"
      data-state={hidden ? 'hidden' : 'visible'}
      // `inert` while hidden keeps the off-screen tabs out of the tab order and AT.
      inert={hidden}
      className={cn(
        'border-border bg-surface/70 absolute inset-x-0 bottom-0 z-40 flex items-stretch border-t pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgb(0_0_0/0.18)] backdrop-blur-md transition-transform duration-300 motion-reduce:transition-none',
        hidden && 'translate-y-full',
      )}
    >
      <NavBarList items={items} />
    </nav>
  )
}
