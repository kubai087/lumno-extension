// The mode menu's items and what choosing one does. The items are the
// aggregate searches, the site searches by group and the local sources, in
// the stored order, each marked when it is the active mode; choosing one
// starts its mode and runs what was typed in it. A surface may add an item
// of its own ahead of the local sources (the overlay's open tabs).
import { createScopeProvider, isAggregateSearchProvider } from '../../domain/search/aggregate-search-store';
import { rankScopeItems } from '../../domain/search/search-source-order';
import type { SearchSourceType, SiteSearchProvider } from '../../domain/search/types';
import * as SearchSiteSearchProviders from '../../domain/search/utils/site-search-providers';
import { searchResultSourceTypes } from '../../domain/settings/search';
import type { SettingsStore } from '../../platform/settings-store';
import type { InputModeProvider, ModeMenuItem } from '../search/input-mode/types';
import type { SiteSearchIconCache } from '../search/site-search-icon-cache';
import { getLocalSearchScopeIconName, getLocalSearchScopeLabel, getSiteSearchDisplayName } from './labels';
import type { SearchLocale } from './labels';
import type { SearchModeActions } from './mode-actions';
import type { SearchModeMenuOrder } from './mode-menu-order';
import type { SearchMode } from './search-mode';
import type { SiteSearchCatalog } from './site-search/catalog';

const LOCAL_SOURCES: readonly SearchSourceType[] = ['topSite', 'bookmark', 'history'];

const LOCAL_SEARCH_TERMS: Readonly<Record<SearchSourceType, string[]>> = {
  topSite: ['top sites', 'frequent sites', 'favorites'],
  bookmark: ['bookmark', 'bookmarks'],
  history: ['history', 'browsing history']
};

// What differs per surface.
interface SearchModeMenuSurface {
  getInput(): HTMLInputElement | null;
  // A site search's icon as this surface may draw it.
  getProviderIcon(provider: SiteSearchProvider): string;
  // An item of the surface's own ahead of the local sources.
  getOwnItem?(localGroup: string): ModeMenuItem | null;
  // Chooses the surface's own item; false for any other.
  selectOwnItem?(item: ModeMenuItem, rawQuery: string): boolean;
}

interface SearchModeMenuOptions {
  settings: Pick<SettingsStore, 'get'>;
  locale: SearchLocale;
  catalog: SiteSearchCatalog;
  iconCache: Pick<SiteSearchIconCache, 'load'>;
  order: Pick<SearchModeMenuOrder, 'load'>;
  mode: Pick<SearchMode<InputModeProvider>, 'site' | 'local'>;
  actions: Pick<SearchModeActions<SiteSearchProvider>, 'activateSiteSearch' | 'activateLocalSearchScope' | 'restoreSearchModeQuery'>;
  surface: SearchModeMenuSurface;
}

class SearchModeMenu {
  private readonly options: SearchModeMenuOptions;

  constructor(options: SearchModeMenuOptions) {
    this.options = options;
  }

  readonly getItems = (): Promise<ModeMenuItem[]> => {
    const { catalog, iconCache, order } = this.options;
    return Promise.all([iconCache.load(), catalog.loadProviders(), catalog.loadAggregates(), order.load()])
      .then((results) => this.buildItems(results[3]));
  };

  // Starts the item's mode and runs what was typed in it, keeping the rows
  // shown while there is something typed.
  readonly select = (item: ModeMenuItem | null): void => {
    if (!item || !item.kind) {
      return;
    }
    const { actions, surface } = this.options;
    const input = surface.getInput();
    const rawQuery = input ? input.value || '' : '';
    if (surface.selectOwnItem && surface.selectOwnItem(item, rawQuery)) {
      return;
    }
    const preserveResults = Boolean(rawQuery.trim());
    if (item.kind === 'local') {
      if (!item.sourceType) {
        return;
      }
      // Chosen from the menu, so no trigger was typed.
      actions.activateLocalSearchScope({ sourceType: item.sourceType, trigger: '', key: '' }, { preserveResults });
      actions.restoreSearchModeQuery(rawQuery);
      return;
    }
    if ((item.kind === 'aggregate' || item.kind === 'provider') && item.provider) {
      actions.activateSiteSearch(item.provider, { preserveResults });
      actions.restoreSearchModeQuery(rawQuery);
    }
  };

  private buildItems(sourceOrder: unknown): ModeMenuItem[] {
    const { locale, catalog, mode, settings, surface } = this.options;
    const { t } = locale;
    const engineGroup = t('search_scope_group_engines', '搜索引擎');
    const localGroup = t('search_scope_group_local', '浏览器内容');
    const aiGroup = t('search_scope_group_ai', 'AI 搜索');
    const siteGroup = t('search_scope_group_sites', '站内搜索');
    const aggregateGroup = t('search_scope_group_aggregates', '聚合搜索');
    const activeProvider = mode.site;
    const activeId = activeProvider ? SearchSiteSearchProviders.getSearchModeProviderId(activeProvider) : '';
    const items: ModeMenuItem[] = [];
    const providers = catalog.modeProviders;
    catalog.aggregates.forEach((definition) => {
      const provider = catalog.isAggregateAvailable(definition, providers) ? createScopeProvider(definition) : null;
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
        active: Boolean(activeProvider && isAggregateSearchProvider(activeProvider) &&
          String(activeProvider.aggregateId || '') === String(definition.id || ''))
      });
    });
    const isEngine = SearchSiteSearchProviders.isSearchEngineSiteSearchProvider;
    const isAi = SearchSiteSearchProviders.isAiSiteSearchProvider;
    providers.filter((provider) => isEngine(provider))
      .concat(providers.filter((provider) => !isEngine(provider) && !isAi(provider)))
      .concat(providers.filter((provider) => isAi(provider)))
      .forEach((provider) => {
        const ai = isAi(provider);
        const engine = isEngine(provider);
        const groupKey = engine ? 'engine' : (ai ? 'ai' : 'site');
        const id = SearchSiteSearchProviders.getSearchModeProviderId(provider);
        items.push({
          id,
          kind: 'provider',
          provider,
          label: getSiteSearchDisplayName(locale, provider),
          group: engine ? engineGroup : (ai ? aiGroup : siteGroup),
          groupKey,
          orderList: provider._xIsCustom ? 'custom' : groupKey,
          orderKey: provider.key,
          iconUrl: surface.getProviderIcon(provider),
          iconName: ai ? 'ri-search-ai-line' : 'ri-global-line',
          isAi: ai,
          active: Boolean(activeId) && activeId === id
        });
      });
    const ownItem = surface.getOwnItem ? surface.getOwnItem(localGroup) : null;
    if (ownItem) {
      items.push(ownItem);
    }
    const sources = settings.get(searchResultSourceTypes);
    LOCAL_SOURCES.filter((sourceType) => sources.includes(sourceType)).forEach((sourceType) => {
      items.push({
        id: `local:${sourceType}`,
        kind: 'local',
        sourceType,
        label: getLocalSearchScopeLabel(locale, { sourceType }),
        groupKey: 'local',
        orderList: 'local',
        orderKey: sourceType,
        searchTerms: LOCAL_SEARCH_TERMS[sourceType],
        group: localGroup,
        iconName: getLocalSearchScopeIconName(sourceType),
        menuIconName: sourceType === 'topSite' ? 'star' : sourceType,
        active: Boolean(mode.local && mode.local.sourceType === sourceType)
      });
    });
    return rankScopeItems(items, sourceOrder);
  }
}

export { SearchModeMenu };
export type { SearchModeMenuSurface };
