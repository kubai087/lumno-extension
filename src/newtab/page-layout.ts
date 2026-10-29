// Page geometry: bookmark and recent grid column counts, the width modes
// and search width, shortcut grid sizing, which content sections show, and
// the search entry's vertical position as the viewport changes.
import type { SearchEntryLayoutOptions, WidthModeConfig } from './layout';
import type { PagePreferences } from './page-preferences';
import type { RecentSitesController } from './recent/recent-sites-controller';
import type { SuggestionsLayout } from './search/suggestions-layout';
import type { ShortcutContextMenu } from './shortcuts/shortcut-context-menu';
import type { ShortcutDock } from './shortcuts/shortcut-dock';
import type { ShortcutPageActions } from './shortcuts/shortcut-page-actions';
import type { ShortcutsController } from './shortcuts/shortcuts-controller';
import { newtabZenMode } from '../domain/settings/newtab-page';
import type { SettingsStore } from '../platform/settings-store';
import { newtabShortcutAddVisible, newtabShortcutColumns, newtabShortcutGap, newtabShortcutSize, newtabShortcutsVisible } from '../domain/settings/newtab-shortcuts';
import type { SettingPreview } from './setting-preview';
import { newtabSearchWidth, newtabWidthMode } from '../domain/settings/newtab-page';
import { bookmarkColumns } from '../domain/settings/bookmarks';
import { recentCount } from '../domain/settings/recent-sites';
import * as NEWTAB_LAYOUT from './layout';
import { NEWTAB_MOBILE_FLOW_BREAKPOINT_PX, NEWTAB_WIDTH_MODE_CONFIGS, RECENT_CARD_TARGET_WIDTH_PX, RECENT_GRID_GAP_PX } from './newtab-config';
import { DEFAULT_MAX_SHORTCUTS } from '../domain/shortcuts/constants';
import { SEARCH_WIDTH_CONFIG } from './layout';
import type { ViewportActivity } from './viewport-activity';
import type { RecentPointer } from './recent/recent-pointer';
import type { ShortcutList } from './shortcuts/shortcut-list';
import type { BottomDockParts } from './shortcuts/bottom-dock-parts';

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
  bookmarkGrid: HTMLElement | null;
  bookmarkCurrentPage: number;
}

interface PageLayoutDeps extends
  Pick<PagePreferences,
    'normalizeNewtabSearchWidth' | 'getBookmarkLimit'>,
  Pick<SuggestionsLayout, 'updateSuggestionsFloatingLayout'>,
  Pick<RecentSitesController, 'closeRecentContextMenu'>,
  Pick<ShortcutsController, 'getVisibleShortcuts'>,
  Pick<ShortcutDock, 'resetShortcutDockHover'>,
  Pick<ShortcutContextMenu, 'closeShortcutContextMenu'>,
  Pick<ShortcutPageActions, 'closeShortcutDialog'> {
  preview: Pick<SettingPreview, 'get' | 'show' | 'store'>;
  settings: Pick<SettingsStore, 'get' | 'set' | 'subscribe'>;
  scheduleWallpaperAdaptiveToneUpdate(): void;
  viewport: Pick<ViewportActivity, 'locked'>;
  recentPointer: Pick<RecentPointer, 'reset'>;
  shortcutList: Pick<ShortcutList, 'items'>;
  shortcutSection: HTMLElement;
  shortcutGrid: HTMLElement;
  bottomDockParts: Pick<BottomDockParts, 'layoutController' | 'layoutMotion'>;
  recentGrid: HTMLElement;
  recentSection: HTMLElement;
  pageState: PageLayoutState;
}

function createPageLayout(deps: PageLayoutDeps) {
  const {
    recentSection,
    recentGrid,
    bottomDockParts,
    shortcutGrid,
    shortcutSection,
    shortcutList,
    preview,
    settings,
    normalizeNewtabSearchWidth,
    getBookmarkLimit,
    updateSuggestionsFloatingLayout,
    closeRecentContextMenu,
    scheduleWallpaperAdaptiveToneUpdate,
    getVisibleShortcuts,
    resetShortcutDockHover,
    closeShortcutContextMenu,
    closeShortcutDialog,
    viewport,
    recentPointer
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

  // The columns the bookmark grid shows at this width, for the column
  // setting or another one.
  function getBookmarkGridColumnCount(columns: number = preview.get(bookmarkColumns)): number {
    const config = getNewtabWidthModeConfig();
    const maxColumns = Math.max(2, columns);
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
    return NEWTAB_WIDTH_MODE_CONFIGS[settings.get(newtabWidthMode)] || NEWTAB_WIDTH_MODE_CONFIGS.wide;
  }

  function getEffectiveNewtabSearchWidth(): number {
    const customWidth = normalizeNewtabSearchWidth(preview.get(newtabSearchWidth), { allowNull: true });
    return customWidth || getNewtabWidthModeBaseConfig().searchMaxWidth || SEARCH_WIDTH_CONFIG.fallback;
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
    const normalized = preview.get(recentCount);
    if (normalized <= 0) {
      return 0;
    }
    const rows = Math.max(1, Math.round(normalized / 4));
    return rows * Math.max(1, getRecentGridColumnCount());
  }

  function getRecentSourceLimit(): number {
    const normalized = preview.get(recentCount);
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
    if (!recentGrid) {
      return false;
    }
    const columns = getRecentGridColumnCount();
    const changed = currentRecentGridColumns !== columns;
    currentRecentGridColumns = columns;
    recentGrid.style.setProperty('--x-nt-recent-columns', String(columns));
    return changed;
  }

  function applyNewtabWidthMode(): void {
    if (bottomDockParts.layoutController) {
      bottomDockParts.layoutController.applyWidthMode(getNewtabWidthModeConfig());
    }
  }

  function updateNewtabSearchWidthLayout(): void {
    applyNewtabWidthMode();
    updateSuggestionsFloatingLayout();
    updateBookmarkSectionPosition();
  }

  // Reports whether the width changed. A saved width goes to the settings;
  // a dragged one only shows until it is saved.
  function setNewtabSearchWidth(value: unknown, options?: { allowNull?: boolean; persist?: boolean }): boolean {
    const config = options || {};
    const nextWidth = normalizeNewtabSearchWidth(value, { allowNull: Boolean(config.allowNull) });
    const changed = preview.get(newtabSearchWidth) !== nextWidth;
    if (config.persist && nextWidth !== null) {
      void settings.set(newtabSearchWidth, nextWidth);
    } else {
      preview.show(newtabSearchWidth, nextWidth);
    }
    return changed;
  }

  function setContentSectionVisible(section: HTMLElement | null, visible: boolean): void {
    if (!section) {
      return;
    }
    section.setAttribute('data-content-visible', visible ? 'true' : 'false');
    section.setAttribute('data-visible', visible && !settings.get(newtabZenMode) ? 'true' : 'false');
    if (section === recentSection && (!visible || settings.get(newtabZenMode))) {
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
    if (!shortcutGrid || typeof window.getComputedStyle !== 'function') {
      return;
    }
    const gridStyle = window.getComputedStyle(shortcutGrid);
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
    if (!shortcutSection) {
      return;
    }
    const hasVisibleContent = getVisibleShortcuts().length > 0 ||
      (preview.get(newtabShortcutAddVisible) && shortcutList.items.length < DEFAULT_MAX_SHORTCUTS);
    setContentSectionVisible(
      shortcutSection,
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
    if (bottomDockParts.layoutController) {
      bottomDockParts.layoutController.updateBottomDockLayout({
        preserveSearchEntryLayout: Boolean(layoutOptions.preserveSearchEntryLayout) ||
          viewport.locked ||
          shouldPreserveSearchEntryLayout(),
        // A live resize holds the dock's density until the resize settles.
        stabilizeDockDensity: Boolean(layoutOptions.stabilizeDockDensity) || viewport.locked,
        onRecentHidden: () => recentPointer.reset()
      });
    }
    if (bottomDockParts.layoutMotion) {
      bottomDockParts.layoutMotion.commit();
    }
    rememberSearchEntryViewport();
    scheduleWallpaperAdaptiveToneUpdate();
  }

  function updateSearchEntryLayout(options?: SearchEntryLayoutOptions): void {
    if (bottomDockParts.layoutController) {
      bottomDockParts.layoutController.updateSearchEntryLayout(options);
    }
    if (bottomDockParts.layoutMotion) {
      bottomDockParts.layoutMotion.commit();
    }
  }

  // The search box follows its width, and a dragged slider at once.
  function followNewtabSearchWidth(): void {
    let shownWidth = getEffectiveNewtabSearchWidth();
    const apply = () => {
      const width = getEffectiveNewtabSearchWidth();
      if (width !== shownWidth) {
        shownWidth = width;
        updateNewtabSearchWidthLayout();
      }
    };
    settings.subscribe(newtabSearchWidth, apply);
    preview.store.subscribe(apply);
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
    followNewtabSearchWidth,
    followShortcutGridLayout,
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
