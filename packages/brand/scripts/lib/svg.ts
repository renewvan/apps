// Just enough XML for the logo masters in svg/: elements, attributes and text. The C2PA
// `<metadata>` the design tool embeds is dropped on reading; nothing generated carries it.

export interface SvgElement {
  name: string
  attributes: Record<string, string>
  children: SvgNode[]
}
export type SvgNode = SvgElement | string

const TOKEN =
  /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/([\w:-]+)\s*>|<([\w:-]+)((?:\s+[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|[^<]+/g
const ATTRIBUTE = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g

export function parseSvg(xml: string): SvgElement {
  const document: SvgElement = { name: '#document', attributes: {}, children: [] }
  const open: SvgElement[] = [document]
  for (const token of xml.matchAll(TOKEN)) {
    const [text, closing, name, attributeText, selfClosing] = token
    const parent = open[open.length - 1]
    if (text.startsWith('<!--') || text.startsWith('<?')) continue
    if (closing) {
      if (parent.name !== closing) throw new Error(`Unexpected </${closing}> in <${parent.name}>`)
      open.pop()
    } else if (name) {
      const element: SvgElement = { name, attributes: {}, children: [] }
      for (const [, key, double, single] of (attributeText ?? '').matchAll(ATTRIBUTE)) {
        element.attributes[key] = double ?? single
      }
      parent.children.push(element)
      if (!selfClosing) open.push(element)
    } else if (text.trim()) {
      parent.children.push(text)
    }
  }
  if (open.length !== 1) throw new Error(`Unclosed <${open[open.length - 1].name}>`)
  const root = document.children.find((child) => typeof child !== 'string')
  if (!root || root.name !== 'svg') throw new Error('No <svg> root')
  return withoutMetadata(root)
}

function withoutMetadata(element: SvgElement): SvgElement {
  return {
    ...element,
    children: element.children
      .filter((child) => typeof child === 'string' || child.name !== 'metadata')
      .map((child) => (typeof child === 'string' ? child : withoutMetadata(child))),
  }
}

/** The text an element holds, its descendants' included. */
export function textOf(element: SvgElement): string {
  return element.children
    .map((child) => (typeof child === 'string' ? child : textOf(child)))
    .join('')
}

function serialise(node: SvgNode): string {
  if (typeof node === 'string') return node
  const attributes = Object.entries(node.attributes)
    .map(([key, value]) => ` ${key}="${value}"`)
    .join('')
  if (node.children.length === 0) return `<${node.name}${attributes}/>`
  return `<${node.name}${attributes}>${node.children.map(serialise).join('')}</${node.name}>`
}

/** An element's children as markup, to be drawn inside another `<svg>`. */
export function innerMarkup(element: SvgElement): string {
  return element.children.map(serialise).join('')
}

/** A number for an SVG attribute: at most four decimals, no trailing zeros. */
function number(value: number): string {
  return String(Math.round(value * 1e4) / 1e4)
}

export interface Placement {
  /** The symbol's markup, in its own user units (the masters' `viewBox="6 16 110 80"`). */
  symbol: string
  /** The van's drawn width in those units, strokes included. */
  vanWidth: number
  /** Width and height of the square canvas, in pixels. */
  size: number
  /** The share of the canvas width the van takes. */
  share: number
  /** The point of the symbol that lands on the canvas centre, in the symbol's units. */
  centre: { x: number; y: number }
  /** A fill for the whole canvas; transparent when absent. */
  background?: string
}

/** A square SVG with the symbol scaled to `share` of its width and centred on `centre`. */
export function placeSymbol({ symbol, vanWidth, size, share, centre, background }: Placement) {
  const scale = (share * size) / vanWidth
  const x = size / 2 - centre.x * scale
  const y = size / 2 - centre.y * scale
  const fill = background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">` +
    `${fill}<g transform="translate(${number(x)} ${number(y)}) scale(${number(scale)})">${symbol}</g></svg>`
  )
}
