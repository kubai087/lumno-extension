// Keyword and direct-URL suggestions, open-tab matching and quick navigation.
import type { OverlayTab, ShortcutRule } from '../../domain/messages';
import type { Disposition } from '../../domain/navigation-disposition';
import type { SiteSearchProvider } from '../../domain/search/types';
import type { BrowserInternalProfile } from '../../platform/browser-profile';
import * as LumnoMessaging from '../../platform/messaging';
import type { SearchInputParts } from '../../shared/react/search-input';
import type { Suggestion, SuggestionElement } from '../../shared/react/search/suggestion-list/types';
import type { ModeCommands } from '../mode-commands';
import type { FormatMessage } from '../newtab-types';
import type { SurfaceOpenKeys } from '../page-navigation';
import type { RenderSuggestions, SlashCommand } from './search-types';
import { shortcutRulesCache } from '../../shared/search/shortcut-rules-cache';
import * as SearchDirectNavigation from '../../domain/search/utils/direct-navigation';
import * as SearchNavigationMatching from '../../domain/search/utils/navigation-matching';
import { overlayTabPriority } from '../../domain/settings/overlay-panel';
import type { SettingsStore } from '../../platform/settings-store';
import type { AppearanceModes } from '../appearance-modes';
import { newtabZenMode } from '../../domain/settings/newtab-page';
import type { SearchQuery } from '../../shared/search-panel/search-query';
import type { SearchAutocomplete } from '../../shared/search-panel/autocomplete';
import type { SearchMode } from '../../shared/search-panel/search-mode';
import type { SearchResults } from '../../shared/search-panel/search-results';
import type { SearchModeActions } from '../../shared/search-panel/mode-actions';
import type { SiteSearchRunner } from '../../shared/search-panel/site-search/runner';
import * as BROWSER_PROFILE from '../../platform/browser-profile';
import * as SUGGESTION_ACTION_MODEL from '../../domain/search/suggestion-action-model';

interface SearchNavigationState {
  tabs: OverlayTab[];
  currentNewtabTabId: number | null;
  currentThemeMode: string;
  inputParts: SearchInputParts | null;
}

// A slash command the typed text names, and the text that completes it.
interface CommandMatch {
  command: SlashCommand;
  completion: string;
}

interface SearchNavigationDeps {
  siteSearchRunner: SiteSearchRunner;
  modeActions: SearchModeActions<SiteSearchProvider>;
  searchResults: SearchResults<Suggestion>;
  searchMode: SearchMode<SiteSearchProvider>;
  searchAutocomplete: SearchAutocomplete;
  searchQuery: SearchQuery;
  settings: Pick<SettingsStore, 'get' | 'set'>;
  formatMessage: FormatMessage;
  getExtensionResourceUrl(resourcePath: string): string;
  getPageFaviconCandidateUrl(pageUrl: string): string;
  isBackgroundOpenEvent(event: OpenEventLike | null | undefined): boolean;
  // Where a plain open from the surface goes, after its new-tab setting.
  getSurfaceOpenDisposition(surface: 'search', keys: SurfaceOpenKeys): Disposition;
  recordSearchSuggestionSelection(suggestion: Suggestion, query: string): void;
  navigateToUrl(url: string): void;
  suggestionItems: SuggestionElement[];
  getAutoHighlightIndex(): number;
  renderSuggestions: RenderSuggestions;
  isSlashCommandInput(query: string): boolean;
  getCommandMatch(query: string): CommandMatch | null;
  isModeCommand(query: string): boolean;
  isZenCommand(query: string): boolean;
  getNextThemeMode(mode: string): string;
  setVisibleThemeMode: AppearanceModes['setVisibleThemeMode'];
  setWebAppearanceMode: ModeCommands['setWebAppearanceMode'];
  focusSearchInputPreservingScroll(): boolean;
  openCommunityQrDialog(url: string | undefined): void;
  // Searches the query with the default engine; `forceSearch` skips the
  // address check.
  navigateToQuery(query: string, forceSearch: boolean, disposition: Disposition): void;
  pageState: SearchNavigationState;
}

// The fields of a click or key event that decide where a result opens.
type OpenEventLike = Pick<MouseEvent, 'altKey' | 'shiftKey' | 'metaKey' | 'ctrlKey'> & { button?: number };

// A result to open: its address, and what kind of row it came from.
type OpenableSuggestion = Pick<Suggestion, 'url' | 'title' | 'type'>;

function createSearchNavigation(deps: SearchNavigationDeps) {
  const {
    siteSearchRunner,
    modeActions,
    searchResults,
    searchMode,
    searchAutocomplete,
    searchQuery,
    settings,
    formatMessage,
    getExtensionResourceUrl,
    getPageFaviconCandidateUrl,
    isBackgroundOpenEvent,
    getSurfaceOpenDisposition,
    recordSearchSuggestionSelection,
    navigateToUrl,
    suggestionItems,
    getAutoHighlightIndex,
    renderSuggestions,
    isSlashCommandInput,
    getCommandMatch,
    isModeCommand,
    isZenCommand,
    getNextThemeMode,
    setVisibleThemeMode,
    setWebAppearanceMode,
    focusSearchInputPreservingScroll,
    openCommunityQrDialog,
    navigateToQuery
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  function getBrowserPageSuggestionTitle(browserProfile: Readonly<BrowserInternalProfile> | null, targetUrl: string): string {
    const browserName = browserProfile && browserProfile.name ? browserProfile.name : '';
    if (browserName) {
      return formatMessage('open_browser_url', '打开 {browser}：{url}', {
        browser: browserName,
        url: targetUrl
      });
    }
    return formatMessage('open_url', '打开 {url}', { url: targetUrl });
  }

  function getShortcutRules(): Promise<ShortcutRule[]> {
    const cached = shortcutRulesCache.rules;
    if (cached) {
      return Promise.resolve(cached);
    }
    if (shortcutRulesCache.pending) {
      return shortcutRulesCache.pending;
    }
    const rulesUrl = getExtensionResourceUrl('assets/data/shortcut-rules.json');
    const rulesPromise = fetch(rulesUrl)
      .then((response) => response.json())
      .then((data: unknown) => {
        const items = readShortcutRules(isRecord(data) ? data.items : null);
        shortcutRulesCache.rules = items;
        return items;
      })
      .catch(() => new Promise<ShortcutRule[]>((resolve) => {
        if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
          shortcutRulesCache.rules = [];
          resolve([]);
          return;
        }
        LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'getShortcutRules' }, (response) => {
          const items = response ? readShortcutRules(response.items) : [];
          shortcutRulesCache.rules = items;
          resolve(items);
        });
      }));
    shortcutRulesCache.pending = rulesPromise;
    return rulesPromise;
  }

  function buildKeywordSuggestions(input: string, rules: readonly ShortcutRule[]): Suggestion[] {
    const queryLower = input.toLowerCase();
    const browserProfile = BROWSER_PROFILE.getBrowserInternalProfile(navigator);
    const scheme = browserProfile.scheme;
    const matches: Suggestion[] = [];
    rules.forEach((rule) => {
      const keys = rule.keys;
      if (!keys) {
        return;
      }
      const isMatch = keys.some((key) => queryLower.startsWith(key));
      if (!isMatch) {
        return;
      }
      if (rule.type === 'browserPage' && rule.path) {
        if (!BROWSER_PROFILE.canOpenBrowserPages(scheme)) {
          return;
        }
        const targetUrl = `${scheme}${rule.path}`;
        matches.push({
          type: 'browserPage',
          title: getBrowserPageSuggestionTitle(browserProfile, targetUrl),
          url: targetUrl,
          favicon: getPageFaviconCandidateUrl(targetUrl)
        });
      } else if (rule.type === 'url' && rule.url) {
        matches.push({
          type: 'browserPage',
          title: formatMessage('open_url', '打开 {url}', { url: rule.url }),
          url: rule.url,
          favicon: getPageFaviconCandidateUrl(rule.url)
        });
      }
    });
    return matches;
  }

  function getDirectUrlSuggestion(input: string): Suggestion | null {
    const targetUrl = getDirectNavigationUrl(input);
    if (!targetUrl) {
      return null;
    }
    const suggestion: Suggestion = {
      type: 'directUrl',
      title: formatMessage('open_url', '打开 {url}', { url: targetUrl }),
      url: targetUrl,
      favicon: getPageFaviconCandidateUrl(targetUrl)
    };
    const matchedTab = getMatchedOpenTabForSuggestion(suggestion);
    if (!matchedTab) {
      return suggestion;
    }
    return {
      ...suggestion,
      title: String(matchedTab.title || '').trim() || suggestion.title,
      favicon: String(matchedTab.favIconUrl || '').trim() || suggestion.favicon,
      _xMatchedTabId: matchedTab.id
    };
  }

  function getDirectNavigationUrl(input: unknown): string {
    return SearchDirectNavigation.getDirectNavigationUrl(input);
  }

  function normalizeTabMatchUrl(url: unknown): string {
    return SearchNavigationMatching.buildTabMatchUrl(url);
  }

  function getMatchedOpenTabForSuggestion(suggestion: Suggestion | null | undefined): OverlayTab | null {
    if (!suggestion || !suggestion.url || pageState.tabs.length === 0) {
      return null;
    }
    const target = normalizeTabMatchUrl(suggestion.url);
    if (!target) {
      return null;
    }
    for (let i = 0; i < pageState.tabs.length; i += 1) {
      const tab = pageState.tabs[i];
      if (typeof tab.id !== 'number' || !tab.url) {
        continue;
      }
      const current = normalizeTabMatchUrl(tab.url);
      if (current && current === target) {
        return tab;
      }
    }
    return null;
  }

  function getMatchedOpenTabIdForSuggestion(suggestion: Suggestion | null | undefined): number | null {
    const matchedTab = getMatchedOpenTabForSuggestion(suggestion);
    return matchedTab ? matchedTab.id : null;
  }

  // Whether Enter on the row switches to the open tab it matched.
  function shouldSwitchMatchedTabSuggestion(suggestion: Suggestion | null | undefined): boolean {
    if (!suggestion || typeof suggestion._xMatchedTabId !== 'number') {
      return false;
    }
    if (!settings.get(overlayTabPriority)) {
      return false;
    }
    return true;
  }

  function shouldUseNewTabForSwitchAction(
    suggestion: Suggestion,
    event: OpenEventLike | null | undefined,
    item: SuggestionElement | null | undefined
  ): boolean {
    if (!event || !event.shiftKey) {
      return false;
    }
    const action = item && item._xVisitButtonAction ? item._xVisitButtonAction : 'switch';
    return SUGGESTION_ACTION_MODEL.shouldOpenSwitchActionInNewTab(suggestion, {
      action,
      openSwitchInNewTab: true
    });
  }

  function shouldOpenSearchResultInBackgroundTab(event: OpenEventLike | null | undefined): boolean {
    const config = {
      openInBackgroundTab: isBackgroundOpenEvent(event),
      openInCurrentTab: Boolean(event && event.altKey)
    };
    return SUGGESTION_ACTION_MODEL.getSearchResultOpenDisposition(config) === 'backgroundTab';
  }

  function getSearchResultNewTabDisposition(event: OpenEventLike | null | undefined): Disposition {
    return shouldOpenSearchResultInBackgroundTab(event) ? 'backgroundTab' : 'newTab';
  }

  // Option/Alt opens a result in the other of the current and a new tab
  // than search results are set to.
  function getSearchResultDisposition(event: OpenEventLike | null | undefined): Disposition {
    return getSurfaceOpenDisposition('search', {
      openInBackgroundTab: isBackgroundOpenEvent(event),
      openInOtherTab: Boolean(event && event.altKey)
    });
  }

  function openSearchResultUrl(suggestion: OpenableSuggestion | null | undefined, query: string, event: OpenEventLike | null | undefined): boolean {
    if (!suggestion || !suggestion.url) {
      return false;
    }
    recordSearchSuggestionSelection(suggestion, query);
    const disposition = getSearchResultDisposition(event);
    if (disposition !== 'currentTab') {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'createTab',
        url: suggestion.url,
        disposition
      });
      return true;
    }
    navigateToUrl(suggestion.url);
    return true;
  }

  function openMatchedTabSuggestion(
    suggestion: Suggestion,
    event: OpenEventLike | null | undefined,
    item: SuggestionElement | null | undefined,
    query: string
  ): void {
    if (shouldUseNewTabForSwitchAction(suggestion, event, item) ||
        shouldOpenSearchResultInBackgroundTab(event)) {
      recordSearchSuggestionSelection(suggestion, query);
      if (suggestion.url) {
        LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
          action: 'createTab',
          url: suggestion.url,
          disposition: getSearchResultNewTabDisposition(event)
        });
      }
      return;
    }
    if (typeof suggestion._xMatchedTabId === 'number') {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'switchToTab',
        tabId: suggestion._xMatchedTabId
      });
    }
  }

  // Reads the open tabs again; `callback` learns whether it could.
  function refreshTabsForSearchContext(callback?: (ok: boolean) => void): void {
    if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      if (callback) {
        callback(false);
      }
      return;
    }
    const request: { action: 'getTabsForOverlay'; currentTabId?: number } = { action: 'getTabsForOverlay' };
    if (typeof pageState.currentNewtabTabId === 'number') {
      request.currentTabId = pageState.currentNewtabTabId;
    }
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const finish = (ok: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      if (callback) {
        callback(ok);
      }
    };
    timeout = setTimeout(() => finish(false), 240);
    LumnoMessaging.sendBackgroundMessage(chrome.runtime, request, (response) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        finish(false);
        return;
      }
      pageState.tabs = response && Array.isArray(response.tabs) ? response.tabs : [];
      pageState.currentNewtabTabId = response && typeof response.currentTabId === 'number'
        ? response.currentTabId
        : null;
      finish(true);
    });
  }

  // Warm the tab snapshot before the first URL input so a matched page can render
  // with its final title and switch action on the first visible frame.
  refreshTabsForSearchContext(() => {});

  // The address Enter goes to without a search: a typed address or a
  // keyword's page; null for neither.
  function resolveQuickNavigation(query: string): Promise<string | null> {
    const directUrlSuggestion = getDirectUrlSuggestion(query);
    if (directUrlSuggestion) {
      return Promise.resolve(directUrlSuggestion.url || null);
    }
    return getShortcutRules().then((rules) => {
      const keywordSuggestions = buildKeywordSuggestions(query, rules);
      if (keywordSuggestions.length > 0) {
        return keywordSuggestions[0].url || null;
      }
      return null;
    });
  }

  // Enter in the search box: a typed command, the highlighted (or
  // automatically highlighted) suggestion, the active search scope, an
  // inline or autocompleted site, a quick-navigation target, and last a
  // web search.
  function submitSearchQuery(query: string, event: KeyboardEvent): void {
    const commandMatch = searchMode.local ? null : getCommandMatch(query);
    if (commandMatch && searchResults.selectedIndex === -1) {
      if (commandMatch.command.type === 'commandNewTab') {
        LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openNewTab' });
        return;
      }
      if (commandMatch.command.type === 'commandSettings') {
        LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openOptionsPage' });
        return;
      }
    }
    if (!searchMode.local && isModeCommand(query)) {
      setVisibleThemeMode(getNextThemeMode(pageState.currentThemeMode));
      return;
    }
    if (!searchMode.local && isZenCommand(query)) {
      void settings.set(newtabZenMode, !settings.get(newtabZenMode));
      return;
    }
    const executeSuggestion = (
      selectedSuggestion: Suggestion | undefined,
      event: KeyboardEvent,
      activeSuggestionIndex: number
    ): boolean => {
      if (!selectedSuggestion) {
        return false;
      }
      const activeItem = Number.isInteger(activeSuggestionIndex)
        ? suggestionItems[activeSuggestionIndex]
        : null;
      if (selectedSuggestion.type === 'modeSwitch') {
        setVisibleThemeMode(selectedSuggestion.nextMode);
        return true;
      }
      if (selectedSuggestion.type === 'zenSwitch') {
        void settings.set(newtabZenMode, newtabZenMode.parse(selectedSuggestion.nextEnabled));
        return true;
      }
      if (selectedSuggestion.type === 'webAppearanceSwitch') {
        setWebAppearanceMode(selectedSuggestion.nextMode);
        return true;
      }
      if (selectedSuggestion.type === 'commandNewTab') {
        LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openNewTab' });
        return true;
      }
      if (selectedSuggestion.type === 'commandSettings') {
        LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openOptionsPage' });
        return true;
      }
      if (selectedSuggestion.type === 'siteSearchPrompt' && isSiteSearchProvider(selectedSuggestion.provider)) {
        modeActions.activateSiteSearch(selectedSuggestion.provider);
        focusSearchInputPreservingScroll();
        return true;
      }
      if (selectedSuggestion.type === 'helpFeedback' && selectedSuggestion.feedbackKey === 'community') {
        openCommunityQrDialog(selectedSuggestion.url);
        return true;
      }
      if (isSiteSearchProvider(selectedSuggestion.provider) && selectedSuggestion.searchQuery) {
        return siteSearchRunner.run(
          selectedSuggestion.provider,
          selectedSuggestion.searchQuery,
          getSearchResultDisposition(event)
        );
      }
      if (shouldSwitchMatchedTabSuggestion(selectedSuggestion)) {
        openMatchedTabSuggestion(selectedSuggestion, event, activeItem, query);
        return true;
      }
      if (shouldOpenSearchResultInBackgroundTab(event) && selectedSuggestion.url) {
        return openSearchResultUrl(selectedSuggestion, query, event);
      }
      if (selectedSuggestion.forceSearch && selectedSuggestion.searchQuery) {
        navigateToQuery(selectedSuggestion.searchQuery, true, getSearchResultDisposition(event));
        return true;
      }
      if (selectedSuggestion.url) {
        return openSearchResultUrl(selectedSuggestion, query, event);
      }
      return false;
    };
    if (searchResults.selectedIndex >= 0 && searchResults.rows[searchResults.selectedIndex]) {
      if (executeSuggestion(searchResults.rows[searchResults.selectedIndex], event, searchResults.selectedIndex)) {
        return;
      }
    } else {
      const autoIndex = getAutoHighlightIndex();
      if (autoIndex >= 0 && searchResults.rows[autoIndex]) {
        if (executeSuggestion(searchResults.rows[autoIndex], event, autoIndex)) {
          return;
        }
      }
    }
    if (!searchMode.local && isSlashCommandInput(query)) {
      renderSuggestions([], query);
      return;
    }
    if (searchMode.local) {
      return;
    }
    if (searchMode.site) {
      if (siteSearchRunner.run(
        searchMode.site,
        query,
        getSearchResultDisposition(event)
      )) {
        return;
      }
    }
    const inputValue = pageState.inputParts ? pageState.inputParts.input.value : '';
    const currentRawInput = (searchQuery.raw || inputValue || '').trim();
    const inline = searchMode.inline;
    if (inline && inline.isAuto && inline.rawInput === currentRawInput) {
      if (inline.provider && inline.query) {
        if (siteSearchRunner.run(
          inline.provider,
          inline.query,
          getSearchResultDisposition(event)
        )) {
          return;
        }
      } else if (inline.url) {
        openSearchResultUrl({
          url: inline.url,
          title: inline.url,
          type: 'inlineSiteSearch'
        }, query, event);
        return;
      }
    }
    if (searchAutocomplete.state && searchAutocomplete.state.url) {
      openSearchResultUrl({
        url: searchAutocomplete.state.url,
        title: searchAutocomplete.state.title || '',
        type: 'autocomplete'
      }, query, event);
      return;
    }
    void resolveQuickNavigation(query).then((targetUrl) => {
      if (targetUrl) {
        openSearchResultUrl({
          url: targetUrl,
          title: query,
          type: 'quickNavigation'
        }, query, event);
        return;
      }
      navigateToQuery(query, false, getSearchResultDisposition(event));
    });
  }

  return {
    submitSearchQuery,
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
    resolveQuickNavigation
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

// The shortcut rules in a list read from the bundled file or the
// background; entries that are not rules are left out.
function readShortcutRules(value: unknown): ShortcutRule[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const rules: ShortcutRule[] = [];
  value.forEach((item: unknown) => {
    if (!isRecord(item)) {
      return;
    }
    const keys = Array.isArray(item.keys) ? item.keys.filter((key: unknown): key is string => typeof key === 'string') : undefined;
    rules.push({
      ...(typeof item.type === 'string' ? { type: item.type } : {}),
      ...(keys ? { keys } : {}),
      ...(typeof item.path === 'string' ? { path: item.path } : {}),
      ...(typeof item.url === 'string' ? { url: item.url } : {}),
      ...(typeof item.searchSourceType === 'string' ? { searchSourceType: item.searchSourceType } : {})
    });
  });
  return rules;
}

// Whether a row's provider names a site search; rows may leave out its key.
function isSiteSearchProvider(provider: Partial<SiteSearchProvider> | null | undefined): provider is SiteSearchProvider {
  return Boolean(provider) && typeof provider?.key === 'string';
}

// Arrow keys move the highlighted suggestion one step (`direction` 1 or
// -1) and wrap around the list. With nothing selected yet, the step starts
// from the automatically highlighted suggestion (`autoIndex`, -1 if none).
function getNextSuggestionIndex(
  direction: number,
  selectedIndex: number,
  itemCount: number,
  autoIndex: number
): { index: number; didWrap: boolean } {
  const count = Math.max(0, Math.floor(Number(itemCount) || 0));
  if (!count) {
    return { index: -1, didWrap: false };
  }
  const last = count - 1;
  const auto = Number.isInteger(autoIndex) ? autoIndex : -1;
  if (direction > 0) {
    if (selectedIndex === -1) {
      const index = auto >= 0 ? (auto + 1) % count : 0;
      return { index, didWrap: auto >= 0 && index === 0 };
    }
    const index = (selectedIndex + 1) % count;
    return { index, didWrap: selectedIndex === last && index === 0 };
  }
  if (selectedIndex === 0) {
    return { index: last, didWrap: true };
  }
  if (selectedIndex === -1) {
    return auto > 0 ? { index: auto - 1, didWrap: false } : { index: last, didWrap: true };
  }
  return { index: selectedIndex - 1, didWrap: false };
}

type SearchNavigation = ReturnType<typeof createSearchNavigation>;

export { createSearchNavigation, getNextSuggestionIndex };
export type { CommandMatch, SearchNavigation, SearchNavigationDeps, SearchNavigationState };
