import type { ReactNode } from 'react'
import { Card } from '@heroui/react'

/**
 * A phone page's card: the title row every card on a page shares, then its content, centred. The
 * Start and Power pages stack these on a phone.
 */
export function PhoneCard({
  title,
  icon,
  right,
  children,
}: {
  title: string
  icon: ReactNode
  /** Top right of the header, e.g. which battery the card reads. */
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <Card className="shrink-0 gap-0! p-0!">
      <Card.Header className="mb-2 flex-row! items-center gap-2 px-4 py-3 text-sm font-semibold">
        <span className="text-muted" aria-hidden="true">
          {icon}
        </span>
        {title}
        {right && <span className="ml-auto min-w-0 truncate">{right}</span>}
      </Card.Header>
      <Card.Content className="items-center justify-center gap-4 px-4 pb-5">
        {children}
      </Card.Content>
    </Card>
  )
}
