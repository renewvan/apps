import { describe, expect, it } from 'vite-plus/test'
import { innerMarkup, parseSvg, placeSymbol, textOf } from './svg.ts'

const MASTER =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="6 16 110 80" width="440" height="320" xmlns:c2pa="http://c2pa.org/manifest"><metadata><c2pa:manifest>AAAA</c2pa:manifest></metadata><defs><mask id="k"><rect width="130" height="110" fill="#fff"></rect></mask></defs><g stroke="#0385F7" stroke-width="3"><line x1="54" y1="52" x2="16" y2="26"></line></g></svg>'

describe('parseSvg', () => {
  it('reads the root, its attributes and children, without the metadata', () => {
    const root = parseSvg(MASTER)
    expect(root.name).toBe('svg')
    expect(root.attributes.viewBox).toBe('6 16 110 80')
    expect(root.children.map((child) => (typeof child === 'string' ? child : child.name))).toEqual([
      'defs',
      'g',
    ])
  })

  it('keeps text, so a wordmark can be read', () => {
    const root = parseSvg('<svg><text x="1">renew<tspan fill="#0385F7">van</tspan></text></svg>')
    const text = root.children[0]
    expect(typeof text === 'string' ? text : textOf(text)).toBe('renewvan')
  })
})

describe('innerMarkup', () => {
  it('serialises the children with self-closing empty elements', () => {
    expect(innerMarkup(parseSvg(MASTER))).toBe(
      '<defs><mask id="k"><rect width="130" height="110" fill="#fff"/></mask></defs><g stroke="#0385F7" stroke-width="3"><line x1="54" y1="52" x2="16" y2="26"/></g>',
    )
  })
})

describe('placeSymbol', () => {
  it('scales the van to a share of the canvas width, centred on a point of the symbol', () => {
    const svg = placeSymbol({
      symbol: '<g/>',
      vanWidth: 103,
      size: 1024,
      share: 1,
      centre: { x: 61, y: 54 },
    })
    // favicon.svg as it was exported by hand.
    expect(svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><g transform="translate(-94.4466 -24.8544) scale(9.9417)"><g/></g></svg>',
    )
  })

  it('paints a background when given one', () => {
    const svg = placeSymbol({
      symbol: '<g/>',
      vanWidth: 100,
      size: 100,
      share: 0.5,
      centre: { x: 50, y: 50 },
      background: '#0385f7',
    })
    expect(svg).toContain('<rect width="100" height="100" fill="#0385f7"/>')
    expect(svg).toContain('translate(25 25) scale(0.5)')
  })
})
