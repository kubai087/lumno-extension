// The search mode menu: its providers and items, the order the user
// gives them, stepping through it, opening it with a double Tab, and
// picking an item.
import type * as AggregateSearchStore from '../../domain/search/aggregate-search-store';
import type * as SearchSourceOrder from '../../domain/search/search-source-order';
import type { ScopeMenuMove } from '../../domain/search/search-source-order';
import type { LocalSearchScope, SearchSourceType, SiteSearchProvider } from '../../domain/search/types';
import type { InputModeController } from '../../shared/search/search-input-mode';
import type { InputModeProvider, ModeMenuItem } from '../../shared/search/input-mode/types';
import type { Translate } from './types';
import { lazyInstance } from '../../shared/lazy-instance';
import { createHistory as createSearchSourceOrderHistory } from '../../domain/search/search-source-order';
import type { RemixIconName } from '../../shared/ui/remix-icon';
import { searchSourceOrder } from '../../domain/settings/search';
import type { SiteSearchIconCache } from '../../shared/search/site-search-icon-cache';
import * as SearchSiteSearchMatching from '../../domain/search/utils/site-search-matching';
import * as SearchSiteSearchProviders from '../../domain/search/utils/site-search-providers';
import { searchResultSourceTypes } from '../../domain/settings/search';
import type { OverlaySettings } from '../overlay-settings';
import type { SiteSearchCatalog } from '../../shared/search-panel/site-search/catalog';
import type { DefaultSearchEngine } from '../../shared/search-panel/default-engine';
import type { SearchQuery } from '../../shared/search-panel/search-query';
import type { SearchMode } from '../../shared/search-panel/search-mode';
import { isAiSiteSearchProvider, isSearchEngineSiteSearchProvider } from '../../domain/search/utils/site-search-providers';
import { isAggregateSearchProvider } from '../../domain/search/aggregate-search-store';

interface SearchModeMenuState {
  settings: Pick<OverlaySettings, 'get' | 'store' | 'loaded' | 'set'>;
  searchInput: HTMLInputElement | null;
  inputModeController: Pick<InputModeController, 'openModeMenu'> | null;
  // The page the overlay opened on, whose site search the menu offers first.
  initialContextTabUrl: string;
}

interface SearchModeMenuDeps {
  searchMode: SearchMode<InputModeProvider>;
  searchQuery: SearchQuery;
  searchEngine: DefaultSearchEngine;
  siteSearchCatalog: SiteSearchCatalog;
  AGGREGATE_SEARCH_STORE: Pick<typeof AggregateSearchStore,
    'isAggregateSearchAvailable' | 'mergeTriggerProviders' | 'createScopeProvider'>;
  SEARCH_SOURCE_ORDER: Pick<typeof SearchSourceOrder,
    'rankScopeItems' | 'applyScopeMenuMove' | 'applyGroupMove' | 'createHistory'>;
  t: Translate;
  getSiteSearchDisplayName(provider: SiteSearchProvider | null): string;
  getPageRenderableProviderIcon(provider: SiteSearchProvider): string;
  getLocalSearchScopeLabel(scope: Pick<LocalSearchScope, 'sourceType'> | null): string;
  getLocalSearchScopeIconName(sourceType: string): RemixIconName;
  siteSearchIconCache: Pick<SiteSearchIconCache, 'load'>;
  cancelPendingOpenTabsPrefixEntry(): boolean;
  activateSiteSearch(provider: InputModeProvider | null, options?: { preserveResults?: boolean; animatePrefix?: boolean }): void;
  activateOpenTabsSearchMode(options?: { deferResults?: boolean }): void;
  activateLocalSearchScope(scope: LocalSearchScope | null, options?: { preserveResults?: boolean }): boolean;
  overlayState: SearchModeMenuState;
}

// A group block dragged by its title.
interface GroupMove {
  groups: unknown;
  group: unknown;
  delta: number;
}

const LOCAL_SOURCE_TYPES: readonly SearchSourceType[] = ['topSite', 'bookmark', 'history'];

// Undo and redo of the scope panel's moves in this page.
const getPageSearchSourceOrderHistory = lazyInstance(() => createSearchSourceOrderHistory());

function createSearchModeMenu(deps: SearchModeMenuDeps) {
  const {
    searchMode,
    searchQuery,
    searchEngine,
    siteSearchCatalog,
    AGGREGATE_SEARCH_STORE,
    t,
    getSiteSearchDisplayName,
    getPageRenderableProviderIcon,
    getLocalSearchScopeLabel,
    getLocalSearchScopeIconName,
    SEARCH_SOURCE_ORDER,
    siteSearchIconCache,
    cancelPendingOpenTabsPrefixEntry,
    activateSiteSearch,
    activateOpenTabsSearchMode,
    activateLocalSearchScope
  } = deps;

  // The panel state object shared with search-panel.ts and the other modules.
  const overlayState = deps.overlayState;
  // Moves, undos and redos of the order run one after another, so each
  // reads what the previous one stored.
  let searchSourceOrderQueue: Promise<unknown> = Promise.resolve();

  function getCurrentPageSiteSearchModeProvider(providers: readonly SiteSearchProvider[]): SiteSearchProvider | null {
    return SearchSiteSearchMatching.findSiteSearchProviderForPageUrl(
      overlayState.initialContextTabUrl,
      providers
    );
  }

  function buildSearchModeMenuItems(sourceOrder: unknown): ModeMenuItem[] {
    const engineGroup = t('search_scope_group_engines', '搜索引擎');
    const localGroup = t('search_scope_group_local', '浏览器内容');
    const aiGroup = t('search_scope_group_ai', 'AI 搜索');
    const siteGroup = t('search_scope_group_sites', '站内搜索');
    const aggregateGroup = t('search_scope_group_aggregates', '聚合搜索');
    const items: ModeMenuItem[] = [];
    const providers = siteSearchCatalog.modeProviders;
    const activeProvider = searchMode.site;
    siteSearchCatalog.aggregates.forEach((definition) => {
      if (!siteSearchCatalog.isAggregateAvailable(definition, providers)) {
        return;
      }
      const provider = AGGREGATE_SEARCH_STORE.createScopeProvider(definition);
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
          activeProvider &&
          isAggregateSearchProvider(activeProvider) &&
          String(activeProvider.aggregateId || '') === String(definition.id || '')
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
          iconUrl: getPageRenderableProviderIcon(provider),
          iconName: isAi ? 'ri-search-ai-line' : 'ri-global-line',
          isAi,
          active: Boolean(activeProvider && SearchSiteSearchProviders.getSearchModeProviderId(activeProvider) === SearchSiteSearchProviders.getSearchModeProviderId(provider))
        });
      });
    items.push({
      id: 'openTabs',
      kind: 'openTabs',
      label: t('search_open_tabs_only_entry', '搜索已打开标签页'),
      searchTerms: ['open tabs', 'tabs', 'browser'],
      group: localGroup,
      // Leads browser content and is not reorderable.
      groupKey: 'local',
      orderList: 'pinned',
      iconName: 'ri-window-line',
      menuIconName: 'browser',
      active: searchMode.openTabs
    });
    LOCAL_SOURCE_TYPES.forEach((sourceType) => {
      if (!overlayState.settings.get(searchResultSourceTypes).includes(sourceType)) {
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
        active: Boolean(searchMode.local && searchMode.local.sourceType === sourceType)
      });
    });
    return SEARCH_SOURCE_ORDER.rankScopeItems(items, sourceOrder);
  }

  // The stored order, as stored; the order helpers read it as untrusted.
  function loadSearchSourceOrder(): Promise<unknown> {
    const settings = overlayState.settings;
    return settings.loaded.then(() => settings.store.getStored(searchSourceOrder));
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
  function reorderSearchModeMenu(payload: ScopeMenuMove | null): Promise<unknown> {
    return queueSearchSourceOrderTask(() => loadSearchSourceOrder()
      .then((value) => recordSearchSourceOrder(value, SEARCH_SOURCE_ORDER.applyScopeMenuMove(value, payload))));
  }
  function queueSearchSourceOrderTask(task: () => Promise<unknown>): Promise<unknown> {
    searchSourceOrderQueue = searchSourceOrderQueue.then(task).catch(() => {});
    return searchSourceOrderQueue;
  }

  function writeSearchSourceOrder(value: unknown): Promise<void> {
    return overlayState.settings.set(searchSourceOrder, searchSourceOrder.parse(value)).catch(() => {});
  }

  // Undo and redo for the moves made in this page's panel, kept in module
  // scope so it outlives one opening of the command bar.
  function getSearchSourceOrderHistory(): ReturnType<typeof SEARCH_SOURCE_ORDER.createHistory> {
    return getPageSearchSourceOrderHistory();
  }

  function recordSearchSourceOrder(before: unknown, after: SearchSourceOrder.SearchSourceOrder): Promise<void> {
    getSearchSourceOrderHistory().record(before, after);
    return writeSearchSourceOrder(after);
  }

  // Returns whether there was a step to take, so the panel only claims
  // Ctrl/Cmd+Z when it does something.
  function stepSearchModeMenuHistory(direction: 'undo' | 'redo'): boolean {
    const history = getSearchSourceOrderHistory();
    if (!(direction === 'redo' ? history.canRedo() : history.canUndo())) {
      return false;
    }
    queueSearchSourceOrderTask(() => loadSearchSourceOrder()
      .then((value) => {
        const target = direction === 'redo' ? history.redo(value) : history.undo(value);
        return target ? writeSearchSourceOrder(target) : Promise.resolve();
      }));
    return true;
  }

  // A group block moved from its title in the panel.
  function moveSearchModeMenuGroup(payload: GroupMove | null): Promise<unknown> {
    if (!payload) {
      return Promise.resolve();
    }
    return queueSearchSourceOrderTask(() => loadSearchSourceOrder()
      .then((value) => recordSearchSourceOrder(
        value,
        SEARCH_SOURCE_ORDER.applyGroupMove(value, payload.groups, payload.group, payload.delta)
      )));
  }

  function readInputValue(): string {
    return overlayState.searchInput ? String(overlayState.searchInput.value || '') : '';
  }

  // Double Tab with no mode: switches to this page's site search, or the
  // default engine's, and opens the menu; resolves to whether it opened.
  function openSearchModeMenuFromDoubleTab(): Promise<boolean> {
    cancelPendingOpenTabsPrefixEntry();
    const expectedSiteSearchState = searchMode.site;
    const expectedLocalSearchScopeState = searchMode.local;
    const expectedOpenTabsSearchModeActive = searchMode.openTabs;
    const expectedInputValue = readInputValue();
    const isActivationCurrent = (): boolean => Boolean(
      overlayState.inputModeController &&
      searchMode.site === expectedSiteSearchState &&
      searchMode.local === expectedLocalSearchScopeState &&
      searchMode.openTabs === expectedOpenTabsSearchModeActive &&
      readInputValue() === expectedInputValue &&
      !expectedSiteSearchState &&
      !expectedLocalSearchScopeState
    );
    const activateDefaultProvider = (providers: SiteSearchProvider[]): boolean | Promise<boolean> => {
      if (!isActivationCurrent()) {
        return false;
      }
      const currentPageProvider = getCurrentPageSiteSearchModeProvider(providers);
      const provider = currentPageProvider ||
        SearchSiteSearchProviders.getSearchEngineSiteSearchProvider(searchEngine.engine, providers);
      if (!provider) {
        return false;
      }
      if (expectedInputValue.trim()) {
        activateSiteSearch(provider, {
          animatePrefix: false,
          preserveResults: true
        });
        restoreSearchModeQuery(expectedInputValue);
      } else {
        activateSiteSearch(provider, { animatePrefix: false });
      }
      const controller = overlayState.inputModeController;
      if (!controller) {
        return false;
      }
      const openResult = controller.openModeMenu(
        currentPageProvider ? 'input' : 'none'
      );
      return Promise.resolve(openResult).then(Boolean);
    };
    return Promise.all([
      searchEngine.ready,
      siteSearchCatalog.loadProviders(),
      siteSearchIconCache.load()
    ]).then(([, providers]) => activateDefaultProvider(providers));
  }

  // Puts the query back after a mode switch emptied the input, and runs
  // it again in the new mode.
  function restoreSearchModeQuery(rawQuery: string): void {
    const value = String(rawQuery || '');
    searchQuery.set(value);
    const input = overlayState.searchInput;
    if (!input) {
      return;
    }
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function shouldPreserveSearchModeResults(rawQuery: string): boolean {
    return Boolean(String(rawQuery || '').trim());
  }

  function selectSearchModeMenuItem(item: ModeMenuItem | null): void {
    if (!item || !item.kind) {
      return;
    }
    const rawQuery = readInputValue();
    const preserveResults = shouldPreserveSearchModeResults(rawQuery);
    if (item.kind === 'openTabs') {
      activateOpenTabsSearchMode({ deferResults: true });
      restoreSearchModeQuery(rawQuery);
      return;
    }
    if (item.kind === 'local') {
      if (!item.sourceType) {
        return;
      }
      // Chosen from the menu, so no trigger was typed.
      activateLocalSearchScope(
        { sourceType: item.sourceType, trigger: '', key: '' },
        { preserveResults }
      );
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

  return {
    getSearchModeMenuItems,
    reorderSearchModeMenu,
    stepSearchModeMenuHistory,
    moveSearchModeMenuGroup,
    openSearchModeMenuFromDoubleTab,
    selectSearchModeMenuItem
  };
}

export { createSearchModeMenu };
export type { SearchModeMenuDeps, SearchModeMenuState };
