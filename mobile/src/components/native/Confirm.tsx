import { Button, ControlField, Dialog, Label } from 'heroui-native'
import { useEffect, useState } from 'react'
import { View } from 'react-native'

export interface ConfirmOptions {
  title: string
  message?: string
  /** The confirming button's label; the other button is always Cancel. */
  action: string
  destructive?: boolean
  /** A switch in the dialog, off when it opens, for one thing to do along with the action. */
  option?: { label: string }
  /** Called with whether `option` was switched on (false when there is none). */
  onConfirm: (optionOn: boolean) => void
}

// One dialog for the whole app, mounted by `ConfirmHost`; `confirm` is the call screens make,
// shaped like the `Alert.alert` it replaces so a prompt stays one statement at the call site.
let open: ((options: ConfirmOptions) => void) | null = null

export function confirm(options: ConfirmOptions) {
  open?.(options)
}

export function ConfirmHost() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [optionOn, setOptionOn] = useState(false)

  useEffect(() => {
    open = (next) => {
      setOptions(next)
      setOptionOn(false)
      setIsOpen(true)
    }
    return () => {
      open = null
    }
  }, [])

  return (
    <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <View className="mb-5 gap-1.5">
            <Dialog.Title>{options?.title}</Dialog.Title>
            {options?.message ? <Dialog.Description>{options.message}</Dialog.Description> : null}
          </View>
          {options?.option ? (
            <ControlField
              className="mb-5 gap-3"
              isSelected={optionOn}
              onSelectedChange={setOptionOn}
              accessibilityLabel={options.option.label}
            >
              <Label className="flex-1">{options.option.label}</Label>
              <ControlField.Indicator />
            </ControlField>
          ) : null}
          <View className="flex-row justify-end gap-3">
            <Button className="shrink-0" variant="ghost" size="sm" onPress={() => setIsOpen(false)}>
              <Button.Label numberOfLines={1}>Cancel</Button.Label>
            </Button>
            <Button
              className="shrink-0"
              variant={options?.destructive ? 'danger' : 'primary'}
              size="sm"
              onPress={() => {
                setIsOpen(false)
                options?.onConfirm(optionOn)
              }}
            >
              <Button.Label numberOfLines={1}>{options?.action}</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}
