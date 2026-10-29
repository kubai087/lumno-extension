// The search's state and actions: the query, the mode and its menu, the
// results and where they come from, matching, autocomplete, result
// activation, site search providers and their icons, the slash commands,
// and the site themes the results, cards and tiles are tinted with.
import * as ShortcutIconCache from '../../domain/favicon/shortcut-favicon/persisted';
import * as LumnoShortcutFaviconStore from '../../platform/shortcut-favicon-store';
import * as NEWTAB_SITE_SEARCH_PROVIDERS from '../search/site-search-providers';
import { createDefaultTheme, createUrlHighlightTheme, defaultAccentColor } from '../../shared/favicon/favicon-theme';
import { extractAverageColor } from '../../shared/favicon/average-color';
import { getBrandAccentForUrl, normalizeHost } from '../../domain/favicon/brand-accents';
import { parseCssColor, stableHashCode } from '../../domain/color';
import * as NEWTAB_SITE_THEME_RESOLVER from '../theme/site-theme-resolver';
import { newtabOpenInNewTab } from '../../domain/settings';
import { SiteSearchIconCache } from '../../shared/search/site-search-icon-cache';
import { SiteSearchCatalog } from '../../shared/search-panel/site-search/catalog';
import * as SearchSettings from '../../domain/settings/search';
import { SearchQuery } from '../../shared/search-panel/search-query';
import { SuggestionSource } from '../../shared/search-panel/suggestion-source';
import { SuggestionModifiers } from '../../shared/search-panel/suggestion-modifiers';
import { SiteSearchRunner } from '../../shared/search-panel/site-search/runner';
import { SearchModeMenu } from '../../shared/search-panel/mode-menu';
import { SearchModeActions } from '../../shared/search-panel/mode-actions';
import { SearchModeMenuOrder } from '../../shared/search-panel/mode-menu-order';
import { SearchMatching } from '../../shared/search-panel/matching';
import { SearchResults } from '../../shared/search-panel/search-results';
import { SearchMode } from '../../shared/search-panel/search-mode';
import { SearchAutocomplete } from '../../shared/search-panel/autocomplete';
import type { SiteSearchProvider } from '../../domain/search/types';
import type { Suggestion } from '../../shared/react/search/suggestion-list/types';
import { ResultActivation } from '../../shared/search-panel/result-activation';
import { OpenTabs } from '../../shared/search-panel/open-tabs';
import { createCommandCatalog } from '../search/command-catalog';
import * as SUGGESTION_INPUT_PREVIEW from '../../domain/search/suggestion-input-preview';
import type { PageContext } from '../app/context';
import type { ShellFeature } from './shell';
import type { ShortcutStoreFeature } from './shortcut-store';
import type { NavigationFeature } from './navigation';

interface SearchCoreFeatureDeps {
  shell: ShellFeature;
  shortcutStore: ShortcutStoreFeature;
  navigation: NavigationFeature;
}

function createSearchCoreFeature(ctx: PageContext, deps: SearchCoreFeatureDeps) {
  const { formatMessage, localStorageArea, locale, settings, t } = ctx;
  const {
    appliedTheme,
    areFaviconRenderCachesReady,
    faviconCacheRuntime,
    faviconParts,
    getPageFaviconUrlResolver,
    getPersistedSiteThemeEntry,
    getUrlDisplay,
    isHostFaviconVisitDirty,
    searchBox,
    showToast,
    webAppearance
  } = deps.shell;
  const { getShortcutFaviconCandidateUrl, getShortcutFaviconDataUrl } = deps.shortcutStore;
  const { navigateToUrl, searchEngine } = deps.navigation;

  // The search suggestion the arrows show in the input.
  const suggestionInputPreview = SUGGESTION_INPUT_PREVIEW.createSuggestionInputPreview();
  // The window's tabs, which results switch to.
  const openTabs = new OpenTabs([], null);
  const commandCatalog = createCommandCatalog({ settings, t, formatMessage, appliedTheme, webAppearance });
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

  const {
    getProviderFaviconPageUrl,
    getProviderIcon,
    createAggregateSearchScopeProvider,
    getProviderHost
  } = NEWTAB_SITE_SEARCH_PROVIDERS.createSiteSearchProviders({
    getPageFaviconUrlResolver,
    siteSearchIconCache
  });

  const defaultTheme = createDefaultTheme();
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
    getShortcutFaviconCandidateUrl,
    getShortcutFaviconDataUrl,
    getProviderFaviconPageUrl,
    areFaviconRenderCachesReady
  });
  const modeActions = new SearchModeActions<SiteSearchProvider>({
    settings,
    locale,
    mode: searchMode,
    query: searchQuery,
    autocomplete: searchAutocomplete,
    source: suggestionSource,
    surface: {
      getInput: () => (searchBox.inputParts ? searchBox.inputParts.input : null),
      getModeController: () => searchBox.modeController,
      defaultTheme,
      getImmediateTheme: () => defaultTheme,
      getThemeForProvider
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

  return {
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
    getThemeSource,
    getThemeSourcePriority,
    getTileThemeOnSiteChange,
    isFaviconProxyUrl,
    isLowConfidenceTheme,
    isModeCommand,
    isNewtabDarkMode,
    isSlashCommandInput,
    isZenCommand,
    menuOrder,
    modeActions,
    modeMenu,
    normalizeAccentRgb,
    normalizeThemeConfidence,
    openTabs,
    queueThemeForTarget,
    resultActivation,
    scheduleThemeResolutionFlush,
    searchAutocomplete,
    searchMatching,
    searchMode,
    searchQuery,
    searchResults,
    setResolvedThemeForHost,
    shouldUseUrlFallbackThemeForSuggestion,
    siteSearchCatalog,
    siteSearchIconCache,
    siteSearchRunner,
    suggestionInputPreview,
    suggestionModifiers,
    suggestionSource,
    themeColorCache,
    themeHostCache,
    urlHighlightTheme
  };
}

type SearchCoreFeature = ReturnType<typeof createSearchCoreFeature>;

export { createSearchCoreFeature };
export type { SearchCoreFeature };
