/** The battery a phone card reads, small and muted at the right of its header. */
export function BatterySource({ name }: { name: string }) {
  return (
    <span data-testid="battery-source" className="text-muted truncate text-xs font-normal">
      {name}
    </span>
  )
}
