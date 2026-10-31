// Selecting the card the pointer is over, once the pointer has moved since
// the tab switcher opened. A switcher that opens under a resting pointer
// gets a pointerenter for the card beneath it, which is not the reader
// pointing at that card: it must not replace the tab the shortcut picked.

// Pointer travel, in CSS pixels, that counts as the reader moving the pointer.
const POINTER_MOVE_PX = 3;

interface PointerPosition {
  clientX: number;
  clientY: number;
}

// Takes each pointer event over a card: its index, whether it is selected.
type HoverSelection = (index: number, active: boolean, event: PointerPosition) => void;

function createHoverSelection(onSelect: (index: number) => void): HoverSelection {
  let origin: PointerPosition | null = null;
  let travelled = false;
  return (index, active, event) => {
    if (!origin) {
      origin = { clientX: event.clientX, clientY: event.clientY };
    } else if (!travelled) {
      travelled = Math.abs(event.clientX - origin.clientX) + Math.abs(event.clientY - origin.clientY) >= POINTER_MOVE_PX;
    }
    if (travelled && !active) onSelect(index);
  };
}

export { createHoverSelection };
export type { HoverSelection };
