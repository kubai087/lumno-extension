import * as LumnoImeKeyGuard from '../domain/search/ime-key-guard';
import * as SEARCH_INPUT_HISTORY from '../domain/search/search-input-history';
import * as SUGGESTION_NAVIGATION from '../shared/search/suggestion-navigation';
import * as NEWTAB_BOOKMARK_DRAG_CONTROLLER from './bookmarks/bookmark-drag-controller';
import * as NEWTAB_BOOKMARK_PAGER from './bookmarks/bookmark-pager';
import * as NEWTAB_BOOKMARK_SECTION from './bookmarks/bookmark-section';
import * as NEWTAB_INPUT_FOCUS from './input-focus';
import * as NEWTAB_MODE_COMMANDS from './mode-commands';
import * as NEWTAB_PAGE_KEYBOARD from './page-keyboard';
import { loadNewtabLocaleMessages } from './page-language';
import { SurfaceLocale } from '../shared/i18n/surface-locale';
import * as NEWTAB_PAGE_NOTICES from './page-notices';
import * as NEWTAB_PAGE_RESIZE from './page-resize';
import * as NEWTAB_RECENT_CARD_DRAG from './recent/recent-card-drag';
import * as NEWTAB_RECENT_SECTION from './recent/recent-section';
import * as NEWTAB_SEARCH_BOX_CONTROLS from './search/search-box-controls';
import * as NEWTAB_SEARCH_BOX from './search/search-box';
import * as NEWTAB_SEARCH_INPUT_COMPOSITION from './search/search-input-composition';
import * as NEWTAB_SEARCH_MODE_CONTROLLER from './search/search-mode-controller';
import * as NEWTAB_SEARCH_NAVIGATION from './search/search-navigation';
import * as NEWTAB_SEARCH_SETTINGS_SYNC from './search/search-settings-sync';
import * as NEWTAB_SITE_SEARCH_RUNTIME from './search/site-search-runtime';
import * as NEWTAB_SUGGESTIONS_CONTROLLER from './search/suggestions-controller';
import * as NEWTAB_SECTION_HEADERS from './section-headers';
import * as NEWTAB_SECTION_LOADERS from './section-loaders';
import * as NEWTAB_SECTION_RELOAD from './section-reload';
import * as NEWTAB_BOTTOM_DOCK_RUNTIME from './shortcuts/bottom-dock-runtime';
import * as NEWTAB_SHORTCUT_DRAG from './shortcuts/shortcut-drag';
import * as NEWTAB_SHORTCUTS_CONTROLLER from './shortcuts/shortcuts-controller';
import * as NEWTAB_STARTUP_PREFERENCES from './startup-preferences';
import * as NEWTAB_STARTUP_STORAGE from './startup-storage';
import { defaultAccentColor } from '../shared/favicon/favicon-theme';
import { getBrandAccentForUrl, normalizeHost } from '../domain/favicon/brand-accents';
import { parseCssColor, rgbToCss, stableHashCode } from '../domain/color';
import * as NEWTAB_GLASS_SURFACES from './theme/glass-surfaces';
import * as LumnoMessaging from '../platform/messaging';
import { isNode } from '../shared/dom-guards';
import {
  bookmarkColumns,
  bookmarkCount,
  bookmarkFolderIconsVisible,
  bookmarkViewMode,
  newtabOpenInNewTab,
  newtabSearchWidth,
  newtabShortcutColumns,
  newtabWidthMode,
  numberShortcutInstantEnabled,
  overlayTabPriority,
  recentCount,
  recentMode,
  simpleModeEnabled
} from '../domain/settings';
import { SYNCED_PAGE_STORAGE_KEYS } from './newtab-config';
import type { SuggestionElement } from '../shared/react/search/suggestion-list/types';
import { readBootValue } from '../platform/boot-handoff';
import { createPageStructure } from './react/page-structure';
import { createSearchInput } from '../shared/react/search-input';
import { newtabShortcutAddVisible, newtabShortcutDockMagnificationEnabled, newtabShortcutGap, newtabShortcutSize, newtabShortcutsVisible } from '../domain/settings/newtab-shortcuts';
import { createSettingPort, getContextSettingsStore } from '../platform/settings-store';
import { SettingPreview } from './setting-preview';
import { repairStoredSettings } from './setting-repairs';
import { newtabTimeFont, newtabTimeFontSize, newtabTimeFontWeight, newtabTimeOpacity, newtabTimeSecondsVisible, newtabTopContentMode } from '../domain/settings/newtab-time';
import { newtabAppearanceButtonVisible, newtabFeedbackButtonVisible } from '../domain/settings/newtab-page';
import * as SearchSettings from '../domain/settings/search';

// The search settings the page reads as it starts.
const NEWTAB_SEARCH_SETTINGS = [
  SearchSettings.searchResultPriority,
  SearchSettings.searchResultSourceTypes,
  SearchSettings.searchResultDisplayLimit,
  SearchSettings.numberShortcutInstantEnabled,
  SearchSettings.macosCtrlSuggestionNavigationEnabled,
  SearchSettings.tabRankScoreDebug,
  SearchSettings.searchBlacklist,
  SearchSettings.faviconRequestBlacklist,
  SearchSettings.faviconEnhancedFetchEnabled,
  overlayTabPriority,
  simpleModeEnabled,
  newtabOpenInNewTab
];
import * as BundledIcons from '../domain/favicon/shortcut-favicon/bundled-icons';
import { SearchTabKey } from '../shared/search-panel/tab-key';
import { createSearchSubmit } from './search/search-submit';
import type { PageContext } from './app/context';
import { adaptiveToneEvents } from './wallpaper/tone-requests';
import { createShellFeature } from './features/shell';
import { createBookmarkStoreFeature } from './features/bookmark-store';
import { createShortcutStoreFeature } from './features/shortcut-store';
import { createTransfersFeature } from './features/transfers';
import { createNavigationFeature } from './features/navigation';
import { createBookmarkMenusFeature } from './features/bookmark-menus';
import { createShortcutMenusFeature } from './features/shortcut-menus';
import { createSearchCoreFeature } from './features/search-core';
import { createRecentCoreFeature } from './features/recent-core';
import { createThemeFeature } from './features/theme';
import { createLayoutFeature } from './features/layout';
import { createTopContentFeature } from './features/top-content';
import { createWallpaperFeature } from './features/wallpaper';

(function() {
  const {
    providerStorageRuntime,
    storageArea,
    takeStartupRead,
    migrateLocalSettingsIfNeeded
  } = NEWTAB_STARTUP_STORAGE.createStartupStorage();
  // The page's settings, read and followed through the one store of this context.
  const settings = getContextSettingsStore(chrome, window, takeStartupRead);
  // A dragged slider's value until it is saved.
  const preview = new SettingPreview(settings);
  preview.follow([
    newtabTimeFontSize, newtabTimeOpacity, newtabShortcutColumns, newtabShortcutSize, newtabShortcutGap, newtabSearchWidth,
    recentCount, bookmarkCount, bookmarkColumns, bookmarkFolderIconsVisible
  ]);
  const root = document.getElementById('_x_extension_newtab_root_2024_unique_');
  if (!root) {
    return;
  }
  if (document.body) {
    document.body.removeAttribute('data-nt-ready');
  }
  // The page's sections and the search layer, which the modules below draw into.
  const pageStructureRuntime = createPageStructure({
    documentObj: document
  });
  const suggestionsContainer = pageStructureRuntime.suggestions.container;
  const searchLayer = pageStructureRuntime.searchLayer;
  const shortcutSection = pageStructureRuntime.shortcut.section;
  const shortcutGrid = pageStructureRuntime.shortcut.grid;
  // The wordmark or clock above the search box, drawn by the top content runtime.
  const topContentContainer = pageStructureRuntime.topContent;
  const recentSection = pageStructureRuntime.recent.section;
  const localStorageArea = (chrome && chrome.storage && chrome.storage.local)
    ? chrome.storage.local
    : storageArea;
  // The page's language; it follows the stored choice from the first read.
  const locale = new SurfaceLocale(settings, loadNewtabLocaleMessages);
  locale.follow();
  const { t, formatMessage } = locale;
  // The runtime instances every feature takes.
  const ctx: PageContext = {
    settings,
    preview,
    locale,
    t,
    formatMessage,
    root,
    structure: pageStructureRuntime,
    providerStorageRuntime,
    storageArea,
    localStorageArea
  };
  const shellFeature = createShellFeature(ctx);
  const {
    appliedTheme,
    areFaviconRenderCachesReady,
    bindCursorTooltip,
    bindSearchInputCursorTooltip,
    bindShortcutTooltip,
    bookmarkCascadeCopyTooltipController,
    bookmarkCursorTooltipController,
    copyBookmarkUrl,
    copySearchResultUrl,
    dismissStack,
    dragSessions,
    faviconCacheRuntime,
    filterBlacklistedSuggestions,
    getBrowserPageFaviconUrl,
    getChromeFaviconUrl,
    getOwnExtensionPageDisplay,
    getPageFaviconCandidateUrl,
    getPageFaviconRenderCandidates,
    getPageFaviconUrlResolver,
    getSiteDisplayName,
    getUrlDisplay,
    hideCursorTooltip,
    hideSearchInputCursorTooltip,
    hideShortcutTooltip,
    hideToast,
    hideTopActionTooltip,
    historyLock,
    isLocalNetworkHost,
    limitSuggestionsForDisplay,
    sanitizeDisplayText,
    searchBox,
    shouldBlockFaviconForHost,
    shouldExcludeFromRecentSites,
    showToast,
    showTopActionTooltip,
    waitForFaviconRenderCaches,
    webAppearance
  } = shellFeature;
  const bookmarkStoreFeature = createBookmarkStoreFeature(ctx);
  const {
    bookmarkCards,
    bookmarkLayoutAnimation,
    bookmarkMoveHistory,
    bookmarkParts,
    bookmarksRuntime,
    bookmarksShown
  } = bookmarkStoreFeature;
  const shortcutStoreFeature = createShortcutStoreFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature });
  const {
    closeShortcutDialog,
    getFolderItemIconForShortcut,
    getFolderItemIconUrl,
    getShortcutById,
    getShortcutFolderId,
    getShortcutStoreOptions,
    loadVisibleShortcuts,
    moveShortcutGroupToIndex,
    openShortcutAddDialog,
    openShortcutGroupDialog,
    persistShortcuts,
    refreshShortcutFolderReferences,
    shortcutAreaScroll,
    shortcutData,
    shortcutFavicons,
    shortcutFolderRuntime,
    shortcutGroupHeaders,
    shortcutLayoutAnimation,
    shortcutList,
    shortcutTiles
  } = shortcutStoreFeature;
  const transfersFeature = createTransfersFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, shortcutStore: shortcutStoreFeature });
  const {
    applyBookmarkShortcutTransfer,
    applyShortcutStack,
    moveBookmarkToShortcuts,
    performBookmarkMoveHistoryAction,
    persistBookmarkCrossLevelMove,
    persistBookmarkDragOrder
  } = transfersFeature;
  const navigationFeature = createNavigationFeature(ctx, { shell: shellFeature });
  const {
    closeFeedbackPopover,
    createFeedbackControls,
    getFeedbackControl,
    getFeedbackLinks,
    getFeedbackWebLocale,
    getOpenDisposition,
    isFeedbackPopoverOpen,
    isMiddleClick,
    navigateToQuery,
    navigateToUrl,
    openCommunityQrDialog,
    openFeedbackExternalUrl,
    openUrlFromNewtabCard,
    searchEngine
  } = navigationFeature;
  const searchCoreFeature = createSearchCoreFeature(ctx, { shell: shellFeature, shortcutStore: shortcutStoreFeature, navigation: navigationFeature });
  const {
    applyMarkVariables,
    applyThemeVariables,
    buildCommandSuggestion,
    buildModeSuggestion,
    buildThemeFromAccent,
    buildZenSuggestion,
    commandCatalog,
    createAggregateSearchScopeProvider,
    defaultTheme,
    getCanonicalPageUrlForFavicon,
    getCommandMatch,
    getCommandMatches,
    getHostFromUrl,
    getHoverColors,
    getImmediateThemeForSuggestion,
    getNeutralHoverActionColors,
    getNextThemeMode,
    getProviderFaviconPageUrl,
    getProviderIcon,
    getProviderThemeHost,
    getThemeForMode,
    getThemeForProvider,
    getThemeForSuggestion,
    getThemeHostForSuggestion,
    getTileThemeOnSiteChange,
    isModeCommand,
    isNewtabDarkMode,
    isSlashCommandInput,
    isZenCommand,
    menuOrder,
    modeActions,
    modeMenu,
    openTabs,
    queueThemeForTarget,
    resultActivation,
    scheduleThemeResolutionFlush,
    searchAutocomplete,
    searchMatching,
    searchMode,
    searchQuery,
    searchResults,
    shouldUseUrlFallbackThemeForSuggestion,
    siteSearchCatalog,
    siteSearchIconCache,
    siteSearchRunner,
    suggestionInputPreview,
    suggestionModifiers,
    suggestionSource,
    urlHighlightTheme
  } = searchCoreFeature;
  const recentCoreFeature = createRecentCoreFeature(ctx, { shell: shellFeature, shortcutStore: shortcutStoreFeature, navigation: navigationFeature, searchCore: searchCoreFeature });
  const {
    closeRecentContextMenu,
    getHiddenRecentSites,
    getPinnedRecentSites,
    getRecentProgressState,
    getRecentSiteUrlKey,
    getRecentSites,
    handleRecentCardContextMenu,
    isRecentSiteHidden,
    isRecentSitePinned,
    mergeRecentSitesWithPinned,
    normalizeRecentSiteRecord,
    recentCards,
    recentPointer,
    recentShown,
    recentSitesReadyTask,
    recentSourceReads,
    togglePinnedRecentSite,
    toggleRecentProgressTracking,
    writeHiddenRecentSites
  } = recentCoreFeature;
  const bookmarkMenusFeature = createBookmarkMenusFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, shortcutStore: shortcutStoreFeature, transfers: transfersFeature, navigation: navigationFeature });
  const {
    closeBookmarkCascadeMenu,
    closeBookmarkContextMenu,
    getBookmarkModeMenuOptions,
    getTopBookmarks,
    handleBookmarkItemContextMenu,
    handleBookmarkModeMenuAction,
    initFolderPathMorph,
    initialBookmarkTopbarLayoutReady,
    isBookmarkContextMenuNode,
    isFolderColorPickerOpen,
    loadFolderColors,
    openBookmarkCascadeMenu,
    positionBookmarkCascadeLevels,
    scheduleFolderColorSync,
    syncBookmarkTopbarSurfaceAppearance,
    syncOpenBookmarkCascadeAnchorVisual
  } = bookmarkMenusFeature;
  const themeFeature = createThemeFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, navigation: navigationFeature, bookmarkMenus: bookmarkMenusFeature, searchCore: searchCoreFeature, recentCore: recentCoreFeature });
  const {
    applyBookmarkCardTheme,
    applyFallbackIcon,
    applyFaviconOpticalAlignment,
    applyFaviconOpticalShift,
    applyRecentCardTheme,
    applyShortcutTileTheme,
    applyThemeMode,
    attachFaviconData,
    attachFaviconWithFallbacks,
    followLanguage,
    followTheme,
    getScopedThemeMode,
    notices,
    preloadIcon,
    refreshThemeAwareFavicons,
    scheduleThemeAwareFaviconRescue,
    setFaviconSrcWithAnimation,
    setVisibleThemeMode,
    shouldDelayBookmarkHoverFromRecent,
    syncSystemThemeMode,
    warmIconCache
  } = themeFeature;
  const shortcutMenusFeature = createShortcutMenusFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, shortcutStore: shortcutStoreFeature, navigation: navigationFeature, bookmarkMenus: bookmarkMenusFeature });
  const {
    applyNewtabShortcutDockMagnification,
    closeShortcutContextMenu,
    followShortcutDockMagnification,
    getShortcutTileById,
    getShortcutTileFromNode,
    getShortcutTileId,
    handleShortcutContextMenu,
    handleShortcutDockPointerMove,
    handleShortcutDockPointerOver,
    handleShortcutNativeDragStart,
    isShortcutContextMenuNode,
    openShortcutAddContextMenu,
    openShortcutGroupMenu,
    openShortcutUrl,
    refreshShortcutTileCacheFromDom,
    resetShortcutDockHover,
    syncShortcutDockFolderMenu
  } = shortcutMenusFeature;
  const layoutFeature = createLayoutFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, shortcutStore: shortcutStoreFeature, shortcutMenus: shortcutMenusFeature, recentCore: recentCoreFeature });
  const {
    applyBookmarkGridColumns,
    applyNewtabShortcutColumns,
    applyNewtabShortcutLayoutPreferences,
    applyNewtabShortcutsVisibility,
    applyNewtabWidthMode,
    applyRecentGridColumns,
    beginSearchEntryRestoreLayoutLock,
    bottomDockParts,
    followNewtabSearchWidth,
    followShortcutGridLayout,
    getBookmarkGridColumnCount,
    getBookmarkLimit,
    getRecentLimit,
    getRecentSourceLimit,
    inferNewtabShortcutColumnsFromWidth,
    initialNewtabInputAutoFocusReadyTask,
    isCardActivationSuppressed,
    isContentSectionVisible,
    keepBookmarkPageAnchorAfterLimitChange,
    newtabEntryAnimationReadyPromise,
    rememberSearchEntryViewport,
    setContentSectionVisible,
    setSuggestionsVisible,
    syncSearchModeMenuResultOffset,
    updateBookmarkSectionPosition,
    updateSearchEntryLayout,
    updateSuggestionsFloatingLayout,
    viewportActivity
  } = layoutFeature;
  const pageSearchParams = new URLSearchParams(window.location.search || '');
  const suggestionItems: SuggestionElement[] = [];
  const topContentFeature = createTopContentFeature(ctx, { shell: shellFeature, navigation: navigationFeature, recentCore: recentCoreFeature, layout: layoutFeature });
  const {
    animateRecentResizeLayout,
    applyNewtabTopContentVisibility,
    cancelRecentResizeLayoutAnimations,
    captureRecentCardLayout,
    initialTimeFontReadyTask,
    quoteRuntime,
    renderNewtabTopContent,
    shouldAnimateNewtabLayoutShift,
    shouldSkipNewtabEntryMotion
  } = topContentFeature;
  const wallpaperFeature = createWallpaperFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, shortcutStore: shortcutStoreFeature, navigation: navigationFeature, bookmarkMenus: bookmarkMenusFeature, theme: themeFeature, layout: layoutFeature, topContent: topContentFeature });
  const {
    finishNewtabEntryAnimation,
    initialAppearanceReadyTask,
    markNewtabReady,
    wallpaperRuntime
  } = wallpaperFeature;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') {
      rememberSearchEntryViewport();
      hideToast();
    }
    if (document.visibilityState !== 'visible') {
      return;
    }
    syncSystemThemeMode();
  });
  window.addEventListener('pageshow', () => {
    hideToast();
    syncSystemThemeMode();
  });
  window.addEventListener('focus', () => {
    hideToast();
    syncSystemThemeMode();
  });
  window.addEventListener('blur', hideToast);
  window.addEventListener('pagehide', hideToast);

  const imeKeyGuard = LumnoImeKeyGuard.createImeKeyGuard();
  const searchInputHistoryController =
    SEARCH_INPUT_HISTORY.createSearchInputHistoryController({
      storage: createSettingPort(settings, SearchSettings.searchInputHistory)
    });
  function isImeCompositionEvent(event: KeyboardEvent): boolean {
    return imeKeyGuard.shouldIgnoreKeydown(event);
  }

  migrateLocalSettingsIfNeeded(SYNCED_PAGE_STORAGE_KEYS.slice());

  suggestionsContainer.addEventListener('wheel', function(event) {
    SUGGESTION_NAVIGATION.preventNumberShortcutWheel(event, suggestionsContainer);
  }, { passive: false });
  document.addEventListener('pointerdown', function() {
    SUGGESTION_NAVIGATION.cancelNumberShortcuts(suggestionsContainer);
  }, true);
  const suggestionsSurface = pageStructureRuntime.suggestions.surface;
  const suggestionsOutline = pageStructureRuntime.suggestions.outline;
  const bookmarkSection = pageStructureRuntime.bookmark.section;

  const {
    updateBookmarkHeader,
    setNewtabTopOccupied,
    syncBookmarkSurfaceMode,
    setBookmarkSurfaceVisible,
    followBookmarkViewMode,
    navigateBookmarkFolder
  } = NEWTAB_SECTION_HEADERS.createSectionHeaders({
    locale,
    bookmarkGrid: pageStructureRuntime.bookmark.grid,
    bookmarkParts,
    bookmarksShown,
    preview,
    settings,
    t,
    updateSearchEntryLayout,
    setContentSectionVisible,
    bookmarkSection,
    bookmarkCards,
    closeBookmarkCascadeMenu,
    showTopActionTooltip,
    hideTopActionTooltip,
    renderBookmarkHeader: pageStructureRuntime.bookmark.renderHeader,
    getBookmarkModeMenuOptions,
    handleBookmarkModeMenuAction,
    openBookmarkManager: () => {
      if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
        return;
      }
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openBookmarkManager' });
    }
  });

  const {
    getAddShortcutButton,
    renderShortcuts,
    flushDeferredShortcutRender,
    followNewtabShortcutPreferences,
    createShortcutsSection,
    fitShortcutGroupColumns
  } = NEWTAB_SHORTCUTS_CONTROLLER.createShortcutsController({
    openShortcutUrl,
    shortcutData,
    shortcutFavicons,
    locale,
    dragSessions,
    shortcutList,
    settings,
    shortcutFolderRuntime,
    shortcutLayoutAnimation,
    t,
    hideShortcutTooltip,
    closeShortcutContextMenu,
    syncOpenBookmarkCascadeAnchorVisual,
    applyNewtabShortcutsVisibility,
    updateBookmarkSectionPosition,
    applyNewtabShortcutLayoutPreferences,
    applyNewtabShortcutDockMagnification,
    inferNewtabShortcutColumnsFromWidth,
    formatMessage,
    resetShortcutDockHover,
    pageStructureRuntime,
    shortcutTiles,
    shortcutGroupHeaders,
    initFolderPathMorph,
    getHostFromUrl,
    getImmediateThemeForSuggestion,
    applyShortcutTileTheme,
    queueThemeForTarget,
    getTileThemeOnSiteChange,
    attachFaviconWithFallbacks,
    bindShortcutTooltip,
    isMiddleClick,
    isCardActivationSuppressed,
    handleShortcutContextMenu,
    handleShortcutNativeDragStart,
    openShortcutAddDialog,
    openShortcutGroupDialog,
    openShortcutAddContextMenu,
    handleShortcutDockPointerOver,
    handleShortcutDockPointerMove,
    syncShortcutDockFolderMenu,
    handleShortcutGroupMenu: openShortcutGroupMenu
  });

  const {
    getBookmarkPageCount,
    updateBookmarkPagerState,
    updateBookmarkGridHeightLock,
    renderCurrentBookmarkPage,
    switchBookmarkPageDuringDrag,
    handleBookmarkWheel
  } = NEWTAB_BOOKMARK_PAGER.createBookmarkPager({
    setBookmarkSurfaceVisible,
    shortcutSection,
    dragSessions,
    bookmarkParts,
    settings,
    bookmarkGrid: pageStructureRuntime.bookmark.grid,
    bookmarksShown,
    getBookmarkLimit,
    updateBookmarkHeader,
    getBookmarkGridColumnCount,
    updateBookmarkSectionPosition
  });
  // A swipe or wheel turn over the bookmarks turns their pages.
  bookmarkSection.addEventListener('wheel', (event) => {
    if (!event || !isContentSectionVisible(bookmarkSection)) {
      return;
    }
    handleBookmarkWheel(event);
  }, { passive: false });

  const {
    isEmptyBookmarkRootHidden,
    getExternalBookmarkSurfacePoint,
    isValidExternalBookmarkDropTarget,
    getShortcutFolderDropTargetAt,
    getShortcutInsertionDropTarget,
    getExternalBookmarkDropTarget,
    isPointOverShortcutDropSurface,
    clearDragDropTarget,
    isBookmarkCascadeSurfaceAtPoint,
    setDragDropTarget,
    getBookmarkDragPageSwitchDirection,
    clearBookmarkDragPageSwitch,
    clearBookmarkDragFolderSwitch,
    scheduleBookmarkDragFolderSwitch,
    scheduleBookmarkDragPageSwitch,
    finishBookmarkDrag,
    handleBookmarkDragPointerDown,
    handleBookmarkCascadeItemPointerDown
  } = NEWTAB_BOOKMARK_DRAG_CONTROLLER.createBookmarkDragController({
    shortcutAreaScroll,
    syncOpenBookmarkCascadeAnchorVisual,
    bookmarkLayoutAnimation,
    moveBookmarkToShortcuts,
    persistBookmarkDragOrder,
    persistBookmarkCrossLevelMove,
    dragSessions,
    historyLock,
    bookmarkPagerNextButton: pageStructureRuntime.bookmark.nextButton,
    bookmarkPagerPrevButton: pageStructureRuntime.bookmark.previousButton,
    bookmarkGrid: pageStructureRuntime.bookmark.grid,
    bookmarkParts,
    bookmarksShown,
    getAddShortcutButton,
    shortcutGrid,
    shortcutSection,
    shortcutList,
    settings,
    preview,
    getBookmarkLimit,
    initFolderPathMorph,
    isContentSectionVisible,
    bookmarkSection,
    bookmarksRuntime,
    getShortcutById,
    getShortcutFolderId,
    getShortcutStoreOptions,
    getShortcutTileId,
    getBookmarkPageCount,
    openBookmarkCascadeMenu,
    navigateBookmarkFolder,
    switchBookmarkPageDuringDrag,
    hideCursorTooltip,
    closeBookmarkCascadeMenu,
    renderCurrentBookmarkPage,
    closeBookmarkContextMenu
  });

  createShortcutsSection();

  NEWTAB_BOOKMARK_SECTION.createBookmarkSection({
    navigateBookmarkFolder,
    dragSessions,
    bookmarkParts,
    settings,
    preview,
    setContentSectionVisible,
    bookmarkSection,
    pageStructureRuntime,
    t,
    handleBookmarkDragPointerDown,
    applyBookmarkGridColumns,
    bookmarkCards,
    formatMessage,
    sanitizeDisplayText,
    getHostFromUrl,
    getSiteDisplayName,
    getUrlDisplay,
    initFolderPathMorph,
    stableHashCode,
    normalizeHost,
    attachFaviconWithFallbacks,
    isLocalNetworkHost,
    getChromeFaviconUrl,
    getBrowserPageFaviconUrl,
    getImmediateThemeForSuggestion,
    queueThemeForTarget,
    applyBookmarkCardTheme,
    shouldDelayBookmarkHoverFromRecent,
    bindCursorTooltip,
    hideCursorTooltip,
    openBookmarkCascadeMenu,
    copyBookmarkUrl,
    handleBookmarkItemContextMenu,
    isCardActivationSuppressed,
    navigateToUrl,
    openUrlFromNewtabCard,
    dismissStack,
    getFolderItemIconUrl,
    bookmarksRuntime,
    bookmarkCascadeCopyTooltipController,
    hideTopActionTooltip,
    handleBookmarkCascadeItemPointerDown,
    isBookmarkContextMenuNode,
    setNewtabTopOccupied,
    syncBookmarkTopbarSurfaceAppearance,
    syncBookmarkSurfaceMode
  });

  const { recentSitesView } = NEWTAB_RECENT_SECTION.createRecentSection({
    locale,
    getPinnedRecentSites,
    settings,
    setContentSectionVisible,
    hideTopActionTooltip,
    pageStructureRuntime,
    t,
    applyRecentGridColumns,
    recentCards,
    formatMessage,
    sanitizeDisplayText,
    getOwnExtensionPageDisplay,
    getHostFromUrl,
    getCanonicalPageUrlForFavicon,
    getSiteDisplayName,
    getUrlDisplay,
    attachFaviconWithFallbacks,
    getBrowserPageFaviconUrl,
    getImmediateThemeForSuggestion,
    queueThemeForTarget,
    applyRecentCardTheme,
    getRecentLimit,
    isRecentSitePinned,
    showToast,
    showTopActionTooltip,
    navigateToUrl,
    bindCursorTooltip,
    hideCursorTooltip,
    openUrlFromNewtabCard,
    togglePinnedRecentSite,
    handleRecentCardContextMenu,
    isCardActivationSuppressed,
    getRecentProgressState,
    toggleRecentProgressTracking,
    recentPointer
  });

  const {
    bottomDockRuntime,
    bottomDock
  } = NEWTAB_BOTTOM_DOCK_RUNTIME.createBottomDockRuntime({
    topContentContainer,
    recentSection,
    bottomDockParts,
    shortcutSection,
    quoteRuntime,
    notices,
    searchLayer,
    suggestionsContainer,
    searchBox,
    root,
    bookmarkSection,
    suggestionsSurface,
    suggestionsOutline,
    shouldAnimateNewtabLayoutShift,
    applyNewtabWidthMode,
    viewport: viewportActivity
  });

  const {
    finishShortcutDrag
  } = NEWTAB_SHORTCUT_DRAG.createShortcutDrag({
    shortcutAreaScroll,
    shortcutLayoutAnimation,
    settings,
    dragSessions,
    historyLock,
    bookmarkGrid: pageStructureRuntime.bookmark.grid,
    bookmarkParts,
    getAddShortcutButton,
    shortcutGrid,
    shortcutList,
    refreshShortcutTileCacheFromDom,
    getShortcutTileId,
    getShortcutTileById,
    renderShortcuts,
    flushDeferredShortcutRender,
    resetShortcutDockHover,
    persistShortcuts,
    bookmarkMoveHistory,
    hideCursorTooltip,
    closeBookmarkCascadeMenu,
    hideShortcutTooltip,
    isEmptyBookmarkRootHidden,
    renderCurrentBookmarkPage,
    isBookmarkCascadeSurfaceAtPoint,
    getExternalBookmarkSurfacePoint,
    isPointOverShortcutDropSurface,
    clearBookmarkDragPageSwitch,
    clearBookmarkDragFolderSwitch,
    clearDragDropTarget,
    getBookmarkDragPageSwitchDirection,
    scheduleBookmarkDragPageSwitch,
    getShortcutFolderDropTargetAt,
    getExternalBookmarkDropTarget,
    setDragDropTarget,
    scheduleBookmarkDragFolderSwitch,
    getShortcutById,
    isValidExternalBookmarkDropTarget,
    bookmarksRuntime,
    getShortcutFolderId,
    bookmarkLayoutAnimation,
    applyBookmarkShortcutTransfer,
    applyShortcutStack,
    getFolderItemIconForShortcut,
    showToast,
    hideToast,
    t,
    formatMessage,
    refreshShortcutFolderReferences,
    isShortcutContextMenuNode,
    getShortcutTileFromNode,
    closeShortcutContextMenu,
    moveShortcutGroupToIndex,
    fitShortcutGroupColumns
  });

  const recentCardDrag = NEWTAB_RECENT_CARD_DRAG.createRecentCardDrag({
    settings,
    dragSessions,
    historyLock,
    bookmarkGrid: pageStructureRuntime.bookmark.grid,
    bookmarkParts,
    shortcutList,
    getShortcutStoreOptions,
    getShortcutFolderId,
    persistShortcuts,
    bookmarkMoveHistory,
    bookmarksRuntime,
    isBookmarkCascadeSurfaceAtPoint,
    getExternalBookmarkSurfacePoint,
    getExternalBookmarkDropTarget,
    getShortcutFolderDropTargetAt,
    getShortcutInsertionDropTarget,
    isPointOverShortcutDropSurface,
    isValidExternalBookmarkDropTarget,
    shortcutAreaScroll,
    setDragDropTarget,
    clearDragDropTarget,
    getBookmarkDragPageSwitchDirection,
    scheduleBookmarkDragPageSwitch,
    clearBookmarkDragPageSwitch,
    scheduleBookmarkDragFolderSwitch,
    clearBookmarkDragFolderSwitch,
    applyBookmarkShortcutTransfer,
    bookmarkLayoutAnimation,
    isEmptyBookmarkRootHidden,
    renderCurrentBookmarkPage,
    closeBookmarkCascadeMenu,
    closeRecentContextMenu,
    hideCursorTooltip,
    hideTopActionTooltip,
    resetShortcutDockHover,
    showToast,
    t,
    formatMessage
  });

  const {
    startSectionDataPass,
    renderRecentSites,
    markBookmarkDataDirty,
    markBookmarkTreeDirty,
    markRecentDataDirty,
    loadBookmarks,
    loadRecentSites,
    handleRecentVisibilityChange
  } = NEWTAB_SECTION_LOADERS.createSectionLoaders({
    locale,
    dragSessions,
    bookmarkGrid: pageStructureRuntime.bookmark.grid,
    bookmarkParts,
    bookmarksShown,
    recentSitesView,
    recentShown,
    shortcutList,
    appliedTheme,
    getHiddenRecentSites,
    settings,
    preview,
    setBookmarkSurfaceVisible,
    updateBookmarkGridHeightLock,
    updateBookmarkSectionPosition,
    updateBookmarkPagerState,
    normalizeRecentSiteRecord,
    getRecentSiteUrlKey,
    writeHiddenRecentSites,
    shouldExcludeFromRecentSites,
    isRecentSiteHidden,
    mergeRecentSitesWithPinned,
    getRecentLimit,
    setContentSectionVisible,
    recentSection,
    bookmarksRuntime,
    closeBookmarkCascadeMenu,
    followTheme,
    areFaviconRenderCachesReady,
    waitForFaviconRenderCaches,
    getTopBookmarks,
    getBookmarkLimit,
    getBookmarkPageCount,
    updateBookmarkHeader,
    renderCurrentBookmarkPage,
    getRecentSourceLimit,
    getRecentSites,
    beginSearchEntryRestoreLayoutLock
  });

  NEWTAB_STARTUP_PREFERENCES.createStartupPreferences({
    bookmarkParts,
    bookmarksShown,
    recentShown,
    preview,
    settings,
    renderRecentSites,
    markRecentDataDirty,
    loadRecentSites,
    getBookmarkLimit,
    applyNewtabWidthMode,
    applyRecentGridColumns,
    applyBookmarkGridColumns,
    keepBookmarkPageAnchorAfterLimitChange,
    renderCurrentBookmarkPage,
    updateBookmarkGridHeightLock,
    updateBookmarkSectionPosition,
    markBookmarkDataDirty,
    loadBookmarks
  });

  const numberShortcutOptions = {
    onHoldStart: function() {
      showToast(t(
        'search_number_jump_release_hint',
        'Release to show numbers'
      ), false, { duration: 0 });
    },
    onHoldEnd: hideToast,
    instantActive: () => settings.get(numberShortcutInstantEnabled)
  };

  // Kick off favicon cache warmup early; theme tint work flushes when storage is ready.
  void faviconCacheRuntime.ensureCachesReady().then(() => {
    scheduleThemeResolutionFlush(0);
    refreshThemeAwareFavicons();
    scheduleThemeAwareFaviconRescue();
  });

  const attachInputModeFaviconData =
    BundledIcons.createSiteSearchProviderIconHydrator(attachFaviconData);

  const tabKey = new SearchTabKey({
    query: searchQuery,
    mode: searchMode,
    results: searchResults,
    autocomplete: searchAutocomplete,
    matching: searchMatching,
    catalog: siteSearchCatalog,
    actions: modeActions,
    modeMenu,
    preview: suggestionInputPreview,
    surface: {
      getInput: () => (searchBox.inputParts ? searchBox.inputParts.input : null),
      getModeController: () => searchBox.modeController,
      getSelectedRow: () => (searchResults.selectedIndex >= 0 ? searchResults.rows[searchResults.selectedIndex] || null : null)
    }
  });

  const { getNextSuggestionIndex } = NEWTAB_SEARCH_NAVIGATION;
  const {
    quickNavigation,
    getDirectUrlSuggestion,
    getMatchedOpenTabIdForSuggestion,
    shouldSwitchMatchedTabSuggestion,
    refreshTabsForSearchContext
  } = NEWTAB_SEARCH_NAVIGATION.createSearchNavigation({
    openTabs,
    searchBox,
    settings,
    formatMessage,
    getPageFaviconCandidateUrl
  });

  const {
    getAutoHighlightIndex,
    activateRenderedSuggestion,
    deleteRenderedHistorySuggestion,
    scrollSelectedSuggestionIntoView,
    refreshTabsIfIdle,
    clearSearchSuggestions,
    dismissSearchSuggestionsFromBackground,
    restoreDismissedSearchSuggestions,
    forgetSuggestionsDismissal,
    renderSuggestions,
    renderPendingSuggestions,
    showSuggestionSnapshot,
    directNavigationSettleController,
    requestSuggestions
  } = NEWTAB_SUGGESTIONS_CONTROLLER.createSuggestionsController({
    appliedTheme,
    openTabs,
    searchBox,
    suggestionSource,
    siteSearchRunner,
    modeActions,
    searchMatching,
    locale,
    searchResults,
    searchMode,
    searchAutocomplete,
    searchQuery,
    settings,
    getPageFaviconCandidateUrl,
    setVisibleThemeMode,
    webAppearance,
    shouldSwitchMatchedTabSuggestion,
    resultActivation,
    navigateToQuery,
    suggestionsContainer,
    suggestionItems,
    refreshTabsForSearchContext,
    isSlashCommandInput,
    isModeCommand,
    isZenCommand,
    getScopedThemeMode,
    applyThemeMode,
    getCommandMatches,
    buildModeSuggestion,
    buildZenSuggestion,
    buildCommandSuggestion,
    getDirectUrlSuggestion,
    quickNavigation,
    siteSearchCatalog,
    searchEngine,
    getProviderIcon,
    formatMessage,
    getMatchedOpenTabIdForSuggestion,
    filterBlacklistedSuggestions,
    getUrlDisplay,
    limitSuggestionsForDisplay,
    t,
    warmIconCache,
    setSuggestionsVisible,
    openCommunityQrDialog
  });

  const { submitSearchQuery } = createSearchSubmit({
    quickNavigation,
    shouldSwitchMatchedTabSuggestion,
    siteSearchRunner,
    modeActions,
    searchResults,
    searchMode,
    searchAutocomplete,
    searchQuery,
    settings,
    resultActivation,
    suggestionItems,
    renderSuggestions,
    isSlashCommandInput,
    getCommandMatch,
    isModeCommand,
    isZenCommand,
    getNextThemeMode,
    setVisibleThemeMode,
    webAppearance,
    openCommunityQrDialog,
    navigateToQuery,
    searchBox,
    appliedTheme
  });

  const { focusResume } = NEWTAB_SITE_SEARCH_RUNTIME.createSiteSearchRuntime({
    searchBox,
    modeActions,
    searchResults,
    searchMode,
    searchQuery,
    siteSearchCatalog,
    createAggregateSearchScopeProvider,
    showSuggestionSnapshot,
    requestSuggestions,
    settings,
    defaultTheme
  });

  const {
    refreshFallbackShortcut,
    handleGlobalTypingFocus
  } = NEWTAB_INPUT_FOCUS.createInputFocus({
    isFolderColorPickerOpen,
    searchBox,
    settings,
    focusResume,
    refreshTabsIfIdle,
    initialNewtabInputAutoFocusReadyTask,
    isImeCompositionEvent
  });

  const {
    updateModeBadge,
    followZenMode
  } = NEWTAB_MODE_COMMANDS.createModeCommands({
    catalog: commandCatalog,
    webAppearance,
    locale,
    bookmarkParts,
    appliedTheme,
    searchBox,
    preview,
    settings,
    t,
    renderSuggestions,
    applyNewtabTopContentVisibility,
    applyNewtabShortcutsVisibility,
    bookmarkSection,
    recentSection,
    bookmarkCards,
    closeBookmarkCascadeMenu,
    closeShortcutContextMenu,
    closeRecentContextMenu,
    closeShortcutDialog,
    closeWallpaperPanel: wallpaperRuntime.closePanel,
    closeFeedbackPopover,
    hideTopActionTooltip,
    hideShortcutTooltip,
    hideCursorTooltip,
    updateBookmarkSectionPosition,
    updateSearchEntryLayout
  });

  const {
    inputParts,
    searchInput,
    rightIcon,
    setSearchScopeIconEnabled
  } = NEWTAB_SEARCH_BOX.createSearchBox({
    searchLayer,
    suggestionsContainer,
    suggestionInputPreview,
    searchBox,
    suggestionSource,
    suggestionModifiers,
    modeActions,
    searchResults,
    searchMode,
    searchAutocomplete,
    searchQuery,
    locale,
    settings,
    suggestionItems,
    t,
    formatMessage,
    sanitizeDisplayText,
    shouldBlockFaviconForHost,
    isLocalNetworkHost,
    getHostFromUrl,
    getUrlDisplay,
    getThemeHostForSuggestion,
    getImmediateThemeForSuggestion,
    getThemeForSuggestion,
    shouldUseUrlFallbackThemeForSuggestion,
    getThemeForMode,
    getHoverColors,
    getNeutralHoverActionColors,
    applyThemeVariables,
    applyMarkVariables,
    applyFaviconOpticalAlignment,
    applyFaviconOpticalShift,
    applyFallbackIcon,
    setFaviconSrcWithAnimation,
    attachFaviconWithFallbacks,
    preloadIcon,
    getChromeFaviconUrl,
    getBrowserPageFaviconUrl,
    getPageFaviconRenderCandidates,
    setSuggestionsVisible,
    resultActivation,
    activateRenderedSuggestion,
    deleteRenderedHistorySuggestion,
    copySearchResultUrl,
    showTopActionTooltip,
    hideTopActionTooltip,
    bindCursorTooltip,
    getSearchActionLabel: () => t('action_search', '搜索'),
    getDefaultSearchEngineThemeUrl: () => searchEngine.themeUrl(),
    getBrandAccentForUrl,
    buildThemeFromAccent,
    shouldSwitchMatchedTabSuggestion,
    defaultTheme,
    urlHighlightTheme,
    createSearchInput,
    searchInputHistoryController,
    updateModeBadge,
    imeKeyGuard,
    clearSearchSuggestions,
    isSlashCommandInput,
    renderSuggestions,
    getDirectUrlSuggestion,
    renderPendingSuggestions,
    requestSuggestions,
    isImeCompositionEvent,
    getNextSuggestionIndex,
    getAutoHighlightIndex,
    scrollSelectedSuggestionIntoView,
    submitSearchQuery,
    root,
    dismissSearchSuggestionsFromBackground,
    finishNewtabEntryAnimation,
    handleGlobalTypingFocus,
    refreshFallbackShortcut,
    restoreDismissedSearchSuggestions,
    forgetSuggestionsDismissal,
    handleSearchTabKey: tabKey.handle,
    hideSearchInputCursorTooltip,
    modeMenu,
    bindSearchInputCursorTooltip
  });

  renderNewtabTopContent(!shouldSkipNewtabEntryMotion());
  applyNewtabTopContentVisibility();

  const {
    maybeShowFileAccessNotice,
    createNewtabGraphicsNoticeController,
    createNewtabEngagementNoticeController,
    helpCenterAskHintSettled,
    dismissHelpCenterAskHint,
    dismissWebdavFeatureHint
  } = NEWTAB_PAGE_NOTICES.createPageNotices({
    openCommunityQrDialog,
    getFeedbackLinks,
    notices,
    searchBox,
    modeActions,
    locale,
    pageSearchParams,
    bottomDock,
    t,
    getOpenDisposition,
    getFeedbackWebLocale,
    isFeedbackPopoverOpen,
    openFeedbackExternalUrl,
    newtabEntryAnimationReadyPromise,
    root,
    siteSearchCatalog
  });

  const {
    followNewtabActionButtonVisibility
  } = NEWTAB_SEARCH_BOX_CONTROLS.createSearchBoxControls({
    getWallpaperControl: wallpaperRuntime.getControlElement,
    getFeedbackControl,
    notices,
    searchBox,
    searchMode,
    settings,
    locale,
    dismissHelpCenterAskHint,
    rightIcon,
    formatMessage,
    dismissWebdavFeatureHint,
    helpCenterAskHintSettled,
    t,
    getOpenDisposition,
    searchInput,
    closeFeedbackPopover,
    closeWallpaperPanel: wallpaperRuntime.closePanel
  });

  const {
    followNewtabGlassStyle
  } = NEWTAB_GLASS_SURFACES.createGlassSurfaces({
    settings,
    syncBookmarkTopbarSurfaceAppearance
  });

  NEWTAB_SEARCH_MODE_CONTROLLER.createSearchModeController({
    suggestionsContainer,
    searchBox,
    modeMenu,
    modeActions,
    menuOrder,
    locale,
    searchResults,
    searchMode,
    searchQuery,
    requestSuggestions,
    settings,
    renderSuggestions,
    searchInput,
    getThemeForMode,
    defaultTheme,
    defaultAccentColor,
    parseCssColor,
    rgbToCss,
    isNewtabDarkMode,
    getProviderIcon,
    getPageFaviconUrlResolver,
    getProviderFaviconPageUrl,
    getProviderThemeHost,
    getThemeForProvider,
    attachInputModeFaviconData,
    formatMessage,
    bookmarkCursorTooltipController,
    showToast,
    t,
    hideToast,
    setSearchScopeIconEnabled,
    syncSearchModeMenuResultOffset,
    siteSearchIconCache
  });

  NEWTAB_PAGE_RESIZE.createPageResize({
    bookmarksShown,
    recentShown,
    modeActions,
    getBookmarkLimit,
    applyNewtabWidthMode,
    applyNewtabShortcutColumns,
    shouldAnimateNewtabLayoutShift,
    captureRecentCardLayout,
    applyRecentGridColumns,
    applyBookmarkGridColumns,
    keepBookmarkPageAnchorAfterLimitChange,
    renderCurrentBookmarkPage,
    updateBookmarkGridHeightLock,
    updateBookmarkSectionPosition,
    positionBookmarkCascadeLevels,
    updateSuggestionsFloatingLayout,
    cancelRecentResizeLayoutAnimations,
    renderRecentSites,
    animateRecentResizeLayout,
    viewport: viewportActivity
  });

  NEWTAB_PAGE_KEYBOARD.createPageKeyboard({
    isFolderColorPickerOpen,
    finishRecentCardDrag: recentCardDrag.finishRecentCardDrag,
    dragSessions,
    suggestionsContainer,
    searchBox,
    suggestionModifiers,
    handleSearchTabKey: tabKey.handle,
    dismissStack,
    finishShortcutDrag,
    finishBookmarkDrag,
    performBookmarkMoveHistoryAction,
    suggestionItems,
    numberShortcutOptions
  });

  NEWTAB_SEARCH_INPUT_COMPOSITION.createSearchInputComposition({
    searchBox,
    suggestionSource,
    searchAutocomplete,
    searchQuery,
    directNavigationSettleController,
    imeKeyGuard,
    clearSearchSuggestions,
    getDirectUrlSuggestion,
    renderPendingSuggestions,
    requestSuggestions
  });

  wallpaperRuntime.createControls();
  const feedbackControl = createFeedbackControls();
  document.addEventListener('pointerdown', function(event) {
    if (!isFeedbackPopoverOpen()) {
      return;
    }
    const target = isNode(event.target) ? event.target : null;
    if (target === feedbackControl || feedbackControl.contains(target)) {
      return;
    }
    closeFeedbackPopover();
  }, true);
  document.addEventListener('pointerdown', function(event) {
    if (!wallpaperRuntime.isPanelOpen()) {
      return;
    }
    const target = isNode(event.target) ? event.target : null;
    if (wallpaperRuntime.containsTarget(target)) {
      return;
    }
    wallpaperRuntime.closePanel();
  }, true);
  dismissStack.register('wallpaper-panel', {
    isOpen: wallpaperRuntime.isPanelOpen,
    close: () => {
      // Escape dismisses an open filter menu before it closes the whole panel.
      if (wallpaperRuntime.closeOpenMenu()) {
        return;
      }
      wallpaperRuntime.closePanel({ restoreFocus: true });
    }
  });

  document.body.insertBefore(topContentContainer, root);
  searchLayer.appendChild(inputParts.container);
  root.appendChild(searchLayer);
  const newtabUpdateNoticeAnchor = root.nextSibling;
  document.body.insertBefore(shortcutSection, newtabUpdateNoticeAnchor);
  const updateNotice = notices.update;
  if (updateNotice && updateNotice.element) {
    document.body.insertBefore(updateNotice.element, newtabUpdateNoticeAnchor);
    if (typeof updateNotice.recordExposure === 'function') {
      updateNotice.recordExposure();
    }
  }
  document.body.insertBefore(suggestionsSurface, newtabUpdateNoticeAnchor);
  document.body.insertBefore(suggestionsOutline, newtabUpdateNoticeAnchor);
  document.body.insertBefore(suggestionsContainer, newtabUpdateNoticeAnchor);
  // 等首轮语言解析完成后再创建，避免默认文案在新标签页首帧短暂闪现。
  Promise.all([
    locale.ready,
    updateNotice && updateNotice.ready ? updateNotice.ready : Promise.resolve(false)
  ]).then(() => {
    if (notices.engagement) {
      return;
    }
    const noticeAnchor = suggestionsSurface.parentNode === document.body
      ? suggestionsSurface
      : newtabUpdateNoticeAnchor;
    const graphicsNotice = createNewtabGraphicsNoticeController();
    notices.mountGraphics(graphicsNotice);
    if (graphicsNotice && graphicsNotice.element) {
      document.body.insertBefore(graphicsNotice.element, noticeAnchor);
    }
    const engagementNotice = createNewtabEngagementNoticeController();
    notices.mountEngagement(engagementNotice);
    if (!engagementNotice || !engagementNotice.element) {
      return;
    }
    document.body.insertBefore(engagementNotice.element, noticeAnchor);
    if (String(inputParts.input.value || '').trim() &&
        typeof engagementNotice.recordMeaningfulUse === 'function') {
      engagementNotice.recordMeaningfulUse();
    }
  });
  if (bookmarkParts.topbar) {
    bookmarkParts.topbar.mount(document.body);
  }
  bottomDockRuntime.mount(document.body);
  const initialQuoteReadyTask = quoteRuntime.mount().catch(() => true);
  const wallpaperControl = wallpaperRuntime.getControlElement();
  if (wallpaperControl) {
    document.body.appendChild(wallpaperControl);
  }
  document.body.appendChild(feedbackControl);

  const {
    scheduleRecentReloadIfVisible,
    scheduleBookmarkReloadIfVisible
  } = NEWTAB_SECTION_RELOAD.createSectionReload({
    bookmarkParts,
    shortcutList,
    loadRecentSites,
    loadBookmarks,
    recentSourceReads,
    markRecentDataDirty,
    bookmarksRuntime,
    refreshShortcutFolderReferences,
    scheduleFolderColorSync,
    markBookmarkTreeDirty,
    bookmarkMoveHistory
  });

  NEWTAB_SEARCH_SETTINGS_SYNC.createSearchSettingsSync({
    suggestionsContainer,
    searchBox,
    modeActions,
    searchResults,
    searchMode,
    searchQuery,
    settings,
    searchEngine,
    renderSuggestions,
    requestSuggestions,
    markRecentDataDirty,
    scheduleRecentReloadIfVisible,
    scheduleBookmarkReloadIfVisible,
    refreshThemeAwareFavicons,
    getImmediateThemeForSuggestion
  });

  window.addEventListener('blur', () => {
    finishShortcutDrag(null, { cancel: true });
    finishBookmarkDrag(null, { canceled: true });
  });
  window.addEventListener('visibilitychange', handleRecentVisibilityChange);
  window.addEventListener('resize', () => adaptiveToneEvents.emit('stale', {}), { passive: true });
  // An open folder menu follows its anchor once per frame while the page
  // scrolls; scroll events run before that frame's animation callbacks, so
  // the menu never trails the page.
  let bookmarkCascadeScrollFrame = 0;
  window.addEventListener('scroll', () => {
    adaptiveToneEvents.emit('stale', {});
    if (bookmarkCascadeScrollFrame || !bookmarkParts.cascade || !bookmarkParts.cascade.isOpen()) {
      return;
    }
    bookmarkCascadeScrollFrame = window.requestAnimationFrame(() => {
      bookmarkCascadeScrollFrame = 0;
      positionBookmarkCascadeLevels();
    });
  }, { passive: true });
  bottomDockRuntime.onScroll(() => adaptiveToneEvents.emit('stale', {}), { passive: true });
  const actionButtonVisibilityReadyPromise = followNewtabActionButtonVisibility();
  const glassStyleReadyPromise = followNewtabGlassStyle();
  const shortcutPreferencesReadyPromise = followNewtabShortcutPreferences();
  followShortcutGridLayout();
  followNewtabSearchWidth();
  followShortcutDockMagnification();
  const shortcutsReadyPromise = shortcutPreferencesReadyPromise.then(() => {
    void loadFolderColors();
    return loadVisibleShortcuts();
  });
  const initialShortcutsReadyTask = shortcutsReadyPromise.catch((error) => {
    console.warn('[Lumno] Deferred shortcut loading failed.', error);
    return [];
  });
  // The search settings join the page's first storage read.
  const sectionPolicyReadyPromise = settings.include(NEWTAB_SEARCH_SETTINGS);
  // The page keeps the stored copy of its settings normalized.
  void repairStoredSettings(settings, storageArea, {
    saved: [
      SearchSettings.tabRankScoreDebug,
      newtabTopContentMode,
      newtabTimeFontWeight,
      newtabTimeSecondsVisible,
      newtabFeedbackButtonVisible,
      newtabAppearanceButtonVisible,
      newtabShortcutsVisible,
      newtabShortcutAddVisible,
      newtabShortcutDockMagnificationEnabled,
      newtabShortcutSize,
      newtabShortcutGap,
      newtabWidthMode,
      recentCount,
      recentMode,
      bookmarkCount,
      bookmarkColumns,
      bookmarkFolderIconsVisible
    ],
    // A missing column count is worked out from the older width setting.
    invalidOnly: [
      newtabShortcutColumns,
      SearchSettings.searchResultPriority,
      SearchSettings.searchResultDisplayLimit,
      SearchSettings.faviconEnhancedFetchEnabled,
      newtabTimeFont,
      bookmarkViewMode
    ]
  });
  const initialLanguageReadyTask = followLanguage();
  const initialMotionPreferenceReadyTask = readBootValue('motionPreferenceReady');
  const initialFontsReadyTask = document.fonts && document.fonts.ready &&
    typeof document.fonts.ready.then === 'function'
      ? document.fonts.ready.catch(() => true)
      : Promise.resolve(true);
  webAppearance.load();
  Promise.all([
    initialAppearanceReadyTask,
    initialBookmarkTopbarLayoutReady,
    followBookmarkViewMode(),
    followZenMode(),
    actionButtonVisibilityReadyPromise,
    glassStyleReadyPromise,
    initialMotionPreferenceReadyTask,
    initialLanguageReadyTask,
    sectionPolicyReadyPromise,
    initialShortcutsReadyTask,
    recentSitesReadyTask,
    initialFontsReadyTask,
    initialTimeFontReadyTask,
    initialQuoteReadyTask
  ]).catch((error) => {
    console.warn('[Lumno] Initial new tab layout setup failed.', error);
  }).then(() => {
    const { recent: recentSitesReadyTask, bookmarks: bookmarksReadyTask } = startSectionDataPass();
    const releaseSourceReads = () => recentSourceReads.release();
    recentSitesReadyTask.then(releaseSourceReads, releaseSourceReads);
    return Promise.all([recentSitesReadyTask, bookmarksReadyTask]);
  }).catch((error) => {
    console.warn('[Lumno] Initial new tab content setup failed.', error);
  }).then(() => {
    // The wallpaper leads: content enters once its tones are on the controls.
    return wallpaperRuntime.waitForInitialWallpaperTone();
  }).then(() => {
    maybeShowFileAccessNotice();
    markNewtabReady();
  });
  updateBookmarkSectionPosition();

})();
