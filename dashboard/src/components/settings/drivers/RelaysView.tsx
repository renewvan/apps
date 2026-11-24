import { useId } from 'react'
import { ToggleButton, ToggleButtonGroup } from '@heroui/react'
import { useEntityIcon } from '@/hooks/useEntityIcon'
import { RELAY_ICON_NAMES } from '@renewvan/core/icons'
import { instanceKey, relaySummary } from '@renewvan/core/drivers'
import { ownGroups } from '@renewvan/core/relays'
import { reservedRelayIds } from '@renewvan/core/winterMode'
import { EntityCard } from '../shared/EntityCard'
import { IconPicker } from '../shared/IconPicker'
import { NameField } from '../shared/NameField'
import { useLiveVan } from '@/hooks/useLiveVan'
import { useRawBus } from '@/hooks/useRawBus'
import { useCommands } from '@/hooks/useCommands'

/**
 * The longest name the ESP32 relay driver stores, in UTF-8 bytes (hub ADR 0013: 63 by default, 254 to
 * 255 at most). The driver silently drops a longer one, so the field refuses to send it.
 */
const RELAY_NAME_MAX_BYTES = 63

/** The key of the "no group" button: group names never start with a space, so it cannot collide. */
const NO_GROUP = ' none'

/**
 * Which group the Relays page files the channel under. The choice is the shared hub setting, so a
 * tap sends the command and nothing changes until the hub plugin answers with the retained map.
 * The buttons are the shared list of groups (edited in Settings › Display & Appearance › Relays page).
 */
function GroupPicker({ id, group }: { id: string; group: string | undefined }) {
  const { list: relayGroupList } = useLiveVan().relayGroups
  const { setRelayGroup } = useCommands()
  // A group that has left the list reads as no group: the Relays page files the channel under Unassigned.
  const offered = ownGroups(relayGroupList)
  const current = group !== undefined && offered.includes(group) ? group : NO_GROUP

  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted pt-2 text-xs">Group</span>
      <ToggleButtonGroup
        aria-label="Group"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={new Set([current])}
        onSelectionChange={(keys) => {
          const key = [...keys][0]
          if (key === undefined) return
          const next = String(key)
          // HeroUI re-fires the selection on a re-tap of the selected item: send nothing.
          if (next === current) return
          setRelayGroup(id, next === NO_GROUP ? null : next)
        }}
        className="flex-wrap justify-end"
      >
        <ToggleButton id={NO_GROUP}>None</ToggleButton>
        {offered.map((name) => (
          <ToggleButton key={name} id={name}>
            {name}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  )
}

/** Settings › Devices › Relays › <channel> › Details: rename the channel, pick its icon and its group. */
export function RelayDetails({ id }: { id: string }) {
  const { relays } = useRawBus().state
  const { relayGroups, hubPower } = useLiveVan()
  if (relays[id] === undefined) return null
  if (reservedRelayIds(hubPower).includes(id)) {
    return <HubPowerPanel id={id} name={relays[id].name} />
  }
  return <RelayPanel id={id} name={relays[id].name} group={relayGroups.assignments[id]} />
}

/**
 * The Hub power relay (hub ADR 0033): reserved, so it is not renamed or grouped here, and the
 * Relays page draws it on its own card with Start winter mode.
 */
function HubPowerPanel({ id, name }: { id: string; name: string | undefined }) {
  const labelId = useId()
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="border-border bg-surface flex flex-col gap-2 rounded-2xl border px-3.5 py-3"
    >
      <span id={labelId} className="text-muted text-xs">
        {id}
      </span>
      <span className="text-sm font-medium">{name ?? id}</span>
      <p className="text-muted text-sm">
        Hub power: this relay powers the hub, so it is not renamed or grouped. It is chosen when its
        relay board is flashed, and its only way off is Winter mode, on the Relays page.
      </p>
    </div>
  )
}

function RelayPanel({
  id,
  name,
  group,
}: {
  id: string
  name: string | undefined
  group: string | undefined
}) {
  const { setRelayName, setEntityIcon } = useCommands()
  const icon = useEntityIcon('relay', id)
  const labelId = useId()

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="border-border bg-surface flex flex-col gap-3 rounded-2xl border px-3.5 py-3"
    >
      <span id={labelId} className="text-muted text-xs">
        {id}
      </span>
      <NameField
        name={name}
        maxBytes={RELAY_NAME_MAX_BYTES}
        onCommit={(next) => setRelayName(id, next)}
      />
      <IconPicker
        names={RELAY_ICON_NAMES}
        value={icon}
        onChange={(next) => setEntityIcon('relay', id, next)}
      />
      <GroupPicker id={id} group={group} />
    </div>
  )
}

/** Settings › Devices › Relays: one card per channel, each opening its Details. Switching is on the Relays page. */
export function RelaysView({ onOpen }: { onOpen: (key: string) => void }) {
  const { relays } = useRawBus().state
  const { hubPower } = useLiveVan()
  const reserved = reservedRelayIds(hubPower)
  // `numeric` keeps relay_9 before relay_10 for an id that is not zero-padded.
  const ids = Object.keys(relays).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  if (ids.length === 0) {
    return (
      <p className="border-border bg-surface text-muted rounded-2xl border px-3.5 py-3 text-sm">
        No relays found. Waiting for the relay driver to publish.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {hubPower.kind === 'conflict' && (
        <p role="alert" className="bg-danger/10 text-danger rounded-2xl px-3.5 py-3 text-sm">
          More than one relay board claims Hub power (
          {hubPower.claims.map((claim) => claim.driver).join(', ')}). Only one board may power the
          hub: reflash the others without it. Winter mode is off until then.
        </p>
      )}
      <ul aria-label="Relays" className="flex flex-col gap-2">
        {ids.map((id) => (
          <li key={id}>
            <EntityCard
              label={relays[id].name || id}
              subtitle={
                reserved.includes(id)
                  ? `Hub power${relays[id].name ? ` · ${id}` : ''}`
                  : relays[id].name
                    ? id
                    : undefined
              }
              summary={relaySummary(relays[id])}
              onOpen={() => onOpen(instanceKey('relay', id))}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
