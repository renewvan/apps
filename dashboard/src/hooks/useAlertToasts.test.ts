import { toast } from '@heroui/react'
import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { liveVan, type LiveVan } from '@renewvan/core/van'
import { emptyRenewvanBusState, type Tank } from '@/types'
import type { ConnectionStatus } from './useRenewvanBus'
import { useAlertToasts } from './useAlertToasts'
import * as alertHistory from '@/lib/alertHistory'

// The wiring only: which alerts are open is core's (`@renewvan/core/alerts`, tested there). This is
// the toasts and the history they write.

const okTank: Tank = {
  fluid_type: 'fresh_water',
  capacity_l: 100,
  level_pct: 50,
  status: 'ok',
  volume_since_full_l: 0,
  volume_since_empty_l: 0,
}
const alarmTank: Tank = { ...okTank, alarm_state: 'alarm' }

/** The Live van with one fresh-water tank, the demo van's when `demo`. */
const vanWith = (tank: Tank, demo = false): LiveVan =>
  liveVan({
    state: { ...emptyRenewvanBusState, tanks: { fresh: tank } },
    status: 'connected',
    settled: true,
    primaryBattery: null,
    relayGroups: {},
    relayGroupList: null,
    relayOrder: [],
    demoMode: demo,
  })
const alarm = vanWith(alarmTank)
const quiet = vanWith(okTank)

/** Spies on every toast entry point the hook uses, so nothing reaches the real queue. */
function spyToasts(ids: { danger?: string; warning?: string } = {}) {
  return {
    danger: vi.spyOn(toast, 'danger').mockReturnValue(ids.danger ?? 't1'),
    warning: vi.spyOn(toast, 'warning').mockReturnValue(ids.warning ?? 't2'),
    close: vi.spyOn(toast, 'close').mockImplementation(() => {}),
  }
}

const base = { status: 'connected' as ConnectionStatus, tailscale: null, enabled: true }

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useAlertToasts', () => {
  it('toasts a tank alarm on the Live van and records it in the history', () => {
    const { danger } = spyToasts()
    const append = vi.spyOn(alertHistory, 'appendAlertHistoryEntry').mockReturnValue('h1')

    renderHook(() => useAlertToasts({ ...base, van: alarm }))

    expect(danger).toHaveBeenCalledWith(
      'Fresh water tank alarm',
      expect.objectContaining({ description: 'Level requires attention.', timeout: 0 }),
    )
    expect(append).toHaveBeenCalledWith(expect.objectContaining({ key: 'tank:fresh' }))
  })

  it('closes the toast and resolves the history once the alarm clears, once', () => {
    const { danger, close } = spyToasts()
    vi.spyOn(alertHistory, 'appendAlertHistoryEntry').mockReturnValue('h1')
    const resolve = vi.spyOn(alertHistory, 'resolveAlertHistoryEntry')

    const { rerender } = renderHook(({ van }) => useAlertToasts({ ...base, van }), {
      initialProps: { van: alarm },
    })
    rerender({ van: vanWith(alarmTank) })
    expect(danger).toHaveBeenCalledTimes(1)
    rerender({ van: quiet })

    expect(close).toHaveBeenCalledWith('t1')
    expect(resolve).toHaveBeenCalledWith('h1')
  })

  it('toasts a lost hub link as a warning', () => {
    const { warning } = spyToasts()

    renderHook(() => useAlertToasts({ ...base, van: quiet, status: 'disconnected' }))

    expect(warning).toHaveBeenCalledWith(
      'Hub connection lost',
      expect.objectContaining({ description: 'Live data may be out of date.', timeout: 0 }),
    )
  })

  describe('in Demo mode', () => {
    it('toasts the demo van alarm but never writes it to the history', () => {
      const { danger } = spyToasts()
      const append = vi.spyOn(alertHistory, 'appendAlertHistoryEntry')
      const resolve = vi.spyOn(alertHistory, 'resolveAlertHistoryEntry')

      const { rerender } = renderHook(({ van }) => useAlertToasts({ ...base, van }), {
        initialProps: { van: vanWith(alarmTank, true) },
      })
      rerender({ van: vanWith(okTank, true) })

      expect(danger).toHaveBeenCalledTimes(1)
      expect(append).not.toHaveBeenCalled()
      expect(resolve).not.toHaveBeenCalled()
    })

    it('hides the real alarm toast while the demo van is shown and shows it again, once, after', () => {
      const { danger, close } = spyToasts()
      const append = vi.spyOn(alertHistory, 'appendAlertHistoryEntry').mockReturnValue('real-1')
      const resolve = vi.spyOn(alertHistory, 'resolveAlertHistoryEntry')

      const { rerender } = renderHook(({ van }) => useAlertToasts({ ...base, van }), {
        initialProps: { van: alarm },
      })
      rerender({ van: vanWith(okTank, true) })
      expect(close).toHaveBeenCalledWith('t1')
      rerender({ van: alarm })

      expect(danger).toHaveBeenCalledTimes(2) // the original, and one on return, not a stack
      expect(append).toHaveBeenCalledTimes(1)
      expect(resolve).not.toHaveBeenCalled()
    })
  })

  describe('when alerts are disabled', () => {
    it('adds no toast but still records history', () => {
      const { danger } = spyToasts()
      const append = vi.spyOn(alertHistory, 'appendAlertHistoryEntry').mockReturnValue('h1')

      renderHook(() => useAlertToasts({ ...base, van: alarm, enabled: false }))

      expect(danger).not.toHaveBeenCalled()
      expect(append).toHaveBeenCalledTimes(1)
    })

    it('closes an open toast when muted without acknowledging it, and re-shows it when un-muted', () => {
      const { danger, close } = spyToasts()
      const ack = vi.spyOn(alertHistory, 'acknowledgeAlertHistoryEntry')
      const append = vi.spyOn(alertHistory, 'appendAlertHistoryEntry').mockReturnValue('h1')

      const { rerender } = renderHook(
        ({ enabled }) => useAlertToasts({ ...base, van: alarm, enabled }),
        { initialProps: { enabled: true } },
      )
      rerender({ enabled: false })
      expect(close).toHaveBeenCalledWith('t1')
      rerender({ enabled: true })

      expect(ack).not.toHaveBeenCalled()
      expect(danger).toHaveBeenCalledTimes(2)
      expect(append).toHaveBeenCalledTimes(1)
    })
  })

  describe('acknowledging history', () => {
    // Mirrors HeroUI: a toast's `onClose` fires for any close, including a programmatic
    // `toast.close(id)`. Capturing it lets each test play the driver's dismissal or the library's
    // reaction to the hook's own close.
    function captureOnClose() {
      let onClose: (() => void) | undefined
      vi.spyOn(toast, 'danger').mockImplementation((_title, options) => {
        onClose = options?.onClose
        return 't1'
      })
      vi.spyOn(toast, 'close').mockImplementation(() => onClose?.())
      return () => onClose?.()
    }

    it('acknowledges the history entry when the driver dismisses the toast', () => {
      const dismiss = captureOnClose()
      const ack = vi.spyOn(alertHistory, 'acknowledgeAlertHistoryEntry')
      vi.spyOn(alertHistory, 'appendAlertHistoryEntry').mockReturnValue('h1')

      renderHook(() => useAlertToasts({ ...base, van: alarm }))
      dismiss()

      expect(ack).toHaveBeenCalledTimes(1)
      expect(ack).toHaveBeenCalledWith('h1')
    })

    it('does not acknowledge when the hook itself closes the toast', () => {
      captureOnClose()
      const ack = vi.spyOn(alertHistory, 'acknowledgeAlertHistoryEntry')
      const resolve = vi.spyOn(alertHistory, 'resolveAlertHistoryEntry')
      vi.spyOn(alertHistory, 'appendAlertHistoryEntry').mockReturnValue('h1')

      const { rerender } = renderHook(({ van }) => useAlertToasts({ ...base, van }), {
        initialProps: { van: alarm },
      })
      rerender({ van: quiet })

      expect(resolve).toHaveBeenCalledWith('h1')
      expect(ack).not.toHaveBeenCalled()
    })

    it('does not show a dismissed toast again while its alert stays open', () => {
      const dismiss = captureOnClose()
      const danger = vi.spyOn(toast, 'danger')
      vi.spyOn(alertHistory, 'appendAlertHistoryEntry').mockReturnValue('h1')

      const { rerender } = renderHook(
        ({ enabled }) => useAlertToasts({ ...base, van: alarm, enabled }),
        {
          initialProps: { enabled: true },
        },
      )
      dismiss()
      rerender({ enabled: false })
      rerender({ enabled: true })

      expect(danger).toHaveBeenCalledTimes(1)
    })
  })
})
