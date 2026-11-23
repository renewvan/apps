import { router } from 'expo-router'
import { Bell, Settings } from 'lucide-react-native'
import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useAlerts } from '@/alerts/AlertsProvider'
import { useRenewvanBus } from '@/bus/RenewvanBusProvider'
import { useCommands } from '@/bus/commands'
import { confirm } from '@/components/native'
import { radius, useTheme } from '@/theme'
import { LogoLockup } from './Logo'

/**
 * The options that give the tabs the platform's own header, as the dashboard's: the renewvan lockup
 * on the left, and on the right the DEMO badge while the shared Demo mode is on, the Alerts bell and
 * Settings. Worn by the first page of each tab. A lost connection is not an icon here: every page
 * says so in its own banner (`Screen`), and Connectivity is in Settings.
 *
 * With `onDone`, a page in an edit mode of its own (Home's widgets) shows Done there instead.
 */
export function useAppHeaderOptions(onDone?: () => void) {
  const { colors } = useTheme()
  // The same object until the theme or `onDone` changes: a page re-rendering on every bus message
  // must not set its header again each time.
  return useMemo(() => {
    const right = onDone ? <DoneButton onPress={onDone} /> : <HeaderActions />
    return {
      headerShown: true,
      headerTitle: '',
      headerShadowVisible: false,
      headerStyle: { backgroundColor: colors.surface },
      headerLeft: () => <LogoLockup size={26} />,
      headerRight: () => right,
      // iOS 26 puts Liquid Glass behind every bar item. The header is flat like the dashboard, so
      // both sides opt out. These override `headerLeft`/`headerRight` on iOS only.
      // Unstable API: recheck on each SDK upgrade.
      unstable_headerLeftItems: () => [
        { type: 'custom' as const, element: <LogoLockup size={26} />, hidesSharedBackground: true },
      ],
      unstable_headerRightItems: () => [
        { type: 'custom' as const, element: right, hidesSharedBackground: true },
      ],
    }
  }, [colors, onDone])
}

/** Ends an edit mode, as Done does on a phone's home screen. */
function DoneButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      android_ripple={{ color: colors.default }}
      hitSlop={8}
      onPress={onPress}
      style={styles.done}
    >
      <Text style={[styles.doneText, { color: colors.accent }]}>Done</Text>
    </Pressable>
  )
}

/** The Alerts bell, with a red dot while an alert is open, then Settings. */
function HeaderActions() {
  const { colors } = useTheme()
  const { demoMode } = useRenewvanBus()
  const commands = useCommands()
  const { openCount } = useAlerts()
  const attention = openCount > 0

  return (
    <View style={styles.right}>
      {demoMode ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Demo mode, tap to turn off"
          hitSlop={8}
          onPress={() =>
            confirm({
              title: 'Turn off Demo mode?',
              message: 'Every client, the kiosk included, goes back to the live van.',
              action: 'Turn off',
              onConfirm: () => commands.setDemoMode(false),
            })
          }
          style={[styles.demo, { backgroundColor: colors.warning }]}
        >
          <Text style={[styles.demoText, { color: colors.warningForeground }]}>DEMO</Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={attention ? 'Alerts, open alerts' : 'Alerts'}
        android_ripple={{ color: colors.default }}
        hitSlop={8}
        onPress={() => router.push('/alerts')}
        style={styles.menu}
      >
        <Bell size={22} color={colors.foreground} />
        {attention ? <View style={[styles.dot, { backgroundColor: colors.danger }]} /> : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Settings"
        android_ripple={{ color: colors.default }}
        hitSlop={8}
        onPress={() => router.push('/settings')}
        style={styles.menu}
      >
        <Settings size={22} color={colors.foreground} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  right: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  demo: { borderRadius: radius['2xl'], paddingHorizontal: 10, paddingVertical: 3 },
  demoText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  // The ripple stays inside the button, so it takes HeroUI's button corners instead of a circle.
  menu: {
    width: 32,
    height: 32,
    borderRadius: radius['3xl'],
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  done: {
    height: 32,
    paddingHorizontal: 8,
    borderRadius: radius['3xl'],
    overflow: 'hidden',
    justifyContent: 'center',
  },
  doneText: { fontSize: 16, fontWeight: '600' },
  dot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
})
