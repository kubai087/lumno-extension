// The search input's mode controller: site search and local scope
// prefixes, the tab hint for site search, the placeholder and caret color
// per mode, and the cached provider icons the prefixes show.
import type { SearchSourceType, SiteSearchProvider } from '../../domain/search/types';
import type * as Settings from '../../domain/settings';
import type { NewtabOpenInNewTab } from '../../domain/settings';
import type { StorageAreaLike } from '../../domain/storage-port';
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

// An option the input mode controller is handed as it is.
type ModeOption<K extends keyof InputModeConfig> = NonNullable<InputModeConfig[K]>;

interface SearchModeControllerState {
  inputParts: SearchInputParts | null;
  modeBadge: HTMLElement | null;
  suggestionsContainer: HTMLElement | null;
  inputModeController: InputModeController | null;
  siteSearchState: SiteSearchProvider | null;
  localSearchScopeState: ActiveLocalScope | null;
  searchResultPriorityMode: string;
  enabledSearchResultSourceTypes: SearchSourceType[];
  searchResultDisplayLimit: number;
  openTabQuickSwitchEnabled: boolean;
  newtabOpenInNewTab: NewtabOpenInNewTab;
  latestQuery: string;
  lastSuggestionResponse: Suggestion[];
}

interface SearchModeControllerDeps {
  storageArea: StorageAreaLike | null;
  SEARCH_RESULT_PRIORITY_STORAGE_KEY: string;
  SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY: string;
  SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY: string;
  OVERLAY_TAB_PRIORITY_STORAGE_KEY: string;
  NEWTAB_OPEN_IN_NEW_TAB_STORAGE_KEY: string;
  normalizeSearchResultPriority(value: unknown): string;
  normalizeEnabledSearchResultSourceTypes(value: unknown): SearchSourceType[];
  normalizeSearchResultDisplayLimit(value: unknown): number;
  normalizeOverlayTabPriorityMode(value: unknown): boolean;
  SETTINGS: Pick<typeof Settings, 'newtabOpenInNewTab'>;
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
  siteSearchIconCache: Pick<SiteSearchIconCache, 'load'>;
  pageState: SearchModeControllerState;
}

function createSearchModeController(deps: SearchModeControllerDeps) {
  const {
    storageArea,
    SEARCH_RESULT_PRIORITY_STORAGE_KEY,
    SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY,
    SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY,
    OVERLAY_TAB_PRIORITY_STORAGE_KEY,
    NEWTAB_OPEN_IN_NEW_TAB_STORAGE_KEY,
    normalizeSearchResultPriority,
    normalizeEnabledSearchResultSourceTypes,
    normalizeSearchResultDisplayLimit,
    normalizeOverlayTabPriorityMode,
    SETTINGS,
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

  if (storageArea) {
    // Narrowed here, for the storage callback below.
    const area = storageArea;
    void area.get([
      SEARCH_RESULT_PRIORITY_STORAGE_KEY,
      SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY,
      SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY,
      OVERLAY_TAB_PRIORITY_STORAGE_KEY,
      NEWTAB_OPEN_IN_NEW_TAB_STORAGE_KEY
    ], (result) => {
      const raw = result ? result[SEARCH_RESULT_PRIORITY_STORAGE_KEY] : null;
      const nextMode = normalizeSearchResultPriority(raw);
      pageState.searchResultPriorityMode = nextMode;
      pageState.enabledSearchResultSourceTypes = normalizeEnabledSearchResultSourceTypes(
        result ? result[SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY] : null
      );
      const rawDisplayLimit = result ? result[SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY] : null;
      pageState.searchResultDisplayLimit = normalizeSearchResultDisplayLimit(rawDisplayLimit);
      pageState.openTabQuickSwitchEnabled = normalizeOverlayTabPriorityMode(
        result ? result[OVERLAY_TAB_PRIORITY_STORAGE_KEY] : null
      );
      pageState.newtabOpenInNewTab = SETTINGS.newtabOpenInNewTab.parse(
        result ? result[NEWTAB_OPEN_IN_NEW_TAB_STORAGE_KEY] : null
      );
      if (raw !== nextMode) {
        void area.set({ [SEARCH_RESULT_PRIORITY_STORAGE_KEY]: nextMode });
      }
      if (rawDisplayLimit !== pageState.searchResultDisplayLimit) {
        void area.set({ [SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY]: pageState.searchResultDisplayLimit });
      }
      if (pageState.latestQuery) {
        renderSuggestions(pageState.lastSuggestionResponse, pageState.latestQuery);
      }
    });
  }
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
  siteSearchIconCache.load().then(() => {
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
