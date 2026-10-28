// Applying the UI language and the light/dark theme to the New Tab, and
// following the system theme.
import type { ThemeMode } from '../domain/settings';
import type { SiteSearchProvider } from '../domain/search/types';
import type { Suggestion, SuggestionElement, SuggestionsViewOptions } from '../shared/react/search/suggestion-list/types';
import type { InputModeController } from '../shared/search/search-input-mode';
import type { FeatureHintController } from '../shared/ui/feature-hint-catalog';
import type { BookmarkDisplaySettings } from './bookmarks/bookmark-display-settings';
import type { FeedbackControlRuntime } from './feedback-control';
import type { ModeCommands } from './mode-commands';
import type { NewtabThemeScope, Translate } from './newtab-types';
import type { SurfaceLocale } from '../shared/i18n/surface-locale';
import { localeToHtmlLang } from '../domain/settings/locale';
import { cacheNewtabLocale } from '../platform/settings-storage';
import type { BookmarkCardElement } from './react/bookmarks';
import type { BookmarksTopbarRuntime } from './react/bookmarks-topbar';
import type { RecentCardElement } from './react/recent-sites';
import type { ShortcutTileElement } from './react/shortcuts';
import type { TopContentController } from './react/wordmark';
import type { SectionHeaders } from './section-headers';
import type { SectionLoaders } from './section-loaders';
import type { SuggestionsController } from './search/suggestions-controller';
import type { CardThemes } from './theme/card-themes';
import type { FaviconViewRuntime } from './theme/favicon-view';
import type { QuoteRuntime } from './top-content/quotes';
import type { TopContentRuntime } from './top-content/top-content';
import type { WallpaperRuntime } from './wallpaper/wallpaper';
import type { WallpaperPage } from './wallpaper/wallpaper-page';
import type { ToneScheduleOptions } from './wallpaper/wallpaper-adaptive-tone';
import type { SettingsStore } from '../platform/settings-store';
import { newtabTopContentMode } from '../domain/settings/newtab-time';
import { themeMode } from '../domain/settings/appearance';
import { NEWTAB_THEME_SETTINGS, getNewtabGlassThemeOverride, newtabGlassStyle, newtabGlassTheme, newtabThemeMode, newtabThemeScope } from '../domain/settings/newtab-page';
import type { SearchQuery } from '../shared/search-panel/search-query';
import type { SearchMode } from '../shared/search-panel/search-mode';
import type { SearchResults } from '../shared/search-panel/search-results';
import type { SearchModeActions } from '../shared/search-panel/mode-actions';

type ResolvedTheme = 'light' | 'dark';
type LanguageAware = Pick<FeatureHintController, 'updateLanguage'>;

interface AppearanceModesState {
  // The mode applied to the page, after scope and glass material are settled.
  currentThemeMode: ThemeMode;
  initialThemeApplied: boolean;
  resolveInitialThemeReady: (() => void) | null;
  topContentController: TopContentController | null;
  bookmarkTopbarRuntime: Pick<BookmarksTopbarRuntime, 'updateLanguage'> | null;
  quoteRuntime: Pick<QuoteRuntime, 'updateLanguage'> | null;
  inputModeController: Pick<InputModeController, 'refreshModeMenuLanguage'> | null;
  updateNoticeController: LanguageAware | null;
  graphicsNoticeController: LanguageAware | null;
  engagementNoticeController: LanguageAware | null;
  webdavFeatureHintController: LanguageAware | null;
  helpCenterAskHintController: LanguageAware | null;
  inputParts: { input: HTMLInputElement } | null;
  defaultPlaceholderText: string;
  faviconViewRuntime: Pick<FaviconViewRuntime,
    'refreshFallbackIcons' | 'refreshThemeAwareFavicons' | 'scheduleThemeAwareFaviconRescue'> | null;
  wallpaperRuntime: Pick<WallpaperRuntime, 'handleThemeModeChange'> | null;
}

interface AppearanceModesDeps extends
  Pick<TopContentRuntime, 'renderNewtabTopContent' | 'applyWordmarkThemeAppearance'>,
  Pick<WallpaperPage, 'updateWallpaperLanguageStrings' | 'updateWallpaperAppearanceSelectionUi'>,
  Pick<FeedbackControlRuntime, 'updateFeedbackLanguageStrings'>,
  Pick<ModeCommands, 'updateModeBadge'>,
  Pick<SuggestionsController, 'renderSuggestions' | 'updateSelection'>,
  Pick<BookmarkDisplaySettings, 'syncBookmarkTopbarSurfaceAppearance'>,
  Pick<CardThemes, 'applyRecentCardTheme' | 'applyBookmarkCardTheme' | 'applyShortcutTileTheme'> {
  modeActions: SearchModeActions<SiteSearchProvider>;
  searchResults: SearchResults<Suggestion>;
  searchMode: SearchMode<SiteSearchProvider>;
  searchQuery: SearchQuery;
  locale: Pick<SurfaceLocale, 'store' | 'ready'>;
  settings: Pick<SettingsStore, 'get' | 'set' | 'include' | 'subscribe'>;
  t: Translate;
  renderShortcuts(): void;
  updateRecentModeMenu: SectionHeaders['updateRecentModeMenu'];
  updateBookmarkModeMenu: SectionHeaders['updateBookmarkModeMenu'];
  forceReloadRecentSitesForI18n: SectionLoaders['forceReloadRecentSitesForI18n'];
  // { resetInk: true } when a setting changed what the glass ink should be.
  scheduleWallpaperAdaptiveToneUpdate(options?: ToneScheduleOptions): void;
  recentCards: readonly RecentCardElement[];
  bookmarkCards: readonly BookmarkCardElement[];
  shortcutTiles: readonly ShortcutTileElement[];
  suggestionItems: readonly SuggestionElement[];
  applyThemeVariables: NonNullable<SuggestionsViewOptions['applyThemeVariables']>;
  // Resolves "system" through the media query unless a match is given.
  resolveTheme(mode: ThemeMode, mediaMatchesOverride?: boolean | null): ResolvedTheme;
  mediaQuery: MediaQueryList;
  // Reports whether the listener was attached.
  addMediaQueryChangeListener(queryList: MediaQueryList, listener: (event: MediaQueryListEvent) => void): boolean;
  removeMediaQueryChangeListener(queryList: MediaQueryList, listener: (event: MediaQueryListEvent) => void): void;
  // Settle once the first theme and the first language are applied.
  initialThemeReadyPromise: Promise<unknown>;
  pageState: AppearanceModesState;
}

function createAppearanceModes(deps: AppearanceModesDeps) {
  const {
    modeActions,
    searchResults,
    searchMode,
    searchQuery,
    locale,
    settings,
    t,
    renderNewtabTopContent,
    updateRecentModeMenu,
    updateBookmarkModeMenu,
    updateWallpaperLanguageStrings,
    updateWallpaperAppearanceSelectionUi,
    updateFeedbackLanguageStrings,
    renderShortcuts,
    updateModeBadge,
    recentCards,
    bookmarkCards,
    renderSuggestions,
    forceReloadRecentSitesForI18n,
    shortcutTiles,
    applyShortcutTileTheme,
    resolveTheme,
    syncBookmarkTopbarSurfaceAppearance,
    applyWordmarkThemeAppearance,
    suggestionItems,
    applyThemeVariables,
    applyRecentCardTheme,
    applyBookmarkCardTheme,
    updateSelection,
    addMediaQueryChangeListener,
    mediaQuery,
    removeMediaQueryChangeListener,
    scheduleWallpaperAdaptiveToneUpdate,
    initialThemeReadyPromise
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  let mediaListenerAttached = false;

  function applyLanguageStrings(): void {
    document.title = t('newtab_page_title', 'New Tab');
    if (pageState.topContentController && settings.get(newtabTopContentMode) === 'time') {
      renderNewtabTopContent(false);
    }
    if (pageState.bookmarkTopbarRuntime) {
      pageState.bookmarkTopbarRuntime.updateLanguage(t('bookmark_view_mode_top', 'Top bookmarks bar'));
    }
    updateRecentModeMenu();
    // Also draws the bookmark header with the new language.
    updateBookmarkModeMenu();
    updateWallpaperLanguageStrings();
    if (pageState.quoteRuntime) pageState.quoteRuntime.updateLanguage();
    updateWallpaperAppearanceSelectionUi();
    updateFeedbackLanguageStrings();
    // Draws the tiles' labels and the shortcut menus in the new language.
    renderShortcuts();
    if (pageState.inputModeController) {
      pageState.inputModeController.refreshModeMenuLanguage();
    }
    if (pageState.updateNoticeController) {
      pageState.updateNoticeController.updateLanguage();
    }
    if (pageState.graphicsNoticeController) {
      pageState.graphicsNoticeController.updateLanguage();
    }
    if (pageState.engagementNoticeController) {
      pageState.engagementNoticeController.updateLanguage();
    }
    if (pageState.webdavFeatureHintController) {
      pageState.webdavFeatureHintController.updateLanguage();
    }
    if (pageState.helpCenterAskHintController) {
      pageState.helpCenterAskHintController.updateLanguage();
    }
    if (pageState.inputParts && pageState.inputParts.input) {
      pageState.defaultPlaceholderText = t('search_placeholder', pageState.defaultPlaceholderText);
      if (!searchMode.site && !searchMode.local) {
        pageState.inputParts.input.placeholder = pageState.defaultPlaceholderText;
      }
      if (searchMode.local) {
        modeActions.setLocalSearchScopePrefix(searchMode.local);
      }
    }
    updateModeBadge(pageState.inputParts && pageState.inputParts.input ? pageState.inputParts.input.value : '');
    if (searchQuery.text && searchQuery.text.trim()) {
      void renderSuggestions(searchResults.lastResponse, searchQuery.text);
    }
  }

  function refreshShortcutTileThemes(): void {
    shortcutTiles.forEach((tile) => {
      if (!tile) {
        return;
      }
      applyShortcutTileTheme(tile, tile._xTheme, tile._xHost || '');
    });
  }

  function refreshFallbackIcons(): void {
    if (pageState.faviconViewRuntime) {
      pageState.faviconViewRuntime.refreshFallbackIcons();
    }
  }

  function refreshThemeAwareFavicons(): void {
    if (pageState.faviconViewRuntime) {
      pageState.faviconViewRuntime.refreshThemeAwareFavicons();
    }
  }

  function scheduleThemeAwareFaviconRescue(): void {
    if (pageState.faviconViewRuntime) {
      pageState.faviconViewRuntime.scheduleThemeAwareFaviconRescue();
    }
  }

  function applyThemeMode(mode: ThemeMode, options?: { mediaMatches?: boolean }): void {
    const previousThemeMode = pageState.currentThemeMode;
    pageState.currentThemeMode = themeMode.parse(mode);
    const mediaMatchesOverride = options && typeof options.mediaMatches === 'boolean'
      ? options.mediaMatches
      : null;
    const previousResolved = document.body ? document.body.getAttribute('data-theme') : '';
    const resolved = resolveTheme(mode, mediaMatchesOverride);
    document.body.setAttribute('data-theme', resolved);
    syncBookmarkTopbarSurfaceAppearance({ scheduleTone: false });
    if (document.documentElement) {
      document.documentElement.removeAttribute('data-wallpaper-preload-theme');
      document.documentElement.style.colorScheme = resolved;
    }
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', resolved === 'dark' ? '#111111' : '#ffffff');
    }
    applyWordmarkThemeAppearance(resolved);
    const didResolvedThemeChange = previousResolved !== resolved;
    suggestionItems.forEach((item) => {
      if (item && item._xTheme) {
        applyThemeVariables(item, item._xTheme);
      }
    });
    recentCards.forEach((card) => {
      if (!card) {
        return;
      }
      applyRecentCardTheme(card, card._xTheme, card._xHost || '');
    });
    bookmarkCards.forEach((card) => {
      if (!card) {
        return;
      }
      // 文件夹卡片通常没有 host/theme，也需要在主题切换时重算阴影与变量。
      applyBookmarkCardTheme(card, card._xTheme, card._xHost || '');
    });
    refreshShortcutTileThemes();
    applyLanguageStrings();
    updateSelection();
    updateModeBadge(pageState.inputParts && pageState.inputParts.input ? pageState.inputParts.input.value : '');
    refreshFallbackIcons();
    if (didResolvedThemeChange) {
      refreshThemeAwareFavicons();
      scheduleThemeAwareFaviconRescue();
    }
    if ((didResolvedThemeChange || previousThemeMode !== pageState.currentThemeMode) &&
        pageState.wallpaperRuntime) {
      pageState.wallpaperRuntime.handleThemeModeChange();
    }
    if (!pageState.initialThemeApplied) {
      pageState.initialThemeApplied = true;
      if (pageState.resolveInitialThemeReady) {
        pageState.resolveInitialThemeReady();
      }
    }
    if (mode === 'system' && !mediaListenerAttached) {
      mediaListenerAttached = addMediaQueryChangeListener(mediaQuery, handleMediaChange);
    }
    if (mode !== 'system' && mediaListenerAttached) {
      removeMediaQueryChangeListener(mediaQuery, handleMediaChange);
      mediaListenerAttached = false;
    }
    // A new theme decides the glass ink afresh rather than holding the last theme's.
    scheduleWallpaperAdaptiveToneUpdate(didResolvedThemeChange ? { resetInk: true } : undefined);
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
    return initialThemeReadyPromise;
  }

  function handleMediaChange(event: MediaQueryListEvent): void {
    if (pageState.currentThemeMode !== 'system') {
      return;
    }
    // 仅更新 data-theme 会遗漏依赖 JS 混色的卡片；系统主题切换时需完整重算。
    const mediaMatches = event && typeof event.matches === 'boolean'
      ? event.matches
      : mediaQuery.matches;
    applyThemeMode('system', { mediaMatches });
  }

  function syncSystemThemeMode(): void {
    if (pageState.currentThemeMode !== 'system') {
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
        forceReloadRecentSitesForI18n();
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
export type { AppearanceModes, AppearanceModesDeps, AppearanceModesState };
