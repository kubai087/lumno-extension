// The search's owners: the query, results, mode and autocomplete, the
// suggestion source and modifiers, the matching, the default engine, the site
// search catalog, runner and icon cache, the mode menu's order and the number
// shortcuts.
import * as LumnoShortcutFaviconStore from '../../../platform/shortcut-favicon-store';
import { SiteSearchIconCache } from '../../../shared/search/site-search-icon-cache';
import type { SuggestionElement } from '../../../shared/react/search/suggestion-list/types';
import type { NumberShortcutOptions } from '../../../shared/search/suggestion-navigation';
import * as LumnoMessaging from '../../../platform/messaging';
import { SiteSearchCatalog } from '../../../shared/search-panel/site-search/catalog';
import { DefaultSearchEngine } from '../../../shared/search-panel/default-engine';
import { numberShortcutInstantEnabled } from '../../../domain/settings/search';
import { SearchQuery } from '../../../shared/search-panel/search-query';
import { SuggestionSource } from '../../../shared/search-panel/suggestion-source';
import { SuggestionModifiers } from '../../../shared/search-panel/suggestion-modifiers';
import { createColorScheme } from '../../../shared/ui/color-scheme';
import { SiteSearchRunner } from '../../../shared/search-panel/site-search/runner';
import { SearchModeMenuOrder } from '../../../shared/search-panel/mode-menu-order';
import { SearchMatching } from '../../../shared/search-panel/matching';
import { SearchResults } from '../../../shared/search-panel/search-results';
import { SearchMode } from '../../../shared/search-panel/search-mode';
import { SearchAutocomplete } from '../../../shared/search-panel/autocomplete';
import type { InputModeProvider } from '../../../shared/search/input-mode/types';
import type { OverlaySuggestion } from '../../panel/types';
import type { OverlayContext } from '../../app/context';
import type { SessionPart } from './session';

// The mode menu's moves can be undone for as long as the page lives, across
// panel openings.
let pageMenuOrder: SearchModeMenuOrder | null = null;

interface SearchPartDeps {
  session: SessionPart;
}

function createSearchPart(ctx: OverlayContext, deps: SearchPartDeps) {
  const { elements, locale, openOptions, settings, t } = ctx;
  const { getUrlDisplay, overlayToast, suggestionInputPreview } = deps.session;

  // Warm local icon lookup immediately, but never put it on the overlay reveal path.
  const siteSearchIconCache = new SiteSearchIconCache(LumnoShortcutFaviconStore.createSiteSearchIconStore({
    chromeApi: chrome,
    storageArea: chrome && chrome.storage ? chrome.storage.local : null
  }));
  void siteSearchIconCache.load();

  const searchQuery = new SearchQuery();
  const suggestionModifiers = new SuggestionModifiers(settings.store);
  const colorScheme = createColorScheme();
  const siteSearchRunner = new SiteSearchRunner({
    t,
    showToast: overlayToast.show,
    getHelpCenterLocale: () => locale.store.getSnapshot().locale,
    openInCurrentTab: (url) => LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'createTab', url, disposition: 'currentTab' })
  });
  if (!pageMenuOrder) {
    pageMenuOrder = new SearchModeMenuOrder(settings.store);
  }
  const menuOrder = pageMenuOrder;
  const searchMatching = new SearchMatching({
    settings: settings.store,
    getUrlDisplay
  });
  const searchResults = new SearchResults<OverlaySuggestion>();
  const suggestionSource = new SuggestionSource(searchQuery, searchResults);
  const searchMode = new SearchMode<InputModeProvider>();
  const searchAutocomplete = new SearchAutocomplete({
    settings: settings.store,
    query: searchQuery,
    getInput: () => elements.searchInput,
    preview: suggestionInputPreview,
    isModeActive: () => Boolean(searchMode.site || searchMode.local),
    getUrlDisplay
  });
  const searchEngine = new DefaultSearchEngine(settings.store);
  const siteSearchCatalog = new SiteSearchCatalog(settings.store, searchEngine, openOptions.siteSearchProviders);
  const suggestionItems: SuggestionElement[] = [];

  const numberShortcutOptions: NumberShortcutOptions = {
    onHoldStart: function() {
      overlayToast.show(t(
        'search_number_jump_release_hint',
        'Release to show numbers'
      ), false, { duration: 0 });
    },
    onHoldEnd: overlayToast.hide,
    instantActive: () => settings.get(numberShortcutInstantEnabled)
  };

  return {
    colorScheme,
    menuOrder,
    numberShortcutOptions,
    searchAutocomplete,
    searchEngine,
    searchMatching,
    searchMode,
    searchQuery,
    searchResults,
    siteSearchCatalog,
    siteSearchIconCache,
    siteSearchRunner,
    suggestionItems,
    suggestionModifiers,
    suggestionSource
  };
}

type SearchPart = ReturnType<typeof createSearchPart>;

export { createSearchPart };
export type { SearchPart };
