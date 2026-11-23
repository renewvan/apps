import { useFocusEffect } from 'expo-router'
import { LayoutGrid } from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Sortable from 'react-native-sortables'
import { useAppHeaderOptions } from '@/components/AppHeader'
import { NativeButton } from '@/components/native'
import { useScreenScrollRef } from '@/components/Screen'
import { openSettings, type SettingsView } from '@/components/settings/routes'
import { EmptyState } from '@/components/ui'
import { layout, radius, useTheme } from '@/theme'
import { EditableCard } from './EditableCard'

/**
 * A page's edit mode, as a phone's home screen has one: started by holding a card, ended by Done
 * in the header or by leaving the page. `header` is the page's header for the moment: render it as
 * `<Stack.Screen options={header} />`.
 */
export function useEditMode() {
  const [editing, setEditing] = useState(false)
  const start = useCallback(() => setEditing(true), [])
  const stop = useCallback(() => setEditing(false), [])
  // Leaving for another tab or a pushed page ends it.
  useFocusEffect(useCallback(() => stop, [stop]))
  const header = useAppHeaderOptions(editing ? stop : undefined)
  return { editing, start, stop, header }
}

export type EditMode = ReturnType<typeof useEditMode>

/**
 * A page's cards in the order this phone keeps, editable in place. Holding a card starts the page's
 * edit mode and lifts it: it follows the finger, the others make way, and the page scrolls at its
 * edges. While editing, every card wears a (−) badge that hides it (when `removable`), and a short
 * hold picks up the next one. Hidden cards come back from the page's Settings (`settings`).
 */
export function EditableCards<T extends string>({
  ids,
  edit,
  labelOf,
  onChange,
  renderCard,
  removable = true,
  corners = radius['3xl'],
  settings,
}: {
  /** The cards shown, in order. */
  ids: readonly T[]
  edit: EditMode
  labelOf: (id: T) => string
  /** The cards to show, in order, after a drag or a (−). */
  onChange: (ids: readonly T[]) => void
  renderCard: (id: T) => ReactNode
  removable?: boolean
  /** The cards' corner radius, for the focus ring. */
  corners?: number
  /** The page's Settings editor, offered when every card is hidden. */
  settings?: SettingsView
}) {
  const { colors } = useTheme()
  const scrollRef = useScreenScrollRef()
  const empty = ids.length === 0
  const { editing, stop } = edit
  // Nothing left to edit once the last card is hidden.
  useEffect(() => {
    if (empty && editing) stop()
  }, [empty, editing, stop])
  // The same array while the cards are the same: a page re-renders on every bus message, and new
  // data would make the list measure again mid-drag.
  const key = ids.join('\n')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => [...ids], [key])
  if (empty) {
    return settings ? (
      <>
        <EmptyState
          icon={<LayoutGrid size={20} color={colors.muted} />}
          title="Every card is hidden."
          detail="Choose what this page shows in Settings."
        />
        <NativeButton label="Choose cards" onPress={() => openSettings(settings)} />
      </>
    ) : null
  }
  return (
    <Sortable.Grid
      data={data}
      keyExtractor={(id) => id}
      rowGap={layout.gap}
      scrollableRef={scrollRef ?? undefined}
      autoScrollEnabled={scrollRef !== null}
      // Held long enough, a card starts editing and lifts; once editing, a shorter hold.
      dragActivationDelay={edit.editing ? 150 : 400}
      hapticsEnabled
      activeItemScale={1.03}
      activeItemShadowOpacity={0}
      inactiveItemOpacity={1}
      onDragStart={edit.start}
      onDragEnd={({ data: next }) => onChange(next)}
      renderItem={({ item: id }) => (
        <EditableCard
          label={labelOf(id)}
          editing={edit.editing}
          corners={corners}
          onRemove={removable ? () => onChange(data.filter((other) => other !== id)) : undefined}
        >
          {renderCard(id)}
        </EditableCard>
      )}
    />
  )
}
