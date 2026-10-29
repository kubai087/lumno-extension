// Applying the UI language and the light/dark theme to the New Tab, and
// following the system theme.
import { applyDocumentColorScheme, getDocumentTheme, setDocumentTheme } from './dom/document-state';
import type { ThemeMode } from '../domain/settings';
import type { SiteSearchProvider } from '../domain/search/types';
import type { Suggestion } from '../shared/react/search/suggestion-list/types';
import type { BookmarkDisplaySettings } from './bookmarks/bookmark-display-settings';
import type { FeedbackControlRuntime } from './feedback-control';
import type { NewtabThemeScope, Translate } from './newtab-types';
import type { SurfaceLocale } from '../shared/i18n/surface-locale';
import { localeToHtmlLang } from '../domain/settings/locale';
import { cacheNewtabLocale } from '../platform/settings-storage';
import type { SettingsStore } from '../platform/settings-store';
import { themeMode } from '../domain/settings/appearance';
import { NEWTAB_THEME_SETTINGS, getNewtabGlassThemeOverride, newtabGlassStyle, newtabGlassTheme, newtabThemeMode, newtabThemeScope } from '../domain/settings/newtab-page';
import type { SearchQuery } from '../shared/search-panel/search-query';
import type { SearchMode } from '../shared/search-panel/search-mode';
import type { SearchResults } from '../shared/search-panel/search-results';
import type { SearchModeActions } from '../shared/search-panel/mode-actions';
import { pageColorScheme } from './theme/page-color-scheme';
import type { SearchBoxParts } from './search/search-box-parts';
import type { PageNoticeControllers } from './notice-controllers';
import type { AppliedThemeMode } from './theme/applied-theme-mode';
import type { BookmarkSectionParts } from './bookmarks/bookmark-section-parts';
import type { FaviconParts } from './theme/favicon-parts';
import { adaptiveToneEvents } from './wallpaper/tone-requests';

type ResolvedTheme = 'light' | 'dark';


interface AppearanceModesDeps extends
  Pick<FeedbackControlRuntime, 'updateFeedbackLanguageStrings'>,
  Pick<BookmarkDisplaySettings, 'syncBookmarkTopbarSurfaceAppearance'> {
  modeActions: SearchModeActions<SiteSearchProvider>;
  searchResults: SearchResults<Suggestion>;
  searchMode: SearchMode<SiteSearchProvider>;
  searchQuery: SearchQuery;
  locale: Pick<SurfaceLocale, 'store' | 'ready'>;
  settings: Pick<SettingsStore, 'get' | 'set' | 'include' | 'subscribe'>;
  t: Translate;
  // Resolves "system" through the media query unless a match is given.
  resolveTheme(mode: ThemeMode, mediaMatchesOverride?: boolean | null): ResolvedTheme;
  mediaQuery: MediaQueryList;
  // Reports whether the listener was attached.
  addMediaQueryChangeListener(queryList: MediaQueryList, listener: (event: MediaQueryListEvent) => void): boolean;
  removeMediaQueryChangeListener(queryList: MediaQueryList, listener: (event: MediaQueryListEvent) => void): void;
  searchBox: Pick<SearchBoxParts, 'inputParts' | 'modeController'>;
  notices: Pick<PageNoticeControllers, 'updateLanguage'>;
  appliedTheme: Pick<AppliedThemeMode, 'firstApplied' | 'markApplied' | 'mode' | 'set'>;
  bookmarkParts: Pick<BookmarkSectionParts, 'topbar'>;
  faviconParts: Pick<FaviconParts, 'view'>;
}

function createAppearanceModes(deps: AppearanceModesDeps) {
  const {
    faviconParts,
    bookmarkParts,
    appliedTheme,
    notices,
    searchBox,
    modeActions,
    searchMode,
    locale,
    settings,
    t,
    updateFeedbackLanguageStrings,
    resolveTheme,
    syncBookmarkTopbarSurfaceAppearance,
    addMediaQueryChangeListener,
    mediaQuery,
    removeMediaQueryChangeListener
  } = deps;


  let mediaListenerAttached = false;

  function applyLanguageStrings(): void {
    document.title = t('newtab_page_title', 'New Tab');
    if (bookmarkParts.topbar) {
      bookmarkParts.topbar.updateLanguage(t('bookmark_view_mode_top', 'Top bookmarks bar'));
    }
    updateFeedbackLanguageStrings();
    if (searchBox.modeController) {
      searchBox.modeController.refreshModeMenuLanguage();
    }
    notices.updateLanguage();
    if (searchBox.inputParts && searchBox.inputParts.input) {
      if (!searchMode.site && !searchMode.local) {
        searchBox.inputParts.input.placeholder = t('search_placeholder', 'Search or enter URL…');
      }
      if (searchMode.local) {
        modeActions.setLocalSearchScopePrefix(searchMode.local);
      }
    }
  }

  function refreshFallbackIcons(): void {
    if (faviconParts.view) {
      faviconParts.view.refreshFallbackIcons();
    }
  }

  function refreshThemeAwareFavicons(): void {
    if (faviconParts.view) {
      faviconParts.view.refreshThemeAwareFavicons();
    }
  }

  function scheduleThemeAwareFaviconRescue(): void {
    if (faviconParts.view) {
      faviconParts.view.scheduleThemeAwareFaviconRescue();
    }
  }

  function applyThemeMode(mode: ThemeMode, options?: { mediaMatches?: boolean }): void {
    const previousThemeMode = appliedTheme.mode;
    appliedTheme.set(themeMode.parse(mode));
    const mediaMatchesOverride = options && typeof options.mediaMatches === 'boolean'
      ? options.mediaMatches
      : null;
    const previousResolved = getDocumentTheme();
    const resolved = resolveTheme(mode, mediaMatchesOverride);
    setDocumentTheme(resolved);
    syncBookmarkTopbarSurfaceAppearance({ scheduleTone: false });
    applyDocumentColorScheme(resolved);
    const didResolvedThemeChange = previousResolved !== resolved;
    pageColorScheme.setState({ dark: resolved === 'dark' });
    applyLanguageStrings();
    refreshFallbackIcons();
    if (didResolvedThemeChange) {
      refreshThemeAwareFavicons();
      scheduleThemeAwareFaviconRescue();
    }
    appliedTheme.markApplied(didResolvedThemeChange || previousThemeMode !== appliedTheme.mode);
    if (mode === 'system' && !mediaListenerAttached) {
      mediaListenerAttached = addMediaQueryChangeListener(mediaQuery, handleMediaChange);
    }
    if (mode !== 'system' && mediaListenerAttached) {
      removeMediaQueryChangeListener(mediaQuery, handleMediaChange);
      mediaListenerAttached = false;
    }
    // A new theme decides the glass ink afresh rather than holding the last theme's.
    adaptiveToneEvents.emit('stale', { resetInk: didResolvedThemeChange });
  }

  function isNewtabThemeFollowingGlobal(): boolean {
    return settings.get(newtabThemeMode) === 'global';
  }

  // A glass material set to light or dark holds the page there, over whatever the theme says.
  function getScopedThemeMode(): ThemeMode {
    const override = getNewtabGlassThemeOverride(settings.get(newtabGlassStyle), settings.get(newtabGlassTheme));
    if (override) {
      return override;
    }
    const pageMode = settings.get(newtabThemeMode);
    return pageMode === 'global' ? settings.get(themeMode) : pageMode;
  }

  // The mode the theme controls show: the page's own when it has its own scope.
  function getSelectedThemeMode(): ThemeMode {
    if (settings.get(newtabThemeScope) !== 'home') {
      return settings.get(themeMode);
    }
    const pageMode = settings.get(newtabThemeMode);
    return pageMode === 'global' ? 'system' : pageMode;
  }

  function applyScopedThemeMode(options?: { mediaMatches?: boolean }): void {
    applyThemeMode(getScopedThemeMode(), options);
  }

  function getThemeScope(): NewtabThemeScope {
    return settings.get(newtabThemeScope);
  }

  // Writes the theme the page's controls edit: the global one, or the
  // page's own when it has its own scope.
  function setThemeMode(mode: unknown): void {
    const nextMode = themeMode.parse(mode);
    if (settings.get(newtabThemeScope) !== 'home') {
      void settings.set(themeMode, nextMode);
      return;
    }
    void settings.set(newtabThemeMode, nextMode === 'system' ? 'global' : nextMode);
  }

  // Writes the theme the page shows: the global one while the page follows it.
  function setVisibleThemeMode(mode: unknown): void {
    const nextMode = themeMode.parse(mode);
    if (settings.get(newtabThemeMode) === 'global') {
      void settings.set(themeMode, nextMode);
      return;
    }
    void settings.set(newtabThemeMode, nextMode === 'system' ? 'global' : nextMode);
  }

  function setThemeScope(scope: unknown): void {
    void settings.set(newtabThemeScope, newtabThemeScope.parse(scope));
  }

  // Puts the page in its theme once the theme settings are read, and again
  // whenever one of them changes.
  // Later calls only wait for the first theme.
  let themeFollowed = false;
  function followTheme(): Promise<unknown> {
    if (!themeFollowed) {
      themeFollowed = true;
      settings.subscribe(NEWTAB_THEME_SETTINGS, () => applyScopedThemeMode());
      void settings.include(NEWTAB_THEME_SETTINGS).then(() => applyScopedThemeMode());
    }
    return appliedTheme.firstApplied;
  }

  function handleMediaChange(event: MediaQueryListEvent): void {
    if (appliedTheme.mode !== 'system') {
      return;
    }
    // 仅更新 data-theme 会遗漏依赖 JS 混色的卡片；系统主题切换时需完整重算。
    const mediaMatches = event && typeof event.matches === 'boolean'
      ? event.matches
      : mediaQuery.matches;
    applyThemeMode('system', { mediaMatches });
  }

  function syncSystemThemeMode(): void {
    if (appliedTheme.mode !== 'system') {
      return;
    }
    const resolved = resolveTheme('system');
    if (!document.body || document.body.getAttribute('data-theme') === resolved) {
      return;
    }
    applyThemeMode('system', { mediaMatches: mediaQuery.matches });
  }

  // Puts the page in its language once the first messages are in, and again
  // on every change; the document's language moves with the locale at once.
  function followLanguage(): Promise<void> {
    let shownMessages = locale.store.getSnapshot().messages;
    let shownLocale = '';
    const applyLocale = () => {
      const { locale: current, messages } = locale.store.getSnapshot();
      if (current !== shownLocale) {
        shownLocale = current;
        document.documentElement.lang = localeToHtmlLang(current);
        cacheNewtabLocale(current);
      }
      if (messages !== shownMessages) {
        shownMessages = messages;
        applyLanguageStrings();
      }
    };
    locale.store.subscribe(applyLocale);
    return locale.ready.then(applyLocale);
  }

  return {
    getThemeScope,
    setThemeMode,
    setVisibleThemeMode,
    setThemeScope,
    followLanguage,
    refreshThemeAwareFavicons,
    scheduleThemeAwareFaviconRescue,
    applyThemeMode,
    isNewtabThemeFollowingGlobal,
    getScopedThemeMode,
    getSelectedThemeMode,
    applyScopedThemeMode,
    followTheme,
    syncSystemThemeMode
  };
}

type AppearanceModes = ReturnType<typeof createAppearanceModes>;

export { createAppearanceModes };
export type { AppearanceModes, AppearanceModesDeps };
