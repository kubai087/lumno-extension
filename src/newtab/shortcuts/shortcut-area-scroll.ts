// The shortcut section's scrolling while a drag holds the pointer by its
// top or bottom edge.
import { isHtmlElement } from '../../shared/dom-guards';

const SHORTCUT_AREA_AUTO_SCROLL_EDGE_PX = 44;
const SHORTCUT_AREA_AUTO_SCROLL_MAX_STEP_PX = 16;
const SHORTCUT_AREA_AUTO_SCROLL_DELAY_MS = 220;

class ShortcutAreaScroll {
  private readonly grid: HTMLElement;
  // When the pointer reached an edge, and when the edge was last checked.
  private edgeSince = 0;
  private edgeCheckedAt = 0;

  constructor(grid: HTMLElement) {
    this.grid = grid;
  }

  // The shortcut section scrolls only when it is taller than the room above
  // the bottom dock.
  area(): HTMLElement | null {
    const area = this.grid.closest('.x-nt-shortcuts-section');
    return isHtmlElement(area) && area.getAttribute('data-shortcuts-scrollable') === 'true' ? area : null;
  }

  // Scrolls a step while a drag holds the pointer near the area's top or
  // bottom edge; the caller asks for another frame while it returns true.
  // A drag coming in from the dock crosses the bottom edge, so scrolling
  // waits until the pointer has stayed by an edge for a moment.
  step(pointerX: number, pointerY: number): boolean {
    const area = this.area();
    if (!area || !Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
      return false;
    }
    const rect = area.getBoundingClientRect();
    const edge = Math.min(SHORTCUT_AREA_AUTO_SCROLL_EDGE_PX, rect.height / 3);
    const inside = pointerX >= rect.left && pointerX <= rect.right && pointerY >= rect.top && pointerY <= rect.bottom;
    const depth = !inside ? 0 : pointerY < rect.top + edge
      ? -(rect.top + edge - pointerY)
      : pointerY > rect.bottom - edge ? pointerY - (rect.bottom - edge) : 0;
    const now = window.performance && typeof window.performance.now === 'function'
      ? window.performance.now() : Date.now();
    const resumed = now - this.edgeCheckedAt < 120;
    this.edgeCheckedAt = now;
    if (!depth) {
      this.edgeSince = 0;
      return false;
    }
    if (!this.edgeSince || !resumed) {
      this.edgeSince = now;
    }
    if (now - this.edgeSince < SHORTCUT_AREA_AUTO_SCROLL_DELAY_MS) {
      return true;
    }
    const step = Math.sign(depth) * Math.max(1, Math.round(SHORTCUT_AREA_AUTO_SCROLL_MAX_STEP_PX * Math.min(1, Math.abs(depth) / edge)));
    const before = area.scrollTop;
    area.scrollTop = before + step;
    return area.scrollTop !== before;
  }
}

export { ShortcutAreaScroll };
