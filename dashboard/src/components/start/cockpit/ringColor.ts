import { signal } from '@renewvan/brand'
import type { DialTone } from '@renewvan/core/dial'
import { FILL_COLOR } from '@/components/tanks/severity'

/**
 * The three colours of a Start-page ring: blue is fine, amber-500 is an alert, red is wrong or bad.
 * Red and blue are the theme's `--danger` / `--accent`; the amber is the brand's fixed ring amber
 * rather than the theme's paler `--warning`, which badges and the Tanks page keep.
 */
const RING_COLOR: Record<DialTone, string> = {
  ok: FILL_COLOR.accent,
  alert: signal.ringAlert,
  bad: FILL_COLOR.danger,
}

export const ringColor = (tone: DialTone): string => RING_COLOR[tone]
