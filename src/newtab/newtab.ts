import * as BLACKLIST_UTILS from '../domain/blacklist-utils';
import * as FOLDER_REFERENCES from '../domain/bookmark-folder-reference';
import * as FOLDER_BINDINGS from '../platform/bookmark-folder-bindings';
import * as LumnoBrowserProfile from '../platform/browser-profile';
import * as LumnoCommunityLinks from '../platform/community-links';
import * as EXTENSION_ROUTES from '../domain/extension-routes';
import * as LumnoShortcutFaviconStore from '../platform/shortcut-favicon-store';
import * as LumnoBrowserIcons from '../platform/browser-icons';
import * as NAVIGATION_DISPOSITION from '../domain/navigation-disposition';
import * as PROGRESS_HISTORY from '../domain/progress-history';
import * as PROGRESS_MATCH from '../domain/progress-match';
import * as AGGREGATE_SEARCH_STORE from '../domain/search/aggregate-search-store';
import * as AGGREGATE_SEARCH_SURFACE from '../domain/search/aggregate-search-surface';
import * as LumnoImeKeyGuard from '../domain/search/ime-key-guard';
import * as SEARCH_INPUT_HISTORY from '../domain/search/search-input-history';
import * as SUGGESTION_ACTION_MODEL from '../domain/search/suggestion-action-model';
import * as SUGGESTION_NAVIGATION from '../shared/search/suggestion-navigation';
import * as SHORTCUT_KEY_MATCHER from '../domain/shortcut-key-matcher';
import * as SITE_DISPLAY_NAME from '../domain/site-display-name';
import * as FEATURE_HINTS from '../shared/ui/feature-hints';
import * as NEWTAB_APPEARANCE_MODES from './appearance-modes';
import * as NEWTAB_BOOKMARK_ACTIONS from './bookmarks/bookmark-actions';
import * as NEWTAB_BOOKMARK_CASCADE_ACTIONS from './bookmarks/bookmark-cascade-actions';
import * as NEWTAB_BOOKMARK_CONTEXT_MENU from './bookmarks/bookmark-context-menu';
import * as NEWTAB_BOOKMARK_DISPLAY_SETTINGS from './bookmarks/bookmark-display-settings';
import * as NEWTAB_BOOKMARK_DRAG_CONTROLLER from './bookmarks/bookmark-drag-controller';
import * as NEWTAB_BOOKMARK_DRAG from './bookmarks/bookmark-drag';
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
import * as NEWTAB_CROSS_SURFACE_DRAG from './cross-surface-drag';
import * as LumnoNewtabDismissStack from './dismiss-stack';
import * as NEWTAB_ENTRY_MOTION from './entry-motion';
import * as NEWTAB_FEEDBACK_CONTROL_RUNTIME from './feedback-control';
import * as NEWTAB_INPUT_FOCUS from './input-focus';
import * as NEWTAB_LAYOUT from './layout';
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
import * as NEWTAB_DIRECT_NAVIGATION_SETTLE from './search/direct-navigation-settle';
import * as NEWTAB_SEARCH_AUTOCOMPLETE from './search/search-autocomplete';
import * as NEWTAB_SEARCH_BOX_CONTROLS from './search/search-box-controls';
import * as NEWTAB_SEARCH_BOX from './search/search-box';
import * as NEWTAB_SEARCH_INPUT_COMPOSITION from './search/search-input-composition';
import * as NEWTAB_SEARCH_MODE_CONTROLLER from './search/search-mode-controller';
import * as NEWTAB_SEARCH_MODES from './search/search-modes';
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
import * as NEWTAB_SETTINGS_SYNC from './settings-sync';
import * as NEWTAB_BOTTOM_DOCK_RUNTIME from './shortcuts/bottom-dock-runtime';
import * as NEWTAB_SHORTCUT_CONTEXT_MENU from './shortcuts/shortcut-context-menu';
import * as NEWTAB_SHORTCUT_DOCK from './shortcuts/shortcut-dock';
import * as NEWTAB_SHORTCUT_DRAG from './shortcuts/shortcut-drag';
import * as NEWTAB_SHORTCUT_ICON_PLATE from './shortcuts/shortcut-icon-plate';
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
  bookmarkFolderColorPresets,
  bookmarkFolderIconsVisible,
  bookmarkViewMode,
  hiddenRecentSites,
  newtabAppearanceButtonVisible,
  newtabFavicon,
  newtabFeedbackButtonVisible,
  newtabInputAutoFocusEnabled,
  newtabLocalWallpaper,
  newtabOpenInNewTab,
  newtabSearchWidth,
  newtabShortcutsVisible,
  newtabShortcutAddVisible,
  NEWTAB_SHORTCUT_COLUMNS_MIN,
  newtabShortcutColumns,
  newtabShortcutDockMagnificationEnabled,
  NEWTAB_SHORTCUT_WIDTH_MAX,
  NEWTAB_SHORTCUT_WIDTH_MIN,
  newtabShortcutWidth,
  newtabWallpaperEffect,
  newtabWallpaperOverlay,
  newtabWallpaper,
  newtabWidthMode,
  newtabZenMode,
  numberShortcutInstantEnabled,
  overlayTabPriority,
  pinnedRecentSites,
  recentCount,
  recentMode,
  simpleModeEnabled
} from '../domain/settings';
import {
  BOOKMARK_CONTEXT_MENU_EDIT_VALUE,
  BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE,
  BOOKMARK_TOPBAR_LAYOUT_ACTION,
  BOOKMARK_TOPBAR_PICK_COLOR_ACTION,
  BOOKMARK_TOPBAR_SURFACE_MODE_ACTION,
  FAVICON_CACHE_BOOT_WAIT_MS,
  FOLDER_COLOR_CONTEXT_MENU_VALUE,
  MAX_PINNED_RECENT_SITES,
  NEWTAB_CONTEXT_MENU_OPEN_VALUE,
  NEWTAB_GLASS_ADAPTIVE_SELECTOR,
  NEWTAB_MOBILE_FLOW_BREAKPOINT_PX,
  NEWTAB_WIDTH_MODE_CONFIGS,
  RECENT_CARD_TARGET_WIDTH_PX,
  RECENT_GRID_GAP_PX,
  SHORTCUT_CONTEXT_MENU_EDIT_VALUE,
  SHORTCUT_CONTEXT_MENU_HIDE_ADD_VALUE,
  SHORTCUT_CONTEXT_MENU_REMOVE_VALUE,
  SHORTCUT_DIALOG_ITEM_BOOKMARK,
  SHORTCUT_DIALOG_ITEM_FOLDER,
  SHORTCUT_GROUP_MENU_VALUES,
  SYNCED_PAGE_STORAGE_KEYS,
  WORDMARK_ENTRY_ANIMATION_NAME,
  createSiteDisplayNameOptions
} from './newtab-config';
import { SiteSearchIconCache } from '../shared/search/site-search-icon-cache';
import { DefaultSearchEngine } from '../shared/search-panel/default-engine';
import { SiteSearchCatalog } from '../shared/search-panel/site-search/catalog';
import type { BackgroundAction, BackgroundReply, BackgroundRequest } from '../domain/messages';
import type { Disposition } from '../domain/navigation-disposition';
import type { OpenModifiers, SearchActionModel, SearchActionModelOptions } from '../domain/search/suggestion-action-model';
import type { SuggestionElement } from '../shared/react/search/suggestion-list/types';
import type { BookmarkCardElement } from './react/bookmarks';
import type { RecentCardElement } from './react/recent-sites';
import type { ShortcutTileElement } from './react/shortcuts';
import { readBootValue } from '../platform/boot-handoff';
import { getBookmarksTopbarApi } from './react/bookmarks-topbar';
import { createToastController } from '../shared/react/toast';
import { getShortcutDialogApi } from './react/shortcut-dialog-lazy';
import { getShortcutsViewApi } from './react/shortcuts';
import { getFeedbackControlApi } from './react/feedback';
import { getSelectMenuApi } from './react/select-menu';
import { getTopContentApi } from './react/wordmark';
import { getPageStructureApi } from './react/page-structure';
import { getFolderColorPickerApi } from './react/folder-color-picker-lazy';
import { createSearchInput } from '../shared/react/search-input';
import { newtabShortcutGap, newtabShortcutSize } from '../domain/settings/newtab-shortcuts';
import { bookmarkFolderColorRefs, bookmarkFolderColorsLegacy } from '../domain/settings/bookmarks';
import { newtabShortcutFaviconCache, newtabShortcutsLocalOverflow, shortcutFolderBindings } from '../domain/settings/newtab-shortcuts';
import { createSettingPort, createSettingsStore, getContextSettingsStore } from '../platform/settings-store';
import { takePrefetchedRead } from '../platform/storage-read-batch';
import { TimePreview } from './top-content/time-preview';
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
import * as ShortcutConstants from '../domain/shortcuts/constants';
import * as SettingsStorage from '../platform/settings-storage';

(function() {
  // Page state shared with the modules split out of this file: each module
  // receives this one object as `pageState` and reads and writes the same
  // properties this file does. page-state.ts lists its initial values.
  const pageState = LumnoNewtabPageState.createPageState();
  // The page's settings, read and followed through the one store of this context.
  const settings = getContextSettingsStore(chrome, window, takePrefetchedRead);
  const timePreview = new TimePreview(settings);
  const root = document.getElementById('_x_extension_newtab_root_2024_unique_');
  if (!root) {
    return;
  }
  if (document.body) {
    document.body.removeAttribute('data-nt-ready');
  }

  const {
    settingsRuntimeApi,
    providerStorageRuntime,
    startupStorageReadBatch,
    storageArea,
    isPrimaryStorageAreaName,
    migrateLocalSettingsIfNeeded
  } = NEWTAB_STARTUP_STORAGE.createStartupStorage();

  // Edge's topSites lists its own promoted sites instead of the user's, so Edge
  // ranks most-visited from history visit counts alone.
  const TOP_SITES_FOLLOW_HISTORY =
    LumnoBrowserProfile.getBrowserInternalScheme(navigator.userAgent) !== 'edge://';
  const startupRecentSourceReadsAt = Date.now();

  const {
    updateRecentContextMenuLanguageStrings,
    openRecentHistoryDialog,
    readRecentOpenTabs,
    readRecentTopSites,
    readRecentHistoryItems,
    releaseStartupRecentSourceReads,
    getRecentSites
  } = NEWTAB_RECENT_SOURCES.createRecentSources({
    t: (...args) => t(...args),
    getRecentContextMenuOptions: (...args) => getRecentContextMenuOptions(...args),
    NEWTAB_CONTEXT_MENU_OPEN_VALUE,
    restoreProgressVersion: (...args) => restoreProgressVersion(...args),
    showToast: (...args) => showToast(...args),
    TOP_SITES_FOLLOW_HISTORY,
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
  const bookmarkTopbarSurfaceStorageArea =
    (chrome && chrome.storage && chrome.storage.local)
      ? chrome.storage.local
      : null;
  const recentSitesStorageArea = storageArea || localStorageArea;
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

  const SETTINGS = settingsRuntimeApi;
  const BROWSER_PROFILE = LumnoBrowserProfile;
  const COMMUNITY_LINKS = LumnoCommunityLinks;
  const LUMNO_FEEDBACK_LINKS_FALLBACK = COMMUNITY_LINKS.FALLBACK_LINKS;
  const NEWTAB_BOOKMARKS_TOPBAR = getBookmarksTopbarApi();
  const BOOKMARK_TOPBAR_HEIGHT_PX = Math.max(
    0,
    Number(NEWTAB_BOOKMARKS_TOPBAR.HEIGHT_PX) || 36
  );
  // Escape closes only the top open layer (menus, popovers, panels, drags).
  // The folder color dialog handles its own Escape.
  const dismissStack = LumnoNewtabDismissStack.getDismissStack();
  dismissStack.setShouldIgnore(() => Boolean(pageState.folderColorPicker && pageState.folderColorPicker.isOpen()));
  const NEWTAB_SHORTCUT_DIALOG = getShortcutDialogApi();
  const NEWTAB_SHORTCUTS_VIEW = getShortcutsViewApi();
  const NEWTAB_FEEDBACK_CONTROL = getFeedbackControlApi();

  // The page's language; it follows the stored choice from the first read.
  const locale = new SurfaceLocale(settings, loadNewtabLocaleMessages);
  locale.follow();
  const { t, formatMessage } = locale;
  const sanitizeDisplayText = SearchDirectNavigation.sanitizeDisplayText;

  const {
    getFeedbackWebLocale,
    openFeedbackExternalUrl,
    updateFeedbackLanguageStrings,
    isFeedbackPopoverOpen,
    closeFeedbackPopover,
    createFeedbackControls
  } = NEWTAB_FEEDBACK_CONTROL_RUNTIME.createFeedbackControlRuntime({
    locale,
    COMMUNITY_LINKS,
    LUMNO_FEEDBACK_LINKS_FALLBACK,
    t,
    openExternalNewTabUrl: (...args) => openExternalNewTabUrl(...args),
    hideTopActionTooltip: (...args) => hideTopActionTooltip(...args),
    NEWTAB_FEEDBACK_CONTROL,
    showTopActionTooltip: (...args) => showTopActionTooltip(...args),
    pageState
  });

  const NEWTAB_SELECT_MENU = getSelectMenuApi();
  const NEWTAB_TOP_CONTENT = getTopContentApi();
  const NEWTAB_PAGE_STRUCTURE = getPageStructureApi();
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


  const {
    hideToast,
    showToast,
    beginToast,
    copyBookmarkUrl,
    copySearchResultUrl
  } = NEWTAB_CLIPBOARD_ACTIONS.createClipboardActions({
    t,
    pageState
  });
  const MAX_NEWTAB_SHORTCUTS = ShortcutConstants.DEFAULT_MAX_SHORTCUTS;
  const shortcutTiles: ShortcutTileElement[] = [];
  const SHORTCUT_DIALOG_MODE_EDIT = NEWTAB_SHORTCUT_DIALOG.MODE_EDIT || 'edit';
  const folderColorApi = getFolderColorPickerApi();


  const {
    updateBookmarkContextMenuLanguageStrings,
    openBookmarkFolderTabGroupConfirmation,
    openBookmarkEditor
  } = NEWTAB_BOOKMARK_ACTIONS.createBookmarkActions({
    t,
    getBookmarkContextMenuOptions: (...args) => getBookmarkContextMenuOptions(...args),
    BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE,
    NEWTAB_CONTEXT_MENU_OPEN_VALUE,
    BOOKMARK_CONTEXT_MENU_EDIT_VALUE,
    bookmarksRuntime,
    NEWTAB_BOOKMARKS_STORE,
    openShortcutDialog: (...args) => openShortcutDialog(...args),
    formatMessage,
    showToast,
    isShortcutFolderAnchor: (...args) => isShortcutFolderAnchor(...args),
    getFolderItemIcon: (...args) => getFolderItemIcon(...args),
    SHORTCUT_DIALOG_MODE_EDIT,
    SHORTCUT_DIALOG_ITEM_FOLDER,
    SHORTCUT_DIALOG_ITEM_BOOKMARK,
    getFolderItemIconUrl: (...args) => getFolderItemIconUrl(...args),
    getBrowserPageFaviconUrl: (...args) => getBrowserPageFaviconUrl(...args),
    pageState
  });

  const {
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
    folderColorApi,
    t,
    bindShortcutDialogTooltip: (...args) => bindShortcutDialogTooltip(...args),
    hideShortcutDialogTooltip: (...args) => hideShortcutDialogTooltip(...args),
    readSavedFolderColors: (...args) => readSavedFolderColors(...args),
    saveSavedFolderColors: (...args) => saveSavedFolderColors(...args),
    SHORTCUT_GROUP_MENU_VALUES,
    getShortcutGroups: (...args) => getShortcutGroups(...args),
    SHORTCUT_CONTEXT_MENU_HIDE_ADD_VALUE,
    MAX_NEWTAB_SHORTCUTS,
    NEWTAB_CONTEXT_MENU_OPEN_VALUE,
    BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE,
    NEWTAB_BOOKMARKS_STORE,
    bookmarksRuntime,
    getShortcutFolderId: (...args) => getShortcutFolderId(...args),
    SHORTCUT_CONTEXT_MENU_EDIT_VALUE,
    FOLDER_COLOR_CONTEXT_MENU_VALUE,
    SHORTCUT_CONTEXT_MENU_REMOVE_VALUE,
    updateBookmarkContextMenuLanguageStrings,
    updateRecentContextMenuLanguageStrings,
    createShortcutDialogComponent: (...args) => createShortcutDialogComponent(...args),
    showToast,
    shortcutTiles,
    openBookmarkEditor,
    getShortcutTitle: (...args) => getShortcutTitle(...args),
    SHORTCUT_DIALOG_MODE_EDIT,
    getShortcutIconDataUrl: (...args) => getShortcutIconDataUrl(...args),
    pageState
  });

  const {
    getBookmarkContextMenuOptions,
    isBookmarkContextMenuNode,
    closeBookmarkContextMenu,
    handleBookmarkItemContextMenu
  } = NEWTAB_BOOKMARK_CONTEXT_MENU.createBookmarkContextMenu({
    bookmarksRuntime,
    NEWTAB_BOOKMARKS_STORE,
    BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE,
    t,
    NEWTAB_CONTEXT_MENU_OPEN_VALUE,
    FOLDER_COLOR_CONTEXT_MENU_VALUE,
    BOOKMARK_CONTEXT_MENU_EDIT_VALUE,
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
  const NEWTAB_SHORTCUTS_LOCAL_OVERFLOW_STORAGE_KEY = newtabShortcutsLocalOverflow.key;
  const NEWTAB_SHORTCUT_COLUMNS_MAX = Number.isFinite(Number(SETTINGS.NEWTAB_SHORTCUT_COLUMNS_MAX))
    ? Number(SETTINGS.NEWTAB_SHORTCUT_COLUMNS_MAX)
    : 16;
  const NEWTAB_SHORTCUT_COLUMNS_DEFAULT = Number.isFinite(
    Number(SETTINGS.NEWTAB_SHORTCUT_COLUMNS_DEFAULT)
  )
    ? Number(SETTINGS.NEWTAB_SHORTCUT_COLUMNS_DEFAULT)
    : 10;
  const NEWTAB_SHORTCUT_SIZE_STORAGE_KEY = SETTINGS.newtabShortcutSize.key ||
    newtabShortcutSize.key;
  const NEWTAB_SHORTCUT_SIZE_MIN = Number.isFinite(Number(SETTINGS.NEWTAB_SHORTCUT_SIZE_MIN))
    ? Number(SETTINGS.NEWTAB_SHORTCUT_SIZE_MIN)
    : 48;
  const NEWTAB_SHORTCUT_SIZE_MAX = Number.isFinite(Number(SETTINGS.NEWTAB_SHORTCUT_SIZE_MAX))
    ? Number(SETTINGS.NEWTAB_SHORTCUT_SIZE_MAX)
    : 112;
  const NEWTAB_SHORTCUT_SIZE_DEFAULT = Number.isFinite(
    Number(SETTINGS.NEWTAB_SHORTCUT_SIZE_DEFAULT)
  )
    ? Number(SETTINGS.NEWTAB_SHORTCUT_SIZE_DEFAULT)
    : 64;
  const NEWTAB_SHORTCUT_GAP_STORAGE_KEY = SETTINGS.newtabShortcutGap.key ||
    newtabShortcutGap.key;
  const NEWTAB_SHORTCUT_GAP_MIN = Number.isFinite(Number(SETTINGS.NEWTAB_SHORTCUT_GAP_MIN))
    ? Number(SETTINGS.NEWTAB_SHORTCUT_GAP_MIN)
    : 0;
  const NEWTAB_SHORTCUT_GAP_MAX = Number.isFinite(Number(SETTINGS.NEWTAB_SHORTCUT_GAP_MAX))
    ? Number(SETTINGS.NEWTAB_SHORTCUT_GAP_MAX)
    : 24;
  const NEWTAB_SHORTCUT_GAP_DEFAULT = Number.isFinite(
    Number(SETTINGS.NEWTAB_SHORTCUT_GAP_DEFAULT)
  )
    ? Number(SETTINGS.NEWTAB_SHORTCUT_GAP_DEFAULT)
    : 4;
  const NEWTAB_SHORTCUT_ICONS_STORAGE_KEY = NewtabShortcutSettings.newtabShortcutIcons.key;
  const NEWTAB_SHORTCUT_FAVICON_CACHE_STORAGE_KEY = newtabShortcutFaviconCache.key;
  const siteSearchIconCache = new SiteSearchIconCache(LumnoShortcutFaviconStore.createShortcutFaviconStore({
    chromeApi: typeof chrome !== 'undefined' ? chrome : null,
    storageArea: localStorageArea,
    storageKey: SearchSettings.siteSearchIconCache.key,
    ...ShortcutIconCache.SITE_SEARCH_CACHE_OPTIONS
  }));
  void siteSearchIconCache.load();
  const searchEngine = new DefaultSearchEngine(settings);
  searchEngine.follow();
  const siteSearchCatalog = new SiteSearchCatalog(settings, searchEngine);
  siteSearchCatalog.follow();
  const NEWTAB_SHORTCUTS_CRITICAL_SYNC_RESERVE_BYTES = ShortcutConstants.DEFAULT_SHORTCUTS_SYNC_RESERVE_BYTES;
  const NEWTAB_SHORTCUTS_STORAGE_KEYS = ShortcutConstants.SHORTCUT_STORAGE_KEYS;
  const pageSearchParams = new URLSearchParams(window.location.search || '');
  const {
    mediaQuery,
    resolveTheme,
    addMediaQueryChangeListener,
    removeMediaQueryChangeListener
  } = NEWTAB_SYSTEM_THEME.createSystemTheme(window);
  const initialThemeReadyPromise = new Promise<void>((resolve) => {
    pageState.resolveInitialThemeReady = resolve;
  });

  const {
    bookmarkTopbarStorageKeys,
    normalizeBookmarkViewMode,
    shouldRepairBookmarkViewModeStorageValue,
    persistBookmarkViewMode,
    loadInitialBookmarkViewMode,
    getEffectiveBookmarkTopbarSurfaceMode,
    getBookmarkTopbarLayout,
    syncBookmarkTopbarSurfaceAppearance,
    loadInitialBookmarkTopbarSurfaceMode,
    syncBookmarkTopbarSurfaceColorForTheme,
    loadInitialBookmarkTopbarSurfaceColors,
    registerStorageChangeHandlers: registerBookmarkDisplayStorageChanges,
    handleBookmarkModeMenuAction
  } = NEWTAB_BOOKMARK_DISPLAY_SETTINGS.createBookmarkDisplaySettings({
    storageArea,
    BOOKMARK_VIEW_MODE_STORAGE_KEY: bookmarkViewMode.key,
    applyBookmarkViewMode: (...args) => applyBookmarkViewMode(...args),
    localStorageArea,
    isPrimaryStorageAreaName,
    NEWTAB_BOOKMARKS_TOPBAR,
    bookmarkTopbarSurfaceStorageArea,
    updateBookmarkModeMenu: (...args) => updateBookmarkModeMenu(...args),
    setNewtabTopLayout: (...args) => setNewtabTopLayout(...args),
    scheduleWallpaperAdaptiveToneUpdate: (...args) => scheduleWallpaperAdaptiveToneUpdate(...args),
    initialThemeReadyPromise,
    showToast,
    t,
    BOOKMARK_TOPBAR_PICK_COLOR_ACTION,
    BOOKMARK_TOPBAR_SURFACE_MODE_ACTION,
    BOOKMARK_TOPBAR_LAYOUT_ACTION,
    pageState
  });
  const initialBookmarkViewModeReadyPromise = new Promise<void>((resolve) => {
    pageState.resolveInitialBookmarkViewModeReady = resolve;
    if (!storageArea) {
      resolve();
    }
  });
  const recentCards: RecentCardElement[] = [];
  const bookmarkCards: BookmarkCardElement[] = [];
  const suggestionItems: SuggestionElement[] = [];
  const newtabEntryAnimationReadyPromise = new Promise<void>((resolve) => {
    pageState.resolveNewtabEntryAnimationReady = resolve;
  });
  pageState.feedbackLinks = LUMNO_FEEDBACK_LINKS_FALLBACK;
  const bookmarkMoveHistory = NEWTAB_BOOKMARK_MOVE_HISTORY.createBookmarkMoveHistory({ maxEntries: 30 });

  const {
    isShortcutContextMenuOpen,
    isShortcutContextMenuNode,
    clearShortcutContextMenuTileActive,
    applyShortcutContextMenuDockHover,
    closeShortcutContextMenu,
    handleShortcutContextMenu,
    openShortcutAddContextMenu,
    openShortcutGroupMenu
  } = NEWTAB_SHORTCUT_CONTEXT_MENU.createShortcutContextMenu({
    setShortcutContextMenuMark: (mark) => setShortcutContextMenuMark(mark),
    getShortcutDockIcon: (...args) => getShortcutDockIcon(...args),
    setShortcutDockHover: (...args) => setShortcutDockHover(...args),
    resetShortcutDockHover: (...args) => resetShortcutDockHover(...args),
    getShortcutTileFromNode,
    getShortcutById,
    SHORTCUT_CONTEXT_MENU_HIDE_ADD_VALUE,
    hideShortcutAddFromContextMenu: (...args) => hideShortcutAddFromContextMenu(...args),
    FOLDER_COLOR_CONTEXT_MENU_VALUE,
    openFolderColorPicker: (...args) => openFolderColorPicker(...args),
    getShortcutFolderId: (...args) => getShortcutFolderId(...args),
    SHORTCUT_CONTEXT_MENU_EDIT_VALUE,
    openShortcutEditor,
    NEWTAB_CONTEXT_MENU_OPEN_VALUE,
    openShortcutUrl: (...args) => openShortcutUrl(...args),
    openExternalNewTabUrl: (...args) => openExternalNewTabUrl(...args),
    SHORTCUT_CONTEXT_MENU_REMOVE_VALUE,
    removeShortcutById: (...args) => removeShortcutById(...args),
    BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE,
    openBookmarkFolderTabGroupConfirmation,
    t,
    getShortcutContextMenuOptions,
    closeRecentContextMenu: (...args) => closeRecentContextMenu(...args),
    hideShortcutTooltip: (...args) => hideShortcutTooltip(...args),
    getShortcutTileId,
    SHORTCUT_GROUP_MENU_VALUES,
    openShortcutGroupDialog: (...args) => openShortcutGroupDialog(...args),
    openShortcutAddDialog: (...args) => openShortcutAddDialog(...args),
    moveShortcutGroup: (...args) => moveShortcutGroup(...args),
    deleteShortcutGroup: (...args) => deleteShortcutGroup(...args),
    confirmDeleteShortcutGroupWithSites: (...args) => confirmDeleteShortcutGroupWithSites(...args),
    pageState
  });

  const {
    getShortcutDockIcon,
    applyNewtabShortcutDockMagnification,
    resetShortcutDockHover,
    setShortcutDockHover,
    handleShortcutDockPointerOver,
    handleShortcutDockPointerMove,
    syncShortcutDockFolderMenu
  } = NEWTAB_SHORTCUT_DOCK.createShortcutDock({
    isShortcutDragActive: (...args) => isShortcutDragActive(...args),
    isBookmarkDragActive: () => isBookmarkDragActive() ||
      Boolean(pageState.recentCardDragRuntime && pageState.recentCardDragRuntime.isRecentCardDragActive()),
    isShortcutContextMenuOpen,
    applyShortcutContextMenuDockHover,
    clearShortcutContextMenuTileActive,
    getShortcutTileFromNode,
    pageState
  });

  const shortcutGroupHeaders: HTMLElement[] = [];
  const LEGACY_FOLDER_COLORS_STORAGE_KEY = bookmarkFolderColorsLegacy.key;
  const FOLDER_COLOR_REFS_STORAGE_KEY = bookmarkFolderColorRefs.key;



  const {
    buildSearchUrl,
    isAiSiteSearchProvider,
    isSearchEngineSiteSearchProvider,
    isAggregateSearchProvider,
    runSiteSearchProviderQuery,
    getProviderFaviconPageUrl,
    getProviderIcon,
    createAggregateSearchScopeProvider,
    getSiteSearchDisplayName,
    getSiteSearchActionTitle,
    getSiteSearchPrefixText,
    getInlineSiteSearchCandidate,
    promoteStrongNavigationMatch,
    getKeywordSearchSuggestionState,
    getTopSiteMatchCandidate,
    promoteTopSiteMatch,
    getProviderHost,
    getSiteSearchTriggerCandidate,
    getLocalSearchScopeCandidate,
    getLocalSearchScopeLabel,
    getLocalSearchScopeIconName
  } = NEWTAB_SITE_SEARCH_PROVIDERS.createSiteSearchProviders({
    settings,
    AGGREGATE_SEARCH_STORE,
    AGGREGATE_SEARCH_SURFACE,
    showToast,
    t,
    navigateToUrl: (...args) => navigateToUrl(...args),
    getPageFaviconUrlResolver: (...args) => getPageFaviconUrlResolver(...args),
    siteSearchIconCache,
    getExtensionResourceUrl,
    formatMessage,
    getDirectNavigationUrl: (...args) => getDirectNavigationUrl(...args),
    getUrlDisplay: (...args) => getUrlDisplay(...args),
    getHelpCenterLocale: (...args) => getHelpCenterLocale(...args)
  });

  const defaultTheme = createDefaultTheme();
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
    normalizeHost,
    parseCssColor,
    defaultAccentColor,
    defaultTheme,
    getProviderHost,
    recentCards,
    applyRecentCardTheme: (...args) => applyRecentCardTheme(...args),
    bookmarkCards,
    applyBookmarkCardTheme: (...args) => applyBookmarkCardTheme(...args),
    shortcutTiles,
    applyShortcutTileTheme: (...args) => applyShortcutTileTheme(...args),
    suggestionItems,
    setSiteSearchPrefix: (...args) => setSiteSearchPrefix(...args),
    updateSelection: (...args) => updateSelection(...args),
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
    isEnglishQuery,
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
    EXTENSION_ROUTES,
    t,
    getPageFaviconUrlResolver: (...args) => getPageFaviconUrlResolver(...args),
    BLACKLIST_UTILS,
    getBrowserIconUrl: pageState.firefoxBrowserIcons ? pageState.firefoxBrowserIcons.get : undefined
  });

  const { isCardActivationSuppressed } = NEWTAB_CARD_ACTIVATION_GUARD.createCardActivationGuard({ documentObj: document });

  const {
    getRecentContextMenuOptions,
    closeRecentContextMenu,
    handleRecentCardContextMenu,
    getRecentStoreOptions,
    getRecentSiteUrlKey,
    normalizeHiddenRecentSites,
    readHiddenRecentSites,
    writeHiddenRecentSites,
    isRecentSiteHidden,
    normalizeRecentSiteRecord,
    normalizePinnedRecentSites,
    readPinnedRecentSites,
    isRecentSitePinned,
    mergeRecentSitesWithPinned,
    togglePinnedRecentSite,
    getRecentProgressState,
    toggleRecentProgressTracking,
    restoreProgressVersion
  } = NEWTAB_RECENT_SITES_CONTROLLER.createRecentSitesController({
    NEWTAB_CONTEXT_MENU_OPEN_VALUE,
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
    MAX_PINNED_RECENT_SITES,
    recentSitesStorageArea,
    HIDDEN_RECENT_SITES_STORAGE_KEY: hiddenRecentSites.key,
    renderRecentSites: (...args) => renderRecentSites(...args),
    PINNED_RECENT_SITES_STORAGE_KEY: pinnedRecentSites.key,
    progressMatch: PROGRESS_MATCH,
    progressHistory: PROGRESS_HISTORY,
    progressHistoryStorageArea: localStorageArea,
    openProgressHistory: (item) => openRecentHistoryDialog(item),
    pageState
  });


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
    syncFolderColorsWithBookmarks,
    scheduleFolderColorSync,
    loadFolderColors,
    openFolderColorPicker
  } = NEWTAB_FOLDER_COLORS.createFolderColors({
    folderColorApi,
    NEWTAB_BOOKMARK_FOLDER_ICON,
    storageArea,
    FOLDER_COLOR_REFS_STORAGE_KEY,
    bookmarksRuntime,
    localStorageArea,
    LEGACY_FOLDER_COLORS_STORAGE_KEY,
    closeBookmarkCascadeMenu,
    closeShortcutDialog,
    hideCursorTooltip: (...args) => hideCursorTooltip(...args),
    t,
    playFolderPathMorph,
    bindShortcutDialogTooltip: (...args) => bindShortcutDialogTooltip(...args),
    hideShortcutDialogTooltip: (...args) => hideShortcutDialogTooltip(...args),
    FOLDER_COLOR_PRESETS_STORAGE_KEY: bookmarkFolderColorPresets.key,
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

  pageState.shortcutContextMenuSelectController = NEWTAB_SELECT_MENU.createController({
      documentObj: document,
      windowObj: window,
      onBeforeOpen: () => {
        hideShortcutTooltip();
        hideTopActionTooltip();
      },
      getViewportTopInset: () => getNewtabViewportTopPaddingPx()
    });
  pageState.bookmarkContextMenuSelectController = NEWTAB_SELECT_MENU.createController({
      documentObj: document,
      windowObj: window,
      onBeforeOpen: () => {
        hideCursorTooltip();
        hideTopActionTooltip();
      },
      getViewportTopInset: () => getNewtabViewportTopPaddingPx()
    });
  pageState.recentContextMenuSelectController = NEWTAB_SELECT_MENU.createController({
      documentObj: document,
      windowObj: window,
      onBeforeOpen: () => {
        hideCursorTooltip();
        hideTopActionTooltip();
      },
      getViewportTopInset: () => getNewtabViewportTopPaddingPx()
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
    pageState
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
    locale,
    settings,
    t,
    renderNewtabTopContent: (...args) => renderNewtabTopContent(...args),
    updateRecentModeMenu: (...args) => updateRecentModeMenu(...args),
    updateBookmarkModeMenu: (...args) => updateBookmarkModeMenu(...args),
    updateWallpaperLanguageStrings: (...args) => updateWallpaperLanguageStrings(...args),
    updateWallpaperAppearanceSelectionUi: (...args) => updateWallpaperAppearanceSelectionUi(...args),
    updateFeedbackLanguageStrings,
    renderShortcuts: () => renderShortcuts(),
    setLocalSearchScopePrefix: (...args) => setLocalSearchScopePrefix(...args),
    updateModeBadge: (...args) => updateModeBadge(...args),
    recentCards,
    bookmarkCards,
    renderSuggestions: (...args) => renderSuggestions(...args),
    forceReloadRecentSitesForI18n: (...args) => forceReloadRecentSitesForI18n(...args),
    shortcutTiles,
    applyShortcutTileTheme,
    resolveTheme,
    syncBookmarkTopbarSurfaceColorForTheme,
    applyWordmarkThemeAppearance: (...args) => applyWordmarkThemeAppearance(...args),
    suggestionItems,
    applyThemeVariables,
    applyRecentCardTheme,
    applyBookmarkCardTheme,
    updateSelection: (...args) => updateSelection(...args),
    addMediaQueryChangeListener,
    mediaQuery,
    removeMediaQueryChangeListener,
    scheduleWallpaperAdaptiveToneUpdate: (...args) => scheduleWallpaperAdaptiveToneUpdate(...args),
    initialThemeReadyPromise,
    pageState
  });
  const NEWTAB_SEARCH_WIDTH_CONFIG = NEWTAB_LAYOUT.SEARCH_WIDTH_CONFIG;
  const toastElement = document.getElementById('_x_extension_toast_2024_unique_');
  pageState.toastController = createToastController(toastElement, { windowObj: window });



  const {
    syncSearchModeMenuResultOffset,
    setSuggestionsVisible,
    updateSuggestionsFloatingLayout
  } = NEWTAB_SUGGESTIONS_LAYOUT.createSuggestionsLayout({
    pageState
  });

  const {
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
  } = NEWTAB_PAGE_LAYOUT.createPageLayout({
    normalizeBookmarkColumns: (...args) => normalizeBookmarkColumns(...args),
    NEWTAB_LAYOUT,
    NEWTAB_MOBILE_FLOW_BREAKPOINT_PX,
    NEWTAB_WIDTH_MODE_CONFIGS,
    normalizeNewtabWidthMode: (...args) => normalizeNewtabWidthMode(...args),
    normalizeNewtabSearchWidth: (...args) => normalizeNewtabSearchWidth(...args),
    NEWTAB_SEARCH_WIDTH_CONFIG,
    RECENT_CARD_TARGET_WIDTH_PX,
    RECENT_GRID_GAP_PX,
    getBookmarkLimit: (...args) => getBookmarkLimit(...args),
    updateSuggestionsFloatingLayout,
    storageArea,
    NEWTAB_SEARCH_WIDTH_STORAGE_KEY: newtabSearchWidth.key,
    closeRecentContextMenu,
    scheduleWallpaperAdaptiveToneUpdate: (...args) => scheduleWallpaperAdaptiveToneUpdate(...args),
    normalizeNewtabShortcutSize: (...args) => normalizeNewtabShortcutSize(...args),
    normalizeNewtabShortcutGap: (...args) => normalizeNewtabShortcutGap(...args),
    getVisibleShortcuts: (...args) => getVisibleShortcuts(...args),
    MAX_NEWTAB_SHORTCUTS,
    resetShortcutDockHover,
    closeShortcutContextMenu,
    closeShortcutDialog,
    pageState
  });

  const {
    normalizeNewtabWidthMode,
    normalizeNewtabSearchWidth,
    normalizeNewtabShortcutsVisible,
    normalizeNewtabShortcutAddVisible,
    normalizeNewtabShortcutDockMagnificationEnabled,
    normalizeNewtabShortcutColumns,
    normalizeNewtabShortcutSize,
    normalizeNewtabShortcutGap,
    inferNewtabShortcutColumnsFromWidth,
    normalizeNewtabInputAutoFocusEnabled,
    normalizeNewtabFeedbackButtonVisible,
    normalizeNewtabAppearanceButtonVisible,
    updateNewtabInputAutoFocusUi,
    setNewtabInputAutoFocusEnabled,
    updateNewtabShortcutPreferencesUi,
    setNewtabShortcutsVisible,
    setNewtabShortcutAddVisible,
    setNewtabShortcutDockMagnificationEnabled,
    setNewtabShortcutColumns,
    setNewtabShortcutSize,
    setNewtabShortcutGap,
    initialNewtabInputAutoFocusReadyTask,
    normalizeBookmarkFolderIconsVisible,
    normalizeZenModeEnabled,
    normalizeBookmarkCount,
    getBookmarkLimit,
    normalizeBookmarkColumns
  } = NEWTAB_PAGE_PREFERENCES.createPagePreferences({
    SETTINGS,
    NEWTAB_SEARCH_WIDTH_CONFIG,
    NEWTAB_SHORTCUT_COLUMNS_MIN,
    NEWTAB_SHORTCUT_COLUMNS_MAX,
    NEWTAB_SHORTCUT_WIDTH_MIN,
    NEWTAB_SHORTCUT_WIDTH_MAX,
    storageArea,
    NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY: newtabInputAutoFocusEnabled.key,
    applyNewtabShortcutsVisibility,
    updateBookmarkSectionPosition,
    NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY: newtabShortcutsVisible.key,
    renderShortcuts: (...args) => renderShortcuts(...args),
    NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY: newtabShortcutAddVisible.key,
    applyNewtabShortcutDockMagnification,
    scheduleWallpaperAdaptiveToneUpdate: (...args) => scheduleWallpaperAdaptiveToneUpdate(...args),
    NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY: newtabShortcutDockMagnificationEnabled.key,
    applyNewtabShortcutColumns,
    NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY: newtabShortcutColumns.key,
    applyNewtabShortcutLayoutPreferences,
    NEWTAB_SHORTCUT_SIZE_STORAGE_KEY,
    NEWTAB_SHORTCUT_GAP_STORAGE_KEY,
    getBookmarkGridColumnCount,
    pageState
  });


  pageState.quoteRuntime = LumnoNewtabQuotes.createRuntime({
    documentObj: document, windowObj: window, chromeObj: chrome,
    storageArea, localStorageArea, t, showToast,
    getLocale: () => locale.store.getSnapshot().locale,
    getSearchRoot: () => root,
    getShortcutSection: () => pageState.shortcutSection,
    getTooltipController: () => topActionTooltipController,
    isPreferenceArea: isPrimaryStorageAreaName,
    onLayout: () => window.requestAnimationFrame(() => {
      updateBookmarkSectionPosition();
      scheduleWallpaperAdaptiveToneUpdate();
    })
  });
  pageState.sectionPanelSettings = LumnoNewtabSectionPanelSettings.createRuntime({
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
    getBookmarkViewMode: () => pageState.currentBookmarkViewMode,
    setBookmarkViewMode: (mode) => setBookmarkViewMode(mode),
    getBookmarkCount: () => pageState.currentBookmarkCount,
    setBookmarkCount: (value, options) => setSectionPreference(
      bookmarkCount.key,
      normalizeBookmarkCount(value),
      applyBookmarkCountPreference,
      options
    ),
    getBookmarkColumns: () => pageState.currentBookmarkColumns,
    setBookmarkColumns: (value, options) => setSectionPreference(
      bookmarkColumns.key,
      normalizeBookmarkColumns(value),
      applyBookmarkColumnsPreference,
      options
    ),
    getBookmarkFolderIconsVisible: () => pageState.bookmarkFolderIconsVisible,
    setBookmarkFolderIconsVisible: (value, options) => setSectionPreference(
      bookmarkFolderIconsVisible.key,
      normalizeBookmarkFolderIconsVisible(value),
      applyBookmarkFolderIconsVisiblePreference,
      options
    ),
    // The bar's shape and background go through the same actions as its own menu.
    getBookmarkTopbarLayout: () => getBookmarkTopbarLayout(),
    setBookmarkTopbarLayout: (layout) => handleBookmarkModeMenuAction(`${BOOKMARK_TOPBAR_LAYOUT_ACTION}:${layout}`),
    getBookmarkTopbarSurfaceMode: () => getEffectiveBookmarkTopbarSurfaceMode(),
    setBookmarkTopbarSurfaceMode: (mode) => handleBookmarkModeMenuAction(
      `${BOOKMARK_TOPBAR_SURFACE_MODE_ACTION}:${mode}`
    ),
    pickBookmarkTopbarSurfaceColor: () => handleBookmarkModeMenuAction(BOOKMARK_TOPBAR_PICK_COLOR_ACTION),
    getRecentMode: () => pageState.currentRecentMode,
    setRecentMode: (mode) => setRecentMode(mode),
    getRecentCount: () => pageState.currentRecentCount,
    setRecentCount: (value, options) => setSectionPreference(
      recentCount.key,
      normalizeRecentCount(value),
      applyRecentCountPreference,
      options
    )
  });

  const {
    updateWallpaperLanguageStrings,
    updateWallpaperAppearanceSelectionUi,
    bootstrapInitialWallpaper,
    bootstrapInitialWallpaperOverlay,
    bootstrapInitialWallpaperEffect,
    waitForInitialWallpaperEffectVisual,
    waitForInitialWallpaperTone,
    markInitialWallpaperVisualReady,
    bootstrapInitialNewtabFavicon,
    createWallpaperControls,
    isWallpaperPanelOpen,
    closeWallpaperPanel,
    scheduleWallpaperAdaptiveToneUpdate
  } = NEWTAB_WALLPAPER_PAGE.createWallpaperPage({
    settings,
    timePreview,
    shortcutTiles,
    getShortcutDockIcon,
    shortcutGroupHeaders,
    getEffectiveBookmarkTopbarSurfaceMode,
    isBookmarkTopbarMode: (...args) => isBookmarkTopbarMode(...args),
    root,
    NEWTAB_GLASS_ADAPTIVE_SELECTOR,
    EXTENSION_ROUTES,
    storageArea,
    localStorageArea,
    NEWTAB_WALLPAPER_STORAGE_KEY: newtabWallpaper.key,
    NEWTAB_LOCAL_WALLPAPER_STORAGE_KEY: newtabLocalWallpaper.key,
    NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY: newtabWallpaperOverlay.key,
    NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY: newtabWallpaperEffect.key,
    NEWTAB_FAVICON_STORAGE_KEY: newtabFavicon.key,
    NEWTAB_SEARCH_WIDTH_CONFIG,
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
    NEWTAB_SHORTCUT_COLUMNS_MIN,
    NEWTAB_SHORTCUT_COLUMNS_MAX,
    NEWTAB_SHORTCUT_COLUMNS_DEFAULT,
    NEWTAB_SHORTCUT_SIZE_MIN,
    NEWTAB_SHORTCUT_SIZE_MAX,
    NEWTAB_SHORTCUT_SIZE_DEFAULT,
    NEWTAB_SHORTCUT_GAP_MIN,
    NEWTAB_SHORTCUT_GAP_MAX,
    NEWTAB_SHORTCUT_GAP_DEFAULT,
    setNewtabShortcutsVisible,
    setNewtabShortcutAddVisible,
    setNewtabShortcutDockMagnificationEnabled,
    setNewtabShortcutColumns,
    setNewtabShortcutSize,
    setNewtabShortcutGap,
    FEATURE_HINTS,
    newtabEntryAnimationReadyPromise,
    initialNewtabInputAutoFocusReadyTask,
    setNewtabInputAutoFocusEnabled,
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

  const initialWallpaperOverlayReadyTask = bootstrapInitialWallpaperOverlay();
  const initialWallpaperVisualReadyTask = Promise.all([
    followTheme(),
    initialWallpaperOverlayReadyTask.then(() => bootstrapInitialWallpaper()),
    initialWallpaperOverlayReadyTask,
    bootstrapInitialWallpaperEffect()
  ]).then(() => waitForInitialWallpaperEffectVisual()).catch((error) => {
    console.warn('[Lumno] Initial new tab wallpaper setup failed.', error);
  }).then(() => {
    markInitialWallpaperVisualReady();
  });
  const initialAppearanceReadyTask = Promise.all([
    initialWallpaperVisualReadyTask,
    bootstrapInitialNewtabFavicon()
  ]).catch((error) => {
    console.warn('[Lumno] Initial new tab appearance setup failed.', error);
  });

  const {
    applyBookmarkCountPreference,
    applyBookmarkColumnsPreference,
    applyBookmarkFolderIconsVisiblePreference,
    applyRecentCountPreference,
    setSectionPreference,
    storageChanges
  } = NEWTAB_SETTINGS_SYNC.createSettingsSync({
    settings,
    normalizeBookmarkCount,
    markBookmarkDataDirty: (...args) => markBookmarkDataDirty(...args),
    loadBookmarks: (...args) => loadBookmarks(...args),
    normalizeBookmarkColumns,
    getBookmarkLimit,
    keepBookmarkPageAnchorAfterLimitChange,
    applyBookmarkGridColumns,
    renderCurrentBookmarkPage: (...args) => renderCurrentBookmarkPage(...args),
    updateBookmarkGridHeightLock: (...args) => updateBookmarkGridHeightLock(...args),
    updateBookmarkSectionPosition,
    normalizeBookmarkFolderIconsVisible,
    normalizeRecentCount,
    markRecentDataDirty: (...args) => markRecentDataDirty(...args),
    loadRecentSites: (...args) => loadRecentSites(...args),
    storageArea,
    isPrimaryStorageAreaName,
    shortcutFolderRuntime,
    renderShortcuts: (...args) => renderShortcuts(...args),
    FOLDER_COLOR_REFS_STORAGE_KEY,
    NEWTAB_BOOKMARK_FOLDER_ICON,
    syncFolderColorsWithBookmarks,
    NEWTAB_SHORTCUT_ICONS_STORAGE_KEY,
    NEWTAB_SHORTCUT_ICON_STORE,
    NEWTAB_SHORTCUT_FAVICON_CACHE_STORAGE_KEY,
    siteSearchIconCache,
    setSiteSearchPrefix: (...args) => setSiteSearchPrefix(...args),
    defaultTheme,
    getThemeForProvider,
    requestSuggestions: (...args) => requestSuggestions(...args),
    NEWTAB_SHORTCUTS_LOCAL_OVERFLOW_STORAGE_KEY,
    isShortcutSyncStorageActive: (...args) => isShortcutSyncStorageActive(...args),
    scheduleShortcutStorageReload: (...args) => scheduleShortcutStorageReload(...args),
    registerBookmarkDisplayStorageChanges,
    PROGRESS_HISTORY,
    NEWTAB_LOCAL_WALLPAPER_STORAGE_KEY: newtabLocalWallpaper.key,
    settingsRuntimeApi,
    NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY: newtabInputAutoFocusEnabled.key,
    normalizeNewtabInputAutoFocusEnabled,
    updateNewtabInputAutoFocusUi,
    RECENT_COUNT_STORAGE_KEY: recentCount.key,
    NEWTAB_WIDTH_MODE_STORAGE_KEY: newtabWidthMode.key,
    normalizeNewtabWidthMode,
    applyNewtabWidthMode,
    applyRecentGridColumns,
    NEWTAB_SEARCH_WIDTH_STORAGE_KEY: newtabSearchWidth.key,
    normalizeNewtabSearchWidth,
    updateNewtabSearchWidthLayout,
    NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY: newtabFeedbackButtonVisible.key,
    normalizeNewtabFeedbackButtonVisible,
    applyNewtabActionButtonVisibility: (...args) => applyNewtabActionButtonVisibility(...args),
    NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY: newtabAppearanceButtonVisible.key,
    normalizeNewtabAppearanceButtonVisible,
    NEWTAB_ZEN_MODE_STORAGE_KEY: newtabZenMode.key,
    normalizeZenModeEnabled,
    applyZenMode: (...args) => applyZenMode(...args),
    updateZenCommandSuggestions: (...args) => updateZenCommandSuggestions(...args),
    NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY: newtabShortcutsVisible.key,
    normalizeNewtabShortcutsVisible,
    applyNewtabShortcutsVisibility,
    updateNewtabShortcutPreferencesUi,
    NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY: newtabShortcutAddVisible.key,
    normalizeNewtabShortcutAddVisible,
    NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY: newtabShortcutDockMagnificationEnabled.key,
    normalizeNewtabShortcutDockMagnificationEnabled,
    applyNewtabShortcutDockMagnification,
    NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY: newtabShortcutColumns.key,
    normalizeNewtabShortcutColumns,
    applyNewtabShortcutColumns,
    NEWTAB_SHORTCUT_SIZE_STORAGE_KEY,
    normalizeNewtabShortcutSize,
    applyNewtabShortcutLayoutPreferences,
    NEWTAB_SHORTCUT_GAP_STORAGE_KEY,
    normalizeNewtabShortcutGap,
    RECENT_MODE_STORAGE_KEY: recentMode.key,
    normalizeRecentMode,
    updateRecentModeMenu: (...args) => updateRecentModeMenu(...args),
    BOOKMARK_VIEW_MODE_STORAGE_KEY: bookmarkViewMode.key,
    normalizeBookmarkViewMode,
    shouldRepairBookmarkViewModeStorageValue,
    persistBookmarkViewMode,
    applyBookmarkViewMode: (...args) => applyBookmarkViewMode(...args),
    BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY: bookmarkFolderIconsVisible.key,
    BOOKMARK_COUNT_STORAGE_KEY: bookmarkCount.key,
    BOOKMARK_COLUMNS_STORAGE_KEY: bookmarkColumns.key,
    requestTabsAndRender: (...args) => requestTabsAndRender(...args),
    PINNED_RECENT_SITES_STORAGE_KEY: pinnedRecentSites.key,
    normalizePinnedRecentSites,
    renderRecentSites: (...args) => renderRecentSites(...args),
    HIDDEN_RECENT_SITES_STORAGE_KEY: hiddenRecentSites.key,
    normalizeHiddenRecentSites,
    NEWTAB_SHORTCUTS_STORAGE_KEYS,
    pageState
  });

  NEWTAB_STARTUP_PREFERENCES.createStartupPreferences({
    storageArea,
    settingsRuntimeApi,
    renderRecentSites: (...args) => renderRecentSites(...args),
    localStorageArea,
    PROGRESS_HISTORY,
    readPinnedRecentSites,
    readHiddenRecentSites,
    RECENT_COUNT_STORAGE_KEY: recentCount.key,
    normalizeRecentCount,
    markRecentDataDirty: (...args) => markRecentDataDirty(...args),
    loadRecentSites: (...args) => loadRecentSites(...args),
    NEWTAB_WIDTH_MODE_STORAGE_KEY: newtabWidthMode.key,
    NEWTAB_SEARCH_WIDTH_STORAGE_KEY: newtabSearchWidth.key,
    getBookmarkLimit,
    normalizeNewtabWidthMode,
    normalizeNewtabSearchWidth,
    applyNewtabWidthMode,
    applyRecentGridColumns,
    applyBookmarkGridColumns,
    keepBookmarkPageAnchorAfterLimitChange,
    renderCurrentBookmarkPage: (...args) => renderCurrentBookmarkPage(...args),
    updateBookmarkGridHeightLock: (...args) => updateBookmarkGridHeightLock(...args),
    updateBookmarkSectionPosition,
    RECENT_MODE_STORAGE_KEY: recentMode.key,
    normalizeRecentMode,
    updateRecentModeMenu: (...args) => updateRecentModeMenu(...args),
    loadInitialBookmarkViewMode,
    loadInitialBookmarkTopbarSurfaceColors,
    loadInitialBookmarkTopbarSurfaceMode,
    BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY: bookmarkFolderIconsVisible.key,
    normalizeBookmarkFolderIconsVisible,
    BOOKMARK_COUNT_STORAGE_KEY: bookmarkCount.key,
    normalizeBookmarkCount,
    markBookmarkDataDirty: (...args) => markBookmarkDataDirty(...args),
    loadBookmarks: (...args) => loadBookmarks(...args),
    BOOKMARK_COLUMNS_STORAGE_KEY: bookmarkColumns.key,
    normalizeBookmarkColumns,
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
    settings,
    searchEngine,
    clearLocalSearchScope: (...args) => clearLocalSearchScope(...args),
    renderSuggestions: (...args) => renderSuggestions(...args),
    requestSuggestions: (...args) => requestSuggestions(...args),
    markRecentDataDirty: (...args) => markRecentDataDirty(...args),
    scheduleRecentReloadIfVisible: (...args) => scheduleRecentReloadIfVisible(...args),
    scheduleBookmarkReloadIfVisible: (...args) => scheduleBookmarkReloadIfVisible(...args),
    refreshThemeAwareFavicons,
    renderShortcuts: (...args) => renderShortcuts(...args),
    setSiteSearchPrefix: (...args) => setSiteSearchPrefix(...args),
    getImmediateThemeForSuggestion,
    pageState
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
    FAVICON_CACHE_BOOT_WAIT_MS,
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
    isBackgroundOpenEvent,
    getOpenDisposition,
    getSurfaceOpenDisposition,
    openExternalNewTabUrl,
    openUrlFromNewtabCard,
    openShortcutUrl,
    recordSearchSuggestionSelection,
    openBookmarkFolder,
    navigateToQuery
  } = NEWTAB_PAGE_NAVIGATION.createPageNavigation({
    settings,
    NAVIGATION_DISPOSITION,
    getShortcutTileById,
    bookmarksRuntime,
    getShortcutFolderId: (...args) => getShortcutFolderId(...args),
    showToast,
    t,
    openBookmarkCascadeMenu,
    navigateBookmarkFolder: (...args) => navigateBookmarkFolder(...args),
    getDirectNavigationUrl: (...args) => getDirectNavigationUrl(...args),
    searchEngine,
    pageState
  });

  const pageStructureRuntime = NEWTAB_PAGE_STRUCTURE.createPageStructure({
    documentObj: document
  });
  pageState.suggestionsContainer = pageStructureRuntime.suggestions.container;
  pageState.suggestionsContainer.addEventListener('wheel', function(event) {
    SUGGESTION_NAVIGATION.preventNumberShortcutWheel(event, pageState.suggestionsContainer);
  }, { passive: false });
  document.addEventListener('pointerdown', function() {
    SUGGESTION_NAVIGATION.cancelNumberShortcuts(pageState.suggestionsContainer);
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
    COMMUNITY_LINKS,
    recentCards,
    SETTINGS,
    updateSearchEntryLayout,
    updateSuggestionsFloatingLayout,
    scheduleWallpaperAdaptiveToneUpdate,
    settings,
    timePreview,
    pageState
  });
  // Settles once the stored clock face has loaded, so the first reveal never
  // draws the clock in a fallback face.
  const initialTimeFontReadyTask = followTopContentSettings();

  const {
    finishNewtabEntryAnimation,
    scheduleNewtabReadyAfterViewportSettle,
    markNewtabReady
  } = NEWTAB_ENTRY_MOTION.createEntryMotion({
    root,
    shouldSkipNewtabEntryMotion,
    updateBookmarkSectionPosition,
    finishWordmarkEntryAnimation,
    rememberSearchEntryViewport,
    getSearchEntryViewportSnapshot,
    hasSearchEntryViewportChanged,
    pageState
  });

  pageState.searchLayer = pageStructureRuntime.searchLayer;

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
    shouldSuppressBookmarkHover: (...args) => shouldSuppressBookmarkHover(...args),
    pageState
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
    applyBookmarkViewMode,
    setBookmarkViewMode,
    navigateBookmarkFolder
  } = NEWTAB_SECTION_HEADERS.createSectionHeaders({
    t,
    normalizeRecentMode,
    storageArea,
    RECENT_MODE_STORAGE_KEY: recentMode.key,
    markRecentDataDirty: (...args) => markRecentDataDirty(...args),
    loadRecentSites: (...args) => loadRecentSites(...args),
    getNewtabVisualViewportInsets,
    BOOKMARK_TOPBAR_HEIGHT_PX,
    updateSearchEntryLayout,
    setContentSectionVisible,
    bookmarkSection,
    bookmarkCards,
    normalizeBookmarkViewMode,
    markBookmarkDataDirty: (...args) => markBookmarkDataDirty(...args),
    loadBookmarks: (...args) => loadBookmarks(...args),
    closeBookmarkCascadeMenu,
    persistBookmarkViewMode,
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
    BOOKMARK_TOPBAR_LAYOUT_ACTION,
    BOOKMARK_TOPBAR_SURFACE_MODE_ACTION,
    BOOKMARK_TOPBAR_PICK_COLOR_ACTION
  });

  const {
    setShortcutContextMenuMark,
    getShortcutFolderId,
    getFolderItemIconUrl,
    getFolderItemIcon,
    getFolderItemIconForShortcut,
    updateFolderItemIcons,
    getVisibleShortcuts,
    refreshShortcutFolderReferences,
    getShortcutStoreOptions,
    isShortcutSyncStorageActive,
    scheduleShortcutStorageReload,
    getShortcutIconDataUrl,
    getShortcutFaviconDataUrl,
    getShortcutFaviconCandidateUrl,
    getShortcutTitle,
    renderShortcuts,
    flushDeferredShortcutRender,
    loadNewtabShortcutPreferences,
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
    shortcutFolderRuntime,
    bookmarksRuntime,
    isShortcutDragActive: (...args) => isShortcutDragActive(...args),
    moveShortcutByKeyboard: (...args) => moveShortcutByKeyboard(...args),
    MAX_NEWTAB_SHORTCUTS,
    normalizeHost,
    sanitizeDisplayText,
    providerStorageRuntime,
    NEWTAB_SHORTCUTS_CRITICAL_SYNC_RESERVE_BYTES,
    NEWTAB_SHORTCUTS_LOCAL_OVERFLOW_STORAGE_KEY,
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
    NEWTAB_SHORTCUT_ICON_STORE,
    NEWTAB_SHORTCUT_ICON_PLATE,
    pickShortcutIconPlateColor,
    NEWTAB_SHORTCUT_COLUMNS_DEFAULT,
    NEWTAB_SHORTCUT_SIZE_DEFAULT,
    NEWTAB_SHORTCUT_GAP_DEFAULT,
    applyNewtabShortcutLayoutPreferences,
    applyNewtabShortcutDockMagnification,
    updateNewtabShortcutPreferencesUi,
    NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY: newtabShortcutsVisible.key,
    NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY: newtabShortcutAddVisible.key,
    NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY: newtabShortcutDockMagnificationEnabled.key,
    NEWTAB_SHORTCUT_WIDTH_STORAGE_KEY: newtabShortcutWidth.key,
    NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY: newtabShortcutColumns.key,
    NEWTAB_SHORTCUT_SIZE_STORAGE_KEY,
    NEWTAB_SHORTCUT_GAP_STORAGE_KEY,
    normalizeNewtabShortcutsVisible,
    normalizeNewtabShortcutAddVisible,
    normalizeNewtabShortcutDockMagnificationEnabled,
    inferNewtabShortcutColumnsFromWidth,
    normalizeNewtabShortcutColumns,
    normalizeNewtabShortcutSize,
    normalizeNewtabShortcutGap,
    loadFolderColors,
    showToast,
    formatMessage,
    getShortcutById,
    SHORTCUT_DIALOG_MODE_EDIT,
    SHORTCUT_DIALOG_ITEM_FOLDER,
    markBookmarkTreeDirty: (...args) => markBookmarkTreeDirty(...args),
    loadBookmarks: (...args) => loadBookmarks(...args),
    refreshOpenBookmarkCascadeMenu: (...args) => refreshOpenBookmarkCascadeMenu(...args),
    NEWTAB_BOOKMARK_MOVE_HISTORY,
    bookmarkMoveHistory,
    getBookmarkUndoShortcutLabel: (...args) => getBookmarkUndoShortcutLabel(...args),
    resetShortcutDockHover,
    scheduleWallpaperAdaptiveToneUpdate,
    pageStructureRuntime,
    NEWTAB_SHORTCUTS_VIEW,
    shortcutTiles,
    shortcutGroupHeaders,
    initFolderPathMorph,
    playFolderPathMorph,
    getHostFromUrl,
    getImmediateThemeForSuggestion,
    applyShortcutTileTheme,
    queueThemeForTarget,
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
    NEWTAB_SHORTCUT_DIALOG,
    bindShortcutDialogTooltip,
    hideShortcutDialogTooltip,
    SHORTCUT_DIALOG_ITEM_BOOKMARK,
    handleShortcutGroupMenu: openShortcutGroupMenu,
    WEBDAV_STATUS_STORAGE_KEY: SETTINGS.webdavStatus.key,
    animateShortcutLayoutChange: (...args) => animateShortcutLayoutChange(...args),
    pageState
  });

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
    isBookmarkTopbarMode,
    getBookmarkLimit,
    NEWTAB_BOOKMARK_DRAG,
    initFolderPathMorph,
    setFolderPathMorphState,
    isContentSectionVisible,
    bookmarkSection,
    bookmarksRuntime,
    NEWTAB_CROSS_SURFACE_DRAG,
    NEWTAB_BOOKMARK_MOVE_HISTORY,
    getShortcutById,
    getShortcutFolderId,
    getShortcutReorderTiles,
    getShortcutTileLayoutRect: (...args) => getShortcutTileLayoutRect(...args),
    getShortcutStoreOptions,
    getShortcutInsertionSlotAt: (...args) => getShortcutInsertionSlotAt(...args),
    MAX_NEWTAB_SHORTCUTS,
    getShortcutTileId,
    FOLDER_REFERENCES,
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
    NEWTAB_CROSS_SURFACE_DRAG,
    isShortcutFolderAnchor,
    getFolderItemIconUrl,
    bookmarksRuntime,
    bookmarkCascadeCopyTooltipController,
    hideTopActionTooltip,
    handleBookmarkCascadeItemPointerDown,
    isBookmarkContextMenuNode,
    getBookmarkCascadeViewportTopPaddingPx,
    NEWTAB_BOOKMARKS_TOPBAR,
    setNewtabTopOccupied,
    syncBookmarkTopbarSurfaceAppearance,
    syncBookmarkSurfaceMode,
    pageState
  });

  NEWTAB_RECENT_SECTION.createRecentSection({
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
    MAX_PINNED_RECENT_SITES,
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
    pageState
  });

  const {
    bottomDockRuntime,
    bottomDock
  } = NEWTAB_BOTTOM_DOCK_RUNTIME.createBottomDockRuntime({
    NEWTAB_LAYOUT,
    root,
    bookmarkSection,
    suggestionsSurface,
    suggestionsOutline,
    getNewtabTopOccupiedInsetPx,
    NEWTAB_MOBILE_FLOW_BREAKPOINT_PX,
    shouldAnimateNewtabLayoutShift,
    applyNewtabWidthMode,
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
    NEWTAB_BOOKMARKS_STORE,
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
    getShortcutReorderTiles,
    NEWTAB_CROSS_SURFACE_DRAG,
    refreshShortcutTileCacheFromDom,
    getShortcutTileId,
    getShortcutTileById,
    renderShortcuts,
    flushDeferredShortcutRender,
    resetShortcutDockHover,
    NEWTAB_BOOKMARK_MOVE_HISTORY,
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
    FOLDER_REFERENCES,
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
    NEWTAB_CROSS_SURFACE_DRAG,
    NEWTAB_BOOKMARK_MOVE_HISTORY,
    getShortcutStoreOptions,
    getShortcutFolderId,
    MAX_NEWTAB_SHORTCUTS,
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
    FAVICON_CACHE_BOOT_WAIT_MS,
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
    MAX_PINNED_RECENT_SITES,
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

  const {
    getAutocompleteCandidate,
    clearAutocomplete,
    restoreUserAuthoredSearchInput,
    dismissAutocompletePreviewOnNonTabKey,
    applyAutocomplete
  } = NEWTAB_SEARCH_AUTOCOMPLETE.createSearchAutocomplete({
    settings,
    getUrlDisplay,
    isEnglishQuery,
    getKeywordSearchSuggestionState,
    pageState
  });

  const attachInputModeFaviconData =
    BundledIcons.createSiteSearchProviderIconHydrator(attachFaviconData);

  const {
    getSearchModeMenuItems,
    reorderSearchModeMenu,
    moveSearchModeMenuGroup,
    stepSearchModeMenuHistory,
    openSearchModeMenuFromDoubleTab,
    selectSearchModeMenuItem,
    restoreSearchModeQuery,
    getLocalSearchScopeTabHintProvider,
    setLocalSearchScopePrefix,
    activateLocalSearchScope,
    clearLocalSearchScope,
    activateSiteSearch,
    clearSiteSearch,
    handleSearchTabKey
  } = NEWTAB_SEARCH_MODES.createSearchModes({
    settings,
    siteSearchCatalog,
    searchEngine,
    t,
    createAggregateSearchScopeProvider,
    isAggregateSearchProvider,
    isSearchEngineSiteSearchProvider,
    isAiSiteSearchProvider,
    getSiteSearchDisplayName,
    getProviderIcon,
    getLocalSearchScopeLabel,
    getLocalSearchScopeIconName,
    siteSearchIconCache,
    formatMessage,
    defaultTheme,
    clearAutocomplete,
    clearSearchSuggestions: (...args) => clearSearchSuggestions(...args),
    clearSiteSearchPrefix: (...args) => clearSiteSearchPrefix(...args),
    setSiteSearchPrefix: (...args) => setSiteSearchPrefix(...args),
    getThemeForProvider,
    getTopSiteMatchCandidate,
    getSiteSearchTriggerCandidate,
    getLocalSearchScopeCandidate,
    getShortcutRules: (...args) => getShortcutRules(...args),
    readSearchSourceOrder: () => SettingsStorage.readStorageValue(
      storageArea,
      chrome,
      SETTINGS.searchSourceOrder.key
    ),
    writeSearchSourceOrder: (value) => SettingsStorage.writeStorageValue(
      storageArea,
      chrome,
      SETTINGS.searchSourceOrder.key,
      value
    ),
    pageState
  });

  const { getNextSuggestionIndex } = NEWTAB_SEARCH_NAVIGATION;
  const {
    getShortcutRules,
    buildKeywordSuggestions,
    getDirectUrlSuggestion,
    getDirectNavigationUrl,
    getMatchedOpenTabIdForSuggestion,
    shouldSwitchMatchedTabSuggestion,
    shouldOpenSearchResultInBackgroundTab,
    getSearchResultDisposition,
    openSearchResultUrl,
    openMatchedTabSuggestion,
    refreshTabsForSearchContext,
    submitSearchQuery
  } = NEWTAB_SEARCH_NAVIGATION.createSearchNavigation({
    settings,
    formatMessage,
    getExtensionResourceUrl,
    BROWSER_PROFILE,
    getPageFaviconCandidateUrl,
    SUGGESTION_ACTION_MODEL,
    isBackgroundOpenEvent,
    getSurfaceOpenDisposition,
    recordSearchSuggestionSelection,
    navigateToUrl,
    suggestionItems,
    getAutoHighlightIndex: (...args) => getAutoHighlightIndex(...args),
    renderSuggestions: (...args) => renderSuggestions(...args),
    isSlashCommandInput: (...args) => isSlashCommandInput(...args),
    getCommandMatch: (...args) => getCommandMatch(...args),
    isModeCommand: (...args) => isModeCommand(...args),
    isZenCommand: (...args) => isZenCommand(...args),
    getNextThemeMode: (...args) => getNextThemeMode(...args),
    setVisibleThemeMode,
    setZenModeEnabled: (...args) => setZenModeEnabled(...args),
    setWebAppearanceMode: (...args) => setWebAppearanceMode(...args),
    activateSiteSearch,
    focusSearchInputPreservingScroll: (...args) => focusSearchInputPreservingScroll(...args),
    openCommunityQrDialog: (...args) => openCommunityQrDialog(...args),
    runSiteSearchProviderQuery,
    navigateToQuery,
    pageState
  });

  const {
    setSuggestionActionModifiersActive,
    syncSuggestionActionModifiersFromEvent,
    getAutoHighlightIndex,
    updateSelection,
    activateRenderedSuggestion,
    deleteRenderedHistorySuggestion,
    scrollSelectedSuggestionIntoView,
    requestTabsAndRender,
    refreshTabsIfIdle,
    clearSearchSuggestions,
    dismissSearchSuggestionsFromBackground,
    restoreDismissedSearchSuggestions,
    renderSuggestions,
    renderPendingSuggestions,
    showSuggestionSnapshot,
    directNavigationSettleController,
    requestSuggestions
  } = NEWTAB_SUGGESTIONS_CONTROLLER.createSuggestionsController({
    settings,
    getPageFaviconCandidateUrl,
    SUGGESTION_ACTION_MODEL,
    activateSiteSearch,
    focusSearchInputPreservingScroll: (...args) => focusSearchInputPreservingScroll(...args),
    setVisibleThemeMode,
    setZenModeEnabled: (...args) => setZenModeEnabled(...args),
    setWebAppearanceMode: (...args) => setWebAppearanceMode(...args),
    shouldSwitchMatchedTabSuggestion,
    openMatchedTabSuggestion,
    runSiteSearchProviderQuery,
    shouldOpenSearchResultInBackgroundTab,
    getSearchResultDisposition,
    openSearchResultUrl,
    navigateToQuery,
    suggestionsContainer: pageState.suggestionsContainer,
    suggestionItems,
    SUGGESTION_NAVIGATION,
    refreshTabsForSearchContext,
    clearSiteSearchTabHint: (...args) => clearSiteSearchTabHint(...args),
    restoreUserAuthoredSearchInput,
    isSlashCommandInput: (...args) => isSlashCommandInput(...args),
    getShortcutRules,
    isModeCommand: (...args) => isModeCommand(...args),
    isZenCommand: (...args) => isZenCommand(...args),
    getScopedThemeMode,
    applyThemeMode,
    getCommandMatches: (...args) => getCommandMatches(...args),
    buildModeSuggestion: (...args) => buildModeSuggestion(...args),
    buildZenSuggestion: (...args) => buildZenSuggestion(...args),
    buildCommandSuggestion: (...args) => buildCommandSuggestion(...args),
    getDirectUrlSuggestion,
    buildKeywordSuggestions,
    siteSearchCatalog,
    searchEngine,
    getInlineSiteSearchCandidate,
    buildSearchUrl,
    getSiteSearchActionTitle,
    getProviderIcon,
    formatMessage,
    isAggregateSearchProvider,
    getMatchedOpenTabIdForSuggestion,
    filterBlacklistedSuggestions,
    getKeywordSearchSuggestionState,
    promoteStrongNavigationMatch,
    promoteTopSiteMatch,
    getSiteSearchTriggerCandidate,
    getAutocompleteCandidate,
    getUrlDisplay,
    getDirectNavigationUrl,
    clearAutocomplete,
    applyAutocomplete,
    getLocalSearchScopeCandidate,
    setSiteSearchTabHint: (...args) => setSiteSearchTabHint(...args),
    getLocalSearchScopeTabHintProvider,
    limitSuggestionsForDisplay,
    t,
    warmIconCache,
    setSuggestionsVisible,
    NEWTAB_DIRECT_NAVIGATION_SETTLE,
    sendRuntimeMessage,
    COMMUNITY_LINKS: LumnoCommunityLinks || null,
    openCommunityQrDialog: (...args) => openCommunityQrDialog(...args),
    getHelpCenterLocale: (...args) => getHelpCenterLocale(...args),
    pageState
  });

  const {
    isEditableElement,
    refreshFallbackShortcut,
    focusSearchInputPreservingScroll,
    handleGlobalTypingFocus
  } = NEWTAB_INPUT_FOCUS.createInputFocus({
    SHORTCUT_KEY_MATCHER,
    prepareFocusReload: () => (pageState.focusResume ? pageState.focusResume.prepareFocusReload() : false),
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
    updateZenCommandSuggestions,
    applyZenMode,
    setZenModeEnabled,
    loadZenMode
  } = NEWTAB_MODE_COMMANDS.createModeCommands({
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
    closeWallpaperPanel,
    closeFeedbackPopover,
    hideTopActionTooltip,
    hideShortcutTooltip,
    hideCursorTooltip,
    updateBookmarkSectionPosition,
    updateSearchEntryLayout,
    scheduleWallpaperAdaptiveToneUpdate,
    normalizeZenModeEnabled,
    storageArea,
    NEWTAB_ZEN_MODE_STORAGE_KEY: newtabZenMode.key,
    pageState
  });

  const isSearchOpenInNewTab = (): boolean =>
    Boolean(settings.get(newtabOpenInNewTab) && settings.get(newtabOpenInNewTab).search === true);
  // Result labels follow where a plain click goes: 「前往」 in this tab, 「新开」 in a new one.
  const newtabSuggestionActionModel = Object.assign({}, SUGGESTION_ACTION_MODEL, {
    createSearchActionModel(input?: SearchActionModelOptions | null): SearchActionModel {
      return SUGGESTION_ACTION_MODEL.createSearchActionModel({
        ...input,
        enterAction: 'openNewTab',
        currentTabByDefault: !isSearchOpenInNewTab()
      });
    },
    // Option/Alt says where the result would go instead.
    getModifierAdjustedAction(action: unknown, modifiers?: OpenModifiers | null): string {
      return SUGGESTION_ACTION_MODEL.getModifierAdjustedAction(action, {
        ...modifiers,
        currentTabByDefault: !isSearchOpenInNewTab()
      });
    }
  });

  const {
    inputParts,
    searchInput,
    rightIcon,
    setSearchScopeIconEnabled
  } = NEWTAB_SEARCH_BOX.createSearchBox({
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
    shouldOpenSearchResultInBackgroundTab,
    activateRenderedSuggestion,
    deleteRenderedHistorySuggestion,
    copySearchResultUrl,
    showTopActionTooltip,
    hideTopActionTooltip,
    bindCursorTooltip,
    getSearchActionLabel: () => t('action_search', '搜索'),
    getSiteSearchDisplayName,
    isAiSiteSearchProvider,
    getDefaultSearchEngineThemeUrl: () => searchEngine.themeUrl(),
    getBrandAccentForUrl,
    buildThemeFromAccent,
    newtabSuggestionActionModel,
    shouldSwitchMatchedTabSuggestion,
    defaultTheme,
    urlHighlightTheme,
    createSearchInput,
    searchInputHistoryController,
    updateModeBadge,
    imeKeyGuard,
    clearAutocomplete,
    clearSearchSuggestions,
    isSlashCommandInput,
    renderSuggestions,
    getDirectUrlSuggestion,
    renderPendingSuggestions,
    requestSuggestions,
    syncSuggestionActionModifiersFromEvent,
    dismissAutocompletePreviewOnNonTabKey,
    SUGGESTION_NAVIGATION,
    clearSiteSearch,
    clearLocalSearchScope,
    isImeCompositionEvent,
    SEARCH_INPUT_HISTORY,
    getNextSuggestionIndex,
    getAutoHighlightIndex,
    updateSelection,
    scrollSelectedSuggestionIntoView,
    submitSearchQuery,
    root,
    dismissSearchSuggestionsFromBackground,
    focusSearchInputPreservingScroll,
    finishNewtabEntryAnimation,
    handleGlobalTypingFocus,
    refreshFallbackShortcut,
    restoreDismissedSearchSuggestions,
    hideSearchInputCursorTooltip,
    openSearchModeMenuFromDoubleTab,
    bindSearchInputCursorTooltip,
    pageState
  });

  function openWordmarkUrl(disposition: Disposition): void {
    openExternalNewTabUrl(COMMUNITY_LINKS.getStoreListing().url, disposition);
  }
  const shouldAnimateWordmarkEntry = !shouldSkipNewtabEntryMotion();
  pageState.topContentContainer = document.createElement('div');
  pageState.topContentController = NEWTAB_TOP_CONTENT.createTopContentController(
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
    locale,
    pageSearchParams,
    bottomDock,
    t,
    FEATURE_HINTS,
    getOpenDisposition,
    getFeedbackWebLocale,
    isFeedbackPopoverOpen,
    LUMNO_FEEDBACK_LINKS_FALLBACK,
    openFeedbackExternalUrl,
    COMMUNITY_LINKS,
    newtabEntryAnimationReadyPromise,
    activateSiteSearch,
    root,
    siteSearchCatalog,
    pageState
  });

  const {
    SEARCH_CLEAR_BUTTON_INSET,
    updateInputRightPadding,
    applyNewtabActionButtonVisibility,
    loadNewtabActionButtonVisibility
  } = NEWTAB_SEARCH_BOX_CONTROLS.createSearchBoxControls({
    locale,
    dismissHelpCenterAskHint,
    rightIcon,
    formatMessage,
    dismissWebdavFeatureHint,
    EXTENSION_ROUTES,
    getExtensionResourceUrl,
    FEATURE_HINTS,
    helpCenterAskHintSettled,
    t,
    getOpenDisposition,
    searchInput,
    closeFeedbackPopover,
    closeWallpaperPanel,
    storageArea,
    NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY: newtabFeedbackButtonVisible.key,
    NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY: newtabAppearanceButtonVisible.key,
    normalizeNewtabFeedbackButtonVisible,
    normalizeNewtabAppearanceButtonVisible,
    pageState
  });

  const {
    followNewtabGlassStyle
  } = NEWTAB_GLASS_SURFACES.createGlassSurfaces({
    settings,
    scheduleWallpaperAdaptiveToneUpdate,
    SETTINGS,
    syncBookmarkTopbarSurfaceAppearance,
    updateWallpaperAppearanceSelectionUi
  });

  const {
    setSiteSearchTabHint,
    clearSiteSearchTabHint,
    updateSiteSearchPrefixLayout,
    setSiteSearchPrefix,
    clearSiteSearchPrefix
  } = NEWTAB_SEARCH_MODE_CONTROLLER.createSearchModeController({
    settings,
    renderSuggestions,
    searchInput,
    SEARCH_CLEAR_BUTTON_INSET,
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
    getSiteSearchPrefixText,
    getSiteSearchDisplayName,
    isAiSiteSearchProvider,
    attachInputModeFaviconData,
    formatMessage,
    bookmarkCursorTooltipController,
    getSearchModeMenuItems,
    selectSearchModeMenuItem,
    reorderSearchModeMenu,
    moveSearchModeMenuGroup,
    stepSearchModeMenuHistory,
    showToast,
    t,
    hideToast,
    setSearchScopeIconEnabled,
    syncSearchModeMenuResultOffset,
    siteSearchIconCache,
    pageState
  });

  NEWTAB_PAGE_RESIZE.createPageResize({
    getBookmarkLimit,
    applyNewtabWidthMode,
    applyNewtabShortcutColumns,
    shouldAnimateNewtabLayoutShift,
    captureRecentCardLayout,
    applyRecentGridColumns,
    applyBookmarkGridColumns,
    updateSiteSearchPrefixLayout,
    keepBookmarkPageAnchorAfterLimitChange,
    renderCurrentBookmarkPage,
    updateBookmarkGridHeightLock,
    updateBookmarkSectionPosition,
    positionBookmarkCascadeLevels,
    updateSuggestionsFloatingLayout,
    cancelRecentResizeLayoutAnimations,
    renderRecentSites,
    animateRecentResizeLayout,
    scheduleNewtabReadyAfterViewportSettle,
    pageState
  });

  NEWTAB_PAGE_KEYBOARD.createPageKeyboard({
    handleSearchTabKey,
    dismissStack,
    finishShortcutDrag,
    finishBookmarkDrag,
    isEditableElement,
    performBookmarkMoveHistoryAction,
    syncSuggestionActionModifiersFromEvent,
    SUGGESTION_NAVIGATION,
    suggestionItems,
    numberShortcutOptions,
    setSuggestionActionModifiersActive,
    pageState
  });

  NEWTAB_SITE_SEARCH_RUNTIME.createSiteSearchRuntime({
    siteSearchCatalog,
    isAggregateSearchProvider,
    createAggregateSearchScopeProvider,
    activateSiteSearch,
    activateLocalSearchScope,
    restoreSearchModeQuery,
    showSuggestionSnapshot,
    focusSearchInputPreservingScroll,
    requestSuggestions,
    storageChanges,
    setSiteSearchPrefix,
    defaultTheme,
    clearSiteSearch,
    pageState
  });

  NEWTAB_SEARCH_INPUT_COMPOSITION.createSearchInputComposition({
    directNavigationSettleController,
    imeKeyGuard,
    clearAutocomplete,
    clearSearchSuggestions,
    getDirectUrlSuggestion,
    renderPendingSuggestions,
    requestSuggestions,
    pageState
  });

  createWallpaperControls();
  createFeedbackControls();
  document.addEventListener('pointerdown', function(event) {
    if (!isFeedbackPopoverOpen()) {
      return;
    }
    const target = isNode(event.target) ? event.target : null;
    if (pageState.feedbackControl && (target === pageState.feedbackControl || pageState.feedbackControl.contains(target))) {
      return;
    }
    closeFeedbackPopover();
  }, true);
  document.addEventListener('pointerdown', function(event) {
    if (!isWallpaperPanelOpen()) {
      return;
    }
    const target = isNode(event.target) ? event.target : null;
    if (pageState.wallpaperRuntime && pageState.wallpaperRuntime.containsTarget(target)) {
      return;
    }
    closeWallpaperPanel();
  }, true);
  dismissStack.register('wallpaper-panel', {
    isOpen: isWallpaperPanelOpen,
    close: () => {
      // Escape dismisses an open filter menu before it closes the whole panel.
      if (pageState.wallpaperRuntime && pageState.wallpaperRuntime.closeOpenMenu()) {
        return;
      }
      closeWallpaperPanel({ restoreFocus: true });
    }
  });

  document.body.insertBefore(pageState.topContentContainer, root);
  pageStructureRuntime.searchLayer.appendChild(inputParts.container);
  root.appendChild(pageStructureRuntime.searchLayer);
  const newtabUpdateNoticeAnchor = root.nextSibling;
  if (pageState.shortcutSection) {
    document.body.insertBefore(pageState.shortcutSection, newtabUpdateNoticeAnchor);
  }
  if (pageState.updateNoticeController && pageState.updateNoticeController.element) {
    document.body.insertBefore(pageState.updateNoticeController.element, newtabUpdateNoticeAnchor);
    if (typeof pageState.updateNoticeController.recordExposure === 'function') {
      pageState.updateNoticeController.recordExposure();
    }
  }
  document.body.insertBefore(suggestionsSurface, newtabUpdateNoticeAnchor);
  document.body.insertBefore(suggestionsOutline, newtabUpdateNoticeAnchor);
  document.body.insertBefore(pageState.suggestionsContainer, newtabUpdateNoticeAnchor);
  // 等首轮语言解析完成后再创建，避免默认文案在新标签页首帧短暂闪现。
  Promise.all([
    locale.ready,
    pageState.updateNoticeController && pageState.updateNoticeController.ready
      ? pageState.updateNoticeController.ready
      : Promise.resolve(false)
  ]).then(() => {
    if (pageState.engagementNoticeController) {
      return;
    }
    const noticeAnchor = suggestionsSurface.parentNode === document.body
      ? suggestionsSurface
      : newtabUpdateNoticeAnchor;
    pageState.graphicsNoticeController = createNewtabGraphicsNoticeController();
    if (pageState.graphicsNoticeController && pageState.graphicsNoticeController.element) {
      document.body.insertBefore(pageState.graphicsNoticeController.element, noticeAnchor);
    }
    pageState.engagementNoticeController = createNewtabEngagementNoticeController();
    if (!pageState.engagementNoticeController || !pageState.engagementNoticeController.element) {
      return;
    }
    document.body.insertBefore(pageState.engagementNoticeController.element, noticeAnchor);
    if (String(inputParts.input.value || '').trim() &&
        typeof pageState.engagementNoticeController.recordMeaningfulUse === 'function') {
      pageState.engagementNoticeController.recordMeaningfulUse();
    }
  });
  if (pageState.bookmarkTopbarRuntime) {
    pageState.bookmarkTopbarRuntime.mount(document.body);
  }
  bottomDockRuntime.mount(document.body);
  const initialQuoteReadyTask = pageState.quoteRuntime
    ? pageState.quoteRuntime.mount().catch(() => true)
    : Promise.resolve(true);
  if (pageState.wallpaperControl) {
    document.body.appendChild(pageState.wallpaperControl);
  }
  if (pageState.feedbackControl) {
    document.body.appendChild(pageState.feedbackControl);
  }
  if (pageState.shortcutDialogController) {
    pageState.shortcutDialogController.mount(document.body);
  }

  const {
    scheduleRecentReloadIfVisible,
    scheduleBookmarkReloadIfVisible
  } = NEWTAB_SECTION_RELOAD.createSectionReload({
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
  const actionButtonVisibilityReadyPromise = loadNewtabActionButtonVisibility();
  const glassStyleReadyPromise = followNewtabGlassStyle();
  const shortcutPreferencesReadyPromise = loadNewtabShortcutPreferences();
  const shortcutsReadyPromise = shortcutPreferencesReadyPromise.then(loadVisibleShortcuts);
  const initialShortcutsReadyTask = shortcutsReadyPromise.catch((error) => {
    console.warn('[Lumno] Deferred shortcut loading failed.', error);
    return [];
  });
  // The search settings join the page's first storage read.
  const sectionPolicyReadyPromise = settings.include(NEWTAB_SEARCH_SETTINGS);
  const initialLanguageReadyTask = followLanguage();
  const initialMotionPreferenceReadyTask = readBootValue('motionPreferenceReady');
  const initialLayoutStorageReadyTask = startupStorageReadBatch
    ? startupStorageReadBatch.ready
    : Promise.resolve(true);
  const initialFontsReadyTask = document.fonts && document.fonts.ready &&
    typeof document.fonts.ready.then === 'function'
      ? document.fonts.ready.catch(() => true)
      : Promise.resolve(true);
  loadWebAppearance();
  Promise.all([
    initialAppearanceReadyTask,
    initialBookmarkViewModeReadyPromise,
    loadZenMode(),
    actionButtonVisibilityReadyPromise,
    glassStyleReadyPromise,
    initialMotionPreferenceReadyTask,
    initialLanguageReadyTask,
    sectionPolicyReadyPromise,
    initialShortcutsReadyTask,
    pageState.initialPinnedRecentSitesReadyTask,
    pageState.initialHiddenRecentSitesReadyTask,
    initialLayoutStorageReadyTask,
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
    return waitForInitialWallpaperTone();
  }).then(() => {
    maybeShowFileAccessNotice();
    markNewtabReady();
  });
  updateBookmarkSectionPosition();

})();
