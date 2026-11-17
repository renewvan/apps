import { useEffect } from 'react'
import { placeCell } from '@/lib/placeName'

const STORAGE_KEY = 'renewvan-dashboard-last-position'

export type LatLon = readonly [latitude: number, longitude: number]

/** The last position a fix reported, or null if none was stored or the stored value is unusable. */
export function readLastPosition(): LatLon | null {
  if (typeof window === 'undefined') return null
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (!Array.isArray(stored) || stored.length !== 2) return null
    const [lat, lon] = stored
    if (typeof lat !== 'number' || typeof lon !== 'number') return null
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
    return [lat, lon]
  } catch {
    return null
  }
}

/**
 * Remembers the van's position across reloads, so the map can open where the van was last seen
 * while the hub or GPS is unavailable. Pass null while there is no fix: nothing is written then.
 * Writes at most once per ~110 m cell: fixes arrive ~1 Hz and jitter even parked, and a storage
 * write per fix would churn the main thread for a value that changes meaningfully per cell.
 */
export function useRememberPosition(position: LatLon | null): void {
  const cell = position === null ? null : placeCell(position[0], position[1])
  const cellLat = cell?.lat
  const cellLon = cell?.lon
  useEffect(() => {
    if (cellLat === undefined || cellLon === undefined) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([cellLat, cellLon]))
    } catch {
      // Storage full or blocked: the map just opens on the world view next time.
    }
  }, [cellLat, cellLon])
}
