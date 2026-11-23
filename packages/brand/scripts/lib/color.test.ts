import { describe, expect, it } from 'vite-plus/test'
import { oklchToHex } from './color.ts'

describe('oklchToHex', () => {
  it('converts the UI accent to the hex the apps used by hand', () => {
    expect(oklchToHex('oklch(62.04% 0.195 253.83)')).toBe('#0485f7')
  })

  it('converts the neutrals', () => {
    expect(oklchToHex('oklch(97.02% 0.0099 253.83)')).toBe('#f1f6fc')
    expect(oklchToHex('oklch(12% 0.0099 253.83)')).toBe('#040609')
    expect(oklchToHex('oklch(99.11% 0 0)')).toBe('#fcfcfc')
  })

  it('clips colours outside sRGB channel by channel', () => {
    expect(oklchToHex('oklch(65.32% 0.2374 25.74)')).toBe('#ff343a')
  })

  it('rejects anything but oklch()', () => {
    expect(() => oklchToHex('transparent')).toThrow(/oklch/)
  })
})
