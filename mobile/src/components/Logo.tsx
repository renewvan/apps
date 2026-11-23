import { brand, logoSymbol, logoWordmark, type LogoElement } from '@renewvan/brand'
import { createElement, type ElementType, type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Defs, G, Line, Mask, Path, Rect } from 'react-native-svg'
import { useTheme } from '@/theme'

// The master's SVG elements (`@renewvan/brand`'s `logoSymbol`, read from
// `renewvan-symbol-blue.svg`), each as its react-native-svg component.
const ELEMENTS: Record<LogoElement['name'], ElementType> = {
  circle: Circle,
  defs: Defs,
  g: G,
  line: Line,
  mask: Mask,
  path: Path,
  rect: Rect,
}

function draw(element: LogoElement, key: number): ReactNode {
  const children = element.children.length ? element.children.map(draw) : undefined
  return createElement(ELEMENTS[element.name], { key, ...element.props }, children)
}

/** The Renewvan symbol in brand blue, drawn from the logo master. */
export function LogoSymbol({ size = 28 }: { size?: number }) {
  const { viewBox, width, height, children } = logoSymbol
  return (
    <Svg width={(size * width) / height} height={size} viewBox={viewBox} color={brand.blue}>
      {children.map(draw)}
    </Svg>
  )
}

/** The symbol beside the wordmark, as in the dashboard's header. */
export function LogoLockup({ size = 28 }: { size?: number }) {
  const { colors } = useTheme()
  return (
    <View accessibilityRole="header" accessibilityLabel="Renewvan" style={styles.lockup}>
      <LogoSymbol size={size} />
      <Text style={[styles.word, { color: colors.foreground, fontSize: size * 0.72 }]}>
        {logoWordmark.map((part) =>
          part.brand ? (
            <Text key={part.text} style={{ color: brand.blue }}>
              {part.text}
            </Text>
          ) : (
            part.text
          ),
        )}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  lockup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  word: { fontWeight: '700', letterSpacing: -0.5 },
})
