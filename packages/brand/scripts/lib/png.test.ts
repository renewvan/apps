import { Resvg } from '@resvg/resvg-js'
import { describe, expect, it } from 'vite-plus/test'
import { decodeIco, decodePng, encodeIco, samePixels } from './png.ts'

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#0385f7"/><circle cx="4" cy="4" r="2.5" fill="#fff"/></svg>'

function render(size = 8) {
  return new Resvg(SVG, { fitTo: { mode: 'width', value: size } }).render()
}

describe('decodePng', () => {
  it('reads back the pixels resvg drew', () => {
    const image = render()
    const decoded = decodePng(image.asPng())
    expect(decoded.width).toBe(8)
    expect(decoded.height).toBe(8)
    expect(Buffer.from(decoded.rgba).equals(image.pixels)).toBe(true)
  })

  it('rejects what is not a PNG', () => {
    expect(() => decodePng(Buffer.from('nope'))).toThrow(/PNG/)
  })
})

describe('encodeIco', () => {
  it('stores each PNG with its size in the directory', () => {
    const pngs = [render(8).asPng(), render(16).asPng()]
    const ico = encodeIco(pngs)
    expect(ico.readUInt16LE(2)).toBe(1) // icon
    expect(ico.readUInt16LE(4)).toBe(2) // images
    expect(ico[6]).toBe(8)
    expect(ico[6 + 16]).toBe(16)
    expect(decodeIco(ico).map((image) => image.width)).toEqual([8, 16])
  })
})

describe('samePixels', () => {
  it('allows a small difference per channel, from antialiasing on another CPU', () => {
    const a = decodePng(render().asPng())
    const b = { ...a, rgba: Uint8Array.from(a.rgba, (value) => Math.max(0, value - 3)) }
    expect(samePixels(a, b)).toBe(true)
  })

  it('catches a real change', () => {
    const a = decodePng(render().asPng())
    const rgba = Uint8Array.from(a.rgba)
    rgba[0] = 255 - rgba[0]
    expect(samePixels(a, { ...a, rgba })).toBe(false)
    expect(samePixels(a, decodePng(render(16).asPng()))).toBe(false)
  })
})
