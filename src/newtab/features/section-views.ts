// The sections' views and data: the bookmark and recent sections, the bottom
// dock, loading what the sections show and loading it again when tabs,
// history or bookmarks change, and the startup preferences that wait for
// the first pass.
import * as NEWTAB_BOOKMARK_SECTION from '../bookmarks/bookmark-section';
import * as NEWTAB_RECENT_SECTION from '../recent/recent-section';
import * as NEWTAB_SECTION_LOADERS from '../section-loaders';
import * as NEWTAB_SECTION_RELOAD from '../section-reload';
import * as NEWTAB_BOTTOM_DOCK_RUNTIME from '../shortcuts/bottom-dock-runtime';
import * as NEWTAB_STARTUP_PREFERENCES from '../startup-preferences';
import { normalizeHost } from '../../domain/favicon/brand-accents';
import { stableHashCode } from '../../domain/color';
import type { PageContext } from '../app/context';
import type { ShellFeature } from './shell';
import type { BookmarkStoreFeature } from './bookmark-store';
import type { ShortcutStoreFeature } from './shortcut-store';
import type { NavigationFeature } from './navigation';
import type { BookmarkMenusFeature } from './bookmark-menus';
import type { SearchCoreFeature } from './search-core';
import type { RecentCoreFeature } from './recent-core';
import type { ThemeFeature } from './theme';
import type { LayoutFeature } from './layout';
import type { TopContentFeature } from './top-content';
import type { SectionsFeature } from './sections';
import type { DragsFeature } from './drags';

interface SectionViewsFeatureDeps {
  shell: ShellFeature;
  bookmarkStore: BookmarkStoreFeature;
  shortcutStore: ShortcutStoreFeature;
  navigation: NavigationFeature;
  bookmarkMenus: BookmarkMenusFeature;
  searchCore: SearchCoreFeature;
  recentCore: RecentCoreFeature;
  theme: ThemeFeature;
  layout: LayoutFeature;
  topContent: TopContentFeature;
  sections: SectionsFeature;
  drags: DragsFeature;
}

function createSectionViewsFeature(ctx: PageContext, deps: SectionViewsFeatureDeps) {
  const { formatMessage, locale, preview, root, settings, t } = ctx;
  const bookmarkSection = ctx.structure.bookmark.section;
  const pageStructureRuntime = ctx.structure;
  const recentSection = ctx.structure.recent.section;
  const searchLayer = ctx.structure.searchLayer;
  const shortcutSection = ctx.structure.shortcut.section;
  const suggestionsContainer = ctx.structure.suggestions.container;
  const suggestionsOutline = ctx.structure.suggestions.outline;
  const suggestionsSurface = ctx.structure.suggestions.surface;
  const topContentContainer = ctx.structure.topContent;
  const {
    appliedTheme,
    areFaviconRenderCachesReady,
    bindCursorTooltip,
    bookmarkCascadeCopyTooltipController,
    copyBookmarkUrl,
    dismissStack,
    dragSessions,
    getBrowserPageFaviconUrl,
    getChromeFaviconUrl,
    getOwnExtensionPageDisplay,
    getSiteDisplayName,
    getUrlDisplay,
    hideCursorTooltip,
    hideTopActionTooltip,
    isLocalNetworkHost,
    sanitizeDisplayText,
    searchBox,
    shouldExcludeFromRecentSites,
    showToast,
    showTopActionTooltip,
    waitForFaviconRenderCaches
  } = deps.shell;
  const {
    bookmarkCards,
    bookmarkMoveHistory,
    bookmarkParts,
    bookmarksRuntime,
    bookmarksShown
  } = deps.bookmarkStore;
  const { getFolderItemIconUrl, refreshShortcutFolderReferences, shortcutList } = deps.shortcutStore;
  const { navigateToUrl, openUrlFromNewtabCard } = deps.navigation;
  const {
    closeBookmarkCascadeMenu,
    getTopBookmarks,
    handleBookmarkItemContextMenu,
    initFolderPathMorph,
    isBookmarkContextMenuNode,
    openBookmarkCascadeMenu,
    scheduleFolderColorSync,
    syncBookmarkTopbarSurfaceAppearance
  } = deps.bookmarkMenus;
  const {
    getCanonicalPageUrlForFavicon,
    getHostFromUrl,
    getImmediateThemeForSuggestion,
    queueThemeForTarget
  } = deps.searchCore;
  const {
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
    recentSourceReads,
    togglePinnedRecentSite,
    toggleRecentProgressTracking,
    writeHiddenRecentSites
  } = deps.recentCore;
  const {
    applyBookmarkCardTheme,
    applyRecentCardTheme,
    attachFaviconWithFallbacks,
    followTheme,
    notices,
    shouldDelayBookmarkHoverFromRecent
  } = deps.theme;
  const {
    applyBookmarkGridColumns,
    applyNewtabWidthMode,
    applyRecentGridColumns,
    beginSearchEntryRestoreLayoutLock,
    bottomDockParts,
    getBookmarkLimit,
    getRecentLimit,
    getRecentSourceLimit,
    isCardActivationSuppressed,
    keepBookmarkPageAnchorAfterLimitChange,
    setContentSectionVisible,
    updateBookmarkSectionPosition,
    viewportActivity
  } = deps.layout;
  const { quoteRuntime, shouldAnimateNewtabLayoutShift } = deps.topContent;
  const {
    getBookmarkPageCount,
    navigateBookmarkFolder,
    renderCurrentBookmarkPage,
    setBookmarkSurfaceVisible,
    setNewtabTopOccupied,
    syncBookmarkSurfaceMode,
    updateBookmarkGridHeightLock,
    updateBookmarkHeader,
    updateBookmarkPagerState
  } = deps.sections;
  const { handleBookmarkCascadeItemPointerDown, handleBookmarkDragPointerDown } = deps.drags;

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

  return {
    bottomDock,
    bottomDockRuntime,
    handleRecentVisibilityChange,
    markRecentDataDirty,
    renderRecentSites,
    scheduleBookmarkReloadIfVisible,
    scheduleRecentReloadIfVisible,
    startSectionDataPass
  };
}

type SectionViewsFeature = ReturnType<typeof createSectionViewsFeature>;

export { createSectionViewsFeature };
export type { SectionViewsFeature };
