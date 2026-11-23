import { Minus } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useItemContext } from 'react-native-sortables'
import { alpha, radius, useTheme } from '@/theme'

const BADGE = 24

/**
 * One card in an `EditableCards` list. While its page is being edited it wears a red (−) badge at
 * its top-right corner that hides it, and its contents take no taps (a held heater button must
 * not switch the heater). The card being dragged lifts with an accent border and glow.
 */
export function EditableCard({
  label,
  editing,
  onRemove,
  corners = radius['3xl'],
  children,
}: {
  label: string
  editing: boolean
  /** Absent for a card that cannot be hidden: no badge. */
  onRemove?: () => void
  /** The card's own corner radius, for the focus ring to follow. */
  corners?: number
  children: ReactNode
}) {
  const { colors } = useTheme()
  const { activationAnimationProgress } = useItemContext()
  const focus = useAnimatedStyle(() => ({ opacity: activationAnimationProgress.value }))
  return (
    <View>
      <View pointerEvents={editing ? 'none' : 'auto'}>{children}</View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.focus,
          {
            borderRadius: corners,
            borderColor: colors.accent,
            boxShadow: `0 0 18px 4px ${alpha(colors.accent, 0.55)}`,
          },
          focus,
        ]}
      />
      {editing && onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Hide ${label} from Home`}
          hitSlop={10}
          onPress={onRemove}
          style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.background }]}
        >
          <Minus size={14} strokeWidth={3} color="white" />
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  focus: { ...StyleSheet.absoluteFill, borderWidth: 2 },
  // A dot badge on the corner, as on a phone's home screen: round by nature.
  badge: {
    position: 'absolute',
    top: -BADGE / 3,
    right: -BADGE / 3,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
