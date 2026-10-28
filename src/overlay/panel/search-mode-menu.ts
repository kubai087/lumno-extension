// The search mode menu: its providers and items, the order the user
// gives them, stepping through it, opening it with a double Tab, and
// picking an item.
import type { SiteSearchProvider } from '../../domain/search/types';
import type { InputModeController } from '../../shared/search/search-input-mode';
import type { InputModeProvider } from '../../shared/search/input-mode/types';
import type { SiteSearchIconCache } from '../../shared/search/site-search-icon-cache';
import * as SearchSiteSearchMatching from '../../domain/search/utils/site-search-matching';
import * as SearchSiteSearchProviders from '../../domain/search/utils/site-search-providers';
import type { OverlaySettings } from '../overlay-settings';
import type { SiteSearchCatalog } from '../../shared/search-panel/site-search/catalog';
import type { DefaultSearchEngine } from '../../shared/search-panel/default-engine';
import type { SearchMode } from '../../shared/search-panel/search-mode';
import type { SearchModeActions } from '../../shared/search-panel/mode-actions';

interface SearchModeMenuState {
  settings: Pick<OverlaySettings, 'get' | 'store' | 'loaded' | 'set'>;
  searchInput: HTMLInputElement | null;
  inputModeController: Pick<InputModeController, 'openModeMenu'> | null;
  // The page the overlay opened on, whose site search the menu offers first.
  initialContextTabUrl: string;
}

interface SearchModeMenuDeps {
  modeActions: SearchModeActions<InputModeProvider>;
  searchMode: SearchMode<InputModeProvider>;
  searchEngine: DefaultSearchEngine;
  siteSearchCatalog: SiteSearchCatalog;
  siteSearchIconCache: Pick<SiteSearchIconCache, 'load'>;
  cancelPendingOpenTabsPrefixEntry(): boolean;
  overlayState: SearchModeMenuState;
}


function createSearchModeMenu(deps: SearchModeMenuDeps) {
  const {
    modeActions,
    searchMode,
    searchEngine,
    siteSearchCatalog,
    siteSearchIconCache,
    cancelPendingOpenTabsPrefixEntry,
  } = deps;

  // The panel state object shared with search-panel.ts and the other modules.
  const overlayState = deps.overlayState;

  function getCurrentPageSiteSearchModeProvider(providers: readonly SiteSearchProvider[]): SiteSearchProvider | null {
    return SearchSiteSearchMatching.findSiteSearchProviderForPageUrl(
      overlayState.initialContextTabUrl,
      providers
    );
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
        modeActions.activateSiteSearch(provider, {
          animatePrefix: false,
          preserveResults: true
        });
        modeActions.restoreSearchModeQuery(expectedInputValue);
      } else {
        modeActions.activateSiteSearch(provider, { animatePrefix: false });
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




  return {
    openSearchModeMenuFromDoubleTab,
  };
}

export { createSearchModeMenu };
export type { SearchModeMenuDeps, SearchModeMenuState };
