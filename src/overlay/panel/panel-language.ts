// Puts the panel's language on what it shows: the CJK face for the
// locale, and the copy of the input, the notices and the results.
import * as LumnoCjkFontFaces from '../../shared/cjk-font-faces';
import * as OVERLAY_FONT_FACES from '../../shared/overlay-font-faces';
import { localeToHtmlLang } from '../../domain/settings/locale';
import type { SurfaceLocale } from '../../shared/i18n/surface-locale';
import type { SearchQuery } from '../../shared/search-panel/search-query';
import type { ActiveLocalScope, SearchMode } from '../../shared/search-panel/search-mode';

// Row is a suggestion row, Provider a site search provider and Theme a
// suggestion theme; this module only passes them along.
interface PanelLanguageState<Row, Theme> {
  inputModeController: { refreshModeMenuLanguage?(): void } | null;
  overlayUpdateNoticeController: { updateLanguage?(): void } | null;
  overlayGraphicsNoticeController: { updateLanguage?(): void } | null;
  overlayEngagementNoticeController: { updateLanguage?(): void } | null;
  searchInput: HTMLInputElement | null;
  defaultPlaceholderText: string;
  modeBadge: HTMLElement | null;
  defaultTheme: Theme;
  lastSuggestionResponse: Row[];
}

interface PanelLanguageDeps<Row, Provider, Theme> {
  searchMode: Pick<SearchMode<Provider>, 'site' | 'local'>;
  searchQuery: SearchQuery;
  locale: Pick<SurfaceLocale, 't'>;
  updateModeBadge(rawValue: string): void;
  setSiteSearchPrefix(provider: Provider, theme: Theme): void;
  getThemeForProvider(provider: Provider): Promise<Theme>;
  updateSiteSearchPrefixLayout(): void;
  setLocalSearchScopePrefix(scope: ActiveLocalScope): void;
  updateSearchSuggestions(rows: Row[], query: string): void;
  requestTabsAndRender(): void;
  // Names the search input's buttons again.
  applyInputActionLabels(): void;
  overlayState: PanelLanguageState<Row, Theme>;
}

function createPanelLanguage<Row, Provider, Theme>(deps: PanelLanguageDeps<Row, Provider, Theme>) {
  const {
    searchMode,
    searchQuery,
    locale,
    updateModeBadge,
    setSiteSearchPrefix,
    getThemeForProvider,
    updateSiteSearchPrefixLayout,
    setLocalSearchScopePrefix,
    updateSearchSuggestions,
    requestTabsAndRender,
    applyInputActionLabels
  } = deps;

  // The panel state object shared with search-panel.ts and the other modules.
  const overlayState = deps.overlayState;

  function applyOverlayCjkFontFace(locale: string): void {
    const lang = localeToHtmlLang(locale);
    if (OVERLAY_FONT_FACES.keepEarlyCjkFontFace(window, lang)) {
      return;
    }
    LumnoCjkFontFaces.install(document, {
      family: OVERLAY_FONT_FACES.OVERLAY_TEXT_FAMILY,
      lang,
      styleId: '_x_extension_overlay_cjk_font_faces_2026_unique_'
    });
  }

  // Puts the current language's copy on everything the panel shows.
  function applyLanguageStrings(options?: { refreshResults?: boolean }): void {
    const refreshResults = !options || options.refreshResults !== false;
    if (overlayState.inputModeController &&
        typeof overlayState.inputModeController.refreshModeMenuLanguage === 'function') {
      overlayState.inputModeController.refreshModeMenuLanguage();
    }
    if (overlayState.overlayUpdateNoticeController &&
        typeof overlayState.overlayUpdateNoticeController.updateLanguage === 'function') {
      overlayState.overlayUpdateNoticeController.updateLanguage();
    }
    if (overlayState.overlayGraphicsNoticeController &&
        typeof overlayState.overlayGraphicsNoticeController.updateLanguage === 'function') {
      overlayState.overlayGraphicsNoticeController.updateLanguage();
    }
    if (overlayState.overlayEngagementNoticeController &&
        typeof overlayState.overlayEngagementNoticeController.updateLanguage === 'function') {
      overlayState.overlayEngagementNoticeController.updateLanguage();
    }
    if (overlayState.searchInput) {
      overlayState.defaultPlaceholderText = locale.t('overlay_search_placeholder', locale.t('search_placeholder', overlayState.defaultPlaceholderText));
      if (!searchMode.site && !searchMode.local) {
        overlayState.searchInput.placeholder = overlayState.defaultPlaceholderText;
      }
    }
    applyInputActionLabels();
    if (overlayState.modeBadge) {
      updateModeBadge(overlayState.searchInput ? overlayState.searchInput.value : '');
    }
    if (searchMode.site) {
      const activeSiteSearchProvider = searchMode.site;
      setSiteSearchPrefix(activeSiteSearchProvider, overlayState.defaultTheme);
      void getThemeForProvider(activeSiteSearchProvider).then((theme) => {
        if (searchMode.site === activeSiteSearchProvider) {
          setSiteSearchPrefix(activeSiteSearchProvider, theme);
        }
      });
      updateSiteSearchPrefixLayout();
    } else if (searchMode.local) {
      setLocalSearchScopePrefix(searchMode.local);
      updateSiteSearchPrefixLayout();
    }
    if (!refreshResults) {
      return;
    }
    if (searchQuery.text) {
      updateSearchSuggestions(overlayState.lastSuggestionResponse, searchQuery.text);
    } else {
      requestTabsAndRender();
    }
  }

  return {
    applyOverlayCjkFontFace,
    applyLanguageStrings
  };
}

export { createPanelLanguage };
export type { PanelLanguageDeps, PanelLanguageState };
