import { CarBattery, Waypoints, Zap } from 'lucide-react-native'
import { StyleSheet, View } from 'react-native'
import { Carousel } from '@/components/Carousel'
import type { LiveVan } from '@renewvan/core/van'
import type { PowerLayout } from '@/preferences/preferences'
import { PowerFlow } from '@/components/power/PowerFlow'
import { SourceLabel } from '@/components/power/SourceLabel'
import { batterySourceName } from '@/components/power/sourceName'
import { MutedIcon, NoData, TitledCard } from '@/components/ui'
import { BatteryDial } from './CockpitDial'
import { batteryDial } from '@renewvan/core/dial'

/**
 * Home's Energy widget, as the dashboard's phone Start page draws it: a carousel of the power
 * flow, then the Primary battery's cockpit dial.
 */
export function EnergyCard({
  van,
  layout,
}: {
  /** The Live van's power: its snapshot, the Primary battery and the complete batteries. */
  van: Pick<LiveVan, 'flow' | 'primaryBattery' | 'batteries'>
  layout: PowerLayout
}) {
  const { flow } = van
  const battery = batteryDial(van.primaryBattery?.battery)
  return (
    <TitledCard
      icon={<MutedIcon icon={Zap} />}
      title="Energy"
      right={<SourceLabel name={batterySourceName(van)} />}
    >
      <Carousel
        label="Energy"
        slides={[
          {
            id: 'flow',
            label: 'Power flow',
            content: flow.nodes.battery.present ? (
              // Room for the Van orbs' Solar label, which sits above its orb.
              <View style={layout === 'van-orbs' ? styles.orbs : undefined}>
                <PowerFlow flow={flow} layout={layout} card />
              </View>
            ) : (
              <NoData icon={<MutedIcon icon={Waypoints} />} label="Power flow" />
            ),
          },
          {
            id: 'battery',
            label: 'Battery',
            content: battery ? (
              <BatteryDial view={battery} />
            ) : (
              <NoData icon={<MutedIcon icon={CarBattery} />} label="Battery" />
            ),
          },
        ]}
      />
    </TitledCard>
  )
}

const styles = StyleSheet.create({
  orbs: { paddingTop: 32 },
})
