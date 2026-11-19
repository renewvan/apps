import { Tabs } from '@heroui/react'
import { cn } from '@/lib/utils'
import type { NavItem } from '@/components/Sidebar'

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
      <Tabs.List aria-label="Navigation" className="flex-1 bg-transparent! p-0!">
        {items.map((item) => (
          <Tabs.Tab
            key={item.id}
            id={item.id}
            aria-label={item.label}
            data-testid={`nav-${item.id}`}
            className="data-[selected=true]:text-accent h-14! min-w-0 flex-1 flex-col! gap-0.5 px-0"
          >
            {item.icon}
            <span className="max-w-full truncate px-1 text-xs leading-none font-medium">
              {item.label}
            </span>
            <Tabs.Indicator className="bg-accent/15! rounded-xl! shadow-none!" />
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </nav>
  )
}
