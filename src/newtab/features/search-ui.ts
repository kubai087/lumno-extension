// The search box and what drives it: typing, composition and history, the
// suggestions and their navigation, Enter, Tab and the mode controller,
// site search, the mode commands, the notices and hints shown with the box,
// the box's controls, and the search settings it follows.
import * as LumnoImeKeyGuard from '../../domain/search/ime-key-guard';
import * as SEARCH_INPUT_HISTORY from '../../domain/search/search-input-history';
import * as SUGGESTION_NAVIGATION from '../../shared/search/suggestion-navigation';
import * as NEWTAB_INPUT_FOCUS from '../input-focus';
import * as NEWTAB_MODE_COMMANDS from '../mode-commands';
import * as NEWTAB_PAGE_NOTICES from '../page-notices';
import * as NEWTAB_SEARCH_BOX_CONTROLS from '../search/search-box-controls';
import * as NEWTAB_SEARCH_BOX from '../search/search-box';
import * as NEWTAB_SEARCH_INPUT_COMPOSITION from '../search/search-input-composition';
import * as NEWTAB_SEARCH_MODE_CONTROLLER from '../search/search-mode-controller';
import * as NEWTAB_SEARCH_NAVIGATION from '../search/search-navigation';
import * as NEWTAB_SEARCH_SETTINGS_SYNC from '../search/search-settings-sync';
import * as NEWTAB_SITE_SEARCH_RUNTIME from '../search/site-search-runtime';
import * as NEWTAB_SUGGESTIONS_CONTROLLER from '../search/suggestions-controller';
import { defaultAccentColor } from '../../shared/favicon/favicon-theme';
import { getBrandAccentForUrl } from '../../domain/favicon/brand-accents';
import { parseCssColor, rgbToCss } from '../../domain/color';
import { numberShortcutInstantEnabled } from '../../domain/settings';
import type { SuggestionElement } from '../../shared/react/search/suggestion-list/types';
import { createSearchInput } from '../../shared/react/search-input';
import { createSettingPort } from '../../platform/settings-store';
import * as SearchSettings from '../../domain/settings/search';
import * as BundledIcons from '../../domain/favicon/shortcut-favicon/bundled-icons';
import { SearchTabKey } from '../../shared/search-panel/tab-key';
import { createSearchSubmit } from '../search/search-submit';
import type { PageContext } from '../app/context';
import type { ShellFeature } from './shell';
import type { BookmarkStoreFeature } from './bookmark-store';
import type { ShortcutStoreFeature } from './shortcut-store';
import type { NavigationFeature } from './navigation';
import type { BookmarkMenusFeature } from './bookmark-menus';
import type { ShortcutMenusFeature } from './shortcut-menus';
import type { SearchCoreFeature } from './search-core';
import type { RecentCoreFeature } from './recent-core';
import type { ThemeFeature } from './theme';
import type { LayoutFeature } from './layout';
import type { TopContentFeature } from './top-content';
import type { WallpaperFeature } from './wallpaper';
import type { SectionViewsFeature } from './section-views';

interface SearchUiFeatureDeps {
  shell: ShellFeature;
  bookmarkStore: BookmarkStoreFeature;
  shortcutStore: ShortcutStoreFeature;
  navigation: NavigationFeature;
  bookmarkMenus: BookmarkMenusFeature;
  shortcutMenus: ShortcutMenusFeature;
  searchCore: SearchCoreFeature;
  recentCore: RecentCoreFeature;
  theme: ThemeFeature;
  layout: LayoutFeature;
  topContent: TopContentFeature;
  wallpaper: WallpaperFeature;
  sectionViews: SectionViewsFeature;
}

function createSearchUiFeature(ctx: PageContext, deps: SearchUiFeatureDeps) {
  const { formatMessage, locale, preview, root, settings, t } = ctx;
  const bookmarkSection = ctx.structure.bookmark.section;
  const recentSection = ctx.structure.recent.section;
  const searchLayer = ctx.structure.searchLayer;
  const suggestionsContainer = ctx.structure.suggestions.container;
  const {
    appliedTheme,
    bindCursorTooltip,
    bindSearchInputCursorTooltip,
    bookmarkCursorTooltipController,
    copySearchResultUrl,
    filterBlacklistedSuggestions,
    getBrowserPageFaviconUrl,
    getChromeFaviconUrl,
    getPageFaviconCandidateUrl,
    getPageFaviconRenderCandidates,
    getPageFaviconUrlResolver,
    getUrlDisplay,
    hideCursorTooltip,
    hideSearchInputCursorTooltip,
    hideShortcutTooltip,
    hideToast,
    hideTopActionTooltip,
    isLocalNetworkHost,
    limitSuggestionsForDisplay,
    sanitizeDisplayText,
    searchBox,
    shouldBlockFaviconForHost,
    showToast,
    showTopActionTooltip,
    webAppearance
  } = deps.shell;
  const { bookmarkCards, bookmarkParts } = deps.bookmarkStore;
  const { closeShortcutDialog } = deps.shortcutStore;
  const {
    closeFeedbackPopover,
    getFeedbackControl,
    getFeedbackLinks,
    getFeedbackWebLocale,
    getOpenDisposition,
    isFeedbackPopoverOpen,
    navigateToQuery,
    openCommunityQrDialog,
    openFeedbackExternalUrl,
    searchEngine
  } = deps.navigation;
  const { closeBookmarkCascadeMenu, isFolderColorPickerOpen } = deps.bookmarkMenus;
  const { closeShortcutContextMenu } = deps.shortcutMenus;
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
    isModeCommand,
    isNewtabDarkMode,
    isSlashCommandInput,
    isZenCommand,
    menuOrder,
    modeActions,
    modeMenu,
    openTabs,
    resultActivation,
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
  } = deps.searchCore;
  const { closeRecentContextMenu } = deps.recentCore;
  const {
    applyFallbackIcon,
    applyFaviconOpticalAlignment,
    applyFaviconOpticalShift,
    applyThemeMode,
    attachFaviconData,
    attachFaviconWithFallbacks,
    getScopedThemeMode,
    notices,
    preloadIcon,
    refreshThemeAwareFavicons,
    setFaviconSrcWithAnimation,
    setVisibleThemeMode,
    warmIconCache
  } = deps.theme;
  const {
    applyNewtabShortcutsVisibility,
    initialNewtabInputAutoFocusReadyTask,
    newtabEntryAnimationReadyPromise,
    setSuggestionsVisible,
    syncSearchModeMenuResultOffset,
    updateBookmarkSectionPosition,
    updateSearchEntryLayout
  } = deps.layout;
  const { applyNewtabTopContentVisibility } = deps.topContent;
  const { finishNewtabEntryAnimation, wallpaperRuntime } = deps.wallpaper;
  const {
    bottomDock,
    markRecentDataDirty,
    scheduleBookmarkReloadIfVisible,
    scheduleRecentReloadIfVisible
  } = deps.sectionViews;

  const pageSearchParams = new URLSearchParams(window.location.search || '');
  const suggestionItems: SuggestionElement[] = [];
  const imeKeyGuard = LumnoImeKeyGuard.createImeKeyGuard();
  const searchInputHistoryController =
    SEARCH_INPUT_HISTORY.createSearchInputHistoryController({
      storage: createSettingPort(settings, SearchSettings.searchInputHistory)
    });
  function isImeCompositionEvent(event: KeyboardEvent): boolean {
    return imeKeyGuard.shouldIgnoreKeydown(event);
  }

  suggestionsContainer.addEventListener('wheel', function(event) {
    SUGGESTION_NAVIGATION.preventNumberShortcutWheel(event, suggestionsContainer);
  }, { passive: false });
  document.addEventListener('pointerdown', function() {
    SUGGESTION_NAVIGATION.cancelNumberShortcuts(suggestionsContainer);
  }, true);
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

  return {
    createNewtabEngagementNoticeController,
    createNewtabGraphicsNoticeController,
    followNewtabActionButtonVisibility,
    followZenMode,
    inputParts,
    maybeShowFileAccessNotice,
    numberShortcutOptions,
    suggestionItems,
    tabKey
  };
}

type SearchUiFeature = ReturnType<typeof createSearchUiFeature>;

export { createSearchUiFeature };
export type { SearchUiFeature };
