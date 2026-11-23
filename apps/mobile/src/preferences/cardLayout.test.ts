import { EMPTY_CARD_LAYOUT, cardLayoutAfterEdit, parseCardLayout, shownCards } from './cardLayout'

describe('shownCards', () => {
  it('shows every available card in its default order when nothing was arranged', () => {
    expect(shownCards(['a', 'b', 'c'], EMPTY_CARD_LAYOUT)).toEqual(['a', 'b', 'c'])
  })

  it('follows the saved order and leaves hidden cards out', () => {
    expect(shownCards(['a', 'b', 'c'], { order: ['c', 'a', 'b'], hidden: ['a'] })).toEqual([
      'c',
      'b',
    ])
  })

  it('places a new card after its default neighbour, and skips saved cards the van no longer has', () => {
    const layout = { order: ['c', 'gone', 'a'], hidden: [] }
    expect(shownCards(['a', 'b', 'c'], layout)).toEqual(['c', 'a', 'b'])
    expect(shownCards(['new', 'a'], { order: ['a'], hidden: [] })).toEqual(['new', 'a'])
  })
})

describe('cardLayoutAfterEdit', () => {
  it('reorders the edited cards and keeps the rest in their places', () => {
    const layout = { order: ['a', 'x', 'b', 'c'], hidden: ['x'] }
    const next = cardLayoutAfterEdit(layout, ['a', 'b', 'c'], ['a', 'b', 'c'], ['c', 'a', 'b'])
    expect(next).toEqual({ order: ['c', 'x', 'a', 'b'], hidden: ['x'] })
    expect(shownCards(['a', 'b', 'c'], next)).toEqual(['c', 'a', 'b'])
  })

  it('hides an edited card left out, and shows a hidden one put back', () => {
    const hidden = cardLayoutAfterEdit(EMPTY_CARD_LAYOUT, ['a', 'b'], ['a', 'b'], ['b'])
    expect(shownCards(['a', 'b'], hidden)).toEqual(['b'])
    const back = cardLayoutAfterEdit(hidden, ['a', 'b'], ['a', 'b'], ['a', 'b'])
    expect(shownCards(['a', 'b'], back)).toEqual(['a', 'b'])
    expect(back.hidden).toEqual([])
  })

  it('leaves a card that was not edited hidden or shown as it was', () => {
    const layout = { order: [], hidden: ['b'] }
    const next = cardLayoutAfterEdit(layout, ['a', 'b', 'c'], ['a', 'c'], ['c', 'a'])
    expect(next.hidden).toEqual(['b'])
    expect(shownCards(['a', 'b', 'c'], next)).toEqual(['c', 'a'])
  })
})

describe('parseCardLayout', () => {
  it('keeps string ids once each and drops anything else', () => {
    expect(parseCardLayout({ order: ['a', 1, 'a', 'b'], hidden: 'x' })).toEqual({
      order: ['a', 'b'],
      hidden: [],
    })
    expect(parseCardLayout(null)).toBeUndefined()
    expect(parseCardLayout(['a'])).toBeUndefined()
  })
})
