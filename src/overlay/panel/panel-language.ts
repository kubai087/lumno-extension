// Puts the panel's language on what it shows: the CJK face for the
// locale, and the copy of the input, the notices and the results.
import * as LumnoCjkFontFaces from '../../shared/cjk-font-faces';
import * as OVERLAY_FONT_FACES from '../../shared/overlay-font-faces';
import { localeToHtmlLang } from '../../domain/settings/locale';
import type { SurfaceLocale } from '../../shared/i18n/surface-locale';
import type { SearchQuery } from '../../shared/search-panel/search-query';
import type { SearchMode } from '../../shared/search-panel/search-mode';
import type { SearchResults } from '../../shared/search-panel/search-results';
import type { SearchModeActions } from '../../shared/search-panel/mode-actions';
import type { InputModeProvider, InputModeTheme } from '../../shared/search/input-mode/types';
import type { OverlayPanelElements } from './panel-elements';
import type { OverlayNotices } from './overlay-notices';

// Row is a suggestion row; this module only passes it along.

interface PanelLanguageDeps<Row> {
  modeActions: SearchModeActions<InputModeProvider>;
  searchResults: Pick<SearchResults<Row>, 'lastResponse'>;
  searchMode: Pick<SearchMode<InputModeProvider>, 'site' | 'local'>;
  searchQuery: SearchQuery;
  locale: Pick<SurfaceLocale, 't'>;
  updateModeBadge(rawValue: string): void;
  getThemeForProvider(provider: InputModeProvider): Promise<InputModeTheme>;
  updateSearchSuggestions(rows: Row[], query: string): void;
  requestTabsAndRender(): void;
  // Names the search input's buttons again.
  defaultTheme: InputModeTheme;
  elements: Pick<OverlayPanelElements, 'inputModeController' | 'modeBadge' | 'searchInput'>;
  notices: Pick<OverlayNotices, 'updateLanguage'>;
}

function createPanelLanguage<Row>(deps: PanelLanguageDeps<Row>) {
  const {
    notices,
    elements,
    defaultTheme,
    modeActions,
    searchResults,
    searchMode,
    searchQuery,
    locale,
    updateModeBadge,
    getThemeForProvider,
    updateSearchSuggestions,
    requestTabsAndRender
  } = deps;

  // The input's placeholder in the current language.
  let defaultPlaceholderText = 'Search or enter URL…';

  function getDefaultPlaceholderText(): string {
    return defaultPlaceholderText;
  }

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
    if (elements.inputModeController &&
        typeof elements.inputModeController.refreshModeMenuLanguage === 'function') {
      elements.inputModeController.refreshModeMenuLanguage();
    }
    notices.updateLanguage();
    if (elements.searchInput) {
      defaultPlaceholderText = locale.t('overlay_search_placeholder', locale.t('search_placeholder', defaultPlaceholderText));
      if (!searchMode.site && !searchMode.local) {
        elements.searchInput.placeholder = defaultPlaceholderText;
      }
    }
    if (elements.modeBadge) {
      updateModeBadge(elements.searchInput ? elements.searchInput.value : '');
    }
    if (searchMode.site) {
      const activeSiteSearchProvider = searchMode.site;
      modeActions.setSiteSearchPrefix(activeSiteSearchProvider, defaultTheme);
      void getThemeForProvider(activeSiteSearchProvider).then((theme) => {
        if (searchMode.site === activeSiteSearchProvider) {
          modeActions.setSiteSearchPrefix(activeSiteSearchProvider, theme);
        }
      });
      modeActions.updateSiteSearchPrefixLayout();
    } else if (searchMode.local) {
      modeActions.setLocalSearchScopePrefix(searchMode.local);
      modeActions.updateSiteSearchPrefixLayout();
    }
    if (!refreshResults) {
      return;
    }
    if (searchQuery.text) {
      updateSearchSuggestions(searchResults.lastResponse, searchQuery.text);
    } else {
      requestTabsAndRender();
    }
  }

  return {
    getDefaultPlaceholderText,
    applyOverlayCjkFontFace,
    applyLanguageStrings
  };
}

export { createPanelLanguage };
export type { PanelLanguageDeps };
