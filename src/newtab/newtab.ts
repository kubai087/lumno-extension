import * as FOLDER_BINDINGS from '../platform/bookmark-folder-bindings';
import * as LumnoBrowserProfile from '../platform/browser-profile';
import * as LumnoCommunityLinks from '../platform/community-links';
import * as LumnoShortcutFaviconStore from '../platform/shortcut-favicon-store';
import * as LumnoBrowserIcons from '../platform/browser-icons';
import * as PROGRESS_HISTORY from '../domain/progress-history';
import * as PROGRESS_MATCH from '../domain/progress-match';
import * as LumnoImeKeyGuard from '../domain/search/ime-key-guard';
import * as SEARCH_INPUT_HISTORY from '../domain/search/search-input-history';
import * as SUGGESTION_NAVIGATION from '../shared/search/suggestion-navigation';
import * as SITE_DISPLAY_NAME from '../domain/site-display-name';
import * as NEWTAB_APPEARANCE_MODES from './appearance-modes';
import * as NEWTAB_BOOKMARK_ACTIONS from './bookmarks/bookmark-actions';
import * as NEWTAB_BOOKMARK_CASCADE_ACTIONS from './bookmarks/bookmark-cascade-actions';
import * as NEWTAB_BOOKMARK_CONTEXT_MENU from './bookmarks/bookmark-context-menu';
import * as NEWTAB_BOOKMARK_DISPLAY_SETTINGS from './bookmarks/bookmark-display-settings';
import * as NEWTAB_BOOKMARK_DRAG_CONTROLLER from './bookmarks/bookmark-drag-controller';
import * as NEWTAB_BOOKMARK_FOLDER_ICON from './bookmarks/bookmark-folder-icon';
import * as NEWTAB_BOOKMARK_MOVE_HISTORY from './bookmarks/bookmark-move-history';
import * as NEWTAB_BOOKMARK_PAGER from './bookmarks/bookmark-pager';
import * as NEWTAB_BOOKMARK_SECTION from './bookmarks/bookmark-section';
import * as NEWTAB_BOOKMARKS_RUNTIME from './bookmarks/bookmarks-runtime';
import * as NEWTAB_BOOKMARKS_STORE from './bookmarks/bookmarks-store';
import * as NEWTAB_FOLDER_COLORS from './bookmarks/folder-colors';
import * as LumnoNewtabFolderItemIcons from './bookmarks/folder-item-icons';
import * as NEWTAB_CARD_ACTIVATION_GUARD from './card-activation-guard';
import * as NEWTAB_CLIPBOARD_ACTIONS from './clipboard-actions';
import * as LumnoNewtabDismissStack from './dismiss-stack';
import * as NEWTAB_ENTRY_MOTION from './entry-motion';
import * as NEWTAB_FEEDBACK_CONTROL_RUNTIME from './feedback-control';
import * as NEWTAB_INPUT_FOCUS from './input-focus';
import * as NEWTAB_MODE_COMMANDS from './mode-commands';
import * as NEWTAB_PAGE_KEYBOARD from './page-keyboard';
import { loadNewtabLocaleMessages } from './page-language';
import { SurfaceLocale } from '../shared/i18n/surface-locale';
import * as SearchDirectNavigation from '../domain/search/utils/direct-navigation';
import * as NEWTAB_PAGE_LAYOUT from './page-layout';
import * as NEWTAB_PAGE_NAVIGATION from './page-navigation';
import * as NEWTAB_PAGE_NOTICES from './page-notices';
import * as NEWTAB_PAGE_PREFERENCES from './page-preferences';
import * as NEWTAB_PAGE_RESIZE from './page-resize';
import * as LumnoNewtabPageState from './page-state';
import * as NEWTAB_RECENT_CARD_DRAG from './recent/recent-card-drag';
import * as NEWTAB_RECENT_SECTION from './recent/recent-section';
import * as NEWTAB_RECENT_SITES_CONTROLLER from './recent/recent-sites-controller';
import * as NEWTAB_RECENT_SOURCES from './recent/recent-sources';
import * as NEWTAB_SEARCH_BOX_CONTROLS from './search/search-box-controls';
import * as NEWTAB_SEARCH_BOX from './search/search-box';
import * as NEWTAB_SEARCH_INPUT_COMPOSITION from './search/search-input-composition';
import * as NEWTAB_SEARCH_MODE_CONTROLLER from './search/search-mode-controller';
import * as NEWTAB_SEARCH_NAVIGATION from './search/search-navigation';
import * as NEWTAB_SEARCH_SETTINGS_SYNC from './search/search-settings-sync';
import * as NEWTAB_SITE_SEARCH_PROVIDERS from './search/site-search-providers';
import * as NEWTAB_SITE_SEARCH_RUNTIME from './search/site-search-runtime';
import * as NEWTAB_SUGGESTIONS_CONTROLLER from './search/suggestions-controller';
import * as NEWTAB_SUGGESTIONS_LAYOUT from './search/suggestions-layout';
import * as NEWTAB_SECTION_HEADERS from './section-headers';
import * as NEWTAB_SECTION_LOADERS from './section-loaders';
import * as NEWTAB_BOOKMARK_MODE_MENU from './bookmarks/bookmark-mode-menu';
import * as LumnoNewtabSectionPanelSettings from './section-panel-settings';
import * as NEWTAB_SECTION_RELOAD from './section-reload';
import * as NEWTAB_BOTTOM_DOCK_RUNTIME from './shortcuts/bottom-dock-runtime';
import * as NEWTAB_SHORTCUT_CONTEXT_MENU from './shortcuts/shortcut-context-menu';
import * as NEWTAB_SHORTCUT_DOCK from './shortcuts/shortcut-dock';
import * as NEWTAB_SHORTCUT_DRAG from './shortcuts/shortcut-drag';
import * as NEWTAB_SHORTCUT_ICON_STORE from './shortcuts/shortcut-icon-store';
import * as NEWTAB_SHORTCUT_PAGE_ACTIONS from './shortcuts/shortcut-page-actions';
import * as NEWTAB_SHORTCUTS_CONTROLLER from './shortcuts/shortcuts-controller';
import * as NEWTAB_STARTUP_PREFERENCES from './startup-preferences';
import * as NEWTAB_STARTUP_STORAGE from './startup-storage';
import * as NEWTAB_CARD_THEMES from './theme/card-themes';
import { buildFallbackThemeForHost, createDefaultTheme, createUrlHighlightTheme, defaultAccentColor } from '../shared/favicon/favicon-theme';
import { extractAverageColor } from '../shared/favicon/average-color';
import { getBrandAccentForUrl, normalizeHost } from '../domain/favicon/brand-accents';
import { getReadableTextColor, mixColor, parseCssColor, rgbToCss, rgbToCssAlpha, rgbToCssParts, stableHashCode } from '../domain/color';
import * as NEWTAB_GLASS_SURFACES from './theme/glass-surfaces';
import * as NEWTAB_PAGE_FAVICONS from './theme/page-favicons';
import * as NEWTAB_SITE_THEME_RESOLVER from './theme/site-theme-resolver';
import * as NEWTAB_SYSTEM_THEME from './theme/system-theme';
import * as NEWTAB_TOOLTIP_BINDINGS from './tooltip-bindings';
import * as NEWTAB_TOOLTIP_CONTROLLERS from './tooltip-controllers';
import * as LumnoNewtabQuotes from './top-content/quotes';
import * as NEWTAB_TOP_CONTENT_RUNTIME from './top-content/top-content';
import * as NEWTAB_URL_POLICY from './url-policy';
import * as NEWTAB_VIEWPORT_INSETS from './viewport-insets';
import * as NEWTAB_WALLPAPER_PAGE from './wallpaper/wallpaper-page';
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
import {
  SYNCED_PAGE_STORAGE_KEYS,
  WORDMARK_ENTRY_ANIMATION_NAME,
  createSiteDisplayNameOptions
} from './newtab-config';
import { SiteSearchIconCache } from '../shared/search/site-search-icon-cache';
import { DefaultSearchEngine } from '../shared/search-panel/default-engine';
import { SiteSearchCatalog } from '../shared/search-panel/site-search/catalog';
import type { BackgroundAction, BackgroundReply, BackgroundRequest } from '../domain/messages';
import type { Disposition } from '../domain/navigation-disposition';
import type { SuggestionElement } from '../shared/react/search/suggestion-list/types';
import type { BookmarkCardElement } from './react/bookmarks';
import type { RecentCardElement } from './react/recent-sites';
import type { ShortcutTileElement } from './react/shortcuts';
import { readBootValue } from '../platform/boot-handoff';
import { createToastController } from '../shared/react/toast';
import { createSelectMenuController } from './react/select-menu';
import { createTopContentController } from './react/wordmark';
import { createPageStructure } from './react/page-structure';
import { createSearchInput } from '../shared/react/search-input';
import { newtabShortcutAddVisible, newtabShortcutDockMagnificationEnabled, newtabShortcutGap, newtabShortcutSize, newtabShortcutsVisible } from '../domain/settings/newtab-shortcuts';
import { newtabShortcutFaviconCache, shortcutFolderBindings } from '../domain/settings/newtab-shortcuts';
import { createSettingPort, createSettingsStore, getContextSettingsStore } from '../platform/settings-store';
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
import * as NewtabShortcutSettings from '../domain/settings/newtab-shortcuts';
import * as FaviconBrowserIconIndex from '../domain/favicon/browser-icon-index';
import * as BundledIcons from '../domain/favicon/shortcut-favicon/bundled-icons';
import * as ShortcutIconCache from '../domain/favicon/shortcut-favicon/persisted';
import { SearchQuery } from '../shared/search-panel/search-query';
import { SuggestionSource } from '../shared/search-panel/suggestion-source';
import { SuggestionModifiers } from '../shared/search-panel/suggestion-modifiers';
import { SiteSearchRunner } from '../shared/search-panel/site-search/runner';
import { SearchModeMenu } from '../shared/search-panel/mode-menu';
import { SearchModeActions } from '../shared/search-panel/mode-actions';
import { SearchModeMenuOrder } from '../shared/search-panel/mode-menu-order';
import { SearchMatching } from '../shared/search-panel/matching';
import { SearchResults } from '../shared/search-panel/search-results';
import { SearchMode } from '../shared/search-panel/search-mode';
import { SearchAutocomplete } from '../shared/search-panel/autocomplete';
import type { SiteSearchProvider } from '../domain/search/types';
import type { Suggestion } from '../shared/react/search/suggestion-list/types';
import { BOOKMARK_TOPBAR_LAYOUT_ACTION, BOOKMARK_TOPBAR_PICK_COLOR_ACTION, BOOKMARK_TOPBAR_SURFACE_MODE_ACTION } from './menu-values';
import { ResultActivation } from '../shared/search-panel/result-activation';
import { SearchTabKey } from '../shared/search-panel/tab-key';
import { ViewportActivity } from './viewport-activity';
import { RecentPointer } from './recent/recent-pointer';
import { getPagePortals } from './app/portals';
import { SearchBoxParts } from './search/search-box-parts';
import { OpenTabs } from '../shared/search-panel/open-tabs';
import { PageNoticeControllers } from './notice-controllers';
import { AppliedThemeMode } from './theme/applied-theme-mode';
import { ShortcutList } from './shortcuts/shortcut-list';
import { BottomDockParts } from './shortcuts/bottom-dock-parts';
import * as SUGGESTION_INPUT_PREVIEW from '../domain/search/suggestion-input-preview';

(function() {
  // Page state shared with the modules split out of this file: each module
  // receives this one object as `pageState` and reads and writes the same
  // properties this file does. page-state.ts lists its initial values.
  const pageState = LumnoNewtabPageState.createPageState();
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
  // The search box's parts, mounted by the search box below.
  const searchBox = new SearchBoxParts();
  // The search suggestion the arrows show in the input.
  const suggestionInputPreview = SUGGESTION_INPUT_PREVIEW.createSuggestionInputPreview();
  // The window's tabs, which results switch to.
  const openTabs = new OpenTabs([], null);
  // The page's notices and feature hints, mounted by the parts that make them.
  const notices = new PageNoticeControllers();
  // The theme mode the page is drawn in.
  const appliedTheme = new AppliedThemeMode();
  // The shortcuts the page shows and their icons.
  const shortcutList = new ShortcutList();
  // The bottom dock's parts and the layout it drives, mounted with the dock.
  const bottomDockParts = new BottomDockParts();


  const startupRecentSourceReadsAt = Date.now();

  const {
    openRecentHistoryDialog,
    readRecentOpenTabs,
    readRecentTopSites,
    readRecentHistoryItems,
    releaseStartupRecentSourceReads,
    getRecentSites
  } = NEWTAB_RECENT_SOURCES.createRecentSources({
    settings,
    t: (...args) => t(...args),
    getRecentContextMenuOptions: (...args) => getRecentContextMenuOptions(...args),
    restoreProgressVersion: (...args) => restoreProgressVersion(...args),
    showToast: (...args) => showToast(...args),
    startupRecentSourceReadsAt,
    getRecentStoreOptions: (...args) => getRecentStoreOptions(...args),
    isBrowserPageRecentUrl: (...args) => isBrowserPageRecentUrl(...args),
    pageState
  });

  pageState.startupRecentSourceReads = {
    historyItems: readRecentHistoryItems(),
    topSites: readRecentTopSites(),
    tabs: readRecentOpenTabs()
  };

  const localStorageArea = (chrome && chrome.storage && chrome.storage.local)
    ? chrome.storage.local
    : storageArea;
  function getExtensionResourceUrl(resourcePath: unknown): string {
    const normalizedPath = String(resourcePath || '').replace(/^\/+/, '');
    if (chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
      return chrome.runtime.getURL(normalizedPath);
    }
    const baseUrl = document.baseURI || window.location.href;
    return new URL(`../../${normalizedPath}`, baseUrl).href;
  }
  function sendRuntimeMessage<A extends BackgroundAction>(
    message: BackgroundRequest<A>,
    callback?: (reply: BackgroundReply<A> | undefined) => void
  ): boolean {
    if (typeof chrome === 'undefined' ||
        !chrome.runtime ||
        typeof chrome.runtime.sendMessage !== 'function') {
      return false;
    }
    try {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, message, callback);
      return true;
    } catch {
      return false;
    }
  }

  const {
    getNewtabVisualViewportInsets
  } = NEWTAB_VIEWPORT_INSETS.createViewportInsets();

  const BROWSER_PROFILE = LumnoBrowserProfile;
  const COMMUNITY_LINKS = LumnoCommunityLinks;
  // Escape closes only the top open layer (menus, popovers, panels, drags).
  // The folder color dialog handles its own Escape.
  const dismissStack = LumnoNewtabDismissStack.getDismissStack();
  dismissStack.setShouldIgnore(() => Boolean(pageState.folderColorPicker && pageState.folderColorPicker.isOpen()));

  // The page's language; it follows the stored choice from the first read.
  const locale = new SurfaceLocale(settings, loadNewtabLocaleMessages);
  locale.follow();
  const { t, formatMessage } = locale;
  const sanitizeDisplayText = SearchDirectNavigation.sanitizeDisplayText;

  const {
    getFeedbackLinks,
    getFeedbackControl,
    getFeedbackButton,
    getFeedbackWebLocale,
    openFeedbackExternalUrl,
    updateFeedbackLanguageStrings,
    isFeedbackPopoverOpen,
    closeFeedbackPopover,
    createFeedbackControls
  } = NEWTAB_FEEDBACK_CONTROL_RUNTIME.createFeedbackControlRuntime({
    locale,
    t,
    openExternalNewTabUrl: (...args) => openExternalNewTabUrl(...args),
    hideTopActionTooltip: (...args) => hideTopActionTooltip(...args),
    showTopActionTooltip: (...args) => showTopActionTooltip(...args)
  });

  const SITE_DISPLAY_NAME_OPTIONS = createSiteDisplayNameOptions(t);
  function initFolderPathMorph(icon: Element | null | undefined): void {
    NEWTAB_BOOKMARK_FOLDER_ICON.initFolderPathMorph(icon);
    applySavedFolderColor(icon || null);
  }
  const playFolderPathMorph = NEWTAB_BOOKMARK_FOLDER_ICON.playFolderPathMorph;
  const setFolderPathMorphState = NEWTAB_BOOKMARK_FOLDER_ICON.setFolderPathMorphState;
  const bookmarksRuntime = NEWTAB_BOOKMARKS_RUNTIME.createBookmarksRuntime({
    chromeApi: typeof chrome !== 'undefined' ? chrome : null,
    store: NEWTAB_BOOKMARKS_STORE,
    normalizeHost
  });

  // The select menus the shortcut, bookmark and recent site context menus open in.
  const shortcutContextMenuSelectController = createSelectMenuController({
    documentObj: document,
    windowObj: window,
    onBeforeOpen: () => {
      hideShortcutTooltip();
      hideTopActionTooltip();
    },
    getViewportTopInset: () => getNewtabViewportTopPaddingPx()
  });
  const bookmarkContextMenuSelectController = createSelectMenuController({
    documentObj: document,
    windowObj: window,
    onBeforeOpen: () => {
      hideCursorTooltip();
      hideTopActionTooltip();
    },
    getViewportTopInset: () => getNewtabViewportTopPaddingPx()
  });
  const recentContextMenuSelectController = createSelectMenuController({
    documentObj: document,
    windowObj: window,
    onBeforeOpen: () => {
      hideCursorTooltip();
      hideTopActionTooltip();
    },
    getViewportTopInset: () => getNewtabViewportTopPaddingPx()
  });

  const {
    hideToast,
    showToast,
    beginToast,
    copyBookmarkUrl,
    copySearchResultUrl
  } = NEWTAB_CLIPBOARD_ACTIONS.createClipboardActions({
    t,
    toastController: createToastController(document.getElementById('_x_extension_toast_2024_unique_'), getPagePortals(), { windowObj: window })
  });
  const shortcutTiles: ShortcutTileElement[] = [];

  const {
    openBookmarkFolderTabGroupConfirmation,
    openBookmarkEditor
  } = NEWTAB_BOOKMARK_ACTIONS.createBookmarkActions({
    t,
    getBookmarkContextMenuOptions: (...args) => getBookmarkContextMenuOptions(...args),
    bookmarksRuntime,
    openShortcutDialog: (...args) => openShortcutDialog(...args),
    formatMessage,
    showToast,
    isShortcutFolderAnchor: (...args) => isShortcutFolderAnchor(...args),
    getFolderItemIcon: (...args) => getFolderItemIcon(...args),
    getFolderItemIconUrl: (...args) => getFolderItemIconUrl(...args),
    getBrowserPageFaviconUrl: (...args) => getBrowserPageFaviconUrl(...args),
    pageState
  });

  const {
    setShortcutError,
    setShortcutIconError,
    pickShortcutIconPlateColor,
    getShortcutContextMenuOptions,
    updateShortcutLanguageStrings,
    closeShortcutDialog,
    openShortcutDialog,
    getShortcutTileFromNode,
    getShortcutTileId,
    refreshShortcutTileCacheFromDom,
    getShortcutReorderTiles,
    getShortcutById,
    getShortcutTileById,
    handleShortcutNativeDragStart,
    openShortcutEditor,
    isShortcutFolderAnchor
  } = NEWTAB_SHORTCUT_PAGE_ACTIONS.createShortcutPageActions({
    shortcutGrid,
    shortcutSection,
    shortcutList,
    t,
    bindShortcutDialogTooltip: (...args) => bindShortcutDialogTooltip(...args),
    hideShortcutDialogTooltip: (...args) => hideShortcutDialogTooltip(...args),
    readSavedFolderColors: (...args) => readSavedFolderColors(...args),
    saveSavedFolderColors: (...args) => saveSavedFolderColors(...args),
    getShortcutGroups: (...args) => getShortcutGroups(...args),
    bookmarksRuntime,
    getShortcutFolderId: (...args) => getShortcutFolderId(...args),
    createShortcutDialogComponent: (...args) => createShortcutDialogComponent(...args),
    showToast,
    shortcutTiles,
    openBookmarkEditor,
    getShortcutTitle: (...args) => getShortcutTitle(...args),
    getShortcutIconDataUrl: (...args) => getShortcutIconDataUrl(...args)
  });

  const {
    getBookmarkContextMenuOptions,
    isBookmarkContextMenuNode,
    closeBookmarkContextMenu,
    handleBookmarkItemContextMenu
  } = NEWTAB_BOOKMARK_CONTEXT_MENU.createBookmarkContextMenu({
    locale,
    bookmarkContextMenuSelectController,
    bookmarksRuntime,
    t,
    openFolderColorPicker: (...args) => openFolderColorPicker(...args),
    openExternalNewTabUrl: (...args) => openExternalNewTabUrl(...args),
    openBookmarkEditor,
    openBookmarkFolderTabGroupConfirmation,
    deleteBookmarkFromContextTarget: (...args) => deleteBookmarkFromContextTarget(...args),
    hasShortcutForSite: (...args) => hasShortcutForSite(...args),
    addSiteToShortcuts: (...args) => addSiteToShortcuts(...args),
    hasShortcutForBookmarkFolder: (...args) => hasShortcutForBookmarkFolder(...args),
    addBookmarkFolderToShortcuts: (...args) => addBookmarkFolderToShortcuts(...args),
    closeShortcutContextMenu: (...args) => closeShortcutContextMenu(...args),
    closeRecentContextMenu: (...args) => closeRecentContextMenu(...args),
    hideCursorTooltip: (...args) => hideCursorTooltip(...args),
    pageState
  });

  const shortcutFolderRuntime = FOLDER_BINDINGS.createRuntime({
    settingsStore: createSettingsStore({ chromeApi: chrome, settings: [shortcutFolderBindings] })
  });
  shortcutFolderRuntime.ready.catch((error) => {
    console.warn('[Lumno] Could not load shortcut folder bindings.', error);
  });
  const NEWTAB_SHORTCUT_ICONS_STORAGE_KEY = NewtabShortcutSettings.newtabShortcutIcons.key;
  const NEWTAB_SHORTCUT_FAVICON_CACHE_STORAGE_KEY = newtabShortcutFaviconCache.key;
  const siteSearchIconCache = new SiteSearchIconCache(LumnoShortcutFaviconStore.createShortcutFaviconStore({
    chromeApi: typeof chrome !== 'undefined' ? chrome : null,
    storageArea: localStorageArea,
    storageKey: SearchSettings.siteSearchIconCache.key,
    ...ShortcutIconCache.SITE_SEARCH_CACHE_OPTIONS
  }));
  void siteSearchIconCache.load();
  const searchQuery = new SearchQuery();
  const suggestionModifiers = new SuggestionModifiers(settings);
  const siteSearchRunner = new SiteSearchRunner({
    t: (key, fallback) => locale.t(key, fallback),
    showToast: (message, isError) => showToast(message, isError),
    getHelpCenterLocale: () => getHelpCenterLocale(),
    openInCurrentTab: (url) => navigateToUrl(url)
  });
  const resultActivation = new ResultActivation(settings, {
    source: 'newtab',
    enterAction: 'openNewTab',
    isCurrentTabDefault: () => !settings.get(newtabOpenInNewTab).search,
    openInCurrentTab: (url) => navigateToUrl(url)
  });
  const menuOrder = new SearchModeMenuOrder(settings);
  const searchMatching = new SearchMatching({
    settings: settings,
    getUrlDisplay: (url) => getUrlDisplay(url)
  });
  const searchResults = new SearchResults<Suggestion>();
  const suggestionSource = new SuggestionSource(searchQuery, searchResults);
  const searchMode = new SearchMode<SiteSearchProvider>();
  const searchAutocomplete = new SearchAutocomplete({
    settings: settings,
    query: searchQuery,
    getInput: () => (searchBox.inputParts ? searchBox.inputParts.input : null),
    preview: suggestionInputPreview,
    isModeActive: () => Boolean(searchMode.site),
    getUrlDisplay: (url) => getUrlDisplay(url)
  });
  const searchEngine = new DefaultSearchEngine(settings);
  searchEngine.follow();
  const siteSearchCatalog = new SiteSearchCatalog(settings, searchEngine);
  siteSearchCatalog.follow();
  const pageSearchParams = new URLSearchParams(window.location.search || '');
  const {
    mediaQuery,
    resolveTheme,
    addMediaQueryChangeListener,
    removeMediaQueryChangeListener
  } = NEWTAB_SYSTEM_THEME.createSystemTheme(window);

  const {
    followBookmarkTopbar,
    bookmarkTopbarStorageKeys,
    getEffectiveBookmarkTopbarSurfaceMode,
    getBookmarkTopbarLayout,
    syncBookmarkTopbarSurfaceAppearance,
    handleBookmarkModeMenuAction
  } = NEWTAB_BOOKMARK_DISPLAY_SETTINGS.createBookmarkDisplaySettings({
    appliedTheme,
    settings,
    updateBookmarkModeMenu: (...args) => updateBookmarkModeMenu(...args),
    setNewtabTopLayout: (...args) => setNewtabTopLayout(...args),
    scheduleWallpaperAdaptiveToneUpdate: (...args) => scheduleWallpaperAdaptiveToneUpdate(...args),
    showToast,
    t,
    pageState
  });
  const initialBookmarkTopbarLayoutReady = followBookmarkTopbar();
  const recentCards: RecentCardElement[] = [];
  const bookmarkCards: BookmarkCardElement[] = [];
  const suggestionItems: SuggestionElement[] = [];
  // Settles once the entry animation finished or was skipped.
  let finishEntryAnimationWait = (): void => {};
  const newtabEntryAnimationReadyPromise = new Promise<void>((resolve) => {
    finishEntryAnimationWait = resolve;
  });
  // The window's resizes, which hold the layout until they settle.
  const viewportActivity = new ViewportActivity();
  viewportActivity.follow(window);
  const recentPointer = new RecentPointer();
  const bookmarkMoveHistory = NEWTAB_BOOKMARK_MOVE_HISTORY.createBookmarkMoveHistory({ maxEntries: 30 });

  const {
    getShortcutContextMenuTile,
    isShortcutContextMenuOpen,
    isShortcutContextMenuNode,
    clearShortcutContextMenuTileActive,
    applyShortcutContextMenuDockHover,
    closeShortcutContextMenu,
    handleShortcutContextMenu,
    openShortcutAddContextMenu,
    openShortcutGroupMenu
  } = NEWTAB_SHORTCUT_CONTEXT_MENU.createShortcutContextMenu({
    locale,
    shortcutContextMenuSelectController,
    shortcutSection,
    setShortcutContextMenuMark: (mark) => setShortcutContextMenuMark(mark),
    getShortcutDockIcon: (...args) => getShortcutDockIcon(...args),
    setShortcutDockHover: (...args) => setShortcutDockHover(...args),
    resetShortcutDockHover: (...args) => resetShortcutDockHover(...args),
    getShortcutTileFromNode,
    getShortcutById,
    hideShortcutAddFromContextMenu: (...args) => hideShortcutAddFromContextMenu(...args),
    openFolderColorPicker: (...args) => openFolderColorPicker(...args),
    getShortcutFolderId: (...args) => getShortcutFolderId(...args),
    openShortcutEditor,
    openShortcutUrl: (...args) => openShortcutUrl(...args),
    openExternalNewTabUrl: (...args) => openExternalNewTabUrl(...args),
    removeShortcutById: (...args) => removeShortcutById(...args),
    openBookmarkFolderTabGroupConfirmation,
    t,
    getShortcutContextMenuOptions,
    closeRecentContextMenu: (...args) => closeRecentContextMenu(...args),
    hideShortcutTooltip: (...args) => hideShortcutTooltip(...args),
    getShortcutTileId,
    openShortcutGroupDialog: (...args) => openShortcutGroupDialog(...args),
    openShortcutAddDialog: (...args) => openShortcutAddDialog(...args),
    moveShortcutGroup: (...args) => moveShortcutGroup(...args),
    deleteShortcutGroup: (...args) => deleteShortcutGroup(...args),
    confirmDeleteShortcutGroupWithSites: (...args) => confirmDeleteShortcutGroupWithSites(...args)
  });

  const {
    getShortcutDockIcon,
    applyNewtabShortcutDockMagnification,
    resetShortcutDockHover,
    setShortcutDockHover,
    handleShortcutDockPointerOver,
    handleShortcutDockPointerMove,
    syncShortcutDockFolderMenu,
    followShortcutDockMagnification
  } = NEWTAB_SHORTCUT_DOCK.createShortcutDock({
    getShortcutContextMenuTile,
    shortcutGrid,
    settings,
    preview,
    isShortcutDragActive: (...args) => isShortcutDragActive(...args),
    isBookmarkDragActive: () => isBookmarkDragActive() ||
      Boolean(pageState.recentCardDragRuntime && pageState.recentCardDragRuntime.isRecentCardDragActive()),
    isShortcutContextMenuOpen,
    applyShortcutContextMenuDockHover,
    clearShortcutContextMenuTileActive,
    getShortcutTileFromNode
  });

  const shortcutGroupHeaders: HTMLElement[] = [];

  const {
    getProviderFaviconPageUrl,
    getProviderIcon,
    createAggregateSearchScopeProvider,
    getProviderHost,
  } = NEWTAB_SITE_SEARCH_PROVIDERS.createSiteSearchProviders({
    getPageFaviconUrlResolver: (...args) => getPageFaviconUrlResolver(...args),
    siteSearchIconCache,
    getExtensionResourceUrl
  });

  const defaultTheme = createDefaultTheme();
  const modeActions = new SearchModeActions<SiteSearchProvider>({
    settings,
    locale,
    mode: searchMode,
    query: searchQuery,
    autocomplete: searchAutocomplete,
    surface: {
      getInput: () => (searchBox.inputParts ? searchBox.inputParts.input : null),
      getModeController: () => searchBox.modeController,
      defaultTheme,
      getImmediateTheme: () => defaultTheme,
      getThemeForProvider: (provider) => getThemeForProvider(provider),
      cancelRequests: () => suggestionSource.cancel(),
      clearResults: () => clearSearchSuggestions()
    }
  });
  const modeMenu = new SearchModeMenu({
    settings,
    locale,
    catalog: siteSearchCatalog,
    engine: searchEngine,
    iconCache: siteSearchIconCache,
    order: menuOrder,
    mode: searchMode,
    actions: modeActions,
    surface: {
      getInput: () => (searchBox.inputParts ? searchBox.inputParts.input : null),
      getModeController: () => searchBox.modeController,
      getProviderIcon: (provider) => getProviderIcon(provider)
    }
  });
  const urlHighlightTheme = createUrlHighlightTheme();

  const {
    normalizeFaviconHost,
    isFaviconProxyUrl,
    themeColorCache,
    themeHostCache,
    getHostFromUrl,
    getCanonicalPageUrlForFavicon,
    normalizeAccentRgb,
    normalizeThemeConfidence,
    getThemeSourcePriority,
    getThemeSource,
    buildThemeFromAccent,
    isLowConfidenceTheme,
    isPersistableTheme,
    getProviderThemeHost,
    getThemeHostForSuggestion,
    setResolvedThemeForHost,
    getThemeForProvider,
    getThemeForSuggestion,
    getTileThemeOnSiteChange,
    getImmediateThemeForSuggestion,
    shouldUseUrlFallbackThemeForSuggestion,
    scheduleThemeResolutionFlush,
    queueThemeForTarget,
    isNewtabDarkMode,
    getThemeForMode,
    getHoverColors,
    getNeutralHoverActionColors,
    applyThemeVariables,
    applyMarkVariables
  } = NEWTAB_SITE_THEME_RESOLVER.createSiteThemeResolver({
    modeActions,
    searchMode,
    normalizeHost,
    parseCssColor,
    defaultAccentColor,
    defaultTheme,
    getProviderHost,
    setPersistedSiteThemeEntry: (...args) => setPersistedSiteThemeEntry(...args),
    getPersistedSiteThemeEntry: (...args) => getPersistedSiteThemeEntry(...args),
    getPageFaviconUrlResolver: (...args) => getPageFaviconUrlResolver(...args),
    getBrandAccentForUrl,
    extractAverageColor,
    getProviderIcon,
    isHostFaviconVisitDirty: (...args) => isHostFaviconVisitDirty(...args),
    stableHashCode,
    getThemeSourceForSuggestion: (...args) => getThemeSourceForSuggestion(...args),
    areFaviconRenderCachesReady: (...args) => areFaviconRenderCachesReady(...args),
    pageState
  });

  // Firefox: index the browser's own cached icons, which stand in for the
  // missing _favicon endpoint (see createBrowserIconIndex).
  pageState.firefoxBrowserIcons = BROWSER_PROFILE.isFirefoxExtensionRuntime()
    ? FaviconBrowserIconIndex.createBrowserIconIndex()
    : null;
  pageState.firefoxBrowserIconsReady = pageState.firefoxBrowserIcons
    ? LumnoBrowserIcons.loadBrowserIcons(pageState.firefoxBrowserIcons, chrome).catch(() => {})
    : Promise.resolve();
  const {
    getUrlDisplay,
    isBrowserPageRecentUrl,
    isOwnExtensionUrl,
    getOwnExtensionPageDisplay,
    getExtensionFaviconUrl,
    getGstaticFaviconUrl,
    getChromeFaviconUrl,
    getBrowserPageFaviconUrl,
    getPageFaviconCandidateUrl,
    getPageFaviconRenderCandidates,
    isLocalNetworkHost,
    shouldBlockFaviconForHost,
    shouldAvoidDirectFaviconForHost,
    isUrlBlockedByFaviconRequestBlacklist,
    getNewtabStrictFaviconReason,
    isNewtabEnhancedFaviconFetchEnabled,
    filterBlacklistedSuggestions,
    limitSuggestionsForDisplay,
    shouldExcludeFromRecentSites
  } = NEWTAB_URL_POLICY.createUrlPolicy({
    settings,
    t,
    getPageFaviconUrlResolver: (...args) => getPageFaviconUrlResolver(...args),
    getBrowserIconUrl: pageState.firefoxBrowserIcons ? pageState.firefoxBrowserIcons.get : undefined
  });

  const { isCardActivationSuppressed } = NEWTAB_CARD_ACTIVATION_GUARD.createCardActivationGuard({ documentObj: document });

  const {
    followStoredSites,
    getPinnedRecentSites,
    getHiddenRecentSites,
    getRecentContextMenuOptions,
    closeRecentContextMenu,
    handleRecentCardContextMenu,
    getRecentStoreOptions,
    getRecentSiteUrlKey,
    writeHiddenRecentSites,
    isRecentSiteHidden,
    normalizeRecentSiteRecord,
    isRecentSitePinned,
    mergeRecentSitesWithPinned,
    togglePinnedRecentSite,
    getRecentProgressState,
    toggleRecentProgressTracking,
    restoreProgressVersion
  } = NEWTAB_RECENT_SITES_CONTROLLER.createRecentSitesController({
    locale,
    recentContextMenuSelectController,
    settings,
    t,
    showToast,
    openExternalNewTabUrl: (...args) => openExternalNewTabUrl(...args),
    hasShortcutForSite: (...args) => hasShortcutForSite(...args),
    addSiteToShortcuts: (...args) => addSiteToShortcuts(...args),
    closeShortcutContextMenu,
    closeBookmarkContextMenu,
    canDismissRecentCard: (...args) => canDismissRecentCard(...args),
    hideCursorTooltip: (...args) => hideCursorTooltip(...args),
    hideTopActionTooltip: (...args) => hideTopActionTooltip(...args),
    normalizeHost,
    getCanonicalPageUrlForFavicon,
    sanitizeDisplayText,
    getSiteDisplayName,
    shouldExcludeFromRecentSites,
    isBrowserPageRecentUrl,
    renderRecentSites: (...args) => renderRecentSites(...args),
    progressMatch: PROGRESS_MATCH,
    progressHistory: PROGRESS_HISTORY,
    openProgressHistory: (item) => openRecentHistoryDialog(item),
    pageState
  });
  const recentSitesReadyTask = followStoredSites();

  const {
    openBookmarkCascadeMenu,
    closeBookmarkCascadeMenu,
    positionBookmarkCascadeLevels,
    getTopBookmarks
  } = NEWTAB_BOOKMARK_CASCADE_ACTIONS.createBookmarkCascadeActions({
    bookmarksRuntime,
    t,
    pageState
  });

  const {
    applySavedFolderColor,
    readSavedFolderColors,
    saveSavedFolderColors,
    scheduleFolderColorSync,
    loadFolderColors,
    openFolderColorPicker
  } = NEWTAB_FOLDER_COLORS.createFolderColors({
    settings,
    bookmarksRuntime,
    closeBookmarkCascadeMenu,
    closeShortcutDialog,
    hideCursorTooltip: (...args) => hideCursorTooltip(...args),
    t,
    playFolderPathMorph,
    bindShortcutDialogTooltip: (...args) => bindShortcutDialogTooltip(...args),
    hideShortcutDialogTooltip: (...args) => hideShortcutDialogTooltip(...args),
    showToast,
    pageState
  });
  const shortcutIconStore = NEWTAB_SHORTCUT_ICON_STORE.createShortcutIconStore({
    documentObj: document,
    windowObj: window,
    storageArea: localStorageArea,
    storageKey: NEWTAB_SHORTCUT_ICONS_STORAGE_KEY
  });
  const folderItemIconStore = LumnoNewtabFolderItemIcons.createStore({
    storageArea: localStorageArea
  });
  const shortcutFaviconStore = LumnoShortcutFaviconStore.createShortcutFaviconStore({
    chromeApi: typeof chrome !== 'undefined' ? chrome : null,
    storageArea: localStorageArea,
    storageKey: NEWTAB_SHORTCUT_FAVICON_CACHE_STORAGE_KEY,
    lockManager: window.navigator && window.navigator.locks
  });


  const {
    applyRecentCardTheme,
    applyBookmarkCardTheme,
    applyShortcutTileTheme,
    shouldDelayBookmarkHoverFromRecent
  } = NEWTAB_CARD_THEMES.createCardThemes({
    buildFallbackThemeForHost,
    defaultTheme,
    getThemeForMode,
    parseCssColor,
    defaultAccentColor,
    mixColor,
    rgbToCss,
    rgbToCssParts,
    rgbToCssAlpha,
    normalizeAccentRgb,
    getReadableTextColor,
    getThemeSource,
    normalizeThemeConfidence,
    isLowConfidenceTheme,
    scheduleWallpaperAdaptiveToneUpdate: (...args) => scheduleWallpaperAdaptiveToneUpdate(...args),
    recentPointer
  });

  const quoteRuntime = LumnoNewtabQuotes.createRuntime({
    documentObj: document, windowObj: window,
    settings, localStorageArea, t, showToast,
    getLocale: () => locale.store.getSnapshot().locale,
    getSearchRoot: () => root,
    getShortcutSection: () => shortcutSection,
    getTooltipController: () => topActionTooltipController,
    onLayout: () => window.requestAnimationFrame(() => {
      updateBookmarkSectionPosition();
      scheduleWallpaperAdaptiveToneUpdate();
    })
  });
  const {
    getThemeScope,
    setThemeMode,
    setVisibleThemeMode,
    setThemeScope,
    followLanguage,
    refreshThemeAwareFavicons,
    scheduleThemeAwareFaviconRescue,
    applyThemeMode,
    getScopedThemeMode,
    getSelectedThemeMode,
    followTheme,
    syncSystemThemeMode
  } = NEWTAB_APPEARANCE_MODES.createAppearanceModes({
    quoteRuntime,
    appliedTheme,
    notices,
    searchBox,
    modeActions,
    searchResults,
    searchMode,
    searchQuery,
    syncBookmarkTopbarSurfaceAppearance,
    locale,
    settings,
    t,
    renderNewtabTopContent: (...args) => renderNewtabTopContent(...args),
    updateRecentModeMenu: (...args) => updateRecentModeMenu(...args),
    updateBookmarkModeMenu: (...args) => updateBookmarkModeMenu(...args),
    updateFeedbackLanguageStrings,
    renderShortcuts: () => renderShortcuts(),
    updateModeBadge: (...args) => updateModeBadge(...args),
    renderSuggestions: (...args) => renderSuggestions(...args),
    forceReloadRecentSitesForI18n: (...args) => forceReloadRecentSitesForI18n(...args),
    resolveTheme,
    applyWordmarkThemeAppearance: (...args) => applyWordmarkThemeAppearance(...args),
    addMediaQueryChangeListener,
    mediaQuery,
    removeMediaQueryChangeListener,
    scheduleWallpaperAdaptiveToneUpdate: (...args) => scheduleWallpaperAdaptiveToneUpdate(...args),
    pageState
  });

  const {
    syncSearchModeMenuResultOffset,
    setSuggestionsVisible,
    updateSuggestionsFloatingLayout
  } = NEWTAB_SUGGESTIONS_LAYOUT.createSuggestionsLayout({
    bottomDockParts,
    suggestionsContainer,
    searchBox
  });

  const {
    getBookmarkGridColumnCount,
    getEffectiveNewtabSearchWidth,
    getRecentLimit,
    getRecentSourceLimit,
    applyBookmarkGridColumns,
    keepBookmarkPageAnchorAfterLimitChange,
    applyRecentGridColumns,
    applyNewtabWidthMode,
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
    updateSearchEntryLayout,
    followShortcutGridLayout,
    followNewtabSearchWidth
  } = NEWTAB_PAGE_LAYOUT.createPageLayout({
    bottomDockParts,
    shortcutGrid,
    shortcutSection,
    shortcutList,
    preview,
    settings,
    normalizeNewtabSearchWidth: (...args) => normalizeNewtabSearchWidth(...args),
    getBookmarkLimit: (...args) => getBookmarkLimit(...args),
    updateSuggestionsFloatingLayout,
    closeRecentContextMenu,
    scheduleWallpaperAdaptiveToneUpdate: (...args) => scheduleWallpaperAdaptiveToneUpdate(...args),
    getVisibleShortcuts: (...args) => getVisibleShortcuts(...args),
    resetShortcutDockHover,
    closeShortcutContextMenu,
    closeShortcutDialog,
    viewport: viewportActivity,
    recentPointer,
    pageState
  });

  const {
    normalizeNewtabSearchWidth,
    inferNewtabShortcutColumnsFromWidth,
    setNewtabShortcutsVisible,
    setNewtabShortcutAddVisible,
    setNewtabShortcutDockMagnificationEnabled,
    setNewtabShortcutColumns,
    setNewtabShortcutSize,
    setNewtabShortcutGap,
    initialNewtabInputAutoFocusReadyTask,
    getBookmarkLimit
  } = NEWTAB_PAGE_PREFERENCES.createPagePreferences({
    preview,
    settings,
    getBookmarkGridColumnCount
  });

  const sectionPanelSettings = LumnoNewtabSectionPanelSettings.createRuntime({
    windowObj: window,
    chromeObj: chrome,
    t,
    watchedKeys: [
      bookmarkViewMode.key,
      bookmarkCount.key,
      bookmarkColumns.key,
      bookmarkFolderIconsVisible.key,
      recentMode.key,
      recentCount.key,
      ...bookmarkTopbarStorageKeys
    ],
    getBookmarkViewMode: () => settings.get(bookmarkViewMode),
    setBookmarkViewMode: (mode) => setBookmarkViewMode(mode),
    getBookmarkCount: () => preview.get(bookmarkCount),
    setBookmarkCount: (value, options) => {
      preview.set(bookmarkCount, value, options);
    },
    getBookmarkColumns: () => preview.get(bookmarkColumns),
    setBookmarkColumns: (value, options) => {
      preview.set(bookmarkColumns, value, options);
    },
    getBookmarkFolderIconsVisible: () => preview.get(bookmarkFolderIconsVisible),
    setBookmarkFolderIconsVisible: (value, options) => {
      preview.set(bookmarkFolderIconsVisible, value, options);
    },
    // The bar's shape and background go through the same actions as its own menu.
    getBookmarkTopbarLayout: () => getBookmarkTopbarLayout(),
    setBookmarkTopbarLayout: (layout) => handleBookmarkModeMenuAction(`${BOOKMARK_TOPBAR_LAYOUT_ACTION}:${layout}`),
    getBookmarkTopbarSurfaceMode: () => getEffectiveBookmarkTopbarSurfaceMode(),
    setBookmarkTopbarSurfaceMode: (mode) => handleBookmarkModeMenuAction(
      `${BOOKMARK_TOPBAR_SURFACE_MODE_ACTION}:${mode}`
    ),
    pickBookmarkTopbarSurfaceColor: () => handleBookmarkModeMenuAction(BOOKMARK_TOPBAR_PICK_COLOR_ACTION),
    getRecentMode: () => settings.get(recentMode),
    setRecentMode: (mode) => setRecentMode(mode),
    getRecentCount: () => preview.get(recentCount),
    setRecentCount: (value, options) => {
      preview.set(recentCount, value, options);
    }
  });

  const {
    wallpaperRuntime,
    bootstrapInitialWallpaper,
    markInitialWallpaperVisualReady,
    getWallpaperShownAt,
    scheduleWallpaperAdaptiveToneUpdate
  } = NEWTAB_WALLPAPER_PAGE.createWallpaperPage({
    bottomDockParts,
    shortcutGrid,
    locale,
    appliedTheme,
    sectionPanelSettings,
    quoteRuntime,
    getFeedbackButton,
    settings,
    preview,
    shortcutTiles,
    getShortcutDockIcon,
    shortcutGroupHeaders,
    getEffectiveBookmarkTopbarSurfaceMode,
    isBookmarkTopbarMode: (...args) => isBookmarkTopbarMode(...args),
    root,
    localStorageArea,
    t,
    formatMessage,
    getSelectedThemeMode,
    getScopedThemeMode,
    getThemeScope,
    setThemeMode,
    setThemeScope,
    showToast,
    beginToast,
    showTopActionTooltip: (...args) => showTopActionTooltip(...args),
    hideTopActionTooltip: (...args) => hideTopActionTooltip(...args),
    applyWordmarkThemeAppearance: (...args) => applyWordmarkThemeAppearance(...args),
    getEffectiveNewtabSearchWidth,
    setNewtabSearchWidth,
    setNewtabShortcutsVisible,
    setNewtabShortcutAddVisible,
    setNewtabShortcutDockMagnificationEnabled,
    setNewtabShortcutColumns,
    setNewtabShortcutSize,
    setNewtabShortcutGap,
    newtabEntryAnimationReadyPromise,
    initialNewtabInputAutoFocusReadyTask,
    followTheme,
    pageState
  });

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

  const initialWallpaperOverlayReadyTask = wallpaperRuntime.bootstrapInitialWallpaperOverlay();
  const initialWallpaperVisualReadyTask = Promise.all([
    followTheme(),
    initialWallpaperOverlayReadyTask.then(() => bootstrapInitialWallpaper()),
    initialWallpaperOverlayReadyTask,
    wallpaperRuntime.bootstrapInitialWallpaperEffect()
  ]).then(() => wallpaperRuntime.waitForInitialWallpaperEffectVisual()).catch((error) => {
    console.warn('[Lumno] Initial new tab wallpaper setup failed.', error);
  }).then(() => {
    markInitialWallpaperVisualReady();
  });
  const initialAppearanceReadyTask = Promise.all([
    initialWallpaperVisualReadyTask,
    wallpaperRuntime.bootstrapInitialNewtabFavicon()
  ]).catch((error) => {
    console.warn('[Lumno] Initial new tab appearance setup failed.', error);
  });


  NEWTAB_STARTUP_PREFERENCES.createStartupPreferences({
    preview,
    settings,
    renderRecentSites: (...args) => renderRecentSites(...args),
    markRecentDataDirty: (...args) => markRecentDataDirty(...args),
    loadRecentSites: (...args) => loadRecentSites(...args),
    getBookmarkLimit,
    applyNewtabWidthMode,
    applyRecentGridColumns,
    applyBookmarkGridColumns,
    keepBookmarkPageAnchorAfterLimitChange,
    renderCurrentBookmarkPage: (...args) => renderCurrentBookmarkPage(...args),
    updateBookmarkGridHeightLock: (...args) => updateBookmarkGridHeightLock(...args),
    updateBookmarkSectionPosition,
    updateRecentModeMenu: (...args) => updateRecentModeMenu(...args),
    markBookmarkDataDirty: (...args) => markBookmarkDataDirty(...args),
    loadBookmarks: (...args) => loadBookmarks(...args),
    pageState
  });
  const imeKeyGuard = LumnoImeKeyGuard.createImeKeyGuard();
  const searchInputHistoryController =
    SEARCH_INPUT_HISTORY.createSearchInputHistoryController({
      storage: createSettingPort(settings, SearchSettings.searchInputHistory)
    });
  function isImeCompositionEvent(event: KeyboardEvent): boolean {
    return imeKeyGuard.shouldIgnoreKeydown(event);
  }

  NEWTAB_SEARCH_SETTINGS_SYNC.createSearchSettingsSync({
    suggestionsContainer,
    searchBox,
    modeActions,
    searchResults,
    searchMode,
    searchQuery,
    settings,
    searchEngine,
    renderSuggestions: (...args) => renderSuggestions(...args),
    requestSuggestions: (...args) => requestSuggestions(...args),
    markRecentDataDirty: (...args) => markRecentDataDirty(...args),
    scheduleRecentReloadIfVisible: (...args) => scheduleRecentReloadIfVisible(...args),
    scheduleBookmarkReloadIfVisible: (...args) => scheduleBookmarkReloadIfVisible(...args),
    refreshThemeAwareFavicons,
    getImmediateThemeForSuggestion
  });

  migrateLocalSettingsIfNeeded(SYNCED_PAGE_STORAGE_KEYS.slice());

  const {
    faviconCacheRuntime,
    areFaviconRenderCachesReady,
    waitForFaviconRenderCaches,
    isHostFaviconVisitDirty,
    getPersistedFaviconDataEntry,
    getPersistedSiteThemeEntry,
    setPersistedSiteThemeEntry,
    applyFaviconOpticalShift,
    applyFaviconOpticalAlignment,
    applyFallbackIcon,
    setFaviconSrcWithAnimation,
    attachFaviconData,
    preloadIcon,
    warmIconCache,
    attachFaviconWithFallbacks,
    getPageFaviconUrlResolver,
    getThemeSourceForSuggestion
  } = NEWTAB_PAGE_FAVICONS.createPageFavicons({
    normalizeFaviconHost,
    isPersistableTheme,
    normalizeAccentRgb,
    parseCssColor,
    getThemeSource,
    isLowConfidenceTheme,
    normalizeThemeConfidence,
    getExtensionFaviconUrl,
    getGstaticFaviconUrl,
    getChromeFaviconUrl,
    isOwnExtensionUrl,
    shouldBlockFaviconForHost,
    shouldAvoidDirectFaviconForHost,
    isNewtabEnhancedFaviconFetchEnabled,
    getNewtabStrictFaviconReason,
    getHostFromUrl,
    isFaviconProxyUrl,
    themeHostCache,
    isUrlBlockedByFaviconRequestBlacklist,
    themeColorCache,
    normalizeHost,
    getThemeSourcePriority,
    extractAverageColor,
    buildThemeFromAccent,
    setResolvedThemeForHost,
    getShortcutFaviconCandidateUrl: (...args) => getShortcutFaviconCandidateUrl(...args),
    getShortcutFaviconDataUrl: (...args) => getShortcutFaviconDataUrl(...args),
    getProviderIcon,
    getProviderFaviconPageUrl,
    pageState
  });

  const {
    navigateToUrl,
    isMiddleClick,
    getOpenDisposition,
    openExternalNewTabUrl,
    openUrlFromNewtabCard,
    openShortcutUrl,
    openBookmarkFolder,
    navigateToQuery
  } = NEWTAB_PAGE_NAVIGATION.createPageNavigation({
    settings,
    getShortcutTileById,
    bookmarksRuntime,
    getShortcutFolderId: (...args) => getShortcutFolderId(...args),
    showToast,
    t,
    openBookmarkCascadeMenu,
    navigateBookmarkFolder: (...args) => navigateBookmarkFolder(...args),
    searchEngine
  });

  suggestionsContainer.addEventListener('wheel', function(event) {
    SUGGESTION_NAVIGATION.preventNumberShortcutWheel(event, suggestionsContainer);
  }, { passive: false });
  document.addEventListener('pointerdown', function() {
    SUGGESTION_NAVIGATION.cancelNumberShortcuts(suggestionsContainer);
  }, true);
  const suggestionsSurface = pageStructureRuntime.suggestions.surface;
  const suggestionsOutline = pageStructureRuntime.suggestions.outline;
  const bookmarkSection = pageStructureRuntime.bookmark.section;
  pageState.recentSection = pageStructureRuntime.recent.section;

  const {
    captureRecentCardLayout,
    cancelRecentResizeLayoutAnimations,
    shouldSkipNewtabEntryMotion,
    shouldAnimateNewtabLayoutShift,
    animateRecentResizeLayout,
    applyNewtabTopContentVisibility,
    finishWordmarkEntryAnimation,
    applyWordmarkThemeAppearance,
    renderNewtabTopContent,
    followTopContentSettings
  } = NEWTAB_TOP_CONTENT_RUNTIME.createTopContentRuntime({
    recentCards,
    updateSearchEntryLayout,
    updateSuggestionsFloatingLayout,
    scheduleWallpaperAdaptiveToneUpdate,
    settings,
    preview,
    pageState
  });
  // Settles once the stored clock face has loaded, so the first reveal never
  // draws the clock in a fallback face.
  const initialTimeFontReadyTask = followTopContentSettings();

  const {
    finishNewtabEntryAnimation,
    markNewtabReady
  } = NEWTAB_ENTRY_MOTION.createEntryMotion({
    getWallpaperShownAt,
    root,
    shouldSkipNewtabEntryMotion,
    updateBookmarkSectionPosition,
    finishWordmarkEntryAnimation,
    rememberSearchEntryViewport,
    getSearchEntryViewportSnapshot,
    hasSearchEntryViewportChanged,
    viewport: viewportActivity,
    onEntryDone: () => finishEntryAnimationWait()
  });

  const {
    topActionTooltipController,
    shortcutTooltipController,
    shortcutDialogTooltipController,
    bookmarkCascadeCopyTooltipController,
    bookmarkCursorTooltipController,
    searchInputCursorTooltipController
  } = NEWTAB_TOOLTIP_CONTROLLERS.createTooltipControllers();

  const {
    showTopActionTooltip,
    hideTopActionTooltip,
    bindSearchInputCursorTooltip,
    hideSearchInputCursorTooltip,
    bindShortcutTooltip,
    hideShortcutTooltip,
    bindShortcutDialogTooltip,
    hideShortcutDialogTooltip,
    bindCursorTooltip,
    hideCursorTooltip
  } = NEWTAB_TOOLTIP_BINDINGS.createTooltipBindings({
    shortcutGrid,
    searchBox,
    preview,
    topActionTooltipController,
    searchInputCursorTooltipController,
    shortcutTooltipController,
    t,
    isShortcutDragActive: (...args) => isShortcutDragActive(...args),
    isBookmarkDragActive: () => isBookmarkDragActive() ||
      Boolean(pageState.recentCardDragRuntime && pageState.recentCardDragRuntime.isRecentCardDragActive()),
    isShortcutContextMenuOpen,
    shortcutDialogTooltipController,
    bookmarkCursorTooltipController,
    shouldSuppressBookmarkHover: (...args) => shouldSuppressBookmarkHover(...args)
  });

  const {
    updateRecentModeMenu,
    setRecentMode,
    canDismissRecentCard,
    updateBookmarkHeader,
    isBookmarkTopbarMode,
    getNewtabTopOccupiedInsetPx,
    getNewtabViewportTopPaddingPx,
    getBookmarkCascadeViewportTopPaddingPx,
    setNewtabTopOccupied,
    setNewtabTopLayout,
    syncBookmarkSurfaceMode,
    setBookmarkSurfaceVisible,
    updateBookmarkModeMenu,
    followBookmarkViewMode,
    setBookmarkViewMode,
    navigateBookmarkFolder
  } = NEWTAB_SECTION_HEADERS.createSectionHeaders({
    preview,
    settings,
    t,
    getNewtabVisualViewportInsets,
    updateSearchEntryLayout,
    setContentSectionVisible,
    bookmarkSection,
    bookmarkCards,
    markBookmarkDataDirty: (...args) => markBookmarkDataDirty(...args),
    loadBookmarks: (...args) => loadBookmarks(...args),
    closeBookmarkCascadeMenu,
    showTopActionTooltip,
    hideTopActionTooltip,
    renderBookmarkHeader: pageStructureRuntime.bookmark.renderHeader,
    getBookmarkModeMenuOptions: () => getBookmarkModeMenuOptions(),
    handleBookmarkModeMenuAction,
    goToBookmarkPage: (step) => {
      const target = pageState.bookmarkCurrentPage + step;
      if (target < 0 || target >= getBookmarkPageCount()) {
        return;
      }
      switchBookmarkPage(target);
    },
    openBookmarkManager: () => {
      if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
        return;
      }
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openBookmarkManager' });
    },
    pageState
  });

  const { getBookmarkModeMenuOptions } = NEWTAB_BOOKMARK_MODE_MENU.createBookmarkModeMenu({
    t,
    getEffectiveBookmarkTopbarSurfaceMode,
    isBookmarkTopbarMode,
    getBookmarkTopbarLayout,
  });

  const {
    getAddShortcutButton,
    setShortcutContextMenuMark,
    getShortcutFolderId,
    getFolderItemIconUrl,
    getFolderItemIcon,
    getFolderItemIconForShortcut,
    updateFolderItemIcons,
    getVisibleShortcuts,
    refreshShortcutFolderReferences,
    getShortcutStoreOptions,
    getShortcutIconDataUrl,
    getShortcutFaviconDataUrl,
    getShortcutFaviconCandidateUrl,
    getShortcutTitle,
    renderShortcuts,
    flushDeferredShortcutRender,
    followNewtabShortcutPreferences,
    followStoredShortcutData,
    loadVisibleShortcuts,
    persistShortcuts,
    removeShortcutById,
    hasShortcutForSite,
    addSiteToShortcuts,
    hideShortcutAddFromContextMenu,
    createShortcutsSection,
    createShortcutDialogComponent,
    getShortcutGroups,
    isWebDavBackingUpShortcuts,
    fitShortcutGroupColumns,
    openShortcutAddDialog,
    openShortcutGroupDialog,
    moveShortcutGroup,
    moveShortcutGroupToIndex,
    deleteShortcutGroup,
    confirmDeleteShortcutGroupWithSites,
    applyShortcutGroupDeleteRecord
  } = NEWTAB_SHORTCUTS_CONTROLLER.createShortcutsController({
    setShortcutIconError,
    setShortcutError,
    shortcutList,
    settings,
    shortcutFolderRuntime,
    bookmarksRuntime,
    isShortcutDragActive: (...args) => isShortcutDragActive(...args),
    moveShortcutByKeyboard: (...args) => moveShortcutByKeyboard(...args),
    normalizeHost,
    sanitizeDisplayText,
    providerStorageRuntime,
    shortcutIconStore,
    folderItemIconStore,
    getPageFaviconUrlResolver,
    getExtensionResourceUrl,
    sendRuntimeMessage,
    shortcutFaviconStore,
    faviconCacheRuntime,
    getPersistedFaviconDataEntry,
    t,
    hideShortcutTooltip,
    closeShortcutContextMenu,
    syncOpenBookmarkCascadeAnchorVisual: (...args) => syncOpenBookmarkCascadeAnchorVisual(...args),
    applyNewtabShortcutsVisibility,
    updateShortcutLanguageStrings,
    updateBookmarkSectionPosition,
    storageArea,
    pickShortcutIconPlateColor,
    applyNewtabShortcutLayoutPreferences,
    applyNewtabShortcutDockMagnification,
    inferNewtabShortcutColumnsFromWidth,
    loadFolderColors,
    showToast,
    formatMessage,
    getShortcutById,
    markBookmarkTreeDirty: (...args) => markBookmarkTreeDirty(...args),
    loadBookmarks: (...args) => loadBookmarks(...args),
    refreshOpenBookmarkCascadeMenu: (...args) => refreshOpenBookmarkCascadeMenu(...args),
    bookmarkMoveHistory,
    getBookmarkUndoShortcutLabel: (...args) => getBookmarkUndoShortcutLabel(...args),
    resetShortcutDockHover,
    scheduleWallpaperAdaptiveToneUpdate,
    pageStructureRuntime,
    shortcutTiles,
    shortcutGroupHeaders,
    initFolderPathMorph,
    playFolderPathMorph,
    getHostFromUrl,
    getImmediateThemeForSuggestion,
    applyShortcutTileTheme,
    queueThemeForTarget,
    getTileThemeOnSiteChange,
    attachFaviconWithFallbacks,
    bindShortcutTooltip,
    isMiddleClick,
    openShortcutUrl,
    isCardActivationSuppressed,
    handleShortcutContextMenu,
    handleShortcutNativeDragStart,
    openShortcutDialog,
    openShortcutAddContextMenu,
    handleShortcutDragPointerDown: (...args) => handleShortcutDragPointerDown(...args),
    handleShortcutDockPointerOver,
    handleShortcutDockPointerMove,
    syncShortcutDockFolderMenu,
    bindShortcutDialogTooltip,
    hideShortcutDialogTooltip,
    handleShortcutGroupMenu: openShortcutGroupMenu,
    animateShortcutLayoutChange: (...args) => animateShortcutLayoutChange(...args),
    pageState
  });
  followStoredShortcutData();

  const {
    queueBookmarkLayoutAnimation,
    playPendingBookmarkLayoutAnimation,
    updateBookmarkDragLayoutCache,
    setBookmarkDragCardTransform,
    isEmptyBookmarkRootHidden,
    getExternalBookmarkSurfacePoint,
    isValidExternalBookmarkDropTarget,
    getShortcutFolderDropTargetAt,
    getShortcutInsertionDropTarget,
    getExternalBookmarkDropTarget,
    isPointOverShortcutDropSurface,
    applyBookmarkShortcutTransfer,
    applyShortcutStack,
    clearDragDropTarget,
    isBookmarkCascadeSurfaceAtPoint,
    setDragDropTarget,
    getBookmarkDragPageSwitchDirection,
    clearBookmarkDragPageSwitch,
    clearBookmarkDragFolderSwitch,
    scheduleBookmarkDragFolderSwitch,
    scheduleBookmarkDragPageSwitch,
    scheduleBookmarkDragMove,
    deleteBookmarkFromContextTarget,
    addBookmarkFolderToShortcuts,
    hasShortcutForBookmarkFolder,
    getBookmarkUndoShortcutLabel,
    refreshOpenBookmarkCascadeMenu,
    syncOpenBookmarkCascadeAnchorVisual,
    performBookmarkMoveHistoryAction,
    isBookmarkDragActive,
    shouldSuppressBookmarkHover,
    finishBookmarkDrag,
    handleBookmarkDragPointerDown,
    handleBookmarkCascadeItemPointerDown
  } = NEWTAB_BOOKMARK_DRAG_CONTROLLER.createBookmarkDragController({
    getAddShortcutButton,
    shortcutGrid,
    shortcutSection,
    shortcutList,
    settings,
    preview,
    isBookmarkTopbarMode,
    getBookmarkLimit,
    initFolderPathMorph,
    setFolderPathMorphState,
    isContentSectionVisible,
    bookmarkSection,
    bookmarksRuntime,
    getShortcutById,
    getShortcutFolderId,
    getShortcutReorderTiles,
    getShortcutTileLayoutRect: (...args) => getShortcutTileLayoutRect(...args),
    getShortcutStoreOptions,
    getShortcutInsertionSlotAt: (...args) => getShortcutInsertionSlotAt(...args),
    getShortcutTileId,
    bookmarkMoveHistory,
    showToast,
    t,
    refreshShortcutFolderReferences,
    shortcutFolderRuntime,
    getFolderItemIcon,
    updateFolderItemIcons,
    persistShortcuts,
    markBookmarkTreeDirty: (...args) => markBookmarkTreeDirty(...args),
    loadBookmarks: (...args) => loadBookmarks(...args),
    getBookmarkPageCount: (...args) => getBookmarkPageCount(...args),
    // A recent card dragged over the bookmarks opens folders like the others.
    isBookmarkSurfaceDragStateActive: (state) => isBookmarkSurfaceDragStateActive(state) ||
      Boolean(pageState.recentCardDragRuntime && pageState.recentCardDragRuntime.isRecentCardDragState(state)),
    openBookmarkCascadeMenu,
    navigateBookmarkFolder,
    switchBookmarkPageDuringDrag: (...args) => switchBookmarkPageDuringDrag(...args),
    setShortcutDragTileTransform: (...args) => setShortcutDragTileTransform(...args),
    scheduleWallpaperAdaptiveToneUpdate,
    formatMessage,
    isShortcutDragActive: (...args) => isShortcutDragActive(...args),
    hideCursorTooltip,
    isEditableElement: (...args) => isEditableElement(...args),
    closeBookmarkCascadeMenu,
    renderCurrentBookmarkPage: (...args) => renderCurrentBookmarkPage(...args),
    applyShortcutGroupDeleteRecord,
    autoScrollShortcutArea: (...args) => autoScrollShortcutArea(...args),
    closeBookmarkContextMenu,
    getShortcutGroups: (...args) => getShortcutGroups(...args),
    isWebDavBackingUpShortcuts,
    pageState
  });

  createShortcutsSection();

  NEWTAB_BOOKMARK_SECTION.createBookmarkSection({
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
    playFolderPathMorph,
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
    shouldSuppressBookmarkHover,
    bindCursorTooltip,
    hideCursorTooltip,
    openBookmarkFolder,
    openBookmarkCascadeMenu,
    copyBookmarkUrl,
    handleBookmarkItemContextMenu,
    isCardActivationSuppressed,
    navigateToUrl,
    openUrlFromNewtabCard,
    dismissStack,
    isShortcutFolderAnchor,
    getFolderItemIconUrl,
    bookmarksRuntime,
    bookmarkCascadeCopyTooltipController,
    hideTopActionTooltip,
    handleBookmarkCascadeItemPointerDown,
    isBookmarkContextMenuNode,
    getBookmarkCascadeViewportTopPaddingPx,
    setNewtabTopOccupied,
    syncBookmarkTopbarSurfaceAppearance,
    syncBookmarkSurfaceMode,
    pageState
  });

  NEWTAB_RECENT_SECTION.createRecentSection({
    getPinnedRecentSites,
    settings,
    setContentSectionVisible,
    hideTopActionTooltip,
    pageStructureRuntime,
    t,
    setRecentMode,
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
    recentPointer,
    pageState
  });

  const {
    bottomDockRuntime,
    bottomDock
  } = NEWTAB_BOTTOM_DOCK_RUNTIME.createBottomDockRuntime({
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
    getNewtabTopOccupiedInsetPx,
    shouldAnimateNewtabLayoutShift,
    applyNewtabWidthMode,
    viewport: viewportActivity,
    pageState
  });

  bookmarkSection.addEventListener('wheel', (event) => {
    if (!event || !isContentSectionVisible(bookmarkSection)) {
      return;
    }
    handleBookmarkWheel(event);
  }, { passive: false });

  const {
    getBookmarkPageCount,
    updateBookmarkPagerState,
    updateBookmarkGridHeightLock,
    renderCurrentBookmarkPage,
    switchBookmarkPageDuringDrag,
    switchBookmarkPage,
    handleBookmarkWheel
  } = NEWTAB_BOOKMARK_PAGER.createBookmarkPager({
    isBookmarkTopbarMode,
    getBookmarkLimit,
    updateBookmarkHeader,
    getBookmarkGridColumnCount,
    renderBookmarks: (...args) => renderBookmarks(...args),
    updateBookmarkSectionPosition,
    pageState
  });

  const {
    getShortcutTileLayoutRect,
    setShortcutDragTileTransform,
    getShortcutInsertionSlotAt,
    autoScrollShortcutArea,
    animateShortcutLayoutChange,
    scheduleShortcutDragMove,
    finishShortcutDrag,
    moveShortcutByKeyboard,
    isShortcutDragActive,
    isBookmarkSurfaceDragStateActive,
    handleShortcutDragPointerDown
  } = NEWTAB_SHORTCUT_DRAG.createShortcutDrag({
    getAddShortcutButton,
    shortcutGrid,
    shortcutList,
    getShortcutReorderTiles,
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
    isBookmarkTopbarMode,
    isBookmarkCascadeSurfaceAtPoint,
    getExternalBookmarkSurfacePoint,
    isPointOverShortcutDropSurface,
    clearBookmarkDragPageSwitch,
    clearBookmarkDragFolderSwitch,
    clearDragDropTarget,
    scheduleWallpaperAdaptiveToneUpdate,
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
    queueBookmarkLayoutAnimation,
    applyBookmarkShortcutTransfer,
    applyShortcutStack,
    getFolderItemIconForShortcut,
    showToast,
    hideToast,
    t,
    formatMessage,
    getBookmarkUndoShortcutLabel,
    refreshShortcutFolderReferences,
    isShortcutContextMenuNode,
    getShortcutTileFromNode,
    closeShortcutContextMenu,
    moveShortcutGroupToIndex,
    fitShortcutGroupColumns,
    pageState
  });

  pageState.recentCardDragRuntime = NEWTAB_RECENT_CARD_DRAG.createRecentCardDrag({
    shortcutList,
    getShortcutStoreOptions,
    getShortcutFolderId,
    persistShortcuts,
    bookmarkMoveHistory,
    bookmarksRuntime,
    isBookmarkTopbarMode,
    isBookmarkCascadeSurfaceAtPoint,
    getExternalBookmarkSurfacePoint,
    getExternalBookmarkDropTarget,
    getShortcutFolderDropTargetAt,
    getShortcutInsertionDropTarget,
    isPointOverShortcutDropSurface,
    isValidExternalBookmarkDropTarget,
    autoScrollShortcutArea,
    setDragDropTarget,
    clearDragDropTarget,
    getBookmarkDragPageSwitchDirection,
    scheduleBookmarkDragPageSwitch,
    clearBookmarkDragPageSwitch,
    scheduleBookmarkDragFolderSwitch,
    clearBookmarkDragFolderSwitch,
    applyBookmarkShortcutTransfer,
    queueBookmarkLayoutAnimation,
    isEmptyBookmarkRootHidden,
    renderCurrentBookmarkPage,
    closeBookmarkCascadeMenu,
    closeRecentContextMenu,
    hideCursorTooltip,
    hideTopActionTooltip,
    resetShortcutDockHover,
    scheduleWallpaperAdaptiveToneUpdate,
    showToast,
    t,
    formatMessage,
    pageState
  });

  const {
    renderBookmarks,
    renderRecentSites,
    markBookmarkDataDirty,
    markBookmarkTreeDirty,
    markRecentDataDirty,
    loadBookmarks,
    loadRecentSites,
    handleRecentVisibilityChange,
    forceReloadRecentSitesForI18n
  } = NEWTAB_SECTION_LOADERS.createSectionLoaders({
    shortcutList,
    appliedTheme,
    getHiddenRecentSites,
    settings,
    preview,
    isShortcutDragActive,
    isRecentCardDragActive: pageState.recentCardDragRuntime.isRecentCardDragActive,
    resumeRecentCardDragAfterFolderSwitch: pageState.recentCardDragRuntime.resumeRecentCardDragAfterFolderSwitch,
    isBookmarkTopbarMode,
    scheduleShortcutDragMove,
    updateBookmarkDragLayoutCache,
    setBookmarkDragCardTransform,
    scheduleBookmarkDragMove,
    syncOpenBookmarkCascadeAnchorVisual,
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
    recentSection: pageState.recentSection,
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
    playPendingBookmarkLayoutAnimation,
    renderShortcuts,
    getRecentSourceLimit,
    getRecentSites,
    beginSearchEntryRestoreLayoutLock,
    pageState
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

  function getSiteDisplayName(hostname: string, title?: string): string {
    return SITE_DISPLAY_NAME.getSiteDisplayName(
      hostname,
      title,
      SITE_DISPLAY_NAME_OPTIONS
    );
  }


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
    refreshTabsForSearchContext,
    submitSearchQuery
  } = NEWTAB_SEARCH_NAVIGATION.createSearchNavigation({
    appliedTheme,
    openTabs,
    searchBox,
    siteSearchRunner,
    modeActions,
    searchResults,
    searchMode,
    searchAutocomplete,
    searchQuery,
    settings,
    formatMessage,
    getPageFaviconCandidateUrl,
    resultActivation,
    suggestionItems,
    getAutoHighlightIndex: (...args) => getAutoHighlightIndex(...args),
    renderSuggestions: (...args) => renderSuggestions(...args),
    isSlashCommandInput: (...args) => isSlashCommandInput(...args),
    getCommandMatch: (...args) => getCommandMatch(...args),
    isModeCommand: (...args) => isModeCommand(...args),
    isZenCommand: (...args) => isZenCommand(...args),
    getNextThemeMode: (...args) => getNextThemeMode(...args),
    setVisibleThemeMode,
    setWebAppearanceMode: (...args) => setWebAppearanceMode(...args),
    openCommunityQrDialog: (...args) => openCommunityQrDialog(...args),
    navigateToQuery
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
    setWebAppearanceMode: (...args) => setWebAppearanceMode(...args),
    shouldSwitchMatchedTabSuggestion,
    resultActivation,
    navigateToQuery,
    suggestionsContainer: suggestionsContainer,
    suggestionItems,
    refreshTabsForSearchContext,
    clearSiteSearchTabHint: (...args) => clearSiteSearchTabHint(...args),
    isSlashCommandInput: (...args) => isSlashCommandInput(...args),
    isModeCommand: (...args) => isModeCommand(...args),
    isZenCommand: (...args) => isZenCommand(...args),
    getScopedThemeMode,
    applyThemeMode,
    getCommandMatches: (...args) => getCommandMatches(...args),
    buildModeSuggestion: (...args) => buildModeSuggestion(...args),
    buildZenSuggestion: (...args) => buildZenSuggestion(...args),
    buildCommandSuggestion: (...args) => buildCommandSuggestion(...args),
    getDirectUrlSuggestion,
    quickNavigation,
    siteSearchCatalog,
    searchEngine,
    getProviderIcon,
    formatMessage,
    getMatchedOpenTabIdForSuggestion,
    filterBlacklistedSuggestions,
    getUrlDisplay,
    setSiteSearchTabHint: (...args) => setSiteSearchTabHint(...args),
    limitSuggestionsForDisplay,
    t,
    warmIconCache,
    setSuggestionsVisible,
    openCommunityQrDialog: (...args) => openCommunityQrDialog(...args)
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
    isEditableElement,
    refreshFallbackShortcut,
    handleGlobalTypingFocus
  } = NEWTAB_INPUT_FOCUS.createInputFocus({
    searchBox,
    settings,
    focusResume,
    refreshTabsIfIdle,
    initialNewtabInputAutoFocusReadyTask,
    isImeCompositionEvent,
    pageState
  });

  const {
    getCommandMatches,
    getCommandMatch,
    buildCommandSuggestion,
    updateModeBadge,
    getNextThemeMode,
    isModeCommand,
    isZenCommand,
    isSlashCommandInput,
    buildModeSuggestion,
    buildZenSuggestion,
    loadWebAppearance,
    setWebAppearanceMode,
    followZenMode
  } = NEWTAB_MODE_COMMANDS.createModeCommands({
    appliedTheme,
    searchBox,
    preview,
    settings,
    t,
    formatMessage,
    updateInputRightPadding: (...args) => updateInputRightPadding(...args),
    getExtensionResourceUrl,
    renderSuggestions,
    applyNewtabTopContentVisibility,
    applyNewtabShortcutsVisibility,
    bookmarkSection,
    recentSection: pageState.recentSection,
    isBookmarkTopbarMode,
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
    updateSearchEntryLayout,
    scheduleWallpaperAdaptiveToneUpdate,
    pageState
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

  function openWordmarkUrl(disposition: Disposition): void {
    openExternalNewTabUrl(COMMUNITY_LINKS.getStoreListing().url, disposition);
  }
  const shouldAnimateWordmarkEntry = !shouldSkipNewtabEntryMotion();
  pageState.topContentContainer = document.createElement('div');
  pageState.topContentController = createTopContentController(
    pageState.topContentContainer,
    {
      onActivate(disposition) {
        openWordmarkUrl(disposition);
      },
      onEntryAnimationComplete(animationName) {
        if (!animationName || animationName === WORDMARK_ENTRY_ANIMATION_NAME) {
          finishWordmarkEntryAnimation();
        }
      }
    }
  );
  renderNewtabTopContent(shouldAnimateWordmarkEntry);
  applyNewtabTopContentVisibility();

  const {
    maybeShowFileAccessNotice,
    createNewtabGraphicsNoticeController,
    createNewtabEngagementNoticeController,
    getHelpCenterLocale,
    openCommunityQrDialog,
    helpCenterAskHintSettled,
    dismissHelpCenterAskHint,
    dismissWebdavFeatureHint
  } = NEWTAB_PAGE_NOTICES.createPageNotices({
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
    updateInputRightPadding,
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
    getExtensionResourceUrl,
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
    scheduleWallpaperAdaptiveToneUpdate,
    syncBookmarkTopbarSurfaceAppearance
  });

  const {
    setSiteSearchTabHint,
    clearSiteSearchTabHint,
  } = NEWTAB_SEARCH_MODE_CONTROLLER.createSearchModeController({
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
    viewport: viewportActivity,
    pageState
  });

  NEWTAB_PAGE_KEYBOARD.createPageKeyboard({
    suggestionsContainer,
    searchBox,
    suggestionModifiers,
    handleSearchTabKey: tabKey.handle,
    dismissStack,
    finishShortcutDrag,
    finishBookmarkDrag,
    isEditableElement,
    performBookmarkMoveHistoryAction,
    suggestionItems,
    numberShortcutOptions,
    pageState
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

  document.body.insertBefore(pageState.topContentContainer, root);
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
  if (pageState.bookmarkTopbarRuntime) {
    pageState.bookmarkTopbarRuntime.mount(document.body);
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
    shortcutList,
    loadRecentSites,
    loadBookmarks,
    releaseStartupRecentSourceReads,
    markRecentDataDirty,
    bookmarksRuntime,
    refreshShortcutFolderReferences,
    scheduleFolderColorSync,
    markBookmarkTreeDirty,
    bookmarkMoveHistory,
    refreshOpenBookmarkCascadeMenu,
    pageState
  });

  window.addEventListener('blur', () => {
    finishShortcutDrag(null, { cancel: true });
    finishBookmarkDrag(null, { canceled: true });
  });
  window.addEventListener('visibilitychange', handleRecentVisibilityChange);
  window.addEventListener('resize', scheduleWallpaperAdaptiveToneUpdate, { passive: true });
  // An open folder menu follows its anchor once per frame while the page
  // scrolls; scroll events run before that frame's animation callbacks, so
  // the menu never trails the page.
  let bookmarkCascadeScrollFrame = 0;
  window.addEventListener('scroll', () => {
    scheduleWallpaperAdaptiveToneUpdate();
    if (bookmarkCascadeScrollFrame || !pageState.bookmarkCascadeRuntime || !pageState.bookmarkCascadeRuntime.isOpen()) {
      return;
    }
    bookmarkCascadeScrollFrame = window.requestAnimationFrame(() => {
      bookmarkCascadeScrollFrame = 0;
      positionBookmarkCascadeLevels();
    });
  }, { passive: true });
  bottomDockRuntime.onScroll(scheduleWallpaperAdaptiveToneUpdate, { passive: true });
  const actionButtonVisibilityReadyPromise = followNewtabActionButtonVisibility();
  const glassStyleReadyPromise = followNewtabGlassStyle();
  const shortcutPreferencesReadyPromise = followNewtabShortcutPreferences();
  followShortcutGridLayout();
  followNewtabSearchWidth();
  followShortcutDockMagnification();
  const shortcutsReadyPromise = shortcutPreferencesReadyPromise.then(loadVisibleShortcuts);
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
  loadWebAppearance();
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
    // Run one authoritative data pass after every layout-affecting preference
    // has settled. This keeps cached/default geometry from becoming visible and
    // then moving the entire entry when bookmarks or history arrive.
    pageState.sectionDataRevision += 1;
    const initialSectionDataRevision = pageState.sectionDataRevision;
    const recentSitesReadyTask = loadRecentSites({
      force: true,
      sectionDataRevision: initialSectionDataRevision
    });
    const bookmarksReadyTask = loadBookmarks({
      force: true,
      sectionDataRevision: initialSectionDataRevision
    });
    recentSitesReadyTask.then(releaseStartupRecentSourceReads, releaseStartupRecentSourceReads);
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
