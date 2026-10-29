// The page's theme: the system scheme, the language and theme applied to
// the page, the tints of cards and tiles, the favicon images and their
// fallbacks, and the notices redrawn in a new language.
import * as NEWTAB_APPEARANCE_MODES from '../../appearance-modes';
import * as NEWTAB_CARD_THEMES from '../../theme/card-themes';
import { buildFallbackThemeForHost, defaultAccentColor } from '../../../shared/favicon/favicon-theme';
import { extractAverageColor } from '../../../shared/favicon/average-color';
import { normalizeHost } from '../../../domain/favicon/brand-accents';
import { getReadableTextColor, mixColor, parseCssColor, rgbToCss, rgbToCssAlpha, rgbToCssParts } from '../../../domain/color';
import * as NEWTAB_PAGE_FAVICONS from '../../theme/page-favicons';
import * as NEWTAB_SYSTEM_THEME from '../../theme/system-theme';
import { PageNoticeControllers } from '../../notice-controllers';
import type { PageContext } from '../../app/context';
import type { ServicesPart } from '../shell/services';
import type { BookmarkStorePart } from '../stores/bookmark-store';
import type { NavigationPart } from '../shell/navigation';
import type { BookmarkMenusPart } from '../menus/bookmark-menus';
import type { SearchCorePart } from '../sources/search-core';
import type { RecentCorePart } from '../sources/recent-core';

interface ThemePartDeps {
  shell: ServicesPart;
  bookmarkStore: BookmarkStorePart;
  navigation: NavigationPart;
  bookmarkMenus: BookmarkMenusPart;
  searchCore: SearchCorePart;
  recentCore: RecentCorePart;
}

function createThemePart(ctx: PageContext, deps: ThemePartDeps) {
  const { locale, settings, t } = ctx;
  const {
    appliedTheme,
    faviconParts,
    getChromeFaviconUrl,
    getExtensionFaviconUrl,
    getGstaticFaviconUrl,
    getNewtabStrictFaviconReason,
    getPersistedFaviconEntry,
    isBlockedLocalFaviconUrl,
    isNewtabEnhancedFaviconFetchEnabled,
    isOwnExtensionUrl,
    logFaviconDecision,
    searchBox,
    setPersistedFaviconData,
    setPersistedFaviconUrl,
    shouldAvoidDirectFaviconForHost,
    shouldBlockFaviconForHost
  } = deps.shell;
  const { bookmarkParts } = deps.bookmarkStore;
  const { updateFeedbackLanguageStrings } = deps.navigation;
  const { syncBookmarkTopbarSurfaceAppearance } = deps.bookmarkMenus;
  const {
    buildThemeFromAccent,
    defaultTheme,
    getHostFromUrl,
    getThemeForMode,
    getThemeSource,
    getThemeSourcePriority,
    isFaviconProxyUrl,
    isLowConfidenceTheme,
    modeActions,
    normalizeAccentRgb,
    normalizeThemeConfidence,
    searchMode,
    searchQuery,
    searchResults,
    setResolvedThemeForHost,
    themeColorCache,
    themeHostCache
  } = deps.searchCore;
  const { recentPointer } = deps.recentCore;

  // The page's notices and feature hints, mounted by the parts that make them.
  const notices = new PageNoticeControllers();
  const {
    mediaQuery,
    resolveTheme,
    addMediaQueryChangeListener,
    removeMediaQueryChangeListener
  } = NEWTAB_SYSTEM_THEME.createSystemTheme(window);

  const {
    applyRecentCardTheme,
    applyBookmarkCardTheme,
    applyShortcutTileTheme,
    shouldDelayBookmarkHoverFromRecent
  } = NEWTAB_CARD_THEMES.createCardThemes({
    buildFallbackThemeForHost,
    defaultTheme,
    getThemeForMode,
    parseCssColor,
    defaultAccentColor,
    mixColor,
    rgbToCss,
    rgbToCssParts,
    rgbToCssAlpha,
    normalizeAccentRgb,
    getReadableTextColor,
    getThemeSource,
    normalizeThemeConfidence,
    isLowConfidenceTheme,
    recentPointer
  });

  const {
    getThemeScope,
    setThemeMode,
    setVisibleThemeMode,
    setThemeScope,
    followLanguage,
    refreshThemeAwareFavicons,
    scheduleThemeAwareFaviconRescue,
    applyThemeMode,
    getScopedThemeMode,
    getSelectedThemeMode,
    followTheme,
    syncSystemThemeMode
  } = NEWTAB_APPEARANCE_MODES.createAppearanceModes({
    faviconParts,
    bookmarkParts,
    appliedTheme,
    notices,
    searchBox,
    modeActions,
    searchResults,
    searchMode,
    searchQuery,
    syncBookmarkTopbarSurfaceAppearance,
    locale,
    settings,
    t,
    updateFeedbackLanguageStrings,
    resolveTheme,
    addMediaQueryChangeListener,
    mediaQuery,
    removeMediaQueryChangeListener
  });

  const {
    applyFaviconOpticalShift,
    applyFaviconOpticalAlignment,
    applyFallbackIcon,
    setFaviconSrcWithAnimation,
    attachFaviconData,
    preloadIcon,
    warmIconCache,
    attachFaviconWithFallbacks
  } = NEWTAB_PAGE_FAVICONS.createPageFavicons({
    isBlockedLocalFaviconUrl,
    setPersistedFaviconData,
    getPersistedFaviconEntry,
    setPersistedFaviconUrl,
    logFaviconDecision,
    faviconParts,
    getThemeSource,
    getExtensionFaviconUrl,
    getGstaticFaviconUrl,
    getChromeFaviconUrl,
    isOwnExtensionUrl,
    shouldBlockFaviconForHost,
    shouldAvoidDirectFaviconForHost,
    isNewtabEnhancedFaviconFetchEnabled,
    getNewtabStrictFaviconReason,
    getHostFromUrl,
    isFaviconProxyUrl,
    themeHostCache,
    themeColorCache,
    normalizeHost,
    getThemeSourcePriority,
    extractAverageColor,
    buildThemeFromAccent,
    setResolvedThemeForHost
  });

  return {
    applyBookmarkCardTheme,
    applyFallbackIcon,
    applyFaviconOpticalAlignment,
    applyFaviconOpticalShift,
    applyRecentCardTheme,
    applyShortcutTileTheme,
    applyThemeMode,
    attachFaviconData,
    attachFaviconWithFallbacks,
    followLanguage,
    followTheme,
    getScopedThemeMode,
    getSelectedThemeMode,
    getThemeScope,
    notices,
    preloadIcon,
    refreshThemeAwareFavicons,
    scheduleThemeAwareFaviconRescue,
    setFaviconSrcWithAnimation,
    setThemeMode,
    setThemeScope,
    setVisibleThemeMode,
    shouldDelayBookmarkHoverFromRecent,
    syncSystemThemeMode,
    warmIconCache
  };
}

type ThemePart = ReturnType<typeof createThemePart>;

export { createThemePart };
export type { ThemePart };
