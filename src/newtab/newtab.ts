import * as NEWTAB_PAGE_KEYBOARD from './page-keyboard';
import { loadNewtabLocaleMessages } from './page-language';
import { SurfaceLocale } from '../shared/i18n/surface-locale';
import * as NEWTAB_PAGE_RESIZE from './page-resize';
import * as NEWTAB_STARTUP_STORAGE from './startup-storage';
import * as NEWTAB_GLASS_SURFACES from './theme/glass-surfaces';
import { isNode } from '../shared/dom-guards';
import { bookmarkColumns, bookmarkCount, bookmarkFolderIconsVisible, bookmarkViewMode, newtabOpenInNewTab, newtabSearchWidth, newtabShortcutColumns, newtabWidthMode, overlayTabPriority, recentCount, recentMode, simpleModeEnabled } from '../domain/settings';
import { SYNCED_PAGE_STORAGE_KEYS } from './newtab-config';
import { readBootValue } from '../platform/boot-handoff';
import { createPageStructure } from './react/page-structure';
import { newtabShortcutAddVisible, newtabShortcutDockMagnificationEnabled, newtabShortcutGap, newtabShortcutSize, newtabShortcutsVisible } from '../domain/settings/newtab-shortcuts';
import { getContextSettingsStore } from '../platform/settings-store';
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
import { createSectionsFeature } from './features/sections';
import { createDragsFeature } from './features/drags';
import { createSectionViewsFeature } from './features/section-views';
import { createSearchUiFeature } from './features/search-ui';

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
  // The wordmark or clock above the search box, drawn by the top content runtime.
  const topContentContainer = pageStructureRuntime.topContent;
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
    dismissStack,
    dragSessions,
    faviconCacheRuntime,
    hideToast,
    searchBox,
    webAppearance
  } = shellFeature;
  const bookmarkStoreFeature = createBookmarkStoreFeature(ctx);
  const {
    bookmarkParts,
    bookmarksShown
  } = bookmarkStoreFeature;
  const shortcutStoreFeature = createShortcutStoreFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature });
  const {
    loadVisibleShortcuts
  } = shortcutStoreFeature;
  const transfersFeature = createTransfersFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, shortcutStore: shortcutStoreFeature });
  const {
    performBookmarkMoveHistoryAction
  } = transfersFeature;
  const navigationFeature = createNavigationFeature(ctx, { shell: shellFeature });
  const {
    closeFeedbackPopover,
    createFeedbackControls,
    isFeedbackPopoverOpen
  } = navigationFeature;
  const searchCoreFeature = createSearchCoreFeature(ctx, { shell: shellFeature, shortcutStore: shortcutStoreFeature, navigation: navigationFeature });
  const {
    modeActions,
    scheduleThemeResolutionFlush,
    suggestionModifiers
  } = searchCoreFeature;
  const recentCoreFeature = createRecentCoreFeature(ctx, { shell: shellFeature, shortcutStore: shortcutStoreFeature, navigation: navigationFeature, searchCore: searchCoreFeature });
  const {
    recentShown,
    recentSitesReadyTask,
    recentSourceReads
  } = recentCoreFeature;
  const bookmarkMenusFeature = createBookmarkMenusFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, shortcutStore: shortcutStoreFeature, transfers: transfersFeature, navigation: navigationFeature });
  const {
    initialBookmarkTopbarLayoutReady,
    isFolderColorPickerOpen,
    loadFolderColors,
    positionBookmarkCascadeLevels,
    syncBookmarkTopbarSurfaceAppearance
  } = bookmarkMenusFeature;
  const themeFeature = createThemeFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, navigation: navigationFeature, bookmarkMenus: bookmarkMenusFeature, searchCore: searchCoreFeature, recentCore: recentCoreFeature });
  const {
    followLanguage,
    notices,
    refreshThemeAwareFavicons,
    scheduleThemeAwareFaviconRescue,
    syncSystemThemeMode
  } = themeFeature;
  const shortcutMenusFeature = createShortcutMenusFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, shortcutStore: shortcutStoreFeature, navigation: navigationFeature, bookmarkMenus: bookmarkMenusFeature });
  const {
    followShortcutDockMagnification
  } = shortcutMenusFeature;
  const layoutFeature = createLayoutFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, shortcutStore: shortcutStoreFeature, shortcutMenus: shortcutMenusFeature, recentCore: recentCoreFeature });
  const {
    applyBookmarkGridColumns,
    applyNewtabShortcutColumns,
    applyNewtabWidthMode,
    applyRecentGridColumns,
    followNewtabSearchWidth,
    followShortcutGridLayout,
    getBookmarkLimit,
    keepBookmarkPageAnchorAfterLimitChange,
    rememberSearchEntryViewport,
    updateBookmarkSectionPosition,
    updateSuggestionsFloatingLayout,
    viewportActivity
  } = layoutFeature;
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

  migrateLocalSettingsIfNeeded(SYNCED_PAGE_STORAGE_KEYS.slice());

  const suggestionsSurface = pageStructureRuntime.suggestions.surface;
  const suggestionsOutline = pageStructureRuntime.suggestions.outline;

  const sectionsFeature = createSectionsFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, bookmarkMenus: bookmarkMenusFeature, layout: layoutFeature });
  const {
    followBookmarkViewMode,
    renderCurrentBookmarkPage,
    updateBookmarkGridHeightLock
  } = sectionsFeature;
  const dragsFeature = createDragsFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, shortcutStore: shortcutStoreFeature, transfers: transfersFeature, navigation: navigationFeature, bookmarkMenus: bookmarkMenusFeature, shortcutMenus: shortcutMenusFeature, searchCore: searchCoreFeature, recentCore: recentCoreFeature, theme: themeFeature, layout: layoutFeature, sections: sectionsFeature });
  const {
    finishBookmarkDrag,
    finishShortcutDrag,
    followNewtabShortcutPreferences,
    recentCardDrag
  } = dragsFeature;
  const sectionViewsFeature = createSectionViewsFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, shortcutStore: shortcutStoreFeature, navigation: navigationFeature, bookmarkMenus: bookmarkMenusFeature, searchCore: searchCoreFeature, recentCore: recentCoreFeature, theme: themeFeature, layout: layoutFeature, topContent: topContentFeature, sections: sectionsFeature, drags: dragsFeature });
  const {
    bottomDockRuntime,
    handleRecentVisibilityChange,
    renderRecentSites,
    startSectionDataPass
  } = sectionViewsFeature;
  const searchUiFeature = createSearchUiFeature(ctx, { shell: shellFeature, bookmarkStore: bookmarkStoreFeature, shortcutStore: shortcutStoreFeature, navigation: navigationFeature, bookmarkMenus: bookmarkMenusFeature, shortcutMenus: shortcutMenusFeature, searchCore: searchCoreFeature, recentCore: recentCoreFeature, theme: themeFeature, layout: layoutFeature, topContent: topContentFeature, wallpaper: wallpaperFeature, sectionViews: sectionViewsFeature });
  const {
    createNewtabEngagementNoticeController,
    createNewtabGraphicsNoticeController,
    followNewtabActionButtonVisibility,
    followZenMode,
    inputParts,
    maybeShowFileAccessNotice,
    numberShortcutOptions,
    suggestionItems,
    tabKey
  } = searchUiFeature;
  // Kick off favicon cache warmup early; theme tint work flushes when storage is ready.
  void faviconCacheRuntime.ensureCachesReady().then(() => {
    scheduleThemeResolutionFlush(0);
    refreshThemeAwareFavicons();
    scheduleThemeAwareFaviconRescue();
  });

  renderNewtabTopContent(!shouldSkipNewtabEntryMotion());
  applyNewtabTopContentVisibility();

  const {
    followNewtabGlassStyle
  } = NEWTAB_GLASS_SURFACES.createGlassSurfaces({
    settings,
    syncBookmarkTopbarSurfaceAppearance
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
