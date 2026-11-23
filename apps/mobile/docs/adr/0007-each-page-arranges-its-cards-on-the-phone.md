# Each page arranges its cards on the phone

Every tab edits in place the way Home does: hold a card to enter edit mode, drag it anywhere, hide it with its (−) badge, then Done. Each page also has its editor under Settings › Sections, the only way back for a hidden card. The arrangement (an order and a hidden list per page, `pageLayouts` in `src/preferences`) is this phone's own: it never reaches the bus, and another phone or the dashboard keeps its own.

Controls is the one page whose cards come from a shared setting. Which relay groups exist, what is in each, and their order are the hub's (`relay-group-list`, `relay-groups`), edited in Settings › Sections › Controls › Shared groups, so assigning a relay there updates the dashboard too. The phone's arrangement of the panels sits on top: a phone that never arranged them, and a group new to it, follows the shared order.

## Considered options

- **Dragging a Controls panel changes the shared group order.** Rejected: the owner wanted each phone's order to be its own, and a drag on one phone would reorder the dashboard and every other phone.
- **A + in edit mode to bring hidden cards back.** Rejected for now in favour of one Settings editor per page, which also lists what is hidden.

## Consequences

- A card's id is what the page shows it by: a tank, sensor or heater id, a relay group's name, or one of Energy's fixed cards. A renamed relay group is a new card to the phone, placed at its shared position.
- The saved order outlives a card the van no longer has, so a tank that comes back returns to its place.
- The older `hiddenTemperatures` preference is read once into the Temperature layout.
- Tilt is a single card and is not arranged.
