import { useLayoutEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { TopbarBookmarkActions, type BookmarkHeaderStore } from './bookmark-header';
import { createLiquidGlass } from './liquid-glass';

export const BOOKMARK_TOPBAR_IDS = Object.freeze({
  topbar: '_x_extension_newtab_bookmarks_topbar_2026_unique_',
  viewport: '_x_extension_newtab_bookmarks_topbar_viewport_2026_unique_',
  items: '_x_extension_newtab_bookmarks_topbar_items_2026_unique_',
  edgeFade: '_x_extension_newtab_bookmarks_topbar_edge_fade_2026_unique_',
  actions: '_x_extension_newtab_bookmarks_topbar_actions_2026_unique_'
});

export const BOOKMARK_TOPBAR_HEIGHT_PX = 36;

export type BookmarkTopbarSurfaceMode =
  | 'adaptive'
  | 'clear'
  | 'frosted'
  | 'transparent'
  | 'custom';

export function normalizeSurfaceMode(
  value: unknown,
  fallback: BookmarkTopbarSurfaceMode = 'adaptive'
): BookmarkTopbarSurfaceMode {
  return value === 'clear' ||
    value === 'frosted' ||
    value === 'transparent' ||
    value === 'custom' ||
    value === 'adaptive'
    ? value
    : fallback;
}

export type BookmarkTopbarLayout = 'docked' | 'floating';

// Docked spans the top edge; floating sits inset from it as a rounded panel.
export function normalizeLayout(value: unknown): BookmarkTopbarLayout {
  return value === 'floating' ? 'floating' : 'docked';
}

const SURFACE_STYLE_PROPERTIES = Object.freeze([
  '--x-nt-bookmarks-topbar-surface',
  '--x-nt-bookmarks-topbar-terminal-surface',
  '--x-nt-bookmarks-topbar-ink',
  '--x-nt-bookmarks-topbar-action-hover',
  '--x-nt-bookmarks-topbar-item-hover',
  '--x-nt-bookmarks-topbar-folder-hover'
]);

export function normalizeSurfaceColor(value: unknown) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(raw)) {
    return raw;
  }
  if (/^#[0-9a-f]{3}$/.test(raw)) {
    return `#${raw
      .slice(1)
      .split('')
      .map((part) => `${part}${part}`)
      .join('')}`;
  }
  return '';
}

function getRelativeLuminance(color: unknown) {
  const normalized = normalizeSurfaceColor(color);
  if (!normalized) {
    return 1;
  }
  const channels = [1, 3, 5].map((index) => {
    const channel =
      Number.parseInt(normalized.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function getSurfaceColorTokens(value: unknown) {
  const surfaceColor = normalizeSurfaceColor(value);
  if (!surfaceColor) {
    return null;
  }
  const useDarkInk = getRelativeLuminance(surfaceColor) >= 0.2;
  return Object.freeze({
    surfaceColor,
    ink: useDarkInk ? '#111827' : '#f8fafc',
    actionHover: useDarkInk
      ? 'rgba(15, 23, 42, 0.065)'
      : 'rgba(255, 255, 255, 0.095)',
    itemHover: useDarkInk
      ? 'rgba(15, 23, 42, 0.065)'
      : 'rgba(255, 255, 255, 0.095)',
    folderHover: useDarkInk
      ? 'rgba(37, 99, 235, 0.075)'
      : 'rgba(96, 165, 250, 0.12)'
  });
}

interface TopbarElements {
  actions: HTMLDivElement;
  edgeFade: HTMLDivElement;
  itemsHost: HTMLDivElement;
  viewport: HTMLDivElement;
}

function TopbarStructure({
  headerStore,
  register
}: {
  headerStore: BookmarkHeaderStore | null;
  register(elements: TopbarElements): void;
}) {
  const actionsRef = useRef<HTMLDivElement>(null);
  const edgeFadeRef = useRef<HTMLDivElement>(null);
  const itemsHostRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (
      actionsRef.current &&
      edgeFadeRef.current &&
      itemsHostRef.current &&
      viewportRef.current
    ) {
      register({
        actions: actionsRef.current,
        edgeFade: edgeFadeRef.current,
        itemsHost: itemsHostRef.current,
        viewport: viewportRef.current
      });
    }
  }, [register]);
  return (
    <>
      <div
        className="x-nt-bookmarks-topbar-viewport"
        id={BOOKMARK_TOPBAR_IDS.viewport}
        ref={viewportRef}
      >
        <div
          className="x-nt-bookmarks-topbar-items"
          id={BOOKMARK_TOPBAR_IDS.items}
          ref={itemsHostRef}
        />
      </div>
      <div
        aria-hidden="true"
        className="x-nt-bookmarks-topbar-edge-fade"
        data-visible="false"
        id={BOOKMARK_TOPBAR_IDS.edgeFade}
        ref={edgeFadeRef}
      />
      <div
        className="x-nt-bookmarks-topbar-actions"
        id={BOOKMARK_TOPBAR_IDS.actions}
        ref={actionsRef}
      >
        {headerStore ? <TopbarBookmarkActions store={headerStore} /> : null}
      </div>
    </>
  );
}

interface Placement {
  nextSibling: ChildNode | null;
  parent: ParentNode;
}

function rememberPlacement(element: HTMLElement | null): Placement | null {
  return element?.parentNode
    ? {
        parent: element.parentNode,
        nextSibling: element.nextSibling
      }
    : null;
}

function restorePlacement(
  element: HTMLElement | null,
  placement: Placement | null
) {
  if (!element || !placement) {
    return false;
  }
  if (
    placement.nextSibling &&
    placement.nextSibling.parentNode === placement.parent
  ) {
    placement.parent.insertBefore(element, placement.nextSibling);
  } else {
    placement.parent.appendChild(element);
  }
  return true;
}

export interface BookmarksTopbarRuntime {
  actions: HTMLDivElement;
  activate(): boolean;
  autoScroll(pointerX: number, pointerY: number): number;
  deactivate(): boolean;
  destroy(): void;
  edgeFade: HTMLDivElement;
  element: HTMLElement;
  isActive(): boolean;
  isVisible(): boolean;
  itemsHost: HTMLDivElement;
  mount(parent?: HTMLElement | null): BookmarksTopbarRuntime;
  setLayout(value: unknown): BookmarkTopbarLayout;
  setSurfaceColor(value: unknown): string;
  setSurfaceMode(value: unknown): BookmarkTopbarSurfaceMode;
  setVisible(visible: boolean): boolean;
  syncOverflowFade(): boolean;
  updateLanguage(ariaLabel: string): void;
  viewport: HTMLDivElement;
  windowObj: Window & typeof globalThis;
}

export interface BookmarksTopbarOptions {
  documentObj?: Document;
  windowObj?: Window & typeof globalThis;
  ariaLabel?: string;
  // Moved into the bar while it is active, and back when it is not.
  grid?: HTMLElement | null;
  // The bookmark section's header model, whose actions the bar shows while active.
  headerStore?: BookmarkHeaderStore | null;
  onVisibilityChange?(visible: boolean, detail: { element: HTMLElement; height: number }): void;
}

export function createBookmarksTopbar(
  options: BookmarksTopbarOptions = {}
): BookmarksTopbarRuntime {
  const documentObj: Document = options.documentObj || document;
  const windowObj = options.windowObj || window;
  const element = documentObj.createElement('section');
  element.id = BOOKMARK_TOPBAR_IDS.topbar;
  element.className = 'x-nt-bookmarks-topbar';
  element.dataset.reactIsland = 'newtab-bookmarks-topbar';
  element.dataset.surfaceMode = 'adaptive';
  element.dataset.layout = 'docked';
  element.dataset.visible = 'false';
  element.setAttribute('aria-label', String(options.ariaLabel || 'Bookmarks'));
  const reactRoot: Root = createRoot(element);
  const mounted: { elements: TopbarElements | null } = { elements: null };
  const register = (nextElements: TopbarElements) => {
    mounted.elements = nextElements;
  };
  flushSync(() => reactRoot.render(
    <TopbarStructure headerStore={options.headerStore || null} register={register} />
  ));
  if (!mounted.elements) {
    flushSync(() => reactRoot.unmount());
    throw new Error('Lumno New Tab React bookmarks topbar did not mount.');
  }
  const { actions, edgeFade, itemsHost, viewport } = mounted.elements;
  const grid: HTMLElement | null = options.grid || null;
  const onVisibilityChange =
    typeof options.onVisibilityChange === 'function'
      ? options.onVisibilityChange
      : null;
  const gridPlacement = rememberPlacement(grid);
  let active = false;
  let visible = false;
  let overflowRight = false;
  let overflowSyncFrameId = 0;
  let wheelScrollFrameId = 0;
  let pendingWheelDelta = 0;
  let destroyed = false;
  const liquidGlass = createLiquidGlass({ documentObj, element, windowObj });

  const setSurfaceColor = (value: unknown) => {
    const tokens = getSurfaceColorTokens(value);
    if (!tokens) {
      SURFACE_STYLE_PROPERTIES.forEach((propertyName) =>
        element.style.removeProperty(propertyName)
      );
      element.removeAttribute('data-custom-surface');
      return '';
    }
    element.style.setProperty(
      '--x-nt-bookmarks-topbar-surface',
      tokens.surfaceColor
    );
    element.style.setProperty(
      '--x-nt-bookmarks-topbar-terminal-surface',
      tokens.surfaceColor
    );
    element.style.setProperty('--x-nt-bookmarks-topbar-ink', tokens.ink);
    element.style.setProperty(
      '--x-nt-bookmarks-topbar-action-hover',
      tokens.actionHover
    );
    element.style.setProperty(
      '--x-nt-bookmarks-topbar-item-hover',
      tokens.itemHover
    );
    element.style.setProperty(
      '--x-nt-bookmarks-topbar-folder-hover',
      tokens.folderHover
    );
    element.dataset.customSurface = 'true';
    return tokens.surfaceColor;
  };

  const setSurfaceMode = (value: unknown) => {
    const mode = normalizeSurfaceMode(value);
    element.dataset.surfaceMode = mode;
    liquidGlass.sync();
    return mode;
  };

  const setLayout = (value: unknown) => {
    const layout = normalizeLayout(value);
    element.dataset.layout = layout;
    scheduleOverflowFadeSync();
    liquidGlass.sync();
    return layout;
  };

  const setOverflowFadeVisible = (nextVisible: boolean) => {
    const nextOverflowRight = nextVisible === true;
    if (overflowRight !== nextOverflowRight) {
      overflowRight = nextOverflowRight;
      edgeFade.dataset.visible = overflowRight ? 'true' : 'false';
      viewport.dataset.overflowEnd = overflowRight ? 'true' : 'false';
    }
    return overflowRight;
  };

  const syncOverflowFade = () => {
    const scrollWidth = Number(viewport.scrollWidth) || 0;
    const clientWidth = Number(viewport.clientWidth) || 0;
    const scrollLeft = Math.max(0, Number(viewport.scrollLeft) || 0);
    // Items scrolled past the start fade out there too, rather than being cut at the bar's edge.
    const overflowStart = active && visible && clientWidth > 0 && scrollLeft > 1;
    if (viewport.dataset.overflowStart !== String(overflowStart)) {
      viewport.dataset.overflowStart = String(overflowStart);
    }
    return setOverflowFadeVisible(
      active &&
        visible &&
        clientWidth > 0 &&
        scrollLeft + clientWidth < scrollWidth - 1
    );
  };

  const scheduleOverflowFadeSync = () => {
    if (destroyed || overflowSyncFrameId) {
      return;
    }
    if (typeof windowObj.requestAnimationFrame !== 'function') {
      syncOverflowFade();
      return;
    }
    overflowSyncFrameId = windowObj.requestAnimationFrame(() => {
      overflowSyncFrameId = 0;
      syncOverflowFade();
    });
  };

  const setVisible = (nextVisible: boolean) => {
    const previousVisible = visible;
    visible = nextVisible === true;
    element.dataset.visible = visible ? 'true' : 'false';
    liquidGlass.sync();
    if (visible) {
      scheduleOverflowFadeSync();
    } else {
      setOverflowFadeVisible(false);
    }
    if (onVisibilityChange && previousVisible !== visible) {
      onVisibilityChange(visible, {
        element,
        height: BOOKMARK_TOPBAR_HEIGHT_PX
      });
    }
    return visible;
  };

  const activate = () => {
    if (active) {
      return false;
    }
    if (grid) {
      itemsHost.appendChild(grid);
    }
    active = true;
    element.dataset.active = 'true';
    scheduleOverflowFadeSync();
    liquidGlass.sync();
    return true;
  };

  const deactivate = () => {
    if (!active) {
      return false;
    }
    restorePlacement(grid, gridPlacement);
    active = false;
    setVisible(false);
    element.dataset.active = 'false';
    liquidGlass.sync();
    return true;
  };

  const autoScroll = (pointerX: number, pointerY: number) => {
    if (!active || !visible) {
      return 0;
    }
    const x = Number(pointerX);
    const y = Number(pointerY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return 0;
    }
    const rect = viewport.getBoundingClientRect();
    const edgeSize = Math.min(72, Math.max(36, rect.width * 0.1));
    if (
      y < rect.top ||
      y > rect.bottom ||
      x < rect.left - edgeSize ||
      x > rect.right + edgeSize
    ) {
      return 0;
    }
    let direction = 0;
    let strength = 0;
    if (x < rect.left + edgeSize) {
      direction = -1;
      strength = 1 - Math.max(0, x - rect.left) / edgeSize;
    } else if (x > rect.right - edgeSize) {
      direction = 1;
      strength = 1 - Math.max(0, rect.right - x) / edgeSize;
    }
    if (!direction) {
      return 0;
    }
    const delta =
      direction * Math.max(4, Math.round(18 * Math.min(1, strength)));
    const previousScrollLeft = Number(viewport.scrollLeft) || 0;
    viewport.scrollLeft = previousScrollLeft + delta;
    scheduleOverflowFadeSync();
    return (Number(viewport.scrollLeft) || 0) - previousScrollLeft;
  };

  const onScroll = () => scheduleOverflowFadeSync();
  const onResize = () => {
    scheduleOverflowFadeSync();
    liquidGlass.sync();
  };
  const flushWheelScroll = () => {
    wheelScrollFrameId = 0;
    const delta = pendingWheelDelta;
    pendingWheelDelta = 0;
    if (
      destroyed ||
      !active ||
      !visible ||
      !delta ||
      viewport.scrollWidth <= viewport.clientWidth
    ) {
      return;
    }
    viewport.scrollLeft += delta;
    scheduleOverflowFadeSync();
  };
  const scheduleWheelScroll = (delta: number) => {
    pendingWheelDelta += delta;
    if (wheelScrollFrameId) {
      return;
    }
    if (typeof windowObj.requestAnimationFrame !== 'function') {
      flushWheelScroll();
      return;
    }
    wheelScrollFrameId = windowObj.requestAnimationFrame(flushWheelScroll);
  };
  const onWheel = (event: WheelEvent) => {
    if (!active || !visible) {
      return;
    }
    const horizontalDelta = Math.abs(Number(event.deltaX) || 0);
    const verticalDelta = Math.abs(Number(event.deltaY) || 0);
    if (!verticalDelta || horizontalDelta >= verticalDelta) {
      return;
    }
    scheduleWheelScroll(Number(event.deltaY) || 0);
  };
  viewport.addEventListener('scroll', onScroll, { passive: true });
  // Keep horizontal trackpad gestures on the browser's compositor thread.
  // Traditional vertical wheel input is translated once per animation frame.
  viewport.addEventListener('wheel', onWheel, { passive: true });
  windowObj.addEventListener('resize', onResize);

  const runtime: BookmarksTopbarRuntime = {
    actions,
    activate,
    autoScroll,
    deactivate,
    destroy() {
      if (destroyed) {
        return;
      }
      deactivate();
      destroyed = true;
      if (overflowSyncFrameId) {
        windowObj.cancelAnimationFrame?.(overflowSyncFrameId);
        overflowSyncFrameId = 0;
      }
      if (wheelScrollFrameId) {
        windowObj.cancelAnimationFrame?.(wheelScrollFrameId);
        wheelScrollFrameId = 0;
      }
      pendingWheelDelta = 0;
      liquidGlass.destroy();
      viewport.removeEventListener('scroll', onScroll);
      viewport.removeEventListener('wheel', onWheel);
      windowObj.removeEventListener('resize', onResize);
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
      flushSync(() => reactRoot.unmount());
    },
    edgeFade,
    element,
    isActive: () => active,
    isVisible: () => visible,
    itemsHost,
    mount(parent) {
      const target = parent || documentObj.body;
      if (element.parentNode !== target) {
        target.appendChild(element);
      }
      return runtime;
    },
    setLayout,
    setSurfaceColor,
    setSurfaceMode,
    setVisible,
    syncOverflowFade,
    updateLanguage(ariaLabel) {
      element.setAttribute('aria-label', String(ariaLabel || 'Bookmarks'));
    },
    viewport,
    windowObj
  };
  return Object.freeze(runtime);
}
