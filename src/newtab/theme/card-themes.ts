// Accent colors for recent cards, bookmark cards and shortcut icons.
import type * as Color from '../../domain/color';
import type * as FaviconTheme from '../../shared/favicon/favicon-theme';
import type { ThemeVariant } from '../../shared/favicon/favicon-theme';
import type { BookmarkCardElement } from '../react/bookmarks';
import type { SiteThemeResolver } from './site-theme-resolver';
import type { ThemeRgb } from '../../domain/favicon/types';
import type { RecentPointer } from '../recent/recent-pointer';

// A theme as a card or tile holds it; parts may be missing.
type CardTheme = Partial<ThemeVariant> | null | undefined;

interface CardThemesDeps {
  buildFallbackThemeForHost: typeof FaviconTheme.buildFallbackThemeForHost;
  defaultTheme: ThemeVariant;
  getThemeForMode: SiteThemeResolver['getThemeForMode'];
  parseCssColor: typeof Color.parseCssColor;
  defaultAccentColor: ThemeRgb;
  mixColor: typeof Color.mixColor;
  rgbToCss: typeof Color.rgbToCss;
  rgbToCssParts: typeof Color.rgbToCssParts;
  rgbToCssAlpha: typeof Color.rgbToCssAlpha;
  normalizeAccentRgb: SiteThemeResolver['normalizeAccentRgb'];
  getReadableTextColor: typeof Color.getReadableTextColor;
  getThemeSource: SiteThemeResolver['getThemeSource'];
  normalizeThemeConfidence: SiteThemeResolver['normalizeThemeConfidence'];
  isLowConfidenceTheme: SiteThemeResolver['isLowConfidenceTheme'];
  scheduleWallpaperAdaptiveToneUpdate(): void;
  recentPointer: Pick<RecentPointer, 'wasInsideWithin'>;
}

function createCardThemes(deps: CardThemesDeps) {
  const {
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
    scheduleWallpaperAdaptiveToneUpdate,
    recentPointer
  } = deps;


  const BOOKMARK_HOVER_RECENT_TRANSFER_WINDOW_MS = 220;

  // The tinted colors of a card or tile from the site's accent.
  function getAccentRgb(theme: CardTheme, host: string): ThemeRgb {
    const fallbackTheme = theme || buildFallbackThemeForHost(host) || defaultTheme;
    const resolvedTheme = getThemeForMode(fallbackTheme);
    return resolvedTheme.accentRgb || parseCssColor(resolvedTheme.accent) || defaultAccentColor;
  }

  function getRecentCardColors(theme: CardTheme, host: string) {
    const accentRgb = getAccentRgb(theme, host);
    const isDark = document.body && document.body.getAttribute('data-theme') === 'dark';
    const accentEmphasis = mixColor(accentRgb, [0, 0, 0], isDark ? 0.1 : 0.18);
    const baseTarget = isDark ? [22, 22, 22] : [255, 255, 255];
    const base = mixColor(accentRgb, baseTarget, isDark ? 0.72 : 0.82);
    const border = mixColor(base, isDark ? [255, 255, 255] : [0, 0, 0], isDark ? 0.12 : 0.1);
    const innerTint = mixColor(accentRgb, [255, 255, 255], 0.82);
    return {
      base: rgbToCss(base),
      border: rgbToCss(border),
      innerTint: rgbToCssParts(innerTint),
      accent: rgbToCss(accentEmphasis),
      accentSoft: rgbToCssAlpha(accentRgb, isDark ? 0.14 : 0.12),
      accentBorder: rgbToCssAlpha(accentRgb, isDark ? 0.24 : 0.18)
    };
  }

  function applyRecentCardTheme(card: HTMLElement, theme: CardTheme, host: string): void {
    const colors = getRecentCardColors(theme, host);
    card.style.setProperty('--x-nt-recent-card-color', colors.base);
    card.style.setProperty('--x-nt-recent-card-border-color', colors.border);
    card.style.setProperty('--x-nt-recent-inner-tint-rgb', colors.innerTint);
    card.style.setProperty('--x-nt-recent-accent-color', colors.accent);
    card.style.setProperty('--x-nt-recent-accent-soft', colors.accentSoft);
    card.style.setProperty('--x-nt-recent-accent-border', colors.accentBorder);
  }

  function getBookmarkCardColors(theme: CardTheme, host: string) {
    const accentRgb = getAccentRgb(theme, host);
    const isDark = document.body && document.body.getAttribute('data-theme') === 'dark';
    const baseTarget = isDark ? [24, 24, 24] : [255, 255, 255];
    const base = mixColor(accentRgb, baseTarget, isDark ? 0.9 : 0.94);
    const border = mixColor(base, isDark ? [255, 255, 255] : [0, 0, 0], isDark ? 0.12 : 0.07);
    const icon = mixColor(accentRgb, baseTarget, isDark ? 0.92 : 0.96);
    const hover = mixColor(accentRgb, baseTarget, isDark ? 0.84 : 0.9);
    const shadow = isDark
      ? mixColor(accentRgb, [18, 26, 40], 0.62)
      : mixColor(accentRgb, [138, 146, 160], 0.46);
    return {
      base: rgbToCss(base),
      hover: rgbToCssAlpha(hover, isDark ? 0.78 : 0.86),
      border: rgbToCss(border),
      iconBg: rgbToCss(icon),
      shadowRgb: rgbToCssParts(shadow)
    };
  }

  function applyBookmarkCardTheme(card: BookmarkCardElement, theme: CardTheme, host: string): void {
    if (card._xNoThemeTint) {
      card.style.removeProperty('--x-nt-bookmark-card-color');
      card.style.removeProperty('--x-nt-bookmark-card-hover-color');
      card.style.removeProperty('--x-nt-bookmark-card-border-color');
      card.style.removeProperty('--x-nt-bookmark-icon-color');
      const isDark = document.body && document.body.getAttribute('data-theme') === 'dark';
      card.style.setProperty('--x-nt-bookmark-shadow-rgb', isDark ? '52, 96, 180' : '86, 138, 220');
      return;
    }
    const colors = getBookmarkCardColors(theme, host);
    card.style.setProperty('--x-nt-bookmark-card-color', colors.base);
    card.style.setProperty('--x-nt-bookmark-card-hover-color', colors.hover);
    card.style.setProperty('--x-nt-bookmark-card-border-color', colors.border);
    card.style.setProperty('--x-nt-bookmark-icon-color', colors.iconBg);
    card.style.setProperty('--x-nt-bookmark-shadow-rgb', colors.shadowRgb);
  }

  function getShortcutIconColors(theme: CardTheme, host: string) {
    const fallbackTheme = theme || buildFallbackThemeForHost(host) || defaultTheme;
    const resolvedTheme = getThemeForMode(fallbackTheme);
    const accentRgb = normalizeAccentRgb(resolvedTheme.accentRgb || parseCssColor(resolvedTheme.accent)) || defaultAccentColor;
    const isDark = document.body && document.body.getAttribute('data-theme') === 'dark';
    const baseTarget = isDark ? [22, 22, 22] : [255, 255, 255];
    const iconBgRgb = mixColor(accentRgb, baseTarget, isDark ? 0.72 : 0.82);
    return {
      iconBg: rgbToCss(iconBgRgb),
      iconColor: getReadableTextColor(iconBgRgb)
    };
  }

  function isShortcutThemeDefaultForWallpaper(theme: CardTheme): boolean {
    if (theme && theme._xIsCustomShortcutIcon) {
      return false;
    }
    const source = getThemeSource(theme);
    if (!theme || theme._xIsDefault || source === 'fallback') {
      return true;
    }
    if (source === 'favicon') {
      const accentRgb = normalizeAccentRgb(theme.accentRgb || parseCssColor(theme.accent));
      return theme._xThemeNeutral === true ||
        normalizeThemeConfidence(theme._xThemeConfidence, accentRgb) === 'neutral';
    }
    return isLowConfidenceTheme(theme);
  }

  function applyShortcutTileTheme(tile: HTMLElement, theme: CardTheme, host: string): void {
    const fallbackTheme = theme || buildFallbackThemeForHost(host) || defaultTheme;
    const isDefaultTheme = isShortcutThemeDefaultForWallpaper(fallbackTheme);
    const colors = getShortcutIconColors(theme, host);
    tile.setAttribute('data-shortcut-theme-default', isDefaultTheme ? 'true' : 'false');
    tile.setAttribute('data-shortcut-theme-source', getThemeSource(fallbackTheme));
    tile.style.removeProperty('--x-nt-shortcut-wallpaper-icon-bg');
    tile.style.removeProperty('--x-nt-shortcut-wallpaper-icon-color');
    tile.style.setProperty('--x-nt-shortcut-icon-bg', colors.iconBg);
    tile.style.setProperty('--x-nt-shortcut-icon-color', colors.iconColor);
    scheduleWallpaperAdaptiveToneUpdate();
  }

  function shouldDelayBookmarkHoverFromRecent(pointerType?: string): boolean {
    if (pointerType && pointerType !== 'mouse') {
      return false;
    }
    return recentPointer.wasInsideWithin(BOOKMARK_HOVER_RECENT_TRANSFER_WINDOW_MS);
  }

  return {
    applyRecentCardTheme,
    applyBookmarkCardTheme,
    applyShortcutTileTheme,
    shouldDelayBookmarkHoverFromRecent
  };
}

type CardThemes = ReturnType<typeof createCardThemes>;

export { createCardThemes };
export type { CardThemes, CardThemesDeps };
