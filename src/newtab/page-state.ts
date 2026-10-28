// The New Tab's shared page state, with the initial value of every property
// that starts as a constant. newtab.js creates it first and hands the same
// object to every module as `pageState`; properties whose first value
// depends on settings or other modules are set where that value exists.
import * as SUGGESTION_INPUT_PREVIEW from '../domain/search/suggestion-input-preview';
import type { AppearanceModesState } from './appearance-modes';
import type { BookmarkActionsState } from './bookmarks/bookmark-actions';
import type { BookmarkCascadeActionsState } from './bookmarks/bookmark-cascade-actions';
import type { BookmarkContextMenuState } from './bookmarks/bookmark-context-menu';
import type { BookmarkDisplaySettingsState } from './bookmarks/bookmark-display-settings';
import type { BookmarkDragControllerState } from './bookmarks/bookmark-drag-controller';
import type { BookmarkPagerState } from './bookmarks/bookmark-pager';
import type { BookmarkSectionState } from './bookmarks/bookmark-section';
import type { BottomDockRuntimeState } from './shortcuts/bottom-dock-runtime';
import type { CardThemesState } from './theme/card-themes';
import type { ClipboardActionsState } from './clipboard-actions';
import type { EntryMotionState } from './entry-motion';
import type { FeedbackControlState } from './feedback-control';
import type { FocusResumeState } from './focus-resume';
import type { FolderColorsState } from './bookmarks/folder-colors';
import type { InputFocusState } from './input-focus';
import type { ModeCommandsState } from './mode-commands';
import type { PageFaviconsState } from './theme/page-favicons';
import type { PageKeyboardState } from './page-keyboard';
import type { PageLayoutState } from './page-layout';
import type { PageNavigationState } from './page-navigation';
import type { PageNoticesState } from './page-notices';
import type { PagePreferencesState } from './page-preferences';
import type { PageResizeState } from './page-resize';
import type { RecentCardDrag, RecentCardDragState } from './recent/recent-card-drag';
import type { RecentSectionState } from './recent/recent-section';
import type { RecentSitesControllerState } from './recent/recent-sites-controller';
import type { RecentSourcesState } from './recent/recent-sources';
import type { SearchAutocompleteState } from './search/search-autocomplete';
import type { SearchBoxControlsState } from './search/search-box-controls';
import type { SearchBoxState } from './search/search-box';
import type { SearchInputCompositionState } from './search/search-input-composition';
import type { SearchModeControllerState } from './search/search-mode-controller';
import type { SearchModesState } from './search/search-modes';
import type { SearchNavigationState } from './search/search-navigation';
import type { SearchSettingsSyncState } from './search/search-settings-sync';
import type { SectionHeadersState } from './section-headers';
import type { SectionLoadersState } from './section-loaders';
import type { SectionReloadState } from './section-reload';
import type { SettingsSyncState } from './settings-sync';
import type { ShortcutContextMenuState } from './shortcuts/shortcut-context-menu';
import type { ShortcutDockState } from './shortcuts/shortcut-dock';
import type { ShortcutDragState } from './shortcuts/shortcut-drag';
import type { ShortcutPageActionsState } from './shortcuts/shortcut-page-actions';
import type { ShortcutsControllerState } from './shortcuts/shortcuts-controller';
import type { StartupPreferencesState } from './startup-preferences';
import type { SiteSearchRuntimeState } from './search/site-search-runtime';
import type { SiteThemeResolverState } from './theme/site-theme-resolver';
import type { SuggestionsControllerState } from './search/suggestions-controller';
import type { SuggestionsLayoutState } from './search/suggestions-layout';
import type { TooltipBindingsState } from './tooltip-bindings';
import type { QuoteRuntime } from './top-content/quotes';
import type { TopContentState } from './top-content/top-content';
import type { WallpaperPageState } from './wallpaper/wallpaper-page';

// The page state newtab.ts reads and writes itself, beyond what it hands
// the modules.
interface PageCoreState {
  recentCardDragRuntime: RecentCardDrag | null;
  quoteRuntime: QuoteRuntime | null;
}

// Every module's view of the page state, together.
type NewtabPageState =
  PageCoreState &
  AppearanceModesState &
  BookmarkActionsState &
  BookmarkCascadeActionsState &
  BookmarkContextMenuState &
  BookmarkDisplaySettingsState &
  BookmarkDragControllerState &
  BookmarkPagerState &
  BookmarkSectionState &
  BottomDockRuntimeState &
  CardThemesState &
  ClipboardActionsState &
  EntryMotionState &
  FeedbackControlState &
  FocusResumeState &
  FolderColorsState &
  InputFocusState &
  ModeCommandsState &
  PageFaviconsState &
  PageKeyboardState &
  PageLayoutState &
  PageNavigationState &
  PageNoticesState &
  PagePreferencesState &
  PageResizeState &
  RecentCardDragState &
  RecentSectionState &
  RecentSitesControllerState &
  RecentSourcesState &
  SearchAutocompleteState &
  SearchBoxControlsState &
  SearchBoxState &
  SearchInputCompositionState &
  SearchModeControllerState &
  SearchModesState &
  SearchNavigationState &
  SearchSettingsSyncState &
  SectionHeadersState &
  SectionLoadersState &
  SectionReloadState &
  SettingsSyncState &
  ShortcutContextMenuState &
  ShortcutDockState &
  ShortcutDragState &
  ShortcutPageActionsState &
  ShortcutsControllerState &
  StartupPreferencesState &
  SiteSearchRuntimeState &
  SiteThemeResolverState &
  SuggestionsControllerState &
  SuggestionsLayoutState &
  TooltipBindingsState &
  TopContentState &
  WallpaperPageState;

function createPageState(): NewtabPageState {
  return {
    currentThemeMode: 'system',
    initialThemeApplied: false,
    resolveInitialThemeReady: null,

    modeBadge: null,
    inputModeController: null,
    selectedIndex: -1,
    suggestionInputPreview: SUGGESTION_INPUT_PREVIEW.createSuggestionInputPreview(),
    currentSuggestions: [],
    lastSuggestionResponse: [],
    lastEngineSuggestionResponse: [],
    latestQuery: '',
    latestRawQuery: '',
    siteSearchTriggerState: null,
    localSearchScopeTriggerState: null,
    suggestionsView: null,
    recentSourceItems: [],
    pinnedRecentSites: [],
    progressHistoryMap: {},
    hiddenRecentSites: [],
    initialPinnedRecentSitesReadyTask: Promise.resolve([]),
    initialHiddenRecentSitesReadyTask: Promise.resolve([]),
    defaultPlaceholderText: 'Search or enter URL…',
    layoutController: null,
    layoutMotion: null,
    bottomDockScroller: null,
    faviconViewRuntime: null,
    newtabResizeLayoutLocked: false,
    newtabReadyRequested: false,

    // When the wallpaper was revealed (performance.now()); entry-motion.ts lets it lead the content.
    wallpaperShownAt: 0,
    newtabReadyViewportRevision: 0,
    resolveNewtabEntryAnimationReady: null,
    currentBookmarkViewMode: 'folder',
    searchLayer: null,
    topContentContainer: null,
    topContentController: null,
    wordmarkImageEl: null,
    wallpaperControl: null,
    wallpaperRuntime: null,
    quoteRuntime: null,
    sectionPanelSettings: null,
    updateNoticeController: null,
    graphicsNoticeController: null,
    engagementNoticeController: null,
    webdavFeatureHintController: null,
    helpCenterAskHintController: null,
    bookmarkCurrentPage: 0,
    bookmarkAllItems: [],
    bookmarkCurrentFolderId: '1',
    bookmarkRootFolderId: '1',
    bookmarkFolderPath: [],
    bookmarkRootTotalCount: 0,
    bookmarkRootVisibleCount: 0,
    bookmarkTitleWrap: null,
    bookmarkGrid: null,
    recentHeader: null,
    recentModeMenu: null,
    recentGrid: null,
    bookmarkPagerPrevButton: null,
    bookmarkPagerNextButton: null,
    bookmarkPagerAvailability: { previous: false, next: false },
    bookmarkPageAnimating: false,
    bookmarkMoveHistoryBusy: false,
    recentMouseInsideSection: false,
    recentMouseLeftAt: 0,
    recentSitesView: null,
    bookmarksView: null,
    newtabShortcutIcons: {},
    newtabShortcutFavicons: {},
    shortcutPersistenceInFlightCount: 0,
    shortcutDragState: null,

    // Synced colors keyed by folder path, and the colors they resolve to for
    // this device's bookmark ids.
    folderColorRefs: {},
    shortcutFaviconPolicyRevision: 0,
    shortcutFaviconPendingCacheEntries: {},

    // 使用本地打包字体，避免外链字体依赖。

    lastDeletionAt: 0,
    autocompleteState: null,
    inlineSearchState: null,
    remoteSuggestionDebounceTimer: null,
    tabs: [],
    currentNewtabTabId: null,
    suggestionRequestSeq: 0,
    searchSuggestionsDismissed: false,
    suggestionRequestWatchdogTimer: null,
    handleTabKey: null,

    // Created once the search modes and providers below exist.
    focusResume: null,

    // Set by the modules that own them once they exist.
    inputParts: null,
    suggestionsContainer: null,
    recentCardDragRuntime: null,
    faviconCacheRuntime: null,
    requestFaviconData: null,
    faviconDataCache: new Map(),
    bookmarkContextMenu: null,
    bookmarkContextMenuSelectController: null,
    bookmarkContextMenuTarget: null,
    bookmarkCascadeRuntime: null,
    bookmarkDragState: null,
    bookmarkTopbarRuntime: null,
    resolveInitialBookmarkViewModeReady: null,
    shortcutSection: null,
    shortcutGrid: null,
    addShortcutButton: null,
    recentSection: null,
    toastController: null,
    feedbackLinks: null,
    feedbackControl: null,
    feedbackButton: null,
    feedbackReactController: null,
    siteSearchState: null,
    localSearchScopeState: null,
    folderColorPicker: null,
    searchScopeIcon: null,
    recentContextMenu: null,
    recentContextMenuSelectController: null,
    recentContextMenuTarget: null,
    recentHistoryDialogController: null,
    startupRecentSourceReads: null,
    firefoxBrowserIcons: null,
    firefoxBrowserIconsReady: Promise.resolve(null),
    shortcutContextMenu: null,
    shortcutContextMenuSelectController: null,
    shortcutContextMenuTarget: null,
    shortcutPlateColorPicker: null,
    shortcutPlateColorPick: null,
    shortcutDialogController: null,

    bookmarkViewModeRevision: 0,
    bookmarkLoadedOnce: false,
    bookmarkRenderSignature: '',
    sectionDataRevision: 0,
    newtabShortcuts: [],
    recentLoadedOnce: false,
    recentRenderSignature: '',
    shortcutDockPendingPointerX: Number.NaN
  };
}

export { createPageState };
export type { NewtabPageState };
