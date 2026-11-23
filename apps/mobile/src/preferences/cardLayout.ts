// A page's cards as this phone's owner arranged them: an order and the ones hidden. Home has its
// own, older shape (`HomeLayout`, a fixed catalogue); every other page's cards come and go with the
// van (a tank, a sensor, a relay group), so they are plain ids and the saved order outlives them.

/** The pages whose cards can be reordered and hidden on this phone. */
export const CARD_PAGES = ['energy', 'controls', 'tanks', 'temperature', 'climate'] as const
export type CardPage = (typeof CARD_PAGES)[number]

export interface CardLayout {
  /** Every card ever arranged, in order, those the van no longer has included. */
  order: readonly string[]
  hidden: readonly string[]
}

export const EMPTY_CARD_LAYOUT: CardLayout = { order: [], hidden: [] }

/**
 * Every card, the saved ones in their order and each card the layout has not seen yet at its
 * place in `available` (after the nearest card before it there that is already placed, else first).
 */
function fullOrder(available: readonly string[], layout: CardLayout): string[] {
  const order = [...layout.order]
  available.forEach((id, index) => {
    if (order.includes(id)) return
    const before = available
      .slice(0, index)
      .reverse()
      .find((w) => order.includes(w))
    order.splice(before === undefined ? 0 : order.indexOf(before) + 1, 0, id)
  })
  return order
}

/** The cards a page shows, in order: those in `available` (its default order) not hidden. */
export function shownCards(available: readonly string[], layout: CardLayout): string[] {
  return fullOrder(available, layout).filter(
    (id) => available.includes(id) && !layout.hidden.includes(id),
  )
}

/**
 * The layout after the cards in `edited` were rearranged into `shown`; the ones of `edited` left
 * out are hidden. Every other card keeps its place and whether it is hidden: the edited cards only
 * trade the places they held among themselves.
 */
export function cardLayoutAfterEdit(
  layout: CardLayout,
  available: readonly string[],
  edited: readonly string[],
  shown: readonly string[],
): CardLayout {
  const removed = edited.filter((id) => !shown.includes(id))
  const queue = [...shown, ...removed]
  const order = fullOrder(available, layout).map((id) =>
    edited.includes(id) ? queue.shift()! : id,
  )
  const hidden = [
    ...layout.hidden.filter((id) => !shown.includes(id)),
    ...removed.filter((id) => !layout.hidden.includes(id)),
  ]
  return { order, hidden }
}

/** Reads a stored layout, keeping only well-formed ids. */
export function parseCardLayout(value: unknown): CardLayout | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const ids = (list: unknown) =>
    Array.isArray(list)
      ? [...new Set(list.filter((id): id is string => typeof id === 'string'))]
      : []
  const record = value as Record<string, unknown>
  return { order: ids(record.order), hidden: ids(record.hidden) }
}
