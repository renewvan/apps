import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { alpha, useTheme } from '@/theme'

/** Home is the first tab shown, wherever the app is entered (sign-in included). */
export const unstable_settings = { initialRouteName: 'home' }

/**
 * The app's primary navigation (ADR 0006): the platform's own tab bar (Material 3 bottom
 * navigation on Android, the system tab bar on iOS) over a stack per tab. Android allows five tabs;
 * Settings and Alerts open from the header, over the tabs.
 */
export default function TabsLayout() {
  const { colors } = useTheme()
  return (
    <NativeTabs
      backgroundColor={colors.surface}
      disableTransparentOnScrollEdge
      iconColor={colors.muted}
      tintColor={colors.accent}
      indicatorColor={alpha(colors.accent, 0.18)}
      rippleColor={alpha(colors.accent, 0.12)}
      labelStyle={{ color: colors.muted, fontSize: 12 }}
      labelVisibilityMode="labeled"
    >
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Icon md="home" sf="house" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="energy">
        <NativeTabs.Trigger.Icon md="bolt" sf="bolt" />
        <NativeTabs.Trigger.Label>Energy</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="controls">
        <NativeTabs.Trigger.Icon md="toggle_on" sf="switch.2" />
        <NativeTabs.Trigger.Label>Controls</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="levels">
        <NativeTabs.Trigger.Icon md="water_drop" sf="drop" />
        <NativeTabs.Trigger.Label>Levels</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="climate">
        <NativeTabs.Trigger.Icon md="mode_heat_cool" sf="thermometer.medium" />
        <NativeTabs.Trigger.Label>Climate</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
