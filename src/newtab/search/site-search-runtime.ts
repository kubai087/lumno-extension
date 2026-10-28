// Site search providers and aggregate searches while the page is open:
// restoring a search the shortcut's reload interrupted, and following the
// catalog's changes.
import type { SiteSearchProvider } from '../../domain/search/types';
import type { Suggestion } from '../../shared/react/search/suggestion-list/types';
import type { InputModeController } from '../../shared/search/search-input-mode';
import type { InputModeTheme } from '../../shared/search/input-mode/types';
import * as LumnoNewtabFocusResume from '../focus-resume';
import type { FocusResume, FocusResumeState } from '../focus-resume';
import type { SettingsStore } from '../../platform/settings-store';
import type { SearchModeController } from './search-mode-controller';
import type { SearchModes } from './search-modes';
import { getAggregateSearchId } from './search-types';
import type { RequestSuggestions } from './search-types';
import type { SiteSearchProviders } from './site-search-providers';
import * as SearchSiteSearchProviders from '../../domain/search/utils/site-search-providers';
import { searchSourceOrder } from '../../domain/settings/search';
import type { SiteSearchCatalog } from '../../shared/search-panel/site-search/catalog';
import type { SearchQuery } from '../../shared/search-panel/search-query';
import type { SearchMode } from '../../shared/search-panel/search-mode';
import type { SearchResults } from '../../shared/search-panel/search-results';

interface SiteSearchRuntimeState extends FocusResumeState {
  // Carries the search across the reload the search shortcut makes.
  focusResume: FocusResume | null;
  inputModeController: Pick<InputModeController, 'refreshModeMenu'> | null;
}

interface SiteSearchRuntimeDeps {
  searchResults: SearchResults<Suggestion>;
  searchMode: SearchMode<SiteSearchProvider>;
  searchQuery: SearchQuery;
  siteSearchCatalog: SiteSearchCatalog;
  isAggregateSearchProvider: SiteSearchProviders['isAggregateSearchProvider'];
  createAggregateSearchScopeProvider: SiteSearchProviders['createAggregateSearchScopeProvider'];
  activateSiteSearch: SearchModes['activateSiteSearch'];
  activateLocalSearchScope: SearchModes['activateLocalSearchScope'];
  restoreSearchModeQuery: SearchModes['restoreSearchModeQuery'];
  showSuggestionSnapshot(suggestions: Suggestion[], query: string, selectedIndex: number): Promise<void>;
  focusSearchInputPreservingScroll(): boolean;
  requestSuggestions: RequestSuggestions;
  settings: Pick<SettingsStore, 'subscribe'>;
  setSiteSearchPrefix: SearchModeController['setSiteSearchPrefix'];
  defaultTheme: InputModeTheme;
  clearSiteSearch: SearchModes['clearSiteSearch'];
  pageState: SiteSearchRuntimeState;
}

function createSiteSearchRuntime(deps: SiteSearchRuntimeDeps): void {
  const {
    searchResults,
    searchMode,
    searchQuery,
    siteSearchCatalog,
    isAggregateSearchProvider,
    createAggregateSearchScopeProvider,
    activateSiteSearch,
    activateLocalSearchScope,
    restoreSearchModeQuery,
    showSuggestionSnapshot,
    focusSearchInputPreservingScroll,
    requestSuggestions,
    settings,
    setSiteSearchPrefix,
    defaultTheme,
    clearSiteSearch
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  const siteSearchProvidersReady = Promise.all([siteSearchCatalog.loadProviders(), siteSearchCatalog.loadAggregates()]);

  // Search modes are saved by id: a provider's, or its aggregate search's.
  function getSiteSearchSnapshotId(provider: SiteSearchProvider): string {
    return isAggregateSearchProvider(provider)
      ? `aggregate:${getAggregateSearchId(provider)}`
      : SearchSiteSearchProviders.getSearchModeProviderId(provider);
  }

  function findSiteSearchBySnapshotId(id: unknown): SiteSearchProvider | null {
    const providers = siteSearchCatalog.modeProviders;
    if (!String(id).startsWith('aggregate:')) {
      return providers.find((provider) => SearchSiteSearchProviders.getSearchModeProviderId(provider) === id) || null;
    }
    const definition = siteSearchCatalog.aggregates.find((item) => `aggregate:${item && item.id ? item.id : ''}` === id);
    return definition && siteSearchCatalog.isAggregateAvailable(definition, providers)
      ? createAggregateSearchScopeProvider(definition)
      : null;
  }

  const focusResume = LumnoNewtabFocusResume.createFocusResume({
    searchResults,
    searchMode,
    searchQuery,
    getSiteSearchSnapshotId,
    findSiteSearchBySnapshotId,
    activateSiteSearch,
    activateLocalSearchScope,
    restoreSearchModeQuery,
    showSuggestionSnapshot,
    focusSearchInputPreservingScroll,
    pageState
  });
  pageState.focusResume = focusResume;
  void focusResume.resume(siteSearchProvidersReady);

  // A new order from Settings or another tab reaches an open scope panel now;
  // a closed one reads it when it opens.
  settings.subscribe(searchSourceOrder, () => {
    if (pageState.inputModeController) {
      pageState.inputModeController.refreshModeMenu();
    }
  });

  // A changed list may drop the aggregate search the input is in, or
  // change its sources.
  siteSearchCatalog.store.subscribe(() => {
    if (isAggregateSearchProvider(searchMode.site)) {
      const activeId = getAggregateSearchId(searchMode.site);
      const definition = siteSearchCatalog.aggregates.find((item) => String(item && item.id ? item.id : '') === activeId);
      const updatedProvider = definition && siteSearchCatalog.isAggregateAvailable(definition)
        ? createAggregateSearchScopeProvider(definition)
        : null;
      if (updatedProvider) {
        searchMode.replaceSite(updatedProvider);
        setSiteSearchPrefix(updatedProvider, defaultTheme, { animate: false });
      } else {
        clearSiteSearch();
      }
    }
    if (pageState.inputModeController) {
      pageState.inputModeController.refreshModeMenu();
    }
    if (searchQuery.text) {
      requestSuggestions(searchQuery.text, { immediate: true });
    }
  });
}

export { createSiteSearchRuntime };
export type { SiteSearchRuntimeDeps, SiteSearchRuntimeState };
