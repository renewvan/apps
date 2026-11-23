import type { ReactNode } from 'react'
import { Tabs } from '@heroui/react'
import { cn } from '@/lib/utils'
import { NavBarList } from './BottomNavBar'

export interface NavItem {
  id: string
  label: string
  /** A shorter name for the bottom bar's visible label, where `label` would not fit a phone. */
  short?: string
  icon: ReactNode
}

export interface SidebarProps {
  items: NavItem[]
  /**
   * Below the `md` breakpoint the same single tab list renders as a bottom
   * bar instead of a vertical rail. The caller decides (e.g. `useIsMobile()`)
   * and must give the `Tabs` root the matching `orientation`.
   */
  isMobile?: boolean
  /** Kiosk rail only: slid away. The caller drives it from `useAutoHide` (see `App`). */
  hidden?: boolean
}

/**
 * Primary navigation: ONE HeroUI `Tabs.List`. The caller owns the `Tabs`
 * root and `selectedKey`, so it can also render the panels.
 *
 * Kiosk: a closed icon-only rail in an `<aside>` (the accessible name stays on
 * each tab via `aria-label`), spanning the full height of the app: the header sits in the same
 * container and pads itself clear of the rail, which pushes the brand to the right while the rail
 * is up. The last item (Settings) is pushed to the bottom with `mt-auto`. The rail slides away
 * to the left after a few idle seconds and a touch anywhere brings it back.
 *
 * Mobile: the kiosk bottom bar's tabs (`NavBarList`: icon above label, the selected icon in an
 * accent pill) inside a static bottom `<nav>`. The `<nav>` MUST precede the panels in the DOM (React
 * Aria warns when a tab panel is rendered before its tab list); `order-last`
 * moves it visually below them inside a flex-column parent, and the bottom
 * padding keeps it clear of the iOS home indicator.
 */
export function Sidebar({ items, isMobile = false, hidden = false }: SidebarProps) {
  const lastIndex = items.length - 1

  const list = (
    <Tabs.List
      aria-label="Navigation"
      className={cn(
        'min-h-0 flex-1 items-center',
        // HeroUI styles the list as a segmented control; the rail
        // is a plain column, so drop the container chrome and let rows breathe.
        'bg-transparent!',
      )}
    >
      {items.map((item, index) => (
        <Tabs.Tab
          key={item.id}
          id={item.id}
          aria-label={item.label}
          data-testid={`nav-${item.id}`}
          className={cn(
            'data-[selected=true]:text-accent size-11! w-11! min-w-0! px-0!',
            index === lastIndex && 'mt-auto',
          )}
        >
          {item.icon}
          <Tabs.Indicator className="bg-accent/15! rounded-3xl! shadow-none!" />
        </Tabs.Tab>
      ))}
    </Tabs.List>
  )

  if (isMobile) {
    return (
      <nav
        aria-label="Primary"
        className="border-border bg-surface order-last flex shrink-0 border-t pb-[env(safe-area-inset-bottom)]"
      >
        <NavBarList items={items} />
      </nav>
    )
  }

  return <AutoHidingRail hidden={hidden}>{list}</AutoHidingRail>
}

/**
 * The kiosk rail. Absolutely positioned over the whole app (header included) so it can precede
 * the panes in the DOM (React Aria); it never pushes them. Translucent and blurred. Controlled:
 * `App` owns the auto-hide state (see `BottomNavBar` for why it cannot live in here). While it is
 * up the parent publishes a 56px left inset (`--navbar-inset-left`) that the header and a page
 * may pad themselves by, and drops it to 0 as the rail slides away to the left. A touch anywhere
 * brings it back.
 */
function AutoHidingRail({ children, hidden }: { children: ReactNode; hidden: boolean }) {
  return (
    <aside
      data-state={hidden ? 'hidden' : 'visible'}
      // `inert` while hidden keeps the off-screen tabs out of the tab order and AT.
      inert={hidden}
      className={cn(
        'border-border bg-surface/70 absolute inset-y-0 left-0 z-40 flex w-[56px] flex-col overflow-hidden border-r pt-2 pb-1 pl-0.5 backdrop-blur-md transition-transform duration-300 motion-reduce:transition-none',
        hidden && '-translate-x-full',
      )}
    >
      {children}
    </aside>
  )
}
