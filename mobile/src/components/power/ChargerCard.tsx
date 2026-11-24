import { PlugZap } from 'lucide-react-native'
import { StyleSheet, Text, View } from 'react-native'
import { NoData, TitledCard, tabular } from '@/components/ui'
import { chargerWatts, formatPower } from '@renewvan/core/power'
import { instanceStateText, type LiveInstance } from '@renewvan/core/van'
import { useLiveVan } from '@/bus/LiveVanProvider'
import { useTheme } from '@/theme'
import type { Charger } from '@/types'

/** What a charger's row reads: its power while it reports, else Off (Silent) or Driver offline. */
function reading({ state, record }: LiveInstance<Charger>): string {
  if (state !== 'reporting') return instanceStateText('charger', state)
  const watts = chargerWatts(record)
  const power = formatPower(watts === undefined ? undefined : Math.round(watts))
  return `${power.value} ${power.unit}`
}

/**
 * Every charger the bus knows, including one on a van with no battery monitor, and a Silent one (an
 * AC charger without shore power) shown as Off rather than dropped (hub CONTEXT.md "Silent").
 */
export function ChargerCard() {
  const { colors } = useTheme()
  const chargers = useLiveVan().instances.charger
  return (
    <TitledCard icon={<PlugZap size={16} color={colors.muted} />} title="Chargers">
      {chargers.length === 0 ? (
        <NoData icon={<PlugZap size={16} color={colors.muted} />} label="Chargers" />
      ) : (
        chargers.map((charger) => (
          <View key={charger.id} style={styles.row}>
            <Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>
              {charger.record.name ?? charger.id}
            </Text>
            <Text style={{ color: colors.muted, ...tabular }}>{reading(charger)}</Text>
          </View>
        ))
      )}
    </TitledCard>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  name: { flexShrink: 1, fontSize: 14, fontWeight: '500' },
})
