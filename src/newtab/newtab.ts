import * as FOLDER_BINDINGS from '../platform/bookmark-folder-bindings';
import * as LumnoBrowserProfile from '../platform/browser-profile';
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
import { followNewtabVisualViewportInsets } from './viewport-insets';
import { getNewtabViewportTopPaddingPx } from './dom/top-inset';
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
  createSiteDisplayNameOptions
} from './newtab-config';
import { SiteSearchIconCache } from '../shared/search/site-search-icon-cache';
import { DefaultSearchEngine } from '../shared/search-panel/default-engine';
import { SiteSearchCatalog } from '../shared/search-panel/site-search/catalog';
import type { BackgroundAction, BackgroundReply, BackgroundRequest } from '../domain/messages';
import type { SuggestionElement } from '../shared/react/search/suggestion-list/types';
import type { BookmarkCardElement } from './react/bookmarks';
import type { RecentCardElement } from './react/recent-sites';
import type { ShortcutTileElement } from './react/shortcuts';
import { readBootValue } from '../platform/boot-handoff';
import { createToastController } from '../shared/react/toast';
import { createSelectMenuController } from './react/select-menu';
import { createPageStructure } from './react/page-structure';
import { createSearchInput } from '../shared/react/search-input';
import { newtabShortcutAddVisible, newtabShortcutDockMagnificationEnabled, newtabShortcutGap, newtabShortcutSize, newtabShortcutsVisible } from '../domain/settings/newtab-shortcuts';
import { shortcutFolderBindings } from '../domain/settings/newtab-shortcuts';
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
import { RecentSourceReads } from './recent/recent-source-reads';
import { WebAppearance } from './search/web-appearance';
import { createSearchSubmit } from './search/search-submit';
import { createCommandCatalog } from './search/command-catalog';
import { PageNoticeControllers } from './notice-controllers';
import { AppliedThemeMode } from './theme/applied-theme-mode';
import { ShortcutList } from './shortcuts/shortcut-list';
import { BottomDockParts } from './shortcuts/bottom-dock-parts';
import { RecentSitesShown } from './recent/recent-sites-shown';
import { BookmarksShown } from './bookmarks/bookmarks-shown';
import { BookmarkSectionParts } from './bookmarks/bookmark-section-parts';
import { DragSessions } from './drag-sessions';
import { FaviconParts } from './theme/favicon-parts';
import { createPageFaviconCache } from './theme/page-favicon-cache';
import { createShortcutFavicons } from './shortcuts/shortcut-favicons';
import { createShortcutData } from './shortcuts/shortcut-data';
import { createShortcutDialogActions } from './shortcuts/shortcut-dialog-actions';
import { BookmarkLayoutAnimation } from './bookmarks/bookmark-layout-animation';
import * as BOOKMARK_SHORTCUT_TRANSFER from './bookmarks/bookmark-shortcut-transfer';
import * as BOOKMARK_MOVE_ACTIONS from './bookmarks/bookmark-move-actions';
import { MoveHistoryLock } from './bookmarks/move-history-lock';
import * as SUGGESTION_INPUT_PREVIEW from '../domain/search/suggestion-input-preview';
import { adaptiveToneEvents } from './wallpaper/tone-requests';

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
  // The recent sites the section last drew.
  const recentShown = new RecentSitesShown();
  // The bookmark folder and page the section shows.
  const bookmarksShown = new BookmarksShown();
  // The bookmark section's view, folder menu and top bar, mounted with the section.
  const bookmarkParts = new BookmarkSectionParts();
  // The page's favicon data and the favicon cache and view, mounted by the page favicons.
  const faviconParts = new FaviconParts();
  // The drags running on the page, and the lock an undoable change holds.
  const dragSessions = new DragSessions();
  const historyLock = new MoveHistoryLock();


  // Firefox: index the browser's own cached icons, which stand in for the
  // missing _favicon endpoint (see createBrowserIconIndex).
  const firefoxBrowserIcons = LumnoBrowserProfile.isFirefoxExtensionRuntime()
    ? FaviconBrowserIconIndex.createBrowserIconIndex()
    : null;
  const firefoxBrowserIconsReady = firefoxBrowserIcons
    ? LumnoBrowserIcons.loadBrowserIcons(firefoxBrowserIcons, chrome).catch(() => {})
    : Promise.resolve();
  // The browser reads the first recent sites pass shares, started now.
  const recentSourceReads = new RecentSourceReads();

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

  followNewtabVisualViewportInsets();

  // Escape closes only the top open layer (menus, popovers, panels, drags).
  // The folder color dialog handles its own Escape.
  const dismissStack = LumnoNewtabDismissStack.getDismissStack();

  // The page's language; it follows the stored choice from the first read.
  const locale = new SurfaceLocale(settings, loadNewtabLocaleMessages);
  locale.follow();
  const { t, formatMessage } = locale;
  // Firefox's website appearance setting, and the slash commands typed in the search box.
  const webAppearance = new WebAppearance();
  const commandCatalog = createCommandCatalog({ settings, t, formatMessage, getExtensionResourceUrl, appliedTheme, webAppearance });
  const {
    getCommandMatches,
    getCommandMatch,
    buildCommandSuggestion,
    getNextThemeMode,
    isModeCommand,
    isZenCommand,
    isSlashCommandInput,
    buildModeSuggestion,
    buildZenSuggestion
  } = commandCatalog;

  const {
    getPageFaviconUrlResolver,
    logFaviconDecision,
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
    getBrowserIconUrl: firefoxBrowserIcons ? firefoxBrowserIcons.get : undefined
  });

  // The persisted favicon, icon data and site theme caches.
  const {
    faviconCacheRuntime,
    isBlockedLocalFaviconUrl,
    areFaviconRenderCachesReady,
    waitForFaviconRenderCaches,
    isHostFaviconVisitDirty,
    setPersistedFaviconUrl,
    getPersistedFaviconEntry,
    getPersistedFaviconDataEntry,
    setPersistedFaviconData,
    getPersistedSiteThemeEntry
  } = createPageFaviconCache({ isUrlBlockedByFaviconRequestBlacklist });
  const sanitizeDisplayText = SearchDirectNavigation.sanitizeDisplayText;

  const SITE_DISPLAY_NAME_OPTIONS = createSiteDisplayNameOptions(t);
  function getSiteDisplayName(hostname: string, title?: string): string {
    return SITE_DISPLAY_NAME.getSiteDisplayName(
      hostname,
      title,
      SITE_DISPLAY_NAME_OPTIONS
    );
  }
  const bookmarksRuntime = NEWTAB_BOOKMARKS_RUNTIME.createBookmarksRuntime({
    chromeApi: typeof chrome !== 'undefined' ? chrome : null,
    store: NEWTAB_BOOKMARKS_STORE,
    normalizeHost
  });

  const shortcutIconStore = NEWTAB_SHORTCUT_ICON_STORE.createShortcutIconStore({
    documentObj: document,
    windowObj: window,
    storageArea: localStorageArea
  });
  const folderItemIconStore = LumnoNewtabFolderItemIcons.createStore({
    storageArea: localStorageArea
  });
  const shortcutFaviconStore = LumnoShortcutFaviconStore.createShortcutFaviconStore({
    chromeApi: typeof chrome !== 'undefined' ? chrome : null,
    storageArea: localStorageArea,
    lockManager: window.navigator && window.navigator.locks
  });

  // Shortcut icon snapshots and the icons of websites in shortcut folders.
  const shortcutFavicons = createShortcutFavicons({
    settings,
    shortcutList,
    bookmarksRuntime,
    folderItemIconStore,
    shortcutFaviconStore,
    faviconCacheRuntime,
    getPersistedFaviconDataEntry,
    getPageFaviconUrlResolver,
    getExtensionResourceUrl,
    sendRuntimeMessage
  });
  const {
    getFolderItemIconUrl,
    getFolderItemIcon,
    getFolderItemIconForShortcut,
    updateFolderItemIcons,
    getShortcutFaviconDataUrl,
    getShortcutFaviconCandidateUrl
  } = shortcutFavicons;

  // The select menus the shortcut, bookmark and recent site context menus open in.
  const shortcutContextMenuSelectController = createSelectMenuController({
    documentObj: document,
    windowObj: window,
    getViewportTopInset: getNewtabViewportTopPaddingPx
  });
  const bookmarkContextMenuSelectController = createSelectMenuController({
    documentObj: document,
    windowObj: window,
    getViewportTopInset: getNewtabViewportTopPaddingPx
  });
  const recentContextMenuSelectController = createSelectMenuController({
    documentObj: document,
    windowObj: window,
    getViewportTopInset: getNewtabViewportTopPaddingPx
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
    shortcutContextMenuSelectController,
    bookmarkContextMenuSelectController,
    recentContextMenuSelectController,
    dragSessions,
    shortcutGrid,
    searchBox,
    preview,
    topActionTooltipController,
    searchInputCursorTooltipController,
    shortcutTooltipController,
    t,
    shortcutDialogTooltipController,
    bookmarkCursorTooltipController
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

  const shortcutFolderRuntime = FOLDER_BINDINGS.createRuntime({
    settingsStore: createSettingsStore({ chromeApi: chrome, settings: [shortcutFolderBindings] })
  });
  shortcutFolderRuntime.ready.catch((error) => {
    console.warn('[Lumno] Could not load shortcut folder bindings.', error);
  });
  const bookmarkMoveHistory = NEWTAB_BOOKMARK_MOVE_HISTORY.createBookmarkMoveHistory({ maxEntries: 30 });

  // The shortcuts and their groups, loaded, saved and kept in step with other pages.
  const shortcutData = createShortcutData({
    settings,
    storageArea,
    providerStorageRuntime,
    shortcutList,
    shortcutIconStore,
    shortcutFavicons,
    shortcutFolderRuntime,
    bookmarksRuntime,
    bookmarkMoveHistory,
    historyLock,
    dragSessions,
    normalizeHost,
    sanitizeDisplayText,
    t,
    formatMessage,
    showToast
  });
  const {
    getShortcutFolderId,
    getVisibleShortcuts,
    getShortcutTitle,
    getShortcutIconDataUrl,
    getShortcutStoreOptions,
    refreshShortcutFolderReferences,
    followStoredShortcutData,
    loadVisibleShortcuts,
    persistShortcuts,
    isWebDavBackingUpShortcuts,
    getShortcutGroups,
    moveShortcutGroup,
    moveShortcutGroupToIndex,
    deleteShortcutGroup,
    applyShortcutGroupDeleteRecord,
    hasShortcutForSite,
    addSiteToShortcuts,
    removeShortcutById,
    getShortcutById
  } = shortcutData;
  followStoredShortcutData();

  // The shortcut dialog, which adds and edits shortcuts and names groups.
  const {
    openShortcutDialog,
    closeShortcutDialog,
    openShortcutAddDialog,
    openShortcutGroupDialog,
    confirmDeleteShortcutGroupWithSites
  } = createShortcutDialogActions({
    settings,
    locale,
    t,
    formatMessage,
    showToast,
    hideShortcutTooltip,
    bindShortcutDialogTooltip,
    hideShortcutDialogTooltip,
    shortcutList,
    shortcutIconStore,
    shortcutData,
    shortcutFavicons,
    bookmarksRuntime,
    bookmarkParts
  });

  // The slide bookmark cards make after a move, and the moves between the
  // bookmarks and the shortcuts, with their undo.
  const bookmarkLayoutAnimation = new BookmarkLayoutAnimation(pageStructureRuntime.bookmark.grid, bookmarksShown, settings);
  const {
    hasShortcutForBookmarkFolder,
    addBookmarkFolderToShortcuts,
    moveBookmarkToShortcuts,
    applyBookmarkShortcutTransfer,
    applyShortcutStack
  } = BOOKMARK_SHORTCUT_TRANSFER.createBookmarkShortcutTransfer({
    historyLock,
    bookmarkParts,
    shortcutList,
    bookmarksRuntime,
    getShortcutStoreOptions,
    getShortcutFolderId,
    getShortcutGroups,
    bookmarkMoveHistory,
    shortcutFolderRuntime,
    getFolderItemIcon,
    updateFolderItemIcons,
    persistShortcuts,
    refreshShortcutFolderReferences,
    isWebDavBackingUpShortcuts,
    layoutAnimation: bookmarkLayoutAnimation,
    showToast,
    t,
    formatMessage
  });
  const {
    deleteBookmarkFromContextTarget,
    persistBookmarkDragOrder,
    persistBookmarkCrossLevelMove,
    performBookmarkMoveHistoryAction
  } = BOOKMARK_MOVE_ACTIONS.createBookmarkMoveActions({
    historyLock,
    bookmarkParts,
    bookmarksShown,
    shortcutList,
    bookmarksRuntime,
    bookmarkMoveHistory,
    transfer: { applyBookmarkShortcutTransfer, applyShortcutStack },
    applyShortcutGroupDeleteRecord,
    persistShortcuts,
    refreshShortcutFolderReferences,
    layoutAnimation: bookmarkLayoutAnimation,
    showToast,
    t,
    formatMessage
  });
  // The default search engine, which the page's search and navigation follow.
  const searchEngine = new DefaultSearchEngine(settings);
  searchEngine.follow();

  const {
    navigateToUrl,
    isMiddleClick,
    getOpenDisposition,
    openExternalNewTabUrl,
    openUrlFromNewtabCard,
    navigateToQuery
  } = NEWTAB_PAGE_NAVIGATION.createPageNavigation({
    settings,
    showToast,
    t,
    searchEngine
  });

  const {
    openCommunityQrDialog,
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
    openExternalNewTabUrl,
    hideTopActionTooltip,
    showTopActionTooltip
  });
  const shortcutTiles: ShortcutTileElement[] = [];

  const {
    openBookmarkFolderTabGroupConfirmation,
    openBookmarkEditor
  } = NEWTAB_BOOKMARK_ACTIONS.createBookmarkActions({
    bookmarkParts,
    t,
    bookmarksRuntime,
    openShortcutDialog,
    formatMessage,
    showToast,
    getFolderItemIcon,
    getFolderItemIconUrl,
    getBrowserPageFaviconUrl
  });

  const {
    openBookmarkCascadeMenu,
    closeBookmarkCascadeMenu,
    positionBookmarkCascadeLevels,
    getTopBookmarks
  } = NEWTAB_BOOKMARK_CASCADE_ACTIONS.createBookmarkCascadeActions({
    bookmarkParts,
    bookmarksShown,
    bookmarksRuntime,
    t
  });

  const {
    openShortcutUrl,
    getShortcutContextMenuOptions,
    getShortcutTileFromNode,
    getShortcutTileId,
    refreshShortcutTileCacheFromDom,
    getShortcutReorderTiles,
    getShortcutTileById,
    handleShortcutNativeDragStart,
    openShortcutEditor
  } = NEWTAB_SHORTCUT_PAGE_ACTIONS.createShortcutPageActions({
    showToast,
    openBookmarkCascadeMenu,
    openUrlFromNewtabCard,
    shortcutGrid,
    shortcutList,
    t,
    getShortcutGroups,
    bookmarksRuntime,
    getShortcutFolderId,
    getShortcutById,
    openShortcutDialog,
    shortcutTiles,
    openBookmarkEditor,
    getShortcutTitle,
    getShortcutIconDataUrl
  });

  const {
    initFolderPathMorph,
    isFolderColorPickerOpen,
    scheduleFolderColorSync,
    loadFolderColors,
    openFolderColorPicker
  } = NEWTAB_FOLDER_COLORS.createFolderColors({
    settings,
    bookmarksRuntime,
    closeBookmarkCascadeMenu,
    closeShortcutDialog,
    hideCursorTooltip,
    t,
    bindShortcutDialogTooltip,
    hideShortcutDialogTooltip,
    showToast
  });
  dismissStack.setShouldIgnore(isFolderColorPickerOpen);

  const {
    isBookmarkContextMenuNode,
    closeBookmarkContextMenu,
    handleBookmarkItemContextMenu
  } = NEWTAB_BOOKMARK_CONTEXT_MENU.createBookmarkContextMenu({
    otherContextMenus: [shortcutContextMenuSelectController, recentContextMenuSelectController],
    dragSessions,
    bookmarkParts,
    locale,
    bookmarkContextMenuSelectController,
    bookmarksRuntime,
    t,
    openFolderColorPicker,
    openExternalNewTabUrl,
    openBookmarkEditor,
    openBookmarkFolderTabGroupConfirmation,
    deleteBookmarkFromContextTarget,
    hasShortcutForSite,
    addSiteToShortcuts,
    hasShortcutForBookmarkFolder,
    addBookmarkFolderToShortcuts,
    hideCursorTooltip
  });

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
    getHelpCenterLocale: () => locale.store.getSnapshot().locale,
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
    settings,
    getUrlDisplay: (url) => getUrlDisplay(url)
  });
  const searchResults = new SearchResults<Suggestion>();
  const suggestionSource = new SuggestionSource(searchQuery, searchResults);
  const searchMode = new SearchMode<SiteSearchProvider>();
  const searchAutocomplete = new SearchAutocomplete({
    settings,
    query: searchQuery,
    getInput: () => (searchBox.inputParts ? searchBox.inputParts.input : null),
    preview: suggestionInputPreview,
    isModeActive: () => Boolean(searchMode.site),
    getUrlDisplay: (url) => getUrlDisplay(url)
  });
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
    bookmarkParts,
    appliedTheme,
    settings,
    showToast,
    t
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

  const {
    applyNewtabShortcutDockMagnification,
    resetShortcutDockHover,
    setShortcutDockHover,
    holdShortcutDockHover,
    handleShortcutDockPointerOver,
    handleShortcutDockPointerMove,
    syncShortcutDockFolderMenu,
    followShortcutDockMagnification
  } = NEWTAB_SHORTCUT_DOCK.createShortcutDock({
    dragSessions,
    shortcutGrid,
    settings,
    preview,
    getShortcutTileFromNode
  });

  const {
    isShortcutContextMenuNode,
    closeShortcutContextMenu,
    handleShortcutContextMenu,
    openShortcutAddContextMenu,
    openShortcutGroupMenu
  } = NEWTAB_SHORTCUT_CONTEXT_MENU.createShortcutContextMenu({
    otherContextMenus: [bookmarkContextMenuSelectController, recentContextMenuSelectController],
    locale,
    settings,
    showToast,
    shortcutContextMenuSelectController,
    shortcutSection,
    setShortcutDockHover,
    resetShortcutDockHover,
    holdShortcutDockHover,
    getShortcutTileFromNode,
    getShortcutById,
    openFolderColorPicker,
    getShortcutFolderId,
    openShortcutEditor,
    openShortcutUrl,
    openExternalNewTabUrl,
    removeShortcutById,
    openBookmarkFolderTabGroupConfirmation,
    t,
    getShortcutContextMenuOptions,
    hideShortcutTooltip,
    getShortcutTileId,
    openShortcutGroupDialog,
    openShortcutAddDialog,
    moveShortcutGroup,
    deleteShortcutGroup,
    confirmDeleteShortcutGroupWithSites
  });

  const shortcutGroupHeaders: HTMLElement[] = [];

  const {
    getProviderFaviconPageUrl,
    getProviderIcon,
    createAggregateSearchScopeProvider,
    getProviderHost
  } = NEWTAB_SITE_SEARCH_PROVIDERS.createSiteSearchProviders({
    getPageFaviconUrlResolver,
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
    faviconParts,
    modeActions,
    searchMode,
    normalizeHost,
    parseCssColor,
    defaultAccentColor,
    defaultTheme,
    getProviderHost,
    faviconCacheRuntime,
    getPersistedSiteThemeEntry,
    getPageFaviconUrlResolver,
    getBrandAccentForUrl,
    extractAverageColor,
    getProviderIcon,
    isHostFaviconVisitDirty,
    stableHashCode,
    getThemeSourceForSuggestion: (...args) => getThemeSourceForSuggestion(...args),
    areFaviconRenderCachesReady
  });

  const { isCardActivationSuppressed } = NEWTAB_CARD_ACTIVATION_GUARD.createCardActivationGuard({ documentObj: document });

  const {
    followStoredSites,
    getPinnedRecentSites,
    getHiddenRecentSites,
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
    toggleRecentProgressTracking
  } = NEWTAB_RECENT_SITES_CONTROLLER.createRecentSitesController({
    otherContextMenus: [shortcutContextMenuSelectController, bookmarkContextMenuSelectController],
    recentShown,
    locale,
    recentContextMenuSelectController,
    settings,
    t,
    showToast,
    openExternalNewTabUrl,
    hasShortcutForSite,
    addSiteToShortcuts,
    hideCursorTooltip,
    hideTopActionTooltip,
    normalizeHost,
    getCanonicalPageUrlForFavicon,
    sanitizeDisplayText,
    getSiteDisplayName,
    shouldExcludeFromRecentSites,
    isBrowserPageRecentUrl,
    progressMatch: PROGRESS_MATCH,
    progressHistory: PROGRESS_HISTORY
  });

  const { getRecentSites } = NEWTAB_RECENT_SOURCES.createRecentSources({
    sourceReads: recentSourceReads,
    firefoxBrowserIconsReady,
    firefoxBrowserIcons,
    getRecentStoreOptions,
    isBrowserPageRecentUrl
  });
  const recentSitesReadyTask = followStoredSites();



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
    recentPointer
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
    faviconParts,
    bookmarkParts,
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
    updateFeedbackLanguageStrings,
    resolveTheme,
    addMediaQueryChangeListener,
    mediaQuery,
    removeMediaQueryChangeListener
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
    getBookmarkLimit,
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
    bookmarkGrid: pageStructureRuntime.bookmark.grid,
    bookmarksShown,
    recentSection,
    recentGrid: pageStructureRuntime.recent.grid,
    bottomDockParts,
    shortcutGrid,
    shortcutSection,
    shortcutList,
    preview,
    settings,
    updateSuggestionsFloatingLayout,
    closeRecentContextMenu,
    getVisibleShortcuts,
    resetShortcutDockHover,
    closeShortcutContextMenu,
    closeShortcutDialog,
    viewport: viewportActivity,
    recentPointer
  });

  const quoteRuntime = LumnoNewtabQuotes.createRuntime({
    documentObj: document, windowObj: window,
    settings, localStorageArea, t, showToast,
    locale,
    getSearchRoot: () => root,
    getShortcutSection: () => shortcutSection,
    getTooltipController: () => topActionTooltipController,
    onLayout: () => window.requestAnimationFrame(() => {
      updateBookmarkSectionPosition();
      adaptiveToneEvents.emit('stale', {});
    })
  });

  const {
    inferNewtabShortcutColumnsFromWidth,
    setNewtabShortcutsVisible,
    setNewtabShortcutAddVisible,
    setNewtabShortcutDockMagnificationEnabled,
    setNewtabShortcutColumns,
    setNewtabShortcutSize,
    setNewtabShortcutGap,
    initialNewtabInputAutoFocusReadyTask
  } = NEWTAB_PAGE_PREFERENCES.createPagePreferences({
    preview,
    settings
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
    setBookmarkViewMode: (mode) => void settings.set(bookmarkViewMode, bookmarkViewMode.parse(mode)).catch(() => {}),
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
    setRecentMode: (mode) => void settings.set(recentMode, recentMode.parse(mode)).catch(() => {}),
    getRecentCount: () => preview.get(recentCount),
    setRecentCount: (value, options) => {
      preview.set(recentCount, value, options);
    }
  });

  const {
    wallpaperRuntime,
    bootstrapInitialWallpaper,
    markInitialWallpaperVisualReady,
    getWallpaperShownAt
  } = NEWTAB_WALLPAPER_PAGE.createWallpaperPage({
    topContentContainer,
    bookmarkPagerPrevButton: pageStructureRuntime.bookmark.previousButton,
    bookmarkTitleWrap: pageStructureRuntime.bookmark.titleWrap,
    bookmarkParts,
    recentHeader: pageStructureRuntime.recent.header,
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
    shortcutGroupHeaders,
    getEffectiveBookmarkTopbarSurfaceMode,
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
    showTopActionTooltip,
    hideTopActionTooltip,
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
    followTheme
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


  const imeKeyGuard = LumnoImeKeyGuard.createImeKeyGuard();
  const searchInputHistoryController =
    SEARCH_INPUT_HISTORY.createSearchInputHistoryController({
      storage: createSettingPort(settings, SearchSettings.searchInputHistory)
    });
  function isImeCompositionEvent(event: KeyboardEvent): boolean {
    return imeKeyGuard.shouldIgnoreKeydown(event);
  }

  migrateLocalSettingsIfNeeded(SYNCED_PAGE_STORAGE_KEYS.slice());

  const {
    applyFaviconOpticalShift,
    applyFaviconOpticalAlignment,
    applyFallbackIcon,
    setFaviconSrcWithAnimation,
    attachFaviconData,
    preloadIcon,
    warmIconCache,
    attachFaviconWithFallbacks,
    getThemeSourceForSuggestion
  } = NEWTAB_PAGE_FAVICONS.createPageFavicons({
    isBlockedLocalFaviconUrl,
    setPersistedFaviconData,
    getPersistedFaviconEntry,
    setPersistedFaviconUrl,
    getPageFaviconUrlResolver,
    logFaviconDecision,
    faviconParts,
    getThemeSource,
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
    themeColorCache,
    normalizeHost,
    getThemeSourcePriority,
    extractAverageColor,
    buildThemeFromAccent,
    setResolvedThemeForHost,
    getShortcutFaviconCandidateUrl,
    getShortcutFaviconDataUrl,
    getProviderIcon,
    getProviderFaviconPageUrl
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

  const {
    captureRecentCardLayout,
    cancelRecentResizeLayoutAnimations,
    shouldSkipNewtabEntryMotion,
    shouldAnimateNewtabLayoutShift,
    animateRecentResizeLayout,
    applyNewtabTopContentVisibility,
    finishWordmarkEntryAnimation,
    renderNewtabTopContent,
    followTopContentSettings
  } = NEWTAB_TOP_CONTENT_RUNTIME.createTopContentRuntime({
    appliedTheme,
    locale,
    topContentContainer,
    openExternalNewTabUrl,
    recentCards,
    updateSearchEntryLayout,
    updateSuggestionsFloatingLayout,
    settings,
    preview
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

  const { getBookmarkModeMenuOptions } = NEWTAB_BOOKMARK_MODE_MENU.createBookmarkModeMenu({
    settings,
    t,
    getEffectiveBookmarkTopbarSurfaceMode,
    getBookmarkTopbarLayout
  });

  const {
    setRecentMode,
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
    moveShortcutByKeyboard: (...args) => moveShortcutByKeyboard(...args),
    t,
    hideShortcutTooltip,
    closeShortcutContextMenu,
    syncOpenBookmarkCascadeAnchorVisual: (...args) => syncOpenBookmarkCascadeAnchorVisual(...args),
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
    handleShortcutDragPointerDown: (...args) => handleShortcutDragPointerDown(...args),
    handleShortcutDockPointerOver,
    handleShortcutDockPointerMove,
    syncShortcutDockFolderMenu,
    handleShortcutGroupMenu: openShortcutGroupMenu,
    animateShortcutLayoutChange: (...args) => animateShortcutLayoutChange(...args)
  });

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
    syncOpenBookmarkCascadeAnchorVisual,
    finishBookmarkDrag,
    handleBookmarkDragPointerDown,
    handleBookmarkCascadeItemPointerDown
  } = NEWTAB_BOOKMARK_DRAG_CONTROLLER.createBookmarkDragController({
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
    getShortcutReorderTiles,
    getShortcutTileLayoutRect: (...args) => getShortcutTileLayoutRect(...args),
    getShortcutStoreOptions,
    getShortcutInsertionSlotAt: (...args) => getShortcutInsertionSlotAt(...args),
    getShortcutTileId,
    getBookmarkPageCount: (...args) => getBookmarkPageCount(...args),
    // A recent card dragged over the bookmarks opens folders like the others.
    isBookmarkSurfaceDragStateActive: (state) => isBookmarkSurfaceDragStateActive(state) ||
      Boolean(state && state === dragSessions.recentCard && state.isDragging),
    openBookmarkCascadeMenu,
    navigateBookmarkFolder,
    switchBookmarkPageDuringDrag: (...args) => switchBookmarkPageDuringDrag(...args),
    setShortcutDragTileTransform: (...args) => setShortcutDragTileTransform(...args),
    hideCursorTooltip,
    closeBookmarkCascadeMenu,
    renderCurrentBookmarkPage: (...args) => renderCurrentBookmarkPage(...args),
    autoScrollShortcutArea: (...args) => autoScrollShortcutArea(...args),
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
    getShortcutTileLayoutRect,
    setShortcutDragTileTransform,
    getShortcutInsertionSlotAt,
    autoScrollShortcutArea,
    animateShortcutLayoutChange,
    finishShortcutDrag,
    moveShortcutByKeyboard,
    isBookmarkSurfaceDragStateActive,
    handleShortcutDragPointerDown
  } = NEWTAB_SHORTCUT_DRAG.createShortcutDrag({
    settings,
    dragSessions,
    historyLock,
    bookmarkGrid: pageStructureRuntime.bookmark.grid,
    bookmarkParts,
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
    autoScrollShortcutArea,
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
