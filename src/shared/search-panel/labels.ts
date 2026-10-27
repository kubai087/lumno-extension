// What the search panel calls its site searches and local scopes: their
// names, the input's prefix and tab hint, the search action's title and
// the scope icons, in the surface's language.
import * as AGGREGATE_SEARCH_STORE from '../../domain/search/aggregate-search-store';
import type { LocalSearchScope, SiteSearchProvider } from '../../domain/search/types';
import * as SearchSiteSearchProviders from '../../domain/search/utils/site-search-providers';
import type { InputModeProvider } from '../search/input-mode/types';
import type { RemixIconName } from '../ui/remix-icon';

// The surface's language: a message by key, or its fallback, with
// {name} placeholders filled in.
interface SearchLocale {
  t(key: string, fallback: string): string;
  formatMessage(key: string, fallback: string, values?: Record<string, string>): string;
}

type ProviderInput = Partial<SiteSearchProvider> | null | undefined;

function getSiteSearchDisplayName({ t }: SearchLocale, provider: ProviderInput): string {
  if (!provider) {
    return t('site_search_default', '站内');
  }
  const mapping = SearchSiteSearchProviders.getSiteSearchProviderDisplayNameMessage(provider);
  if (mapping) {
    return t(mapping.messageKey, mapping.fallback);
  }
  return provider.name || provider.key || t('site_search_default', '站内');
}

function getSiteSearchActionTitle(locale: SearchLocale, provider: ProviderInput, query?: string): string {
  const { formatMessage } = locale;
  const site = getSiteSearchDisplayName(locale, provider);
  const queryText = String(query || '').trim();
  if (AGGREGATE_SEARCH_STORE.isAggregateSearchProvider(provider)) {
    return queryText
      ? formatMessage('aggregate_search_action_query', '使用{name}搜索“{query}”', { name: site, query: queryText })
      : formatMessage('aggregate_search_action', '使用{name}搜索', { name: site });
  }
  if (SearchSiteSearchProviders.isAiSiteSearchProvider(provider)) {
    return queryText
      ? formatMessage('ask_ai_provider_query', '向 {site} 提问 "{query}"', { site, query: queryText })
      : formatMessage('ask_ai_provider', '向 {site} 提问', { site });
  }
  return queryText
    ? formatMessage('search_in_site_query', '在 {site} 中搜索 "{query}"', { site, query: queryText })
    : formatMessage('search_in_site', '在 {site} 中搜索', { site });
}

// The text of the input's prefix while a site search is active.
function getSiteSearchPrefixText(locale: SearchLocale, provider: ProviderInput): string {
  const name = getSiteSearchDisplayName(locale, provider);
  if (SearchSiteSearchProviders.isAiSiteSearchProvider(provider)) {
    return name;
  }
  return name || locale.formatMessage('search_in_site', '在 {site} 中搜索', {
    site: provider && provider.name ? provider.name : ''
  });
}

function getLocalSearchScopeLabel({ t }: SearchLocale, scope: Pick<LocalSearchScope, 'sourceType'> | null | undefined): string {
  const sourceType = scope && scope.sourceType ? scope.sourceType : '';
  if (sourceType === 'bookmark') {
    return t('search_tag_bookmark', '书签');
  }
  if (sourceType === 'history') {
    return t('search_tag_history', '历史');
  }
  if (sourceType === 'topSite') {
    return t('search_tag_top_site', '常用');
  }
  return '';
}

function getLocalSearchScopeIconName(sourceType: string): RemixIconName {
  if (sourceType === 'bookmark') {
    return 'ri-bookmark-3-line';
  }
  if (sourceType === 'history') {
    return 'ri-history-line';
  }
  return 'ri-star-line';
}

// The tab hint a typed local scope trigger shows.
function getLocalSearchScopeTabHintProvider(locale: SearchLocale, scope: Pick<LocalSearchScope, 'sourceType'>): InputModeProvider {
  const source = getLocalSearchScopeLabel(locale, scope);
  return {
    key: `local:${scope.sourceType}`,
    name: source,
    tabHintLabel: locale.formatMessage('local_search_tab_hint', '仅搜索{source}', { source })
  };
}

export {
  getLocalSearchScopeIconName,
  getLocalSearchScopeLabel,
  getLocalSearchScopeTabHintProvider,
  getSiteSearchActionTitle,
  getSiteSearchDisplayName,
  getSiteSearchPrefixText
};
export type { SearchLocale };
