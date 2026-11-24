import { Pressable, Switch, Text, TextInput, View } from 'react-native'
import type {
  NativeButtonProps,
  NativeSwitchProps,
  NativeTextFieldProps,
  SegmentedProps,
} from '@/components/native/types'

// Plain React Native stand-ins for the form controls, for a test's `jest.mock('@/components/native')`:
// HeroUI Native ships ES modules and needs the native styling Jest does not have. Each keeps the
// role, label and disabled state a test asks for. `confirm` records the prompt: a test reads its
// options and calls `onConfirm` as the tap on the confirming button would.

export const confirm = jest.fn()

export function ConfirmHost() {
  return null
}

export function NativeButton({
  label,
  accessibilityLabel = label,
  onPress,
  disabled,
}: NativeButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
    >
      <Text>{label}</Text>
    </Pressable>
  )
}

export function NativeSwitch({ value, onChange, disabled, label }: NativeSwitchProps) {
  return (
    <Switch accessibilityLabel={label} value={value} disabled={disabled} onValueChange={onChange} />
  )
}

export function Segmented<T extends string>({ label, options, disabled }: SegmentedProps<T>) {
  return (
    <View accessible accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => (
        <Pressable
          key={option.key}
          accessibilityRole="radio"
          accessibilityState={{ disabled: Boolean(disabled) }}
        >
          <Text>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

export function NativeTextField({ label, defaultValue, onChangeText }: NativeTextFieldProps) {
  return (
    <TextInput accessibilityLabel={label} defaultValue={defaultValue} onChangeText={onChangeText} />
  )
}

export function NativeSlider() {
  return null
}
