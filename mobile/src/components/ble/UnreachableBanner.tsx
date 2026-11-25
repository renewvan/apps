import type { BluetoothOffer } from '@renewvan/core/winterMode'
import { StyleSheet, View } from 'react-native'
import { NativeButton } from '@/components/native'
import { openSettings } from '@/components/settings/routes'
import { Banner } from '@/components/ui'
import { useWinterMemory } from '@/winterMode/WinterMemoryProvider'

/**
 * The van is out of reach: its values may be stale. Near the van the phone can still reach a relay
 * board over Bluetooth: Hub wake first while it remembers Winter mode, and Direct control (core's
 * `bluetoothOffer`). Once a wake was accepted, the hub is said to be starting until the bus is back.
 */
export function UnreachableBanner() {
  const { offer } = useWinterMemory()
  const { hubWake } = offer
  return (
    <View style={styles.unreachable}>
      <Banner tone={hubWake === 'quiet' ? 'danger' : 'accent'}>{UNREACHABLE_TEXT[hubWake]}</Banner>
      <View style={styles.actions}>
        {hubWake === 'prominent' ? (
          <NativeButton label="Wake hub" onPress={() => openSettings('hub-wake')} />
        ) : null}
        {offer.directControl ? (
          <NativeButton
            label="Direct control"
            accessibilityLabel="Direct control over Bluetooth"
            variant="outlined"
            onPress={() => openSettings('direct-control')}
          />
        ) : null}
      </View>
    </View>
  )
}

const UNREACHABLE_TEXT: Record<BluetoothOffer['hubWake'], string> = {
  quiet: 'Not connected to the van. Values may be out of date; reconnecting…',
  prominent: 'Winter mode: the hub is powered down. Near the van, wake it over Bluetooth.',
  starting: 'Hub starting: the relay board switched it on. This takes a minute or two.',
}

const styles = StyleSheet.create({
  unreachable: { gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
})
