// Applying the UI language and the light/dark theme to the New Tab, and
// following the system theme.
import type * as LumnoSettings from '../domain/settings';
import type { NewtabGlassTheme, ThemeMode } from '../domain/settings';
import type { SiteSearchProvider } from '../domain/search/types';
import type { StorageAreaLike } from '../domain/storage-port';
import type { Suggestion, SuggestionElement, SuggestionsViewOptions } from '../shared/react/search/suggestion-list/types';
import type { InputModeController } from '../shared/search/search-input-mode';
import type { FeatureHintController } from '../shared/ui/feature-hint-catalog';
import type { BookmarkDisplaySettings } from './bookmarks/bookmark-display-settings';
import type { FeedbackControlRuntime } from './feedback-control';
import type { ModeCommands } from './mode-commands';
import type { NewtabThemeMode, NewtabThemeScope, Translate } from './newtab-types';
import type { LocaleMessages, PageLanguage } from './page-language';
import type { BookmarkCardElement } from './react/bookmarks';
import type { BookmarksTopbarRuntime } from './react/bookmarks-topbar';
import type { RecentCardElement } from './react/recent-sites';
import type { ShortcutTileElement } from './react/shortcuts';
import type { TopContentController } from './react/wordmark';
import type { SearchModes } from './search/search-modes';
import type { SectionHeaders } from './section-headers';
import type { SectionLoaders } from './section-loaders';
import type { ActiveLocalScope } from './search/search-types';
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

type ResolvedTheme = 'light' | 'dark';
type LanguageAware = Pick<FeatureHintController, 'updateLanguage'>;

interface AppearanceModesState {
  currentLanguageMode: string;
  currentResolvedLocale: string | null;
  currentMessages: LocaleMessages | null;
  resolveInitialLanguageReady: (() => void) | null;
  // The mode applied to the page, after scope and glass material are settled.
  currentThemeMode: ThemeMode;
  globalThemeMode: ThemeMode;
  newtabThemeMode: NewtabThemeMode;
  newtabThemeScope: NewtabThemeScope;
  glassThemeOverride: Exclude<NewtabGlassTheme, 'follow'> | '';
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
  siteSearchState: SiteSearchProvider | null;
  localSearchScopeState: ActiveLocalScope | null;
  latestQuery: string;
  lastSuggestionResponse: Suggestion[];
  faviconViewRuntime: Pick<FaviconViewRuntime,
    'refreshFallbackIcons' | 'refreshThemeAwareFavicons' | 'scheduleThemeAwareFaviconRescue'> | null;
  wallpaperRuntime: Pick<WallpaperRuntime, 'handleThemeModeChange'> | null;
}

interface AppearanceModesDeps extends
  Pick<PageLanguage, 'getSystemLocale' | 'normalizeLocale' | 'applyDocumentLanguage' | 'loadLocaleMessages'>,
  Pick<TopContentRuntime, 'renderNewtabTopContent' | 'applyWordmarkThemeAppearance'>,
  Pick<WallpaperPage, 'updateWallpaperLanguageStrings' | 'updateWallpaperAppearanceSelectionUi'>,
  Pick<FeedbackControlRuntime, 'updateFeedbackLanguageStrings'>,
  Pick<SearchModes, 'setLocalSearchScopePrefix'>,
  Pick<ModeCommands, 'updateModeBadge'>,
  Pick<SuggestionsController, 'renderSuggestions' | 'updateSelection'>,
  Pick<BookmarkDisplaySettings, 'syncBookmarkTopbarSurfaceColorForTheme'>,
  Pick<CardThemes, 'applyRecentCardTheme' | 'applyBookmarkCardTheme' | 'applyShortcutTileTheme'> {
  settings: Pick<SettingsStore, 'get'>;
  t: Translate;
  renderShortcuts(): void;
  updateRecentModeMenu: SectionHeaders['updateRecentModeMenu'];
  updateBookmarkModeMenu: SectionHeaders['updateBookmarkModeMenu'];
  // Tells the listeners outside this module that the language changed.
  notifyLanguageChange(): void;
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
  initialLanguageReadyPromise: Promise<unknown>;
  storageArea: StorageAreaLike | null;
  THEME_STORAGE_KEY: string;
  NEWTAB_THEME_MODE_STORAGE_KEY: string;
  NEWTAB_THEME_SCOPE_STORAGE_KEY: string;
  NEWTAB_GLASS_STYLE_STORAGE_KEY: string;
  NEWTAB_GLASS_THEME_STORAGE_KEY: string;
  LANGUAGE_STORAGE_KEY: string;
  getGlassThemeOverride: typeof LumnoSettings.getNewtabGlassThemeOverride;
  pageState: AppearanceModesState;
}

function createAppearanceModes(deps: AppearanceModesDeps) {
  const {
    settings,
    t,
    renderNewtabTopContent,
    updateRecentModeMenu,
    updateBookmarkModeMenu,
    updateWallpaperLanguageStrings,
    updateWallpaperAppearanceSelectionUi,
    updateFeedbackLanguageStrings,
    renderShortcuts,
    notifyLanguageChange,
    setLocalSearchScopePrefix,
    updateModeBadge,
    recentCards,
    bookmarkCards,
    renderSuggestions,
    getSystemLocale,
    normalizeLocale,
    applyDocumentLanguage,
    forceReloadRecentSitesForI18n,
    loadLocaleMessages,
    shortcutTiles,
    applyShortcutTileTheme,
    resolveTheme,
    syncBookmarkTopbarSurfaceColorForTheme,
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
    initialThemeReadyPromise,
    storageArea,
    THEME_STORAGE_KEY,
    NEWTAB_THEME_MODE_STORAGE_KEY,
    NEWTAB_THEME_SCOPE_STORAGE_KEY,
    NEWTAB_GLASS_STYLE_STORAGE_KEY,
    NEWTAB_GLASS_THEME_STORAGE_KEY,
    getGlassThemeOverride,
    initialLanguageReadyPromise,
    LANGUAGE_STORAGE_KEY
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  let mediaListenerAttached = false;
  let hasThemeBootstrapStarted = false;
  let initialLanguageApplied = false;
  let hasLanguageBootstrapStarted = false;
  let languageApplyRequestId = 0;

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
      if (!pageState.siteSearchState && !pageState.localSearchScopeState) {
        pageState.inputParts.input.placeholder = pageState.defaultPlaceholderText;
      }
      if (pageState.localSearchScopeState) {
        setLocalSearchScopePrefix(pageState.localSearchScopeState);
      }
    }
    updateModeBadge(pageState.inputParts && pageState.inputParts.input ? pageState.inputParts.input.value : '');
    if (pageState.latestQuery && pageState.latestQuery.trim()) {
      void renderSuggestions(pageState.lastSuggestionResponse, pageState.latestQuery);
    }
    notifyLanguageChange();
  }

  function applyLanguageMode(mode: unknown): void {
    const requestId = ++languageApplyRequestId;
    pageState.currentLanguageMode = typeof mode === 'string' && mode ? mode : 'system';
    const targetLocale = pageState.currentLanguageMode === 'system' ? getSystemLocale() : normalizeLocale(pageState.currentLanguageMode);
    pageState.currentResolvedLocale = targetLocale;
    applyDocumentLanguage(targetLocale);
    const finalizeLanguageInit = () => {
      if (initialLanguageApplied) {
        return;
      }
      initialLanguageApplied = true;
      if (pageState.resolveInitialLanguageReady) {
        pageState.resolveInitialLanguageReady();
      }
    };
    const applyResolvedMessages = (messages: LocaleMessages | null | undefined) => {
      if (requestId !== languageApplyRequestId) {
        return;
      }
      pageState.currentMessages = messages || {};
      applyLanguageStrings();
      forceReloadRecentSitesForI18n();
      finalizeLanguageInit();
    };
    void loadLocaleMessages(targetLocale).then(applyResolvedMessages);
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
    pageState.currentThemeMode = normalizeThemeMode(mode);
    const mediaMatchesOverride = options && typeof options.mediaMatches === 'boolean'
      ? options.mediaMatches
      : null;
    const previousResolved = document.body ? document.body.getAttribute('data-theme') : '';
    const resolved = resolveTheme(mode, mediaMatchesOverride);
    document.body.setAttribute('data-theme', resolved);
    syncBookmarkTopbarSurfaceColorForTheme(resolved);
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

  function normalizeThemeMode(value: unknown): ThemeMode {
    if (value === 'light' || value === 'dark') {
      return value;
    }
    return 'system';
  }

  function normalizeNewtabThemeMode(value: unknown): NewtabThemeMode {
    if (value === 'light' || value === 'dark') {
      return value;
    }
    return 'global';
  }

  function normalizeNewtabThemeScope(value: unknown): NewtabThemeScope {
    return value === 'home' ? 'home' : 'global';
  }

  function isNewtabThemeFollowingGlobal(): boolean {
    return pageState.newtabThemeMode === 'global';
  }

  // A glass material set to light or dark holds the page there, over whatever the theme says.
  function getScopedThemeMode(): ThemeMode {
    if (pageState.glassThemeOverride) {
      return pageState.glassThemeOverride;
    }
    const newtabThemeMode = pageState.newtabThemeMode;
    return newtabThemeMode === 'global' ? pageState.globalThemeMode : newtabThemeMode;
  }

  function getSelectedThemeMode(): ThemeMode {
    if (pageState.newtabThemeScope !== 'home') {
      return pageState.globalThemeMode;
    }
    const newtabThemeMode = pageState.newtabThemeMode;
    return newtabThemeMode === 'global' ? 'system' : newtabThemeMode;
  }

  function applyScopedThemeMode(options?: { mediaMatches?: boolean }): void {
    applyThemeMode(getScopedThemeMode(), options);
  }

  function bootstrapInitialThemeMode(): Promise<unknown> {
    if (hasThemeBootstrapStarted) {
      return initialThemeReadyPromise;
    }
    hasThemeBootstrapStarted = true;
    if (!storageArea) {
      pageState.globalThemeMode = 'system';
      pageState.newtabThemeMode = 'global';
      pageState.newtabThemeScope = 'global';
      applyScopedThemeMode();
      return initialThemeReadyPromise;
    }
    void storageArea.get([
      THEME_STORAGE_KEY,
      NEWTAB_THEME_MODE_STORAGE_KEY,
      NEWTAB_THEME_SCOPE_STORAGE_KEY,
      NEWTAB_GLASS_STYLE_STORAGE_KEY,
      NEWTAB_GLASS_THEME_STORAGE_KEY
    ], (result) => {
      pageState.globalThemeMode = normalizeThemeMode(result ? result[THEME_STORAGE_KEY] : 'system');
      pageState.newtabThemeMode = normalizeNewtabThemeMode(result ? result[NEWTAB_THEME_MODE_STORAGE_KEY] : 'global');
      pageState.newtabThemeScope = normalizeNewtabThemeScope(result ? result[NEWTAB_THEME_SCOPE_STORAGE_KEY] : 'global');
      // Read with the theme so a page held light or dark by its material opens in it, not after.
      pageState.glassThemeOverride = getGlassThemeOverride(
        result ? result[NEWTAB_GLASS_STYLE_STORAGE_KEY] : 'none',
        result ? result[NEWTAB_GLASS_THEME_STORAGE_KEY] : 'follow'
      );
      applyScopedThemeMode();
    });
    return initialThemeReadyPromise;
  }

  function bootstrapInitialLanguageMode(): Promise<unknown> {
    if (hasLanguageBootstrapStarted) {
      return initialLanguageReadyPromise;
    }
    hasLanguageBootstrapStarted = true;
    if (!storageArea) {
      applyLanguageMode('system');
      return initialLanguageReadyPromise;
    }
    void storageArea.get([LANGUAGE_STORAGE_KEY], (result) => {
      applyLanguageMode(result ? result[LANGUAGE_STORAGE_KEY] : 'system');
    });
    return initialLanguageReadyPromise;
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

  return {
    applyLanguageMode,
    refreshThemeAwareFavicons,
    scheduleThemeAwareFaviconRescue,
    applyThemeMode,
    normalizeThemeMode,
    normalizeNewtabThemeMode,
    normalizeNewtabThemeScope,
    isNewtabThemeFollowingGlobal,
    getScopedThemeMode,
    getSelectedThemeMode,
    applyScopedThemeMode,
    bootstrapInitialThemeMode,
    bootstrapInitialLanguageMode,
    syncSystemThemeMode
  };
}

type AppearanceModes = ReturnType<typeof createAppearanceModes>;

export { createAppearanceModes };
export type { AppearanceModes, AppearanceModesDeps, AppearanceModesState };
