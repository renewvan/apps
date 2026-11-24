import { useCallback } from 'react'
import { EMPTY_VAN_DETAILS, readVanDetails, type VanDetails } from '@renewvan/core/vanDetails'
import { useStoredState } from '@/hooks/useStoredState'

const STORAGE_KEY = 'renewvan-dashboard-van'

function serializeVan(van: VanDetails): string {
  return JSON.stringify(van)
}

function parseVan(raw: string | null): VanDetails {
  try {
    return readVanDetails(JSON.parse(raw ?? 'null'))
  } catch {
    return EMPTY_VAN_DETAILS
  }
}

/**
 * The van's details. Browser-local with no bus topic (the hub has no schema for them yet), persisted
 * like `useMapTheme` so they survive a reload or power cycle. `setField` changes one field and
 * keeps the others.
 */
export function useVan(): [VanDetails, (field: keyof VanDetails, value: string) => void] {
  const [van, setVan] = useStoredState<VanDetails>(STORAGE_KEY, parseVan, serializeVan)

  const setField = useCallback(
    (field: keyof VanDetails, value: string) =>
      setVan((current) => ({ ...current, [field]: value })),
    [setVan],
  )

  return [van, setField]
}
