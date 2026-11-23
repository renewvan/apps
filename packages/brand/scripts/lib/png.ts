// Reading PNGs back (to compare a committed icon with a fresh render by its pixels, not its bytes)
// and packing PNGs into an .ico. Only what resvg writes: 8-bit, non-interlaced, grey or RGB(A).
import { inflateSync } from 'node:zlib'

export interface Pixels {
  width: number
  height: number
  /** Straight (not premultiplied) RGBA, row by row. */
  rgba: Uint8Array
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 }

export function decodePng(png: Buffer): Pixels {
  if (png.length < 8 || !png.subarray(0, 8).equals(SIGNATURE)) throw new Error('Not a PNG')
  let width = 0
  let height = 0
  let channels = 0
  const data: Buffer[] = []
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('latin1', offset + 4, offset + 8)
    const body = png.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      const [depth, colourType, , , interlace] = body.subarray(8)
      channels = CHANNELS[colourType] ?? 0
      if (depth !== 8 || !channels || interlace) {
        throw new Error(`Unsupported PNG (depth ${depth}, colour type ${colourType})`)
      }
    } else if (type === 'IDAT') {
      data.push(body)
    }
    offset += 12 + length
  }
  const raw = inflateSync(Buffer.concat(data))
  const stride = width * channels
  const rows = new Uint8Array(stride * height)
  for (let y = 0; y < height; y++) {
    unfilter(
      raw[y * (stride + 1)],
      raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)),
      rows,
      y,
      stride,
      channels,
    )
  }
  const rgba = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const p = rows.subarray(i * channels, (i + 1) * channels)
    const [r, g, b] = channels >= 3 ? p : [p[0], p[0], p[0]]
    rgba.set([r, g, b, channels === 2 || channels === 4 ? p[channels - 1] : 255], i * 4)
  }
  return { width, height, rgba }
}

function unfilter(
  filter: number,
  line: Uint8Array,
  out: Uint8Array,
  y: number,
  stride: number,
  bpp: number,
) {
  const row = y * stride
  const above = (x: number) => (y > 0 ? out[row - stride + x] : 0)
  for (let x = 0; x < stride; x++) {
    const left = x >= bpp ? out[row + x - bpp] : 0
    const up = above(x)
    const upLeft = x >= bpp ? above(x - bpp) : 0
    let predictor = 0
    if (filter === 1) predictor = left
    else if (filter === 2) predictor = up
    else if (filter === 3) predictor = (left + up) >> 1
    else if (filter === 4) predictor = paeth(left, up, upLeft)
    else if (filter !== 0) throw new Error(`Bad PNG filter ${filter}`)
    out[row + x] = (line[x] + predictor) & 0xff
  }
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/** PNGs packed into one .ico (Vista and later read PNG entries), smallest first as given. */
export function encodeIco(pngs: Buffer[]): Buffer {
  const header = Buffer.alloc(6 + 16 * pngs.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(pngs.length, 4)
  let offset = header.length
  pngs.forEach((png, i) => {
    const { width, height } = decodePng(png)
    const entry = 6 + 16 * i
    header[entry] = width >= 256 ? 0 : width
    header[entry + 1] = height >= 256 ? 0 : height
    header.writeUInt16LE(1, entry + 4) // colour planes
    header.writeUInt16LE(32, entry + 6) // bits per pixel
    header.writeUInt32LE(png.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += png.length
  })
  return Buffer.concat([header, ...pngs])
}

/** The images in an .ico written by `encodeIco`. */
export function decodeIco(ico: Buffer): Pixels[] {
  if (ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1) throw new Error('Not an ICO')
  return Array.from({ length: ico.readUInt16LE(4) }, (_, i) => {
    const entry = 6 + 16 * i
    const start = ico.readUInt32LE(entry + 12)
    return decodePng(ico.subarray(start, start + ico.readUInt32LE(entry + 8)))
  })
}

/**
 * The most a channel may differ for two renders to count as the same image. resvg (tiny-skia)
 * antialiases with SIMD paths that differ by CPU, so a render on Linux CI may be a step or two off
 * one made on a Mac; a moved or recoloured shape is off by far more.
 */
export const CHANNEL_TOLERANCE = 8

export function samePixels(a: Pixels, b: Pixels): boolean {
  if (a.width !== b.width || a.height !== b.height) return false
  for (let i = 0; i < a.rgba.length; i += 4) {
    // Fully transparent pixels carry no colour.
    if (a.rgba[i + 3] === 0 && b.rgba[i + 3] === 0) continue
    for (let c = 0; c < 4; c++) {
      if (Math.abs(a.rgba[i + c] - b.rgba[i + c]) > CHANNEL_TOLERANCE) return false
    }
  }
  return true
}
