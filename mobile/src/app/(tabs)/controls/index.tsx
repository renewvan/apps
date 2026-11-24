import { Stack } from 'expo-router'
import { ToggleLeft } from 'lucide-react-native'
import { useLiveVan } from '@/bus/LiveVanProvider'
import { useEditMode } from '@/components/editing/EditableCards'
import { ControlsContent } from '@/components/relays/ControlsContent'
import { Screen } from '@/components/Screen'
import { EmptyState } from '@/components/ui'
import { useTheme } from '@/theme'

/**
 * The Controls tab: every relay channel on the bus, in the shared groups set in Settings, then the
 * Hub power card. Which groups there are and what is in them is shared with the dashboard; the
 * order of the panels, and which of them this phone shows, is the phone's own (held, or in
 * Settings › Controls).
 */
export default function ControlsTab() {
  const { colors } = useTheme()
  const capability = useLiveVan().capabilities.relay
  const edit = useEditMode()

  if (capability.state !== 'present') {
    const loading = capability.state === 'loading'
    return (
      <Screen>
        <EmptyState
          icon={<ToggleLeft size={20} color={colors.muted} />}
          title={loading ? 'Loading controls…' : 'No controls on this van.'}
          detail={
            loading
              ? 'Looking for relays.'
              : 'Relay controls appear here when their drivers are installed.'
          }
        />
      </Screen>
    )
  }

  return (
    <Screen>
      <Stack.Screen options={edit.header} />
      <ControlsContent edit={edit} />
    </Screen>
  )
}
