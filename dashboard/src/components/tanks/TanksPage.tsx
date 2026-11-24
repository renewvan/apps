import { Droplet } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-media-query'
import { useNow } from '@/hooks/useNow'
import { useLiveVan } from '@/hooks/useLiveVan'
import { NotReportingTank } from './NotReportingTank'
import { TankCard } from './TankCard'
import { TankRow } from './TankRow'

export interface TanksPageProps {
  /** Opens a tank's settings (its Configure button). */
  onConfigure: (id: string) => void
}

/** Drain/fill pace only needs minute resolution. */
const PACE_REFRESH_MS = 30_000

/**
 * Every tank the Live van knows; one that is not reporting keeps its place, saying so. Kiosk (800px and wider): one row of equal cards. Phone: one scrolling row per
 * tank. The switch is the shell's own breakpoint (`useIsMobile`), the one that
 * swaps the rail for the bottom bar. There is deliberately no count cap: with
 * four or more tanks the kiosk cards lose room; revisit if a fourth tank ever
 * publishes (the van publishes fresh and grey only).
 */
export function TanksPage({ onConfigure }: TanksPageProps) {
  const isMobile = useIsMobile()
  const now = new Date(useNow(PACE_REFRESH_MS))
  const tanks = useLiveVan().instances.tank

  if (tanks.length === 0) {
    return (
      <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <Droplet aria-hidden="true" className="text-muted size-5" />
        <h2 className="text-foreground text-lg font-semibold">No tank data yet.</h2>
        <p className="text-muted text-sm">Waiting for readings from the Renewvan hub.</p>
      </section>
    )
  }

  if (isMobile) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto px-4 pt-3 pb-4">
        {tanks.map(({ id, state, record }) =>
          state === 'reporting' ? (
            <TankRow key={id} id={id} tank={record} now={now} onConfigure={onConfigure} />
          ) : (
            <NotReportingTank
              key={id}
              id={id}
              tank={record}
              state={state}
              onConfigure={onConfigure}
            />
          ),
        )}
      </div>
    )
  }

  return (
    <section
      className="grid h-full min-h-0 flex-1 gap-3 px-4 pb-4"
      style={{ gridTemplateColumns: `repeat(${tanks.length}, minmax(0, 1fr))` }}
    >
      {tanks.map(({ id, state, record }) =>
        state === 'reporting' ? (
          <TankCard key={id} id={id} tank={record} now={now} onConfigure={onConfigure} />
        ) : (
          <NotReportingTank
            key={id}
            id={id}
            tank={record}
            state={state}
            fill
            onConfigure={onConfigure}
          />
        ),
      )}
    </section>
  )
}
