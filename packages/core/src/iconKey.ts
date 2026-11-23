/** The entities a user can pick an icon for (hub ADR 0023). */
export type IconEntity = 'tank' | 'temperature' | 'relay'

/** The key of an instance in the shared icons map (`renewvan/hub/icons`): `<entity>/<id>`. */
export function iconKey(entity: IconEntity, id: string): string {
  return `${entity}/${id}`
}
