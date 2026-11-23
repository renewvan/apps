// oklch() to sRGB hex, for React Native (no CSS custom properties, no oklch) and the app manifests.
// Björn Ottosson's OKLab matrices (https://bottosson.github.io/posts/oklab/), then the sRGB transfer
// curve; a colour outside sRGB is clipped channel by channel, as the hand conversion did.

const OKLCH = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/

export function oklchToHex(css: string): string {
  const match = OKLCH.exec(css.trim())
  if (!match) throw new Error(`Not an oklch() colour: ${css}`)
  const l = Number(match[1]) / 100
  const c = Number(match[2])
  const h = (Number(match[3]) * Math.PI) / 180
  const a = c * Math.cos(h)
  const b = c * Math.sin(h)

  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3

  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
  return `#${linear.map(channelHex).join('')}`
}

function channelHex(linear: number): string {
  const gamma = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055
  const byte = Math.round(Math.min(1, Math.max(0, gamma)) * 255)
  return byte.toString(16).padStart(2, '0')
}
