import { useRef } from 'react'
import { Button, Label, Switch } from '@heroui/react'
import { START_WIDGETS } from '@/components/start/widgets/registry'
import {
  DEFAULT_START_LAYOUT,
  layoutAfterDrop,
  widgetSlots,
  type StartWidgetId,
} from '@/hooks/useStartLayout'
import { useDragReorder } from '@/hooks/useDragReorder'
import { Group } from '../../shared/Group'
import { ReorderRow } from '../../shared/ReorderRow'

interface WidgetsViewProps {
  layout: readonly StartWidgetId[]
  onChange: (layout: readonly StartWidgetId[]) => void
}

function isDefaultLayout(layout: readonly StartWidgetId[]): boolean {
  return (
    layout.length === DEFAULT_START_LAYOUT.length &&
    layout.every((id, i) => id === DEFAULT_START_LAYOUT[i])
  )
}

interface ShownSwitchProps {
  label: string
  shown: boolean
  onChange: (shown: boolean) => void
}

/** Whether a widget is on the page. */
function ShownSwitch({ label, shown, onChange }: ShownSwitchProps) {
  // One tap can reach a switch twice (its press, then the browser's own click on the label), and
  // the second change undoes the first: the switch looks dead. Dedupe by value, not by time
  // window — a genuine fast re-toggle carries the other value and must through, while the same
  // value twice is the double fire.
  const lastEvent = useRef<boolean | null>(null)
  return (
    <Switch
      isSelected={shown}
      onChange={(on) => {
        if (on === lastEvent.current) return
        lastEvent.current = on
        onChange(on)
      }}
    >
      <Switch.Content>
        <Label className="sr-only">{`Show ${label}`}</Label>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch.Content>
    </Switch>
  )
}

// Every slot is this tall, the divider's too, so a drag's rows slide by one even step.
const SLOT = 'h-16 [&>*]:h-full'

/**
 * Settings › General › Display & Appearance › Widgets: the Start page's widgets as one list: the
 * shown ones in the order the page draws them, a divider, then the hidden ones. Drag a row's grip
 * (or press the arrow keys on it) to reorder; dropping a widget above the divider shows it, below
 * hides it, and the switch does the same without dragging. Reset puts back the shipped page.
 */
export function WidgetsView({ layout, onChange }: WidgetsViewProps) {
  const slots = widgetSlots(layout)
  const { rowRef, rowStyle, handleProps, draggingIndex } = useDragReorder(
    slots.length,
    (from, to) => onChange(layoutAfterDrop(layout, from, to)),
  )

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted px-1 text-sm">
        Choose what the Start page shows on a phone, and on the kiosk when its Start view is Grid.
        Drag a grip to reorder; drop a widget above the line to show it, below to hide it. The
        Cockpit keeps its dial.
      </p>
      <ul className="flex flex-col gap-2">
        {slots.map((id, i) => {
          if (id === 'divider') {
            return (
              <li
                key="divider"
                ref={rowRef(i)}
                style={rowStyle(i)}
                data-widget-row="divider"
                className={`${SLOT} flex flex-col justify-center gap-1.5`}
              >
                <div aria-hidden="true" className="bg-border h-px" />
                <p className="text-muted text-xs font-medium tracking-wide uppercase">
                  Hidden. Drag a widget below to hide it
                </p>
              </li>
            )
          }
          const { label, icon: Icon } = START_WIDGETS[id]
          const shown = i < layout.length
          const step = (delta: number) => onChange(layoutAfterDrop(layout, i, i + delta))
          return (
            <li key={id} ref={rowRef(i)} style={rowStyle(i)} data-widget-row={id} className={SLOT}>
              <ReorderRow
                icon={<Icon className="size-6" />}
                label={label}
                description={shown ? `Position ${i + 1} of ${layout.length}` : 'Hidden'}
                grip={{
                  props: handleProps(i),
                  dragging: draggingIndex === i,
                  onKeyDown: (key) => step(key === 'ArrowUp' ? -1 : 1),
                }}
                trailing={
                  <ShownSwitch
                    label={label}
                    shown={shown}
                    onChange={(on) =>
                      onChange(on ? [...layout, id] : layout.filter((w) => w !== id))
                    }
                  />
                }
              />
            </li>
          )
        })}
      </ul>
      <Group title="Reset">
        <Button
          variant="secondary"
          fullWidth
          className="min-h-11"
          isDisabled={isDefaultLayout(layout)}
          onPress={() => onChange(DEFAULT_START_LAYOUT)}
        >
          Reset to default
        </Button>
      </Group>
    </div>
  )
}
