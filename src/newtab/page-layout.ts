// Page geometry: bookmark and recent grid column counts, the width modes
// and search width, shortcut grid sizing, which content sections show, and
// the search entry's vertical position as the viewport changes.
import type { NewtabWidthMode } from '../domain/settings';
import type { StorageAreaLike } from '../domain/storage-port';
import type * as LumnoNewtabLayout from './layout';
import type { LayoutController, SearchEntryLayoutOptions, WidthModeConfig } from './layout';
import type { LayoutMotion } from './layout-motion';
import type { PagePreferences } from './page-preferences';
import type { RecentSitesController } from './recent/recent-sites-controller';
import type { SuggestionsLayout } from './search/suggestions-layout';
import type { ShortcutContextMenu } from './shortcuts/shortcut-context-menu';
import type { ShortcutDock } from './shortcuts/shortcut-dock';
import type { ShortcutPageActions } from './shortcuts/shortcut-page-actions';
import type { ShortcutsController } from './shortcuts/shortcuts-controller';
import type { WallpaperRuntime } from './wallpaper/wallpaper';
import * as RecentSitesStore from '../domain/recent-sites-store';
import { newtabZenMode } from '../domain/settings/newtab-page';
import type { SettingsStore } from '../platform/settings-store';
import { newtabShortcutAddVisible, newtabShortcutColumns, newtabShortcutGap, newtabShortcutSize, newtabShortcutsVisible } from '../domain/settings/newtab-shortcuts';
import type { SettingPreview } from './setting-preview';

interface NewtabWidthModeConfig extends WidthModeConfig {
  searchMaxWidth: number;
  contentMaxWidth: number;
  recentMaxColumns: number;
}

interface ViewportSnapshot {
  width: number;
  height: number;
}

interface PageLayoutState {
  currentNewtabWidthMode: NewtabWidthMode;
  currentNewtabSearchWidth: number | null;
  currentBookmarkColumns: number;
  currentRecentCount: number;
  bookmarkGrid: HTMLElement | null;
  bookmarkCurrentPage: number;
  recentGrid: HTMLElement | null;
  recentSection: HTMLElement | null;
  recentMouseInsideSection: boolean;
  recentMouseLeftAt: number;
  shortcutGrid: HTMLElement | null;
  shortcutSection: HTMLElement | null;
  newtabShortcuts: readonly unknown[];
  newtabResizeLayoutLocked: boolean;
  layoutController: Pick<LayoutController,
    'applyWidthMode' | 'updateBottomDockLayout' | 'updateSearchEntryLayout'> | null;
  layoutMotion: Pick<LayoutMotion, 'commit'> | null;
  wallpaperRuntime: Pick<WallpaperRuntime, 'updateSearchWidthUi'> | null;
}

interface PageLayoutDeps extends
  Pick<PagePreferences,
    'normalizeBookmarkColumns' | 'normalizeNewtabWidthMode' | 'normalizeNewtabSearchWidth' | 'getBookmarkLimit'>,
  Pick<SuggestionsLayout, 'updateSuggestionsFloatingLayout'>,
  Pick<RecentSitesController, 'closeRecentContextMenu'>,
  Pick<ShortcutsController, 'getVisibleShortcuts'>,
  Pick<ShortcutDock, 'resetShortcutDockHover'>,
  Pick<ShortcutContextMenu, 'closeShortcutContextMenu'>,
  Pick<ShortcutPageActions, 'closeShortcutDialog'> {
  preview: Pick<SettingPreview, 'get' | 'store'>;
  settings: Pick<SettingsStore, 'get' | 'subscribe'>;
  NEWTAB_LAYOUT: Pick<typeof LumnoNewtabLayout, 'getAdaptiveGridColumnCount' | 'CONTENT_MAX_WIDTH_PX'>;
  NEWTAB_MOBILE_FLOW_BREAKPOINT_PX: number;
  NEWTAB_WIDTH_MODE_CONFIGS: Record<NewtabWidthMode, NewtabWidthModeConfig>;
  NEWTAB_SEARCH_WIDTH_CONFIG: typeof LumnoNewtabLayout.SEARCH_WIDTH_CONFIG;
  RECENT_CARD_TARGET_WIDTH_PX: number;
  RECENT_GRID_GAP_PX: number;
  MAX_NEWTAB_SHORTCUTS: number;
  storageArea: StorageAreaLike | null;
  NEWTAB_SEARCH_WIDTH_STORAGE_KEY: string;
  scheduleWallpaperAdaptiveToneUpdate(): void;
  pageState: PageLayoutState;
}

function createPageLayout(deps: PageLayoutDeps) {
  const {
    preview,
    settings,
    normalizeBookmarkColumns,
    NEWTAB_LAYOUT,
    NEWTAB_MOBILE_FLOW_BREAKPOINT_PX,
    NEWTAB_WIDTH_MODE_CONFIGS,
    normalizeNewtabWidthMode,
    normalizeNewtabSearchWidth,
    NEWTAB_SEARCH_WIDTH_CONFIG,
    RECENT_CARD_TARGET_WIDTH_PX,
    RECENT_GRID_GAP_PX,
    getBookmarkLimit,
    updateSuggestionsFloatingLayout,
    storageArea,
    NEWTAB_SEARCH_WIDTH_STORAGE_KEY,
    closeRecentContextMenu,
    scheduleWallpaperAdaptiveToneUpdate,
    getVisibleShortcuts,
    MAX_NEWTAB_SHORTCUTS,
    resetShortcutDockHover,
    closeShortcutContextMenu,
    closeShortcutDialog
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  const RESTORE_SEARCH_LAYOUT_LOCK_MS = 900;
  let searchEntryRestoreLayoutLockUntil = 0;
  let searchEntryLastVisibleViewportWidth = Math.max(0, window.innerWidth || 0);
  let searchEntryLastVisibleViewportHeight = Math.max(0, window.innerHeight || 0);
  const BOOKMARK_CARD_TARGET_WIDTH_PX = 154;
  const BOOKMARK_GRID_GAP_PX = 12;
  let currentRecentGridColumns = 4;

  function normalizeRecentCount(value: unknown): number {
    return RecentSitesStore.normalizeRecentCount(value);
  }

  function normalizeRecentMode(value: unknown, fallback?: unknown): 'latest' | 'most' {
    if (value === 'latest' || value === 'most') {
      return value;
    }
    return fallback === 'latest' || fallback === 'most' ? fallback : 'latest';
  }

  function getBookmarkGridColumnCount(): number {
    const config = getNewtabWidthModeConfig();
    const maxColumns = Math.max(2, normalizeBookmarkColumns(pageState.currentBookmarkColumns));
    return NEWTAB_LAYOUT.getAdaptiveGridColumnCount({
      viewportWidth: window.innerWidth,
      mobileBreakpointPx: NEWTAB_MOBILE_FLOW_BREAKPOINT_PX,
      mobileColumns: 2,
      compactBreakpointPx: 860,
      compactColumns: 2,
      contentMaxWidth: Number(config.contentMaxWidth || NEWTAB_LAYOUT.CONTENT_MAX_WIDTH_PX),
      targetColumnWidth: BOOKMARK_CARD_TARGET_WIDTH_PX,
      gap: BOOKMARK_GRID_GAP_PX,
      minColumns: 2,
      maxColumns
    });
  }

  function getNewtabWidthModeBaseConfig(): NewtabWidthModeConfig {
    return NEWTAB_WIDTH_MODE_CONFIGS[normalizeNewtabWidthMode(pageState.currentNewtabWidthMode)] || NEWTAB_WIDTH_MODE_CONFIGS.wide;
  }

  function getEffectiveNewtabSearchWidth(): number {
    const customWidth = normalizeNewtabSearchWidth(pageState.currentNewtabSearchWidth, { allowNull: true });
    return customWidth || getNewtabWidthModeBaseConfig().searchMaxWidth || NEWTAB_SEARCH_WIDTH_CONFIG.fallback;
  }

  function getNewtabWidthModeConfig(): NewtabWidthModeConfig {
    return { ...getNewtabWidthModeBaseConfig(), searchMaxWidth: getEffectiveNewtabSearchWidth() };
  }

  function getRecentGridColumnCount(): number {
    const config = getNewtabWidthModeConfig();
    const maxColumns = Math.max(4, Number(config.recentMaxColumns || 4));
    return NEWTAB_LAYOUT.getAdaptiveGridColumnCount({
      viewportWidth: window.innerWidth,
      mobileBreakpointPx: NEWTAB_MOBILE_FLOW_BREAKPOINT_PX,
      mobileColumns: 2,
      compactBreakpointPx: 860,
      compactColumns: 2,
      contentMaxWidth: Number(config.contentMaxWidth || NEWTAB_LAYOUT.CONTENT_MAX_WIDTH_PX),
      targetColumnWidth: RECENT_CARD_TARGET_WIDTH_PX,
      gap: RECENT_GRID_GAP_PX,
      minColumns: 4,
      maxColumns
    });
  }

  function getRecentLimit(): number {
    const normalized = normalizeRecentCount(pageState.currentRecentCount);
    if (normalized <= 0) {
      return 0;
    }
    const rows = Math.max(1, Math.round(normalized / 4));
    return rows * Math.max(1, getRecentGridColumnCount());
  }

  function getRecentSourceLimit(): number {
    const normalized = normalizeRecentCount(pageState.currentRecentCount);
    if (normalized <= 0) {
      return 0;
    }
    const rows = Math.max(1, Math.round(normalized / 4));
    const config = getNewtabWidthModeConfig();
    const maxColumns = Math.max(4, Number(config.recentMaxColumns || 4));
    return rows * maxColumns;
  }

  // Reports whether the column count changed.
  function applyBookmarkGridColumns(): boolean {
    if (!pageState.bookmarkGrid) {
      return false;
    }
    const previousColumns = Number.parseInt(pageState.bookmarkGrid.style.getPropertyValue('--x-nt-bookmark-columns'), 10);
    const columns = Math.max(1, getBookmarkGridColumnCount());
    pageState.bookmarkGrid.style.setProperty('--x-nt-bookmark-columns', String(columns));
    return previousColumns !== columns;
  }

  function keepBookmarkPageAnchorAfterLimitChange(previousLimit: number): void {
    const prev = Math.max(1, Number.parseInt(String(previousLimit), 10) || 1);
    const next = Math.max(1, getBookmarkLimit());
    const firstVisibleIndex = Math.max(0, pageState.bookmarkCurrentPage * prev);
    pageState.bookmarkCurrentPage = Math.floor(firstVisibleIndex / next);
  }

  // Reports whether the column count changed.
  function applyRecentGridColumns(): boolean {
    if (!pageState.recentGrid) {
      return false;
    }
    const columns = getRecentGridColumnCount();
    const changed = currentRecentGridColumns !== columns;
    currentRecentGridColumns = columns;
    pageState.recentGrid.style.setProperty('--x-nt-recent-columns', String(columns));
    return changed;
  }

  function applyNewtabWidthMode(): void {
    if (pageState.layoutController) {
      pageState.layoutController.applyWidthMode(getNewtabWidthModeConfig());
    }
  }

  function updateNewtabSearchWidthLayout(): void {
    applyNewtabWidthMode();
    updateSuggestionsFloatingLayout();
    updateBookmarkSectionPosition();
  }

  // Reports whether the width changed.
  function setNewtabSearchWidth(value: unknown, options?: { allowNull?: boolean; persist?: boolean }): boolean {
    const config = options || {};
    const nextWidth = normalizeNewtabSearchWidth(value, { allowNull: Boolean(config.allowNull) });
    const changed = pageState.currentNewtabSearchWidth !== nextWidth;
    pageState.currentNewtabSearchWidth = nextWidth;
    updateNewtabSearchWidthLayout();
    if (pageState.wallpaperRuntime) {
      pageState.wallpaperRuntime.updateSearchWidthUi();
    }
    if (config.persist && storageArea && nextWidth !== null) {
      void storageArea.set({ [NEWTAB_SEARCH_WIDTH_STORAGE_KEY]: nextWidth });
    }
    return changed;
  }

  function setContentSectionVisible(section: HTMLElement | null, visible: boolean): void {
    if (!section) {
      return;
    }
    section.setAttribute('data-content-visible', visible ? 'true' : 'false');
    section.setAttribute('data-visible', visible && !settings.get(newtabZenMode) ? 'true' : 'false');
    if (section === pageState.recentSection && (!visible || settings.get(newtabZenMode))) {
      closeRecentContextMenu();
    }
    scheduleWallpaperAdaptiveToneUpdate();
  }

  function isContentSectionVisible(section: Element | null | undefined): boolean {
    return Boolean(section && section.getAttribute('data-visible') === 'true');
  }

  function applyNewtabShortcutLayoutPreferences(): void {
    if (!document.documentElement || !document.documentElement.style) {
      return;
    }
    const rootStyle = document.documentElement.style;
    const size = preview.get(newtabShortcutSize);
    const gap = preview.get(newtabShortcutGap);
    // Whole pixels with matching parity leave an even margin on each side, so
    // the icon sits centered in its tile and the favicon in its icon on 1x screens.
    const iconSize = roundToParityOf(size * 0.75, size);
    const faviconSize = roundToParityOf(size * 0.4375, iconSize);
    rootStyle.setProperty('--x-nt-shortcut-user-tile-size', `${size}px`);
    rootStyle.setProperty('--x-nt-shortcut-user-icon-size', `${iconSize}px`);
    rootStyle.setProperty('--x-nt-shortcut-user-icon-radius', `${size * 0.25}px`);
    rootStyle.setProperty('--x-nt-shortcut-user-favicon-size', `${faviconSize}px`);
    rootStyle.setProperty('--x-nt-shortcut-user-tile-padding', `${size * 0.125}px`);
    rootStyle.setProperty('--x-nt-shortcut-user-column-gap', `${gap}px`);
    rootStyle.setProperty('--x-nt-shortcut-user-row-gap', `${gap + 6}px`);
    applyNewtabShortcutColumns();
  }

  function roundToParityOf(value: number, reference: number): number {
    const floor = Math.floor(value);
    const lower = (floor - reference) % 2 === 0 ? floor : floor - 1;
    return value - lower <= 1 ? lower : lower + 2;
  }

  function applyNewtabShortcutColumns(): void {
    if (!document.documentElement || !document.documentElement.style) {
      return;
    }
    document.documentElement.style.setProperty(
      '--x-nt-shortcut-columns',
      String(preview.get(newtabShortcutColumns))
    );
    if (!pageState.shortcutGrid || typeof window.getComputedStyle !== 'function') {
      return;
    }
    const gridStyle = window.getComputedStyle(pageState.shortcutGrid);
    const tileSize = Number.parseFloat(
      gridStyle.getPropertyValue('--x-nt-shortcut-tile-size')
    );
    const columnGap = Number.parseFloat(gridStyle.columnGap);
    const paddingLeft = Number.parseFloat(gridStyle.paddingLeft);
    const paddingRight = Number.parseFloat(gridStyle.paddingRight);
    if (![tileSize, columnGap, paddingLeft, paddingRight].every(Number.isFinite)) {
      return;
    }
    const targetWidth =
      (tileSize * preview.get(newtabShortcutColumns)) +
      (columnGap * Math.max(0, preview.get(newtabShortcutColumns) - 1)) +
      paddingLeft +
      paddingRight;
    document.documentElement.style.setProperty(
      '--x-nt-shortcuts-target-width',
      `${Math.round(targetWidth)}px`
    );
  }

  function applyNewtabShortcutsVisibility(): void {
    if (!pageState.shortcutSection) {
      return;
    }
    const hasVisibleContent = getVisibleShortcuts().length > 0 ||
      (preview.get(newtabShortcutAddVisible) && pageState.newtabShortcuts.length < MAX_NEWTAB_SHORTCUTS);
    setContentSectionVisible(
      pageState.shortcutSection,
      Boolean(preview.get(newtabShortcutsVisible) && hasVisibleContent)
    );
    if (!preview.get(newtabShortcutsVisible) || !hasVisibleContent || settings.get(newtabZenMode)) {
      resetShortcutDockHover();
      closeShortcutContextMenu();
      closeShortcutDialog();
    }
  }

  function getCurrentSearchEntryPaddingTop(): number | null {
    if (!document.body || !document.body.style) {
      return null;
    }
    const value = Number.parseFloat(document.body.style.getPropertyValue('padding-top'));
    return Number.isFinite(value) ? Math.round(value) : null;
  }

  function getSearchEntryViewportSnapshot(): ViewportSnapshot {
    return {
      width: Math.max(0, Math.round(window.innerWidth || 0)),
      height: Math.max(0, Math.round(window.innerHeight || 0))
    };
  }

  function hasSearchEntryViewportChanged(referenceViewport?: Partial<ViewportSnapshot> | null): boolean {
    const currentViewport = getSearchEntryViewportSnapshot();
    const reference = referenceViewport || {};
    return Math.abs(currentViewport.width - (Number(reference.width) || 0)) > 1 ||
      Math.abs(currentViewport.height - (Number(reference.height) || 0)) > 1;
  }

  function rememberSearchEntryViewport(): void {
    const viewport = getSearchEntryViewportSnapshot();
    searchEntryLastVisibleViewportWidth = viewport.width;
    searchEntryLastVisibleViewportHeight = viewport.height;
  }

  function hasSearchEntryViewportChangedSinceLastVisible(): boolean {
    const viewport = getSearchEntryViewportSnapshot();
    return Math.abs(viewport.width - searchEntryLastVisibleViewportWidth) > 1 ||
      Math.abs(viewport.height - searchEntryLastVisibleViewportHeight) > 1;
  }

  function beginSearchEntryRestoreLayoutLock(): void {
    if (!document.body ||
        document.body.getAttribute('data-nt-ready') !== '1' ||
        hasSearchEntryViewportChangedSinceLastVisible() ||
        getCurrentSearchEntryPaddingTop() === null) {
      return;
    }
    searchEntryRestoreLayoutLockUntil = Date.now() + RESTORE_SEARCH_LAYOUT_LOCK_MS;
  }

  function shouldPreserveSearchEntryLayout(): boolean {
    if (!searchEntryRestoreLayoutLockUntil || Date.now() > searchEntryRestoreLayoutLockUntil) {
      searchEntryRestoreLayoutLockUntil = 0;
      return false;
    }
    if (getCurrentSearchEntryPaddingTop() === null) {
      searchEntryRestoreLayoutLockUntil = 0;
      return false;
    }
    return true;
  }

  function updateBookmarkSectionPosition(
    options?: { preserveSearchEntryLayout?: boolean; stabilizeDockDensity?: boolean }
  ): void {
    const layoutOptions = options || {};
    if (pageState.layoutController) {
      pageState.layoutController.updateBottomDockLayout({
        preserveSearchEntryLayout: Boolean(layoutOptions.preserveSearchEntryLayout) ||
          pageState.newtabResizeLayoutLocked ||
          shouldPreserveSearchEntryLayout(),
        // A live resize holds the dock's density until the resize settles.
        stabilizeDockDensity: Boolean(layoutOptions.stabilizeDockDensity) || pageState.newtabResizeLayoutLocked,
        onRecentHidden: () => {
          pageState.recentMouseInsideSection = false;
          pageState.recentMouseLeftAt = 0;
        }
      });
    }
    if (pageState.layoutMotion) {
      pageState.layoutMotion.commit();
    }
    rememberSearchEntryViewport();
    scheduleWallpaperAdaptiveToneUpdate();
  }

  function updateSearchEntryLayout(options?: SearchEntryLayoutOptions): void {
    if (pageState.layoutController) {
      pageState.layoutController.updateSearchEntryLayout(options);
    }
    if (pageState.layoutMotion) {
      pageState.layoutMotion.commit();
    }
  }

  // The grid follows its settings, and a dragged slider at once.
  function followShortcutGridLayout(): void {
    const applyLayout = () => {
      applyNewtabShortcutsVisibility();
      applyNewtabShortcutLayoutPreferences();
      updateBookmarkSectionPosition({ preserveSearchEntryLayout: true, stabilizeDockDensity: true });
    };
    settings.subscribe([newtabShortcutsVisible, newtabShortcutColumns, newtabShortcutSize, newtabShortcutGap], applyLayout);
    preview.store.subscribe(applyLayout);
  }

  return {
    followShortcutGridLayout,
    normalizeRecentCount,
    normalizeRecentMode,
    getBookmarkGridColumnCount,
    getEffectiveNewtabSearchWidth,
    getRecentLimit,
    getRecentSourceLimit,
    applyBookmarkGridColumns,
    keepBookmarkPageAnchorAfterLimitChange,
    applyRecentGridColumns,
    applyNewtabWidthMode,
    updateNewtabSearchWidthLayout,
    setNewtabSearchWidth,
    setContentSectionVisible,
    isContentSectionVisible,
    applyNewtabShortcutLayoutPreferences,
    applyNewtabShortcutColumns,
    applyNewtabShortcutsVisibility,
    getSearchEntryViewportSnapshot,
    hasSearchEntryViewportChanged,
    rememberSearchEntryViewport,
    beginSearchEntryRestoreLayoutLock,
    updateBookmarkSectionPosition,
    updateSearchEntryLayout
  };
}

type PageLayout = ReturnType<typeof createPageLayout>;

export { createPageLayout };
export type { PageLayout, PageLayoutDeps, PageLayoutState };
