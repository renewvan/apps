import { Stack, useLocalSearchParams } from 'expo-router'
import { Droplet } from 'lucide-react-native'
import { useState } from 'react'
import {
  availableLevelsPages,
  LEVELS_PAGES,
  resolveLevelsPage,
  type LevelsPage,
} from '@/components/levels/pages'
import { TanksContent, TemperatureContent, TiltContent } from '@/components/levels/LevelsContent'
import { useEditMode } from '@/components/editing/EditableCards'
import { Segmented } from '@/components/native'
import { Screen } from '@/components/Screen'
import { EmptyState } from '@/components/ui'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useTheme } from '@/theme'

/** The Levels tab: Tanks, Temperature and Tilt as sub-tabs (HeroUI's tabs, `Segmented`) over one page. */
export default function LevelsTab() {
  const { colors } = useTheme()
  const capabilities = useCapabilities()
  const pages = availableLevelsPages(capabilities)
  const [chosen, setChosen] = useState<LevelsPage>('tanks')
  const page = resolveLevelsPage(pages, chosen)
  // Home's circles open a given page; `at` changes on every tap so the same page can be asked twice.
  const { page: asked, at } = useLocalSearchParams<{ page?: string; at?: string }>()
  const [seen, setSeen] = useState(at)
  if (at !== seen) {
    setSeen(at)
    const found = LEVELS_PAGES.find((p) => p.id === asked)
    if (found) setChosen(found.id)
  }
  const edit = useEditMode()
  if (pages.length === 0) {
    const loading = [capabilities.tank, capabilities.temperature, capabilities.tilt].some(
      (capability) => capability.state === 'loading',
    )
    return (
      <Screen>
        <EmptyState
          icon={<Droplet size={20} color={colors.muted} />}
          title={loading ? 'Loading levels…' : 'No level sensors on this van.'}
          detail={
            loading
              ? 'Looking for tanks, temperature sensors and tilt.'
              : 'Tanks, temperature and tilt appear here when their drivers are installed.'
          }
        />
      </Screen>
    )
  }
  return (
    <Screen>
      <Stack.Screen options={edit.header} />
      <Segmented
        label="Levels"
        options={pages.map(({ id, label }) => ({ key: id, label }))}
        selected={page}
        onSelect={setChosen}
        size="navigation"
      />
      {page === 'tanks' ? (
        <TanksContent edit={edit} />
      ) : page === 'temperature' ? (
        <TemperatureContent edit={edit} />
      ) : (
        <TiltContent />
      )}
    </Screen>
  )
}
