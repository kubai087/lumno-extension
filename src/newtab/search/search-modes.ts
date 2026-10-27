// Search mode menu and site-search / local-scope activation for the input.
import type { ShortcutRule } from '../../domain/messages';
import * as SEARCH_SOURCE_ORDER from '../../domain/search/search-source-order';
import type { SearchSourceOrder } from '../../domain/search/search-source-order';
import type { SuggestionInputPreview } from '../../domain/search/suggestion-input-preview';
import type { LocalSearchScope, SearchSourceType, SiteSearchProvider } from '../../domain/search/types';
import type { SearchInputParts } from '../../shared/react/search-input';
import type { Suggestion } from '../../shared/react/search/suggestion-list/types';
import type { InputModeController } from '../../shared/search/search-input-mode';
import type { InputModeProvider, InputModeTheme, ModeMenuItem } from '../../shared/search/input-mode/types';
import type { FormatMessage, Translate } from '../newtab-types';
import type { SearchModeController } from './search-mode-controller';
import { getAggregateSearchId } from './search-types';
import type { ActiveLocalScope, AutocompleteState, InlineSearchState } from './search-types';
import type { SiteSearchProviders } from './site-search-providers';
import { shortcutRulesCache } from '../../shared/search/shortcut-rules-cache';
import * as SearchSiteSearchProviders from '../../domain/search/utils/site-search-providers';
import type { SiteSearchIconCache } from '../../shared/search/site-search-icon-cache';
import type { SiteSearchCatalog } from '../../shared/search-panel/site-search/catalog';
import type { DefaultSearchEngine } from '../../shared/search-panel/default-engine';
import { searchResultSourceTypes } from '../../domain/settings/search';
import type { SettingsStore } from '../../platform/settings-store';

// A site search the typed text turns into on Tab.
interface SiteSearchTrigger {
  rawInput: string;
  provider: SiteSearchProvider | null;
}

// A local scope the typed text turns into on Tab.
interface LocalScopeTrigger {
  rawInput: string;
  scope: LocalSearchScope | null;
}

interface SearchModesState {
  inputParts: SearchInputParts | null;
  inputModeController: InputModeController | null;
  siteSearchState: SiteSearchProvider | null;
  siteSearchTriggerState: SiteSearchTrigger | null;
  localSearchScopeState: ActiveLocalScope | null;
  localSearchScopeTriggerState: LocalScopeTrigger | null;
  inlineSearchState: InlineSearchState | null;
  autocompleteState: AutocompleteState | null;
  currentSuggestions: Suggestion[];
  selectedIndex: number;
  suggestionRequestSeq: number;
  latestQuery: string;
  latestRawQuery: string;
  suggestionInputPreview: Pick<SuggestionInputPreview, 'commit' | 'editAddress'>;
}

interface SearchModesDeps {
  settings: Pick<SettingsStore, 'get'>;
  siteSearchCatalog: SiteSearchCatalog;
  searchEngine: DefaultSearchEngine;
  t: Translate;
  createAggregateSearchScopeProvider: SiteSearchProviders['createAggregateSearchScopeProvider'];
  isAggregateSearchProvider: SiteSearchProviders['isAggregateSearchProvider'];
  isSearchEngineSiteSearchProvider: SiteSearchProviders['isSearchEngineSiteSearchProvider'];
  isAiSiteSearchProvider: SiteSearchProviders['isAiSiteSearchProvider'];
  getSiteSearchDisplayName: SiteSearchProviders['getSiteSearchDisplayName'];
  getProviderIcon: SiteSearchProviders['getProviderIcon'];
  getLocalSearchScopeLabel: SiteSearchProviders['getLocalSearchScopeLabel'];
  getLocalSearchScopeIconName: SiteSearchProviders['getLocalSearchScopeIconName'];
  siteSearchIconCache: Pick<SiteSearchIconCache, 'load'>;
  formatMessage: FormatMessage;
  defaultTheme: InputModeTheme;
  clearAutocomplete(): void;
  clearSearchSuggestions(): void;
  clearSiteSearchPrefix: SearchModeController['clearSiteSearchPrefix'];
  setSiteSearchPrefix: SearchModeController['setSiteSearchPrefix'];
  // The theme a provider's icon gives its prefix, once worked out.
  getThemeForProvider(provider: SiteSearchProvider): Promise<InputModeTheme | null | undefined>;
  getTopSiteMatchCandidate: SiteSearchProviders['getTopSiteMatchCandidate'];
  getSiteSearchTriggerCandidate: SiteSearchProviders['getSiteSearchTriggerCandidate'];
  getLocalSearchScopeCandidate: SiteSearchProviders['getLocalSearchScopeCandidate'];
  getShortcutRules(): Promise<ShortcutRule[]>;
  readSearchSourceOrder?(): unknown;
  writeSearchSourceOrder?(order: SearchSourceOrder): unknown;
  pageState: SearchModesState;
}

// How a mode starts: keeping the results shown, and animating its tag.
interface ModeActivationOptions {
  preserveResults?: boolean;
  animatePrefix?: boolean;
}

// The local sources the menu offers, in their default order.
const LOCAL_SCOPE_SOURCES: readonly SearchSourceType[] = ['topSite', 'bookmark', 'history'];

function createSearchModes(deps: SearchModesDeps) {
  const {
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
    clearSearchSuggestions,
    clearSiteSearchPrefix,
    setSiteSearchPrefix,
    getThemeForProvider,
    getTopSiteMatchCandidate,
    getSiteSearchTriggerCandidate,
    getLocalSearchScopeCandidate,
    getShortcutRules,
    readSearchSourceOrder,
    writeSearchSourceOrder
  } = deps;
  // Undo and redo for the moves made in this page's panel.
  const searchSourceOrderHistory = SEARCH_SOURCE_ORDER.createHistory();
  // Moves, undos and redos run one after another, so each reads what the
  // previous one stored.
  let searchSourceOrderQueue: Promise<unknown> = Promise.resolve();
  function queueSearchSourceOrderTask(task: () => unknown): Promise<unknown> {
    searchSourceOrderQueue = searchSourceOrderQueue.then(task).catch(() => {});
    return searchSourceOrderQueue;
  }

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  // The search box's input; the page creates it before any mode is used.
  function getSearchInput(): HTMLInputElement {
    const inputParts = pageState.inputParts;
    if (!inputParts) {
      throw new Error('Search input unavailable');
    }
    return inputParts.input;
  }

  function buildSearchModeMenuItems(sourceOrder: unknown): ModeMenuItem[] {
    const engineGroup = t('search_scope_group_engines', '搜索引擎');
    const localGroup = t('search_scope_group_local', '浏览器内容');
    const aiGroup = t('search_scope_group_ai', 'AI 搜索');
    const siteGroup = t('search_scope_group_sites', '站内搜索');
    const aggregateGroup = t('search_scope_group_aggregates', '聚合搜索');
    const items: ModeMenuItem[] = [];
    const providers = siteSearchCatalog.modeProviders;
    siteSearchCatalog.aggregates.forEach((definition) => {
      if (!siteSearchCatalog.isAggregateAvailable(definition, providers)) {
        return;
      }
      const provider = createAggregateSearchScopeProvider(definition);
      if (!provider) {
        return;
      }
      items.push({
        id: `aggregate:${definition.id}`,
        kind: 'aggregate',
        aggregate: definition,
        provider,
        label: definition.name,
        group: aggregateGroup,
        groupKey: 'aggregate',
        orderList: 'aggregate',
        orderKey: definition.id,
        iconName: 'ri-stack-line',
        searchTerms: [definition.name].concat(definition.sourceRefs || []),
        active: Boolean(
          isAggregateSearchProvider(pageState.siteSearchState) &&
          getAggregateSearchId(pageState.siteSearchState) === String(definition.id || '')
        )
      });
    });
    providers
      .filter((provider) => isSearchEngineSiteSearchProvider(provider))
      .concat(providers.filter((provider) => (
        !isSearchEngineSiteSearchProvider(provider) && !isAiSiteSearchProvider(provider)
      )))
      .concat(providers.filter((provider) => isAiSiteSearchProvider(provider)))
      .forEach((provider) => {
        const isAi = isAiSiteSearchProvider(provider);
        const isSearchEngine = isSearchEngineSiteSearchProvider(provider);
        const groupKey = isSearchEngine ? 'engine' : (isAi ? 'ai' : 'site');
        items.push({
          id: SearchSiteSearchProviders.getSearchModeProviderId(provider),
          kind: 'provider',
          provider,
          label: getSiteSearchDisplayName(provider),
          group: isSearchEngine ? engineGroup : (isAi ? aiGroup : siteGroup),
          groupKey,
          orderList: provider._xIsCustom ? 'custom' : groupKey,
          orderKey: provider.key,
          iconUrl: getProviderIcon(provider),
          iconName: isAi ? 'ri-search-ai-line' : 'ri-global-line',
          isAi,
          active: Boolean(pageState.siteSearchState && SearchSiteSearchProviders.getSearchModeProviderId(pageState.siteSearchState) === SearchSiteSearchProviders.getSearchModeProviderId(provider))
        });
      });
    LOCAL_SCOPE_SOURCES.forEach((sourceType) => {
      if (!settings.get(searchResultSourceTypes).includes(sourceType)) {
        return;
      }
      items.push({
        id: `local:${sourceType}`,
        kind: 'local',
        sourceType,
        label: getLocalSearchScopeLabel({ sourceType }),
        groupKey: 'local',
        orderList: 'local',
        orderKey: sourceType,
        searchTerms: sourceType === 'topSite'
          ? ['top sites', 'frequent sites', 'favorites']
          : (sourceType === 'bookmark'
            ? ['bookmark', 'bookmarks']
            : ['history', 'browsing history']),
        group: localGroup,
        iconName: getLocalSearchScopeIconName(sourceType),
        menuIconName: sourceType === 'topSite' ? 'star' : sourceType,
        active: Boolean(pageState.localSearchScopeState && pageState.localSearchScopeState.sourceType === sourceType)
      });
    });
    return SEARCH_SOURCE_ORDER.rankScopeItems(items, sourceOrder);
  }

  // The stored order; null when it cannot be read.
  function loadSearchSourceOrder(): Promise<unknown> {
    return readSearchSourceOrder
      ? Promise.resolve(readSearchSourceOrder()).catch(() => null)
      : Promise.resolve(null);
  }

  function getSearchModeMenuItems(): Promise<ModeMenuItem[]> {
    return Promise.all([
      siteSearchIconCache.load(),
      siteSearchCatalog.loadProviders(),
      siteSearchCatalog.loadAggregates(),
      loadSearchSourceOrder()
    ]).then((results) => buildSearchModeMenuItems(results[3]));
  }

  // A tile dragged in the panel: store the new order on top of the latest
  // stored one, so a concurrent change from Settings is not lost.
  function reorderSearchModeMenu(payload: Parameters<typeof SEARCH_SOURCE_ORDER.applyScopeMenuMove>[1]): void {
    if (!writeSearchSourceOrder) {
      return;
    }
    void queueSearchSourceOrderTask(() => loadSearchSourceOrder()
      .then((value) => recordSearchSourceOrder(
        value,
        SEARCH_SOURCE_ORDER.applyScopeMenuMove(value, payload)
      )));
  }

  function recordSearchSourceOrder(before: unknown, after: SearchSourceOrder): unknown {
    searchSourceOrderHistory.record(before, after);
    return writeSearchSourceOrder ? writeSearchSourceOrder(after) : null;
  }

  // Returns whether there was a step to take, so the panel only claims
  // Ctrl/Cmd+Z when it does something.
  function stepSearchModeMenuHistory(direction: 'undo' | 'redo'): boolean {
    // Narrowed here, for the queued task below.
    const write = writeSearchSourceOrder;
    if (!write ||
        !(direction === 'redo' ? searchSourceOrderHistory.canRedo() : searchSourceOrderHistory.canUndo())) {
      return false;
    }
    void queueSearchSourceOrderTask(() => loadSearchSourceOrder()
      .then((value) => {
        const target = direction === 'redo'
          ? searchSourceOrderHistory.redo(value)
          : searchSourceOrderHistory.undo(value);
        return target ? write(target) : null;
      }));
    return true;
  }

  // A group block moved from its title in the panel.
  function moveSearchModeMenuGroup(payload: { delta: number; group: string; groups: string[] }): void {
    if (!writeSearchSourceOrder) {
      return;
    }
    void queueSearchSourceOrderTask(() => loadSearchSourceOrder()
      .then((value) => recordSearchSourceOrder(
        value,
        SEARCH_SOURCE_ORDER.applyGroupMove(value, payload.groups, payload.group, payload.delta)
      )));
  }

  // With an empty or typed input, a double Tab starts the default engine's
  // mode and opens the menu; false when it did not.
  function openSearchModeMenuFromDoubleTab(): boolean | Promise<boolean> {
    const expectedInputValue = String(getSearchInput().value || '');
    const activateDefaultProvider = (providers: readonly SiteSearchProvider[]): boolean => {
      const controller = pageState.inputModeController;
      if (!controller || pageState.siteSearchState || pageState.localSearchScopeState ||
          String(getSearchInput().value || '') !== expectedInputValue) {
        return false;
      }
      const provider = SearchSiteSearchProviders.getSearchEngineSiteSearchProvider(searchEngine.engine, providers);
      if (!provider) {
        return false;
      }
      if (expectedInputValue.trim()) {
        activateSiteSearch(provider, {
          preserveResults: shouldPreserveSearchModeResults(expectedInputValue)
        });
        restoreSearchModeQuery(expectedInputValue);
      } else {
        activateSiteSearch(provider);
      }
      controller.openModeMenu('none');
      return true;
    };
    const loaded = siteSearchCatalog.loadedProviders;
    return loaded ? activateDefaultProvider(loaded) : siteSearchCatalog.loadProviders().then(activateDefaultProvider);
  }

  function restoreSearchModeQuery(rawQuery: unknown): void {
    const value = String(rawQuery || '');
    getSearchInput().value = value;
    pageState.latestRawQuery = value;
    pageState.latestQuery = value.trim();
    getSearchInput().dispatchEvent(new Event('input', { bubbles: true }));
  }

  function shouldPreserveSearchModeResults(rawQuery: unknown): boolean {
    return Boolean(String(rawQuery || '').trim());
  }

  function selectSearchModeMenuItem(item: ModeMenuItem): void {
    if (!item.kind) {
      return;
    }
    const rawQuery = getSearchInput().value || '';
    const preserveResults = shouldPreserveSearchModeResults(rawQuery);
    if (item.kind === 'local') {
      if (item.sourceType) {
        activateLocalSearchScope(
          { sourceType: item.sourceType },
          { preserveResults }
        );
      }
      restoreSearchModeQuery(rawQuery);
      return;
    }
    if (item.kind === 'aggregate' && item.provider) {
      activateSiteSearch(item.provider, { preserveResults });
      restoreSearchModeQuery(rawQuery);
      return;
    }
    if (item.kind === 'provider' && item.provider) {
      activateSiteSearch(item.provider, { preserveResults });
      restoreSearchModeQuery(rawQuery);
    }
  }

  // The Tab hint names the scope as a provider would, keyed like its mode.
  function getLocalSearchScopeTabHintProvider(scope: ActiveLocalScope): InputModeProvider {
    const source = getLocalSearchScopeLabel(scope);
    return {
      key: `local:${scope.sourceType}`,
      name: source,
      tabHintLabel: formatMessage(
        'local_search_tab_hint',
        '仅搜索{source}',
        { source }
      )
    };
  }

  function setLocalSearchScopePrefix(scope: ActiveLocalScope | null): void {
    if (!pageState.inputModeController || !scope) {
      return;
    }
    pageState.inputModeController.setPrefixText(
      getLocalSearchScopeLabel(scope),
      defaultTheme,
      {
        animate: true,
        iconName: getLocalSearchScopeIconName(scope.sourceType),
        menuIconName: scope.sourceType === 'topSite' ? 'star' : scope.sourceType,
        modeId: `local:${scope.sourceType}`
      }
    );
  }

  function activateLocalSearchScope(scope: ActiveLocalScope | null, activationOptions?: ModeActivationOptions): boolean {
    if (!scope || !settings.get(searchResultSourceTypes).includes(scope.sourceType)) {
      return false;
    }
    const options = activationOptions || {};
    pageState.suggestionRequestSeq += 1;
    pageState.localSearchScopeState = scope;
    pageState.localSearchScopeTriggerState = null;
    pageState.siteSearchState = null;
    pageState.siteSearchTriggerState = null;
    pageState.inlineSearchState = null;
    getSearchInput().value = '';
    pageState.latestRawQuery = '';
    pageState.latestQuery = '';
    clearAutocomplete();
    setLocalSearchScopePrefix(scope);
    if (options.preserveResults !== true) {
      clearSearchSuggestions();
    }
    return true;
  }

  function clearLocalSearchScope(): boolean {
    if (!pageState.localSearchScopeState) {
      return false;
    }
    pageState.suggestionRequestSeq += 1;
    pageState.localSearchScopeState = null;
    pageState.localSearchScopeTriggerState = null;
    pageState.inlineSearchState = null;
    clearSiteSearchPrefix();
    clearAutocomplete();
    return true;
  }

  function activateSiteSearch(provider: SiteSearchProvider | null | undefined, activationOptions?: ModeActivationOptions): void {
    if (!provider) {
      return;
    }
    const options = activationOptions || {};
    pageState.localSearchScopeState = null;
    pageState.localSearchScopeTriggerState = null;
    pageState.siteSearchState = provider;
    pageState.inlineSearchState = null;
    getSearchInput().value = '';
    pageState.latestRawQuery = '';
    pageState.latestQuery = '';
    clearAutocomplete();
    setSiteSearchPrefix(provider, defaultTheme, {
      animate: options.animatePrefix !== false
    });
    void getThemeForProvider(provider).then((theme) => {
      if (pageState.siteSearchState === provider) {
        setSiteSearchPrefix(provider, theme);
      }
    });
    if (options.preserveResults !== true) {
      clearSearchSuggestions();
    }
  }

  function clearSiteSearch(): void {
    if (!pageState.siteSearchState) {
      return;
    }
    pageState.siteSearchState = null;
    pageState.inlineSearchState = null;
    clearSiteSearchPrefix();
    clearAutocomplete();
  }

  // Fills the input with the inline autocomplete's completion.
  function acceptAutocompleteCompletion(): void {
    if (!pageState.autocompleteState) {
      return;
    }
    const completion = pageState.autocompleteState.completion;
    getSearchInput().value = completion;
    getSearchInput().setSelectionRange(completion.length, completion.length);
    pageState.latestRawQuery = completion;
    pageState.latestQuery = completion.trim();
    pageState.autocompleteState = null;
    getSearchInput().dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Tab in the search box: toggles or opens the mode menu, turns a typed
  // trigger into a site search or local scope, or takes the inline
  // completion. True when it handled the key.
  function handleSearchTabKey(event: KeyboardEvent): boolean {
    if (event.defaultPrevented) {
      return false;
    }
    const controller = pageState.inputModeController;
    if (controller && controller.handleModeMenuTabFocusToggle(event)) {
      return true;
    }
    // Tab takes the suggestion the arrows show as typed text.
    if (!event.shiftKey && pageState.suggestionInputPreview.commit()) {
      event.preventDefault();
      getSearchInput().dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    if (controller && controller.shouldOpenModeMenuForActiveModeOnTab(event)) {
      controller.openModeMenu('none');
      return true;
    }
    if (pageState.siteSearchState || pageState.localSearchScopeState) {
      return false;
    }
    // On a page the arrows selected, Tab puts its address in the input to edit.
    const selectedSuggestion = pageState.selectedIndex >= 0 ? pageState.currentSuggestions[pageState.selectedIndex] : null;
    if (!event.shiftKey && pageState.suggestionInputPreview.editAddress(getSearchInput(), selectedSuggestion)) {
      event.preventDefault();
      getSearchInput().dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    const rawValue = getSearchInput().value;
    const rawTrigger = pageState.latestRawQuery || rawValue;
    const triggerInput = (rawTrigger || rawValue).trim();
    if (!triggerInput && controller) {
      const shouldOpenModeMenu = controller.shouldOpenModeMenuOnDoubleTab(event);
      if (shouldOpenModeMenu) {
        void openSearchModeMenuFromDoubleTab();
      }
      return Boolean(event.defaultPrevented);
    }
    if (pageState.siteSearchTriggerState &&
        pageState.siteSearchTriggerState.rawInput === triggerInput &&
        pageState.siteSearchTriggerState.provider) {
      event.preventDefault();
      activateSiteSearch(pageState.siteSearchTriggerState.provider);
      return true;
    }
    if (pageState.localSearchScopeTriggerState &&
        pageState.localSearchScopeTriggerState.rawInput === triggerInput &&
        pageState.localSearchScopeTriggerState.scope) {
      event.preventDefault();
      return activateLocalSearchScope(pageState.localSearchScopeTriggerState.scope);
    }
    if (triggerInput) {
      event.preventDefault();
      const providers = siteSearchCatalog.triggerProviders;
      const topSiteMatch = getTopSiteMatchCandidate(pageState.currentSuggestions, triggerInput);
      const directProvider = getSiteSearchTriggerCandidate(triggerInput, providers, topSiteMatch);
      if (directProvider) {
        activateSiteSearch(directProvider);
        return true;
      }
      const cachedRules = shortcutRulesCache.rules;
      const directLocalScope = getLocalSearchScopeCandidate(triggerInput, cachedRules);
      if (siteSearchCatalog.loadedProviders && directLocalScope) {
        activateLocalSearchScope(directLocalScope);
        return true;
      }
      void Promise.all([
        siteSearchCatalog.loadProviders(),
        siteSearchCatalog.loadAggregates(),
        getShortcutRules()
      ]).then(([, , rules]) => {
        if (pageState.siteSearchState || pageState.localSearchScopeState ||
            String(getSearchInput().value || '').trim() !== triggerInput) {
          return;
        }
        const asyncTopSiteMatch = getTopSiteMatchCandidate(pageState.currentSuggestions, triggerInput);
        const asyncProvider = getSiteSearchTriggerCandidate(
          triggerInput,
          siteSearchCatalog.triggerProviders,
          asyncTopSiteMatch
        );
        if (asyncProvider) {
          activateSiteSearch(asyncProvider);
          return;
        }
        const asyncLocalScope = getLocalSearchScopeCandidate(triggerInput, rules);
        if (asyncLocalScope) {
          activateLocalSearchScope(asyncLocalScope);
          return;
        }
        if (pageState.autocompleteState && pageState.autocompleteState.completion) {
          acceptAutocompleteCompletion();
        }
      });
      return true;
    }
    if (pageState.autocompleteState && pageState.autocompleteState.completion) {
      event.preventDefault();
      acceptAutocompleteCompletion();
      return true;
    }
    return false;
  }

  return {
    handleSearchTabKey,
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
    clearSiteSearch
  };
}

type SearchModes = ReturnType<typeof createSearchModes>;

export { createSearchModes };
export type { LocalScopeTrigger, SearchModes, SearchModesDeps, SearchModesState, SiteSearchTrigger };
