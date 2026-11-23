import { usePreferences } from '@/preferences/PreferencesProvider'
import {
  EMPTY_CARD_LAYOUT,
  cardLayoutAfterEdit,
  shownCards,
  type CardPage,
} from '@/preferences/cardLayout'

/**
 * A page's cards as this phone arranged them. `available` is every card the van has now, in the
 * page's default order; `shown` is those to draw, in order. `edit` saves a rearrangement of
 * `edited` (the cards on screen, or every available one in Settings) into `next`, hiding the rest
 * of `edited`.
 */
export function usePageCards<T extends string>(page: CardPage, available: readonly T[]) {
  const { pageLayouts, update } = usePreferences()
  const layout = pageLayouts[page] ?? EMPTY_CARD_LAYOUT
  const shown = shownCards(available, layout) as T[]
  const edit = (edited: readonly T[], next: readonly T[]) =>
    update({
      pageLayouts: {
        ...pageLayouts,
        [page]: cardLayoutAfterEdit(layout, available, edited, next),
      },
    })
  return { shown, edit }
}
