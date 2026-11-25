import { NavRow } from '@/components/settings/kit'
import { openSettings } from '@/components/settings/routes'
import { useWinterMemory } from '@/winterMode/WinterMemoryProvider'

/**
 * Hub wake, always here for a phone that missed Winter mode, and Direct control only while the
 * van's network is off (core's `bluetoothOffer`).
 */
export function BluetoothRows() {
  const { winterMode, offer } = useWinterMemory()
  return (
    <>
      <NavRow
        label="Wake hub"
        description={
          offer.hubWake === 'starting'
            ? 'Hub starting: the relay board switched it on'
            : winterMode
              ? 'Winter mode: power the hub back on over Bluetooth, near the van'
              : 'Power the hub back on over Bluetooth, near the van'
        }
        attention={offer.hubWake === 'prominent'}
        onPress={() => openSettings('hub-wake')}
      />
      {offer.directControl ? (
        <NavRow
          label="Direct control"
          description="Switch the van's lights over Bluetooth while its network is off"
          onPress={() => openSettings('direct-control')}
        />
      ) : null}
    </>
  )
}
