// The panel's own theme: light or dark from the setting or the page,
// watching the page for theme changes, the font family, and the CSS
// variables the panel draws with.
import type { ThemeMode } from '../../domain/settings/appearance';
import { getHoverColors as getModeHoverColors, getThemeForMode as getThemeVariantForMode } from '../../shared/favicon/favicon-theme';
import type { HoverColors, ThemeLike, ThemeVariant } from '../../shared/favicon/favicon-theme';
import * as LumnoOverlayPageTheme from '../page-theme';
import type { PageTheme } from '../page-theme';
import type { OverlayPanelModel } from '../react/shell';
import { OVERLAY_FONT_FAMILY_CSS_VAR, overlayFontFallback, overlayFontFamily, overlayPageThemeAdaptationEnabled } from '../../domain/settings/overlay-panel';
import type { OverlaySettings } from '../overlay-settings';
import * as SETTINGS from '../../domain/settings';
import type { OverlayPanelElements } from './panel-elements';
import type { createSessionCleanupRegistry } from '../lifecycle';
import type { OverlayThemeMode } from './overlay-theme-mode';

type PageThemeObserver = ReturnType<typeof LumnoOverlayPageTheme.createPageThemeObserver>;

interface PanelThemeDeps {
  // Reads a CSS color as an [r, g, b] triple.
  parseCssColor(color: string): number[] | null;
  applyOverlayTheme(mode: ThemeMode): void;
  settings: Pick<OverlaySettings, 'get'>;
  overlayMediaQuery: MediaQueryList;
  defaultTheme: ThemeVariant;
  elements: Pick<OverlayPanelElements, 'overlay' | 'overlayPanelView'>;
  overlayThemeChoice: Pick<OverlayThemeMode, 'mode'>;
  overlaySessionCleanups: Pick<ReturnType<typeof createSessionCleanupRegistry>, 'add'>;
}

// The panel's colors in one theme.
interface OverlayThemeTokens {
  bg: string;
  // A stronger background for a dark panel over a light page.
  lightPageBg?: string;
  modeMenuBg: string;
  border: string;
  shadow: string;
  text: string;
  subtext: string;
  link: string;
  placeholder: string;
  hoverBg: string;
  neutralMarkBg: string;
  neutralMarkText: string;
  tagBg: string;
  tagText: string;
  bookmarkTagBg: string;
  bookmarkTagText: string;
  underline: string;
  dividerOpacity: string;
  dividerInset: string;
  blur: string;
  saturate: string;
}

function createPanelTheme(deps: PanelThemeDeps) {
  const {
    overlayThemeChoice,
    overlaySessionCleanups,
    elements,
    defaultTheme,
    overlayMediaQuery,
    settings,
    parseCssColor,
    applyOverlayTheme,
  } = deps;

  const overlayPageTheme = LumnoOverlayPageTheme;

  function getHighlightColors(theme: Partial<ThemeVariant> | null): { bg?: string; border?: string } {
    const resolvedTheme = getThemeForMode(theme);
    if (!resolvedTheme || !resolvedTheme._xIsBrand) {
      return {
        bg: 'var(--x-ov-hover-bg, #F3F4F6)',
        border: 'transparent'
      };
    }
    return {
      bg: resolvedTheme.highlightBg,
      border: resolvedTheme.highlightBorder
    };
  }
  const overlayThemeTokens: Record<PageTheme, OverlayThemeTokens> = {
    light: {
      bg: 'linear-gradient(135deg, rgba(255, 255, 255, 0.97) 0%, rgba(255, 255, 255, 0.95) 100%)',
      modeMenuBg: '#FFFFFF',
      border: 'var(--x-lumno-search-shell-border-light, rgba(0, 0, 0, 0.14))',
      shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.72), 0 1px 2px rgba(15, 23, 42, 0.06), 0 10px 24px -6px rgba(15, 23, 42, 0.12), 0 36px 84px -12px rgba(15, 23, 42, 0.22), 0 96px 220px -16px rgba(15, 23, 42, 0.3), 0 0 140px 8px rgba(15, 23, 42, 0.08)',
      text: '#111827',
      subtext: '#6B7280',
      link: '#2563EB',
      placeholder: '#9CA3AF',
      hoverBg: 'rgba(200, 208, 218, 0.45)',
      neutralMarkBg: '#E5E7EB',
      neutralMarkText: '#111827',
      tagBg: '#F3F4F6',
      tagText: '#667085',
      bookmarkTagBg: '#F3F4F6',
      bookmarkTagText: '#667085',
      underline: '#E5E7EB',
      dividerOpacity: '0.5',
      dividerInset: '24px',
      blur: '14px',
      saturate: '175%'
    },
    dark: {
      bg: 'rgba(20, 20, 20, 0.62)',
      lightPageBg: 'rgba(20, 20, 20, 0.82)',
      modeMenuBg: '#141414',
      border: 'var(--x-lumno-search-shell-border-dark, rgba(255, 255, 255, 0.16))',
      shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 1px 3px rgba(0, 0, 0, 0.32), 0 12px 26px -6px rgba(0, 0, 0, 0.4), 0 40px 92px -12px rgba(0, 0, 0, 0.55), 0 104px 236px -16px rgba(0, 0, 0, 0.66), 0 0 150px 10px rgba(0, 0, 0, 0.3)',
      text: '#E5E7EB',
      subtext: '#9CA3AF',
      link: '#D1D5DB',
      placeholder: '#9CA3AF',
      hoverBg: 'rgba(255, 255, 255, 0.08)',
      neutralMarkBg: 'rgba(148, 163, 184, 0.28)',
      neutralMarkText: '#F8FAFC',
      tagBg: 'rgba(255, 255, 255, 0.12)',
      tagText: '#E5E7EB',
      bookmarkTagBg: 'rgba(255, 255, 255, 0.12)',
      bookmarkTagText: '#E5E7EB',
      underline: 'rgba(255, 255, 255, 0.18)',
      dividerOpacity: '0.35',
      dividerInset: '24px',
      blur: '28px',
      saturate: '145%'
    }
  };
  function resolveOverlayTheme(mode: string, pageTheme: string | null): PageTheme {
    const systemTheme = overlayMediaQuery.matches ? 'dark' : 'light';
    return overlayPageTheme.resolveOverlayTheme({
      mode,
      pageTheme,
      pageThemeAdaptationEnabled: settings.get(overlayPageThemeAdaptationEnabled),
      systemTheme
    });
  }

  // Sampling hit-tests points across the viewport and reads their computed
  // styles, which forces a full style and layout pass when the page has
  // pending changes and costs hundreds of milliseconds on large pages. One
  // reading serves the session until the page signals a theme change.
  let pageThemeReading: { theme: PageTheme | null } | null = null;

  function detectPageTheme(): PageTheme | null {
    if (!pageThemeReading) {
      pageThemeReading = {
        theme: overlayPageTheme.detectPageTheme({
          document,
          window,
          parseThemeColorRgb: parseCssColor
        })
      };
    }
    return pageThemeReading.theme;
  }

  function invalidatePageTheme(): void {
    pageThemeReading = null;
  }

  function shouldObserveOverlayPageTheme(): boolean {
    return overlayPageTheme.shouldObservePageTheme({
      mode: overlayThemeChoice.mode,
      pageThemeAdaptationEnabled: settings.get(overlayPageThemeAdaptationEnabled),
      systemTheme: overlayMediaQuery.matches ? 'dark' : 'light'
    });
  }

  function syncOverlayPageThemeObservation(): boolean {
    return overlayPageTheme.syncPageThemeObservation({
      mode: overlayThemeChoice.mode,
      pageThemeAdaptationEnabled: settings.get(overlayPageThemeAdaptationEnabled),
      systemTheme: overlayMediaQuery.matches ? 'dark' : 'light',
      start: startOverlayPageThemeObserver,
      stop: stopOverlayPageThemeObserver
    });
  }

  // Follows the page's own theme while the overlay adapts to it.
  let pageThemeObserver: PageThemeObserver | null = null;

  function stopOverlayPageThemeObserver(): void {
    if (pageThemeObserver) {
      pageThemeObserver.stop();
    }
  }

  function startOverlayPageThemeObserver(): void {
    if (!shouldObserveOverlayPageTheme()) {
      return;
    }
    const observer = pageThemeObserver ||
      overlayPageTheme.createPageThemeObserver(window, (change) => {
        if (!elements.overlay || !elements.overlay.isConnected || !shouldObserveOverlayPageTheme()) {
          return;
        }
        if (change.pageChanged) {
          invalidatePageTheme();
        }
        applyOverlayTheme(overlayThemeChoice.mode);
      });
    if (!pageThemeObserver) {
      overlaySessionCleanups.add(stopOverlayPageThemeObserver);
    }
    pageThemeObserver = observer;
    observer.start();
  }

  // The scheme and colors last worked out; the font is added as it is drawn.
  let panelTheme: OverlayPanelModel = { theme: '', vars: {} };

  // The chosen families reach every text rule through the shared
  // --lumno-font-sans token, set on the panel. Without one the panel falls
  // back to the bundled stack its shadow-root stylesheet defines.
  function renderOverlayPanel(): void {
    const view = elements.overlayPanelView;
    if (!view) {
      return;
    }
    const fontFamily = SETTINGS.getOverlayFontFamilyCssValue(settings.get(overlayFontFamily), settings.get(overlayFontFallback));
    view.render({
      theme: panelTheme.theme,
      vars: fontFamily
        ? { ...panelTheme.vars, [OVERLAY_FONT_FAMILY_CSS_VAR]: fontFamily }
        : panelTheme.vars
    });
  }

  function applyOverlayFontFamily(): void {
    renderOverlayPanel();
  }

  function applyOverlayThemeVariables(mode: string): void {
    const pageTheme = detectPageTheme();
    const resolved = resolveOverlayTheme(mode, pageTheme);
    const tokens = overlayThemeTokens[resolved] || overlayThemeTokens.light;
    const shouldStrengthenDarkBackground = overlayPageTheme.shouldStrengthenDarkOverlayBackground({
      resolvedTheme: resolved,
      pageTheme
    });
    panelTheme = {
      theme: resolved,
      vars: {
        '--x-ov-bg': shouldStrengthenDarkBackground && tokens.lightPageBg ? tokens.lightPageBg : tokens.bg,
        '--x-ov-mode-menu-bg': tokens.modeMenuBg,
        '--x-ov-border': tokens.border,
        '--x-ov-shadow': tokens.shadow,
        '--x-ov-text': tokens.text,
        '--x-ov-subtext': tokens.subtext,
        '--x-ov-link': tokens.link,
        '--x-ov-placeholder': tokens.placeholder,
        '--x-ov-hover-bg': tokens.hoverBg,
        '--x-ov-neutral-mark-bg': tokens.neutralMarkBg,
        '--x-ov-neutral-mark-text': tokens.neutralMarkText,
        '--x-ov-tag-bg': tokens.tagBg,
        '--x-ov-tag-text': tokens.tagText,
        '--x-ov-bookmark-tag-bg': tokens.bookmarkTagBg,
        '--x-ov-bookmark-tag-text': tokens.bookmarkTagText,
        '--x-ov-blur': tokens.blur,
        '--x-ov-saturate': tokens.saturate,
        '--x-ext-input-text': tokens.text,
        '--x-ext-input-caret': tokens.link,
        '--x-ext-input-icon': tokens.subtext,
        '--x-ext-input-icon-hover-bg': tokens.hoverBg,
        '--x-ext-input-icon-hover': tokens.text,
        '--x-ext-input-underline': tokens.underline,
        '--x-ext-input-divider-inset': tokens.dividerInset,
        '--x-ext-input-divider-opacity': tokens.dividerOpacity
      }
    };
    renderOverlayPanel();
  }

  function isOverlayDarkMode(): boolean {
    const overlay = elements.overlay;
    return Boolean(overlay && overlay.getAttribute('data-theme') === 'dark');
  }

  // The theme as given in light mode, or its dark variant.
  function getThemeForMode<T extends ThemeLike>(theme: T | null): T | ThemeVariant {
    return getThemeVariantForMode(theme, {
      defaultTheme: defaultTheme,
      isDarkMode: isOverlayDarkMode
    });
  }

  function getHoverColors(theme: ThemeLike | null): HoverColors {
    return getModeHoverColors(theme, {
      defaultTheme: defaultTheme,
      isDarkMode: isOverlayDarkMode
    });
  }

  function getNeutralHoverActionColors(): { bg: string; border: string; text: string } {
    return isOverlayDarkMode()
      ? {
        bg: 'rgba(255, 255, 255, 0.10)',
        border: 'rgba(255, 255, 255, 0.18)',
        text: '#E5E7EB'
      }
      : {
        bg: 'rgba(200, 208, 218, 0.45)',
        border: 'rgba(148, 163, 184, 0.28)',
        text: '#4B5563'
      };
  }

  return {
    stopOverlayPageThemeObserver,
    getHighlightColors,
    detectPageTheme,
    invalidatePageTheme,
    syncOverlayPageThemeObservation,
    applyOverlayFontFamily,
    applyOverlayThemeVariables,
    isOverlayDarkMode,
    getThemeForMode,
    getHoverColors,
    getNeutralHoverActionColors
  };
}

export { createPanelTheme };
export type { PanelThemeDeps };
