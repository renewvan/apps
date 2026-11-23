import { View } from 'react-native'
import { alpha, layout, useTheme } from '@/theme'

/** Stands in for a widget until the bus has settled. */
export function Skeleton({ height = 96 }: { height?: number }) {
  const { colors } = useTheme()
  return (
    <View
      accessibilityLabel="Loading"
      style={{
        height,
        borderRadius: layout.radius,
        backgroundColor: alpha(colors.foreground, 0.06),
      }}
    />
  )
}
