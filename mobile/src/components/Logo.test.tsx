import { render, screen } from '@testing-library/react-native'
import { LogoLockup, LogoSymbol } from './Logo'

// The logo is drawn from `@renewvan/brand`'s `logoSymbol`, read from the SVG master: these pin that
// the master's elements all reach react-native-svg, and the wordmark its text.

// Uniwind ships TypeScript source Jest does not transform; the lockup only needs the theme's name.
jest.mock('uniwind', () => ({ useUniwind: () => ({ theme: 'light' }) }))

interface Node {
  type: string
  props: Record<string, unknown>
  children: (Node | string)[] | null
}

function count(node: Node | string, type: string): number {
  if (typeof node === 'string') return 0
  const own = node.type === type ? 1 : 0
  return own + (node.children ?? []).reduce((sum, child) => sum + count(child, type), 0)
}

it('draws the symbol from the master, wheels cut out of the frame', async () => {
  await render(<LogoSymbol size={40} />)
  const svg = screen.toJSON() as Node
  expect(count(svg, 'RNSVGMask')).toBe(1)
  expect(count(svg, 'RNSVGLine')).toBe(5)
  // Three in the mask, five joints, the hub and two wheels.
  expect(count(svg, 'RNSVGCircle')).toBe(11)
})

it('keeps the master proportions, sized by height', async () => {
  await render(<LogoSymbol size={80} />)
  expect(JSON.stringify(screen.toJSON())).toContain('"height":80')
  expect(JSON.stringify(screen.toJSON())).toContain('"width":110')
})

it('reads the wordmark beside the symbol', async () => {
  await render(<LogoLockup />)
  expect(screen.getByLabelText('Renewvan')).toBeTruthy()
  expect(screen.getByText('van')).toBeTruthy()
})
