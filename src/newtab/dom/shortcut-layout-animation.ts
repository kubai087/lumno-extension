// The slide shortcut tiles make when the grid changes: whatever moved slides
// from where it was, what was added fades in and what was taken away
// shrinks out where it stood.
import { queryHtmlElements } from '../../shared/dom-lookup';
import * as NEWTAB_CROSS_SURFACE_DRAG from '../cross-surface-drag';

const SHORTCUT_REORDER_ANIMATION_MS = 180;
const SHORTCUT_REORDER_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

// A tile the change took away (moved into a folder or the bookmarks, or
// undone) shrinks out where it was instead of vanishing. It plays in a
// layer beside the grid, which carries the grid's classes and state so the
// tile keeps its look, while the grid's own render never meets it.
const SHORTCUT_GHOST_ATTRIBUTES = ['data-shortcut-lifted', 'data-shortcut-dragging', 'data-shortcut-dropping',
  'data-drag-gap', 'data-bookmark-drop-target', 'data-shortcut-context-menu-open'];

// A shortcut's tile can be drawn anew by a render (a folder whose contents
// changed), so the before and after boxes are also paired by shortcut id.
function getShortcutLayoutId(element: HTMLElement): string {
  return String(element.getAttribute('data-shortcut-id') || '');
}

// Something that was hidden or not there has no place to slide from
// (a hidden box measures at the page corner), so it fades in where it is.
function enterShortcutLayoutElement(element: HTMLElement): void {
  if (typeof element.animate !== 'function' || NEWTAB_CROSS_SURFACE_DRAG.prefersReducedMotion(window)) {
    return;
  }
  element.animate([
    { opacity: 0, scale: '0.86' },
    { opacity: 1, scale: '1' }
  ], {
    duration: SHORTCUT_REORDER_ANIMATION_MS,
    easing: SHORTCUT_REORDER_EASING
  });
}

class ShortcutLayoutAnimation {
  private readonly grid: HTMLElement;
  // The timers that end each element's slide.
  private readonly timers = new WeakMap<HTMLElement, number>();

  constructor(grid: HTMLElement) {
    this.grid = grid;
  }

  // Runs a change that re-renders the shortcuts and slides whatever it moved
  // from where it was, so a re-centered grid glides instead of jumping; what
  // it added fades in and what it removed shrinks out.
  change<T>(change: () => T): T {
    const beforeRects = this.measure();
    const result = change();
    this.exit(beforeRects);
    this.shift(beforeRects, null);
    return result;
  }

  // Where each tile, group title and empty slot sits now.
  measure(): Map<HTMLElement, DOMRect> {
    const rects = new Map<HTMLElement, DOMRect>();
    this.elements().forEach((tile) => {
      rects.set(tile, tile.getBoundingClientRect());
    });
    return rects;
  }

  // Slides each element from where `beforeRects` had it; the dragged tile stays.
  shift(beforeRects: ReadonlyMap<HTMLElement, DOMRect>, draggedTile: HTMLElement | null): void {
    if (NEWTAB_CROSS_SURFACE_DRAG.prefersReducedMotion(window)) {
      return;
    }
    const beforeById = new Map<string, DOMRect>();
    beforeRects.forEach((rect, element) => {
      const id = getShortcutLayoutId(element);
      if (id) beforeById.set(id, rect);
    });
    this.elements().forEach((tile) => {
      if (tile === draggedTile) {
        return;
      }
      const before = beforeRects.get(tile) || beforeById.get(getShortcutLayoutId(tile));
      if (!before || !before.width || !before.height) {
        const shown = tile.getBoundingClientRect();
        if (shown.width && shown.height) {
          enterShortcutLayoutElement(tile);
        }
        return;
      }
      this.clear(tile);
      const after = tile.getBoundingClientRect();
      if (!after.width || !after.height) {
        return;
      }
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        return;
      }
      tile.style.transition = 'none';
      tile.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      void tile.offsetWidth;
      window.requestAnimationFrame(() => {
        if (!tile.isConnected) {
          return;
        }
        tile.style.transition = `transform ${SHORTCUT_REORDER_ANIMATION_MS}ms ${SHORTCUT_REORDER_EASING}`;
        tile.style.transform = 'translate3d(0, 0, 0)';
        this.timers.set(tile, window.setTimeout(() => {
          this.timers.delete(tile);
          this.clear(tile);
        }, SHORTCUT_REORDER_ANIMATION_MS + 80));
      });
    });
  }

  private elements(): HTMLElement[] {
    return queryHtmlElements(this.grid, '.x-nt-shortcut-tile, .x-nt-shortcut-group-header, .x-nt-shortcut-group-empty');
  }

  private clear(tile: HTMLElement): void {
    const timer = this.timers.get(tile);
    if (timer) {
      window.clearTimeout(timer);
      this.timers.delete(tile);
    }
    tile.style.removeProperty('transition');
    if (tile.getAttribute('data-shortcut-dragging') !== 'true' &&
        tile.getAttribute('data-shortcut-dropping') !== 'true') {
      tile.style.removeProperty('transform');
    }
  }

  private exit(beforeRects: ReadonlyMap<HTMLElement, DOMRect>): void {
    const grid = this.grid;
    const host = grid.parentNode;
    if (!host || NEWTAB_CROSS_SURFACE_DRAG.prefersReducedMotion(window)) {
      return;
    }
    const shownIds = new Set(this.elements().map(getShortcutLayoutId).filter(Boolean));
    const removed: Array<[HTMLElement, DOMRect]> = [];
    beforeRects.forEach((rect, element) => {
      if (!element.isConnected && rect.width && rect.height &&
          !shownIds.has(getShortcutLayoutId(element)) &&
          element.classList.contains('x-nt-shortcut-tile') &&
          typeof element.animate === 'function') {
        removed.push([element, rect]);
      }
    });
    if (!removed.length) {
      return;
    }
    const layer = document.createElement('div');
    Array.from(grid.attributes).forEach((attribute) => {
      if (attribute.name === 'class' || attribute.name.startsWith('data-')) {
        layer.setAttribute(attribute.name, attribute.value);
      }
    });
    layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;min-height:0;max-width:none;' +
      'margin:0;padding:0;display:block;overflow:visible;pointer-events:none;';
    host.appendChild(layer);
    const origin = layer.getBoundingClientRect();
    removed.forEach(([tile, rect]) => {
      this.clear(tile);
      SHORTCUT_GHOST_ATTRIBUTES.forEach((name) => tile.removeAttribute(name));
      tile.removeAttribute('id');
      // No longer a tile to anything that looks for tiles; it keeps the
      // tile's box by hand.
      tile.classList.replace('x-nt-shortcut-tile', 'x-nt-shortcut-tile-ghost');
      Object.assign(tile.style, {
        display: 'grid',
        placeItems: 'center',
        boxSizing: 'border-box',
        padding: 'var(--x-nt-shortcut-tile-padding, 8px)',
        position: 'absolute',
        left: `${rect.left - origin.left}px`,
        top: `${rect.top - origin.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: '0',
        transform: 'none',
        transition: 'none'
      });
      layer.appendChild(tile);
      tile.animate([
        { opacity: 1, scale: '1' },
        { opacity: 0, scale: '0.6' }
      ], {
        duration: SHORTCUT_REORDER_ANIMATION_MS,
        easing: SHORTCUT_REORDER_EASING,
        fill: 'forwards'
      });
    });
    window.setTimeout(() => {
      if (layer.parentNode) layer.parentNode.removeChild(layer);
    }, SHORTCUT_REORDER_ANIMATION_MS + 60);
  }
}

export { SHORTCUT_REORDER_EASING, ShortcutLayoutAnimation };
