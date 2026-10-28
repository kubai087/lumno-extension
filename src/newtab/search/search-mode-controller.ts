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
import type { ActiveLocalScope, RenderSuggestions } from './search-types';
import type { FaviconUrlResolver } from '../../domain/favicon/resolver';
import type { SiteSearchIconCache } from '../../shared/search/site-search-icon-cache';
import { searchResultDisplayLimit, searchResultPriority, searchResultSourceTypes, siteSearchIconCache as siteSearchIconCacheSetting } from '../../domain/settings/search';
import { newtabOpenInNewTab } from '../../domain/settings/newtab-page';
import { overlayTabPriority } from '../../domain/settings/overlay-panel';
import type { SettingsStore } from '../../platform/settings-store';
import type { SuggestionsController } from './suggestions-controller';

// An option the input mode controller is handed as it is.
type ModeOption<K extends keyof InputModeConfig> = NonNullable<InputModeConfig[K]>;

interface SearchModeControllerState {
  inputParts: SearchInputParts | null;
  modeBadge: HTMLElement | null;
  suggestionsContainer: HTMLElement | null;
  inputModeController: InputModeController | null;
  siteSearchState: SiteSearchProvider | null;
  localSearchScopeState: ActiveLocalScope | null;
  latestQuery: string;
  lastSuggestionResponse: Suggestion[];
}

interface SearchModeControllerDeps {
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
  getSiteSearchPrefixText: ModeOption<'getSiteSearchPrefixText'>;
  getSiteSearchDisplayName: ModeOption<'getSiteSearchDisplayName'>;
  isAiSiteSearchProvider: ModeOption<'isAiSiteSearchProvider'>;
  attachInputModeFaviconData: ModeOption<'attachFaviconData'>;
  formatMessage: FormatMessage;
  bookmarkCursorTooltipController: ModeOption<'modeMenuCursorTooltipController'>;
  getSearchModeMenuItems: ModeOption<'getModeMenuItems'>;
  selectSearchModeMenuItem: ModeOption<'onModeMenuSelect'>;
  reorderSearchModeMenu: ModeOption<'onModeMenuReorder'>;
  moveSearchModeMenuGroup: ModeOption<'onModeMenuGroupMove'>;
  stepSearchModeMenuHistory: ModeOption<'onModeMenuHistory'>;
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
    getSiteSearchPrefixText,
    getSiteSearchDisplayName,
    isAiSiteSearchProvider,
    attachInputModeFaviconData,
    formatMessage,
    bookmarkCursorTooltipController,
    getSearchModeMenuItems,
    selectSearchModeMenuItem,
    reorderSearchModeMenu,
    moveSearchModeMenuGroup,
    stepSearchModeMenuHistory,
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
      if (pageState.latestQuery) {
        renderSuggestions(pageState.lastSuggestionResponse, pageState.latestQuery);
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
    getSiteSearchPrefixText,
    getSiteSearchDisplayName,
    isAiSiteSearchProvider,
    attachFaviconData: attachInputModeFaviconData,
    formatMessage,
    modeMenuCursorTooltipController: bookmarkCursorTooltipController,
    getModeMenuItems: getSearchModeMenuItems,
    onModeMenuSelect: selectSearchModeMenuItem,
    onModeMenuReorder: reorderSearchModeMenu,
    onModeMenuGroupMove: moveSearchModeMenuGroup,
    onModeMenuHistory: stepSearchModeMenuHistory,
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
    isTabHintSuppressed: () => Boolean(pageState.siteSearchState || pageState.localSearchScopeState)
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
    if (!pageState.siteSearchState || !pageState.inputModeController) {
      return;
    }
    const activeProvider = pageState.siteSearchState;
    setSiteSearchPrefix(activeProvider, defaultTheme);
    getThemeForProvider(activeProvider).then((theme) => {
      if (pageState.siteSearchState === activeProvider) {
        setSiteSearchPrefix(activeProvider, theme);
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
    if (pageState.latestQuery) {
      requestSuggestions(pageState.latestQuery, { immediate: true });
    }
  });

  function updateSiteSearchPrefixLayout(): void {
    if (pageState.inputModeController) {
      pageState.inputModeController.updateLayout();
    }
  }

  function setSiteSearchPrefix(...args: Parameters<InputModeController['setProviderPrefix']>): void {
    const [provider, theme, options] = args;
    if (pageState.inputModeController) {
      pageState.inputModeController.setProviderPrefix(provider, theme, options);
    }
  }

  function clearSiteSearchPrefix(): void {
    if (pageState.inputModeController) {
      pageState.inputModeController.clearProviderPrefix();
    }
  }

  return {
    setSiteSearchTabHint,
    clearSiteSearchTabHint,
    updateSiteSearchPrefixLayout,
    setSiteSearchPrefix,
    clearSiteSearchPrefix
  };
}

type SearchModeController = ReturnType<typeof createSearchModeController>;

export { createSearchModeController };
export type { SearchModeController, SearchModeControllerDeps, SearchModeControllerState };
