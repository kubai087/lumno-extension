// Dock-style magnification and hover state for the shortcut row.
//
// While the pointer is over the row, every icon's size, rise and sideways
// nudge are a continuous function of its distance to the pointer, so nothing
// jumps as the pointer crosses from one tile to the next. A frame loop eases
// each icon toward that target (CSS transitions restarted on every move
// stuttered); leaving hands the icons back to the CSS transition.
import { isElementNode } from '../../shared/dom-guards';
import { queryHtmlElement, queryHtmlElements } from '../../shared/dom-lookup';
import { newtabShortcutDockMagnificationEnabled } from '../../domain/settings/newtab-shortcuts';
import type { SettingPreview } from '../setting-preview';
import type { SettingsStore } from '../../platform/settings-store';
const SHORTCUT_DOCK_FOLLOW_TIME_MS = 60;
const SHORTCUT_DOCK_DEFAULT_SCALE = 1.28;
const SHORTCUT_DOCK_DEFAULT_RISE_PX = -6;
// The sideways nudge at the default scale; it shrinks with the scale.
const SHORTCUT_DOCK_SHIFT_PX = 16;

interface DockTransform {
  scale: number;
  shiftX: number;
  rise: number;
}

// An icon's eased transform, the target it moves toward, and its tile.
interface DockIconState extends DockTransform {
  written: boolean;
  target: DockTransform;
  tile: HTMLElement;
}

interface DockMagnitude {
  growth: number;
  rise: number;
  shift: number;
}


interface ShortcutDockDeps {
  settings: Pick<SettingsStore, 'subscribe'>;
  preview: Pick<SettingPreview, 'get'>;
  isShortcutDragActive(): boolean;
  isBookmarkDragActive(): boolean;
  isShortcutContextMenuOpen(): boolean;
  applyShortcutContextMenuDockHover(tile: HTMLElement): void;
  clearShortcutContextMenuTileActive(): void;
  getShortcutTileFromNode(node: EventTarget | null): HTMLElement | null;
  shortcutGrid: HTMLElement;
  // The tile the open shortcut menu acts on; null while it is closed.
  getShortcutContextMenuTile(): HTMLElement | null;
}

function createShortcutDock(deps: ShortcutDockDeps) {
  const {
    shortcutGrid,
    settings,
    preview,
    isShortcutDragActive,
    isBookmarkDragActive,
    applyShortcutContextMenuDockHover,
    clearShortcutContextMenuTileActive,
    getShortcutTileFromNode,
    getShortcutContextMenuTile
  } = deps;

  // The pointer's x for the next dock frame; NaN when none is pending.
  let shortcutDockPendingPointerX = Number.NaN;

  let shortcutDockPointerFrame = 0;
  let shortcutDockPendingTile: HTMLElement | null = null;
  let shortcutDockLastFrameTime = 0;
  // The tile under the pointer; the gaps between tiles keep the last one.
  let shortcutDockActiveTile: HTMLElement | null = null;
  // Icon -> its eased transform values and the target they move toward.
  const shortcutDockIconStates = new Map<HTMLElement, DockIconState>();
  // How far the icon under the pointer grows and rises at this density.
  let shortcutDockMagnitude: DockMagnitude | null = null;
  // Folder tile whose menu is open; it keeps its hover look like a pressed dock item.
  let shortcutDockFolderMenuTile: HTMLElement | null = null;

  function getShortcutDockPointerX(event: PointerEvent): number | null {
    const value = Number(event && event.clientX);
    return Number.isFinite(value) ? value : null;
  }

  function getShortcutDockIcon(tile: HTMLElement | null | undefined): HTMLElement | null {
    return tile ? queryHtmlElement(tile, '.x-nt-shortcut-icon') : null;
  }

  function prefersReducedMotion(): boolean {
    return typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // The values sit on the tile, where the icon and its drop backdrop both read them.
  function removeShortcutDockTileStyles(tile: HTMLElement): void {
    tile.style.removeProperty('--x-nt-shortcut-dock-scale');
    tile.style.removeProperty('--x-nt-shortcut-dock-shift-x');
    tile.style.removeProperty('--x-nt-shortcut-dock-rise');
  }

  function resetShortcutDockTile(tile: HTMLElement | null): void {
    if (!tile) {
      return;
    }
    tile.removeAttribute('data-dock-distance');
    tile.removeAttribute('data-dock-side');
    removeShortcutDockTileStyles(tile);
  }

  function cancelShortcutDockPointerFrame(): void {
    if (shortcutDockPointerFrame) {
      window.cancelAnimationFrame(shortcutDockPointerFrame);
      shortcutDockPointerFrame = 0;
    }
    shortcutDockPendingTile = null;
    shortcutDockLastFrameTime = 0;
    shortcutDockPendingPointerX = Number.NaN;
  }

  // Removing the inline values and the following flag in one style change
  // lets the CSS transition carry each icon back from wherever it is.
  function clearShortcutDockMagnificationState(): void {
    cancelShortcutDockPointerFrame();
    shortcutDockIconStates.clear();
    shortcutDockActiveTile = null;
    shortcutDockMagnitude = null;
    if (!shortcutGrid) {
      return;
    }
    shortcutGrid.removeAttribute('data-dock-active');
    shortcutGrid.removeAttribute('data-dock-following');
    queryHtmlElements(shortcutGrid, '.x-nt-shortcut-tile').forEach((tile) => {
      resetShortcutDockTile(tile);
    });
  }

  function applyNewtabShortcutDockMagnification(): void {
    if (!shortcutGrid) {
      return;
    }
    shortcutGrid.setAttribute(
      'data-dock-magnification',
      preview.get(newtabShortcutDockMagnificationEnabled) ? 'true' : 'false'
    );
    if (!preview.get(newtabShortcutDockMagnificationEnabled)) {
      clearShortcutDockMagnificationState();
    }
  }

  // The compact and tiny dock densities magnify less; follow their values.
  function readShortcutDockMagnitude(): DockMagnitude {
    const grid = shortcutGrid;
    const style = grid && typeof window.getComputedStyle === 'function'
      ? window.getComputedStyle(grid)
      : null;
    const scale = style ? parseFloat(style.getPropertyValue('--x-nt-shortcut-hover-scale-near')) : Number.NaN;
    const rise = style ? parseFloat(style.getPropertyValue('--x-nt-shortcut-hover-rise-near')) : Number.NaN;
    const growth = Math.max(0, (Number.isFinite(scale) ? scale : SHORTCUT_DOCK_DEFAULT_SCALE) - 1);
    return {
      growth,
      rise: Number.isFinite(rise) ? rise : SHORTCUT_DOCK_DEFAULT_RISE_PX,
      shift: SHORTCUT_DOCK_SHIFT_PX * (growth / (SHORTCUT_DOCK_DEFAULT_SCALE - 1))
    };
  }

  // Where the icon is drawn right now, mid-transition included, so the frame
  // loop picks it up there instead of snapping it to rest first.
  function readShortcutDockIconTransform(icon: HTMLElement | null): DockTransform {
    const rest: DockTransform = { scale: 1, shiftX: 0, rise: 0 };
    if (!icon || typeof window.getComputedStyle !== 'function') {
      return rest;
    }
    const match = /^matrix\(([^)]+)\)$/.exec(window.getComputedStyle(icon).transform || '');
    if (!match) {
      return rest;
    }
    const values = match[1].split(',').map((value) => parseFloat(value));
    if (values.length !== 6 || values.some((value) => !Number.isFinite(value))) {
      return rest;
    }
    return { scale: values[0], shiftX: values[4], rise: values[5] };
  }

  // Measure where the icon sits at rest, not where its magnification has
  // moved and grown it: the tile centers the icon and is not transformed,
  // and offsetWidth ignores the scale. Measuring the magnified icon fed its
  // own size back into the radius, so a grown icon held on as the pointer
  // left it.
  function getShortcutDockTarget(pointerX: number, rect: DOMRect, icon: HTMLElement, magnitude: DockMagnitude): DockTransform {
    const iconWidth = Math.max(1, icon.offsetWidth || rect.width || rect.height || 48);
    const centerX = rect.left + ((rect.width || iconWidth) / 2);
    const influenceRadius = Math.max(144, iconWidth * 4.5);
    const raw = Math.max(0, 1 - (Math.abs(pointerX - centerX) / influenceRadius));
    const eased = raw * raw * (3 - (2 * raw));
    // The nudge is zero under the pointer and at the edge of the reach, so
    // it never flips or jumps as the pointer passes an icon's center.
    const side = centerX < pointerX ? -1 : centerX > pointerX ? 1 : 0;
    return {
      scale: 1 + (magnitude.growth * eased),
      shiftX: side * magnitude.shift * eased * (1 - eased),
      rise: magnitude.rise * eased
    };
  }

  function writeShortcutDockTileState(tile: HTMLElement, state: DockTransform): void {
    tile.style.setProperty('--x-nt-shortcut-dock-scale', state.scale.toFixed(4));
    tile.style.setProperty('--x-nt-shortcut-dock-shift-x', `${state.shiftX.toFixed(2)}px`);
    tile.style.setProperty('--x-nt-shortcut-dock-rise', `${state.rise.toFixed(2)}px`);
  }

  // Eases every icon toward its target; reports whether any still moves.
  function stepShortcutDockIcons(elapsedMs: number): boolean {
    const progress = 1 - Math.exp(-elapsedMs / SHORTCUT_DOCK_FOLLOW_TIME_MS);
    let moving = false;
    shortcutDockIconStates.forEach((state, icon) => {
      if (!icon.isConnected) {
        shortcutDockIconStates.delete(icon);
        return;
      }
      const target = state.target;
      const settled = Math.abs(target.scale - state.scale) < 0.0005 &&
        Math.abs(target.shiftX - state.shiftX) < 0.05 &&
        Math.abs(target.rise - state.rise) < 0.05;
      if (settled) {
        if (state.written && state.scale === target.scale &&
            state.shiftX === target.shiftX && state.rise === target.rise) {
          return;
        }
        state.scale = target.scale;
        state.shiftX = target.shiftX;
        state.rise = target.rise;
      } else {
        state.scale += (target.scale - state.scale) * progress;
        state.shiftX += (target.shiftX - state.shiftX) * progress;
        state.rise += (target.rise - state.rise) * progress;
        moving = true;
      }
      writeShortcutDockTileState(state.tile, state);
      state.written = true;
    });
    return moving;
  }

  function runShortcutDockFrame(now: number): void {
    shortcutDockPointerFrame = 0;
    const pendingTile = shortcutDockPendingTile;
    const pendingPointerX = shortcutDockPendingPointerX;
    shortcutDockPendingTile = null;
    shortcutDockPendingPointerX = Number.NaN;
    if (isShortcutDragActive() || isBookmarkDragActive()) {
      shortcutDockLastFrameTime = 0;
      return;
    }
    // Read the layout for a new pointer position before writing this frame's values.
    if (pendingTile && pendingTile.isConnected) {
      setShortcutDockHover(pendingTile, pendingPointerX, { fromFrame: true });
    }
    const elapsed = shortcutDockLastFrameTime
      ? Math.min(64, Math.max(0, now - shortcutDockLastFrameTime))
      : 16;
    shortcutDockLastFrameTime = now;
    if (stepShortcutDockIcons(elapsed)) {
      requestShortcutDockFrame();
    } else {
      shortcutDockLastFrameTime = 0;
    }
  }

  function requestShortcutDockFrame(): void {
    if (!shortcutDockPointerFrame) {
      shortcutDockPointerFrame = window.requestAnimationFrame(runShortcutDockFrame);
    }
  }

  function scheduleShortcutDockPointerStyles(tile: HTMLElement | null, pointerX: number | null): void {
    shortcutDockPendingTile = tile || null;
    shortcutDockPendingPointerX = Number(pointerX);
    requestShortcutDockFrame();
  }

  function getShortcutDockIconCenterX(tile: HTMLElement): number | null {
    const icon = getShortcutDockIcon(tile) || tile;
    const rect = icon.getBoundingClientRect();
    const centerX = rect.left + (rect.width / 2);
    return Number.isFinite(centerX) ? centerX : null;
  }

  function getOpenShortcutFolderMenuTile(): HTMLElement | null {
    const tile = shortcutDockFolderMenuTile;
    if (tile && tile.isConnected && tile.getAttribute('aria-expanded') === 'true') {
      return tile;
    }
    shortcutDockFolderMenuTile = null;
    return null;
  }

  // Keeps a folder tile looking pressed while its menu is open.
  function syncShortcutDockFolderMenu(tile: HTMLElement | null): void {
    if (!tile) {
      return;
    }
    if (tile.getAttribute('aria-expanded') === 'true') {
      shortcutDockFolderMenuTile = tile;
      if (!tile.matches(':hover')) {
        resetShortcutDockHover();
      }
      return;
    }
    if (tile !== shortcutDockFolderMenuTile) {
      return;
    }
    shortcutDockFolderMenuTile = null;
    // A pointer still over the row keeps driving the dock on its next move.
    if (!shortcutGrid || !shortcutGrid.matches(':hover')) {
      resetShortcutDockHover();
    }
  }

  function resetShortcutDockHover(): void {
    cancelShortcutDockPointerFrame();
    if (!shortcutGrid) {
      return;
    }
    const activeTile = getShortcutContextMenuTile();
    if (activeTile) {
      applyShortcutContextMenuDockHover(activeTile);
      return;
    }
    const folderMenuTile = getOpenShortcutFolderMenuTile();
    if (folderMenuTile) {
      setShortcutDockHover(folderMenuTile, getShortcutDockIconCenterX(folderMenuTile), { settle: true });
      return;
    }
    clearShortcutDockMagnificationState();
    clearShortcutContextMenuTileActive();
  }

  // Without a pointer position the tiles take the CSS steps by distance.
  function setShortcutDockStepHover(grid: HTMLElement, tiles: HTMLElement[], activeIndex: number): void {
    shortcutDockIconStates.clear();
    grid.setAttribute('data-dock-active', 'true');
    grid.removeAttribute('data-dock-following');
    tiles.forEach((tile, index) => {
      const offset = index - activeIndex;
      const distance = Math.abs(offset);
      if (distance > 2) {
        resetShortcutDockTile(tile);
        return;
      }
      removeShortcutDockTileStyles(tile);
      tile.setAttribute('data-dock-distance', String(distance));
      tile.setAttribute('data-dock-side', offset < 0 ? 'before' : offset > 0 ? 'after' : 'active');
    });
  }

  // `settle` marks a resting position (a menu's tile) rather than the pointer.
  function setShortcutDockHover(
    activeTile: HTMLElement | null,
    pointerX: number | null,
    options?: { fromFrame?: boolean; settle?: boolean }
  ): void {
    const grid = shortcutGrid;
    if (!grid || !activeTile) {
      return;
    }
    if (!preview.get(newtabShortcutDockMagnificationEnabled)) {
      clearShortcutDockMagnificationState();
      return;
    }
    const tiles = queryHtmlElements(grid, '.x-nt-shortcut-tile');
    const activeIndex = tiles.indexOf(activeTile);
    if (activeIndex < 0) {
      resetShortcutDockHover();
      return;
    }
    shortcutDockActiveTile = activeTile;
    if (pointerX === null || !Number.isFinite(pointerX) || prefersReducedMotion()) {
      setShortcutDockStepHover(grid, tiles, activeIndex);
      return;
    }
    // Reads first: every tile's resting box, and where a newly reached icon
    // is drawn now.
    const magnitude = shortcutDockMagnitude || readShortcutDockMagnitude();
    shortcutDockMagnitude = magnitude;
    const activeRect = activeTile.getBoundingClientRect();
    const targets = tiles.map((tile) => {
      const icon = getShortcutDockIcon(tile);
      if (!icon) {
        return null;
      }
      const rect = tile.getBoundingClientRect();
      // Only the pointer's own row magnifies; a wrapped row below stays put.
      const sameRow = Math.abs(rect.top - activeRect.top) < Math.max(1, rect.height / 2);
      const target: DockTransform = sameRow
        ? getShortcutDockTarget(pointerX, rect, icon, magnitude)
        : { scale: 1, shiftX: 0, rise: 0 };
      const atRest = target.scale <= 1.0005;
      if (atRest && !shortcutDockIconStates.has(icon)) {
        return { tile, icon, target, state: null };
      }
      const state: DockIconState = shortcutDockIconStates.get(icon) ||
        { ...readShortcutDockIconTransform(icon), written: false, target, tile };
      return { tile, icon, target, state };
    });
    grid.setAttribute('data-dock-active', 'true');
    // The frame loop moves the icons, so the CSS transition steps aside.
    grid.setAttribute('data-dock-following', 'true');
    targets.forEach((entry, index) => {
      if (!entry) {
        return;
      }
      const { tile, icon, target, state } = entry;
      if (!state) {
        if (tile.hasAttribute('data-dock-distance')) {
          resetShortcutDockTile(tile);
        }
        return;
      }
      state.target = target;
      state.tile = tile;
      shortcutDockIconStates.set(icon, state);
      const offset = index - activeIndex;
      tile.setAttribute('data-dock-distance', String(Math.abs(offset)));
      tile.setAttribute('data-dock-side', offset < 0 ? 'before' : offset > 0 ? 'after' : 'active');
    });
    if (!(options && options.fromFrame)) {
      requestShortcutDockFrame();
    }
  }

  function handleShortcutDockPointerOver(event: PointerEvent): void {
    if (isShortcutDragActive() || isBookmarkDragActive()) {
      return;
    }
    const tile = getShortcutTileFromNode(event.target);
    if (tile) {
      scheduleShortcutDockPointerStyles(tile, getShortcutDockPointerX(event));
      return;
    }
    // A group title row is not part of the dock: pointing at it settles
    // the icons, so a magnified icon never shows beside a waking title.
    const target = event.target;
    if (isElementNode(target) && target.closest('.x-nt-shortcut-group-header')) {
      resetShortcutDockHover();
    }
  }

  function handleShortcutDockPointerMove(event: PointerEvent): void {
    if (isShortcutDragActive() || isBookmarkDragActive()) {
      return;
    }
    // In the gap between two tiles the pointer is over the grid itself; the
    // icons keep following it from the last tile's row.
    const tile = getShortcutTileFromNode(event.target) ||
      (event.target === shortcutGrid && shortcutDockActiveTile && shortcutDockActiveTile.isConnected
        ? shortcutDockActiveTile
        : null);
    if (tile) {
      scheduleShortcutDockPointerStyles(tile, getShortcutDockPointerX(event));
    }
  }

  // The dock follows its magnification setting.
  function followShortcutDockMagnification(): void {
    settings.subscribe(newtabShortcutDockMagnificationEnabled, applyNewtabShortcutDockMagnification);
  }

  return {
    followShortcutDockMagnification,
    getShortcutDockIcon,
    applyNewtabShortcutDockMagnification,
    resetShortcutDockHover,
    setShortcutDockHover,
    handleShortcutDockPointerOver,
    handleShortcutDockPointerMove,
    syncShortcutDockFolderMenu
  };
}

type ShortcutDock = ReturnType<typeof createShortcutDock>;

export { createShortcutDock };
export type { ShortcutDock, ShortcutDockDeps };
