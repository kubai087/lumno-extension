// The search input's mode controller: site search and local scope
// prefixes, the tab hint for site search, the placeholder and caret color
// per mode, and the cached provider icons the prefixes show.
import type { SiteSearchProvider } from '../../domain/search/types';
import type { SearchInputParts } from '../../shared/react/search-input';
import type { Suggestion } from '../../shared/react/search/suggestion-list/types';
import * as SEARCH_INPUT_MODE from '../../shared/search/search-input-mode';
import type { InputModeController } from '../../shared/search/search-input-mode';
import type { InputModeConfig } from '../../shared/search/input-mode/controller-types';
import type { InputModeProvider, InputModeTheme } from '../../shared/search/input-mode/types';
import type { FormatMessage, ShowToast, Translate } from '../newtab-types';
import type { RenderSuggestions } from './search-types';
import type { FaviconUrlResolver } from '../../domain/favicon/resolver';
import type { SiteSearchIconCache } from '../../shared/search/site-search-icon-cache';
import { searchResultDisplayLimit, searchResultPriority, searchResultSourceTypes, siteSearchIconCache as siteSearchIconCacheSetting } from '../../domain/settings/search';
import { newtabOpenInNewTab } from '../../domain/settings/newtab-page';
import { overlayTabPriority } from '../../domain/settings/overlay-panel';
import type { SettingsStore } from '../../platform/settings-store';
import type { SuggestionsController } from './suggestions-controller';
import type { SearchQuery } from '../../shared/search-panel/search-query';
import type { SearchMode } from '../../shared/search-panel/search-mode';
import type { SearchResults } from '../../shared/search-panel/search-results';
import { getSiteSearchDisplayName, getSiteSearchPrefixText } from '../../shared/search-panel/labels';
import type { SearchLocale } from '../../shared/search-panel/labels';
import type { SearchModeMenuOrder } from '../../shared/search-panel/mode-menu-order';
import type { SearchModeActions } from '../../shared/search-panel/mode-actions';

// An option the input mode controller is handed as it is.
type ModeOption<K extends keyof InputModeConfig> = NonNullable<InputModeConfig[K]>;

interface SearchModeControllerState {
  inputParts: SearchInputParts | null;
  modeBadge: HTMLElement | null;
  suggestionsContainer: HTMLElement | null;
  inputModeController: InputModeController | null;
}

interface SearchModeControllerDeps {
  modeActions: SearchModeActions<SiteSearchProvider>;
  locale: SearchLocale;
  searchResults: SearchResults<Suggestion>;
  searchMode: SearchMode<SiteSearchProvider>;
  searchQuery: SearchQuery;
  settings: Pick<SettingsStore, 'getStored' | 'include' | 'subscribe'>;
  requestSuggestions: SuggestionsController['requestSuggestions'];
  renderSuggestions: RenderSuggestions;
  searchInput: HTMLInputElement;
  // The room the clear button takes at the input's right.
  SEARCH_CLEAR_BUTTON_INSET: number;
  getThemeForMode: ModeOption<'getThemeForMode'>;
  defaultTheme: ModeOption<'defaultTheme'>;
  defaultAccentColor: ModeOption<'defaultAccentColor'>;
  parseCssColor: ModeOption<'parseCssColor'>;
  rgbToCss: ModeOption<'rgbToCss'>;
  isNewtabDarkMode: ModeOption<'isDarkMode'>;
  getProviderIcon: ModeOption<'getProviderIcon'>;
  getPageFaviconUrlResolver(): Pick<FaviconUrlResolver, 'getProviderFaviconUrl'>;
  getProviderFaviconPageUrl(provider: SiteSearchProvider | null | undefined): string;
  getProviderThemeHost: ModeOption<'getProviderThemeHost'>;
  // The theme a provider's icon gives its prefix, once worked out.
  getThemeForProvider(provider: SiteSearchProvider): Promise<InputModeTheme | null | undefined>;
  attachInputModeFaviconData: ModeOption<'attachFaviconData'>;
  formatMessage: FormatMessage;
  bookmarkCursorTooltipController: ModeOption<'modeMenuCursorTooltipController'>;
  getSearchModeMenuItems: ModeOption<'getModeMenuItems'>;
  selectSearchModeMenuItem: ModeOption<'onModeMenuSelect'>;
  menuOrder: SearchModeMenuOrder;
  showToast: ShowToast;
  t: Translate;
  hideToast(): void;
  setSearchScopeIconEnabled(enabled: boolean): void;
  syncSearchModeMenuResultOffset(): void;
  siteSearchIconCache: Pick<SiteSearchIconCache, 'applyStored' | 'load'>;
  pageState: SearchModeControllerState;
}

function createSearchModeController(deps: SearchModeControllerDeps) {
  const {
    modeActions,
    locale,
    searchResults,
    searchMode,
    searchQuery,
    requestSuggestions,
    settings,
    renderSuggestions,
    searchInput,
    SEARCH_CLEAR_BUTTON_INSET,
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
    getSearchModeMenuItems,
    selectSearchModeMenuItem,
    menuOrder,
    showToast,
    t,
    hideToast,
    setSearchScopeIconEnabled,
    syncSearchModeMenuResultOffset,
    siteSearchIconCache,
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  // The search box exists before this module is created.
  const inputParts = pageState.inputParts;
  if (!inputParts) {
    throw new Error('Search input unavailable');
  }
  // The page structure creates the results container before the search box.
  const suggestionsContainer = pageState.suggestionsContainer;
  if (!suggestionsContainer) {
    throw new Error('Search results container unavailable');
  }

  function setSiteSearchTabHint(provider: InputModeProvider | null): void {
    if (pageState.inputModeController) {
      pageState.inputModeController.setTabHintVisible(true, provider);
    }
  }

  function clearSiteSearchTabHint(): void {
    if (pageState.inputModeController) {
      pageState.inputModeController.setTabHintVisible(false);
    }
  }

  void settings.include([searchResultPriority, searchResultSourceTypes, searchResultDisplayLimit, overlayTabPriority, newtabOpenInNewTab])
    .then(() => {
      if (searchQuery.text) {
        renderSuggestions(searchResults.lastResponse, searchQuery.text);
      }
    });
  const defaultPlaceholder = searchInput.placeholder;
  const defaultCaretColor = searchInput.style.caretColor || '#7DB7FF';
  const inputModePrefixTransition = 'opacity 140ms cubic-bezier(0.22, 1, 0.36, 1), transform 160ms cubic-bezier(0.22, 1, 0.36, 1), background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease, color 140ms ease';
  pageState.inputModeController = SEARCH_INPUT_MODE.createInputModeController(inputParts, {
    surface: 'newtab',
    prefixTransition: inputModePrefixTransition,
    defaultPlaceholder,
    defaultCaretColor,
    modeBadgeElement: pageState.modeBadge,
    rightReserveBase: 100,
    rightAnchorOffset: 88,
    getExtraRightInset: () => (inputParts.syncClearAction() ? SEARCH_CLEAR_BUTTON_INSET : 0),
    baseInputPaddingLeft: 44,
    getThemeForMode,
    defaultTheme,
    defaultAccentColor,
    parseCssColor,
    rgbToCss,
    isDarkMode: isNewtabDarkMode,
    getProviderIcon,
    resolveProviderIconUrl: (provider, iconUrl) => getPageFaviconUrlResolver().getProviderFaviconUrl(
      getProviderFaviconPageUrl(provider), iconUrl
    ),
    getProviderThemeHost,
    getThemeForProvider,
    getSiteSearchPrefixText: (provider) => getSiteSearchPrefixText(locale, provider),
    getSiteSearchDisplayName: (provider) => getSiteSearchDisplayName(locale, provider),
    attachFaviconData: attachInputModeFaviconData,
    formatMessage,
    modeMenuCursorTooltipController: bookmarkCursorTooltipController,
    getModeMenuItems: getSearchModeMenuItems,
    onModeMenuSelect: selectSearchModeMenuItem,
    onModeMenuReorder: menuOrder.reorder,
    onModeMenuGroupMove: menuOrder.moveGroup,
    onModeMenuHistory: menuOrder.step,
    onModeTagRemovalConfirmation: () => {
      showToast(t(
        'search_scope_remove_confirmation',
        'Press Backspace again to remove the scope.'
      ));
    },
    onModeTagRemovalConfirmationReset: hideToast,
    onModeTagActiveChange: (active) => {
      setSearchScopeIconEnabled(!active);
    },
    onModeMenuLayoutChange: syncSearchModeMenuResultOffset,
    isTabHintSuppressed: () => Boolean(searchMode.site || searchMode.local)
  });
  syncSearchModeMenuResultOffset();
  if (typeof window.ResizeObserver === 'function') {
    const searchModeMenuResultResizeObserver = new window.ResizeObserver(
      syncSearchModeMenuResultOffset
    );
    searchModeMenuResultResizeObserver.observe(suggestionsContainer);
  }
  // The active site search's prefix shows its icon once the icons are read.
  function showActiveProviderIcon(): void {
    if (!searchMode.site || !pageState.inputModeController) {
      return;
    }
    const activeProvider = searchMode.site;
    modeActions.setSiteSearchPrefix(activeProvider, defaultTheme);
    getThemeForProvider(activeProvider).then((theme) => {
      if (searchMode.site === activeProvider) {
        modeActions.setSiteSearchPrefix(activeProvider, theme);
      }
    }).catch(() => {});
  }
  void siteSearchIconCache.load().then(showActiveProviderIcon);
  // Icons another page stored redraw the prefix, the mode menu and the
  // suggestions.
  settings.subscribe(siteSearchIconCacheSetting, () => {
    siteSearchIconCache.applyStored(settings.getStored(siteSearchIconCacheSetting));
    showActiveProviderIcon();
    if (pageState.inputModeController) {
      pageState.inputModeController.refreshModeMenu();
    }
    if (searchQuery.text) {
      requestSuggestions(searchQuery.text, { immediate: true });
    }
  });




  return {
    setSiteSearchTabHint,
    clearSiteSearchTabHint,
  };
}

type SearchModeController = ReturnType<typeof createSearchModeController>;

export { createSearchModeController };
export type { SearchModeController, SearchModeControllerDeps, SearchModeControllerState };
