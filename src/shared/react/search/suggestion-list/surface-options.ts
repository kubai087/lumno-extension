// Surface options: the class and CSS variable names that differ between New
// Tab and the overlay, and normalizing the options a surface passes in.
import { createStore } from '../../../state/store';
import { createColorScheme } from '../../../ui/color-scheme';
import type {
  ModifierState,
  QueryStore,
  NormalizedOptions,
  SuggestionSelection,
  SuggestionsViewOptions
} from './types';

export function createQueryStore(): QueryStore {
  let query = '';
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => query,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(nextQuery) {
      if (nextQuery === query) {
        return;
      }
      query = nextQuery;
      listeners.forEach((listener) => listener());
    }
  };
}

function noop(): void {}

const OVERLAY_CLASS_OVERRIDES: Record<string, string> = {
  'x-nt-suggestion-tag': 'x-ov-suggestion-source-tag',
  'x-nt-suggestion-action-tag': 'x-ov-action-tag',
  'x-nt-suggestion-action-tag__label': 'x-ov-action-tag__label',
  'x-nt-suggestion-action-button__label': 'x-ov-inline-label',
  'x-nt-suggestion-action-button__icon': 'x-ov-inline-icon',
  'x-nt-tab-switch-button':
    'x-ov-suggestion-action-button x-ov-suggestion-switch-button'
};

const OVERLAY_VARIABLE_OVERRIDES: Record<string, string> = {
  '--x-nt-suggestion-active-bg': '--x-ov-suggestion-row-bg',
  '--x-nt-suggestion-hover-bg': '--x-ov-suggestion-row-bg',
  '--x-nt-suggestion-tag-bg': '--x-ov-suggestion-source-tag-bg',
  '--x-nt-suggestion-tag-text': '--x-ov-suggestion-source-tag-text',
  '--x-nt-suggestion-tag-border': '--x-ov-suggestion-source-tag-border',
  '--x-nt-suggestion-icon-color': 'color'
};

export function surfaceClass(
  options: NormalizedOptions,
  value: string
): string {
  if (options.surface !== 'overlay') {
    return value;
  }
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((token) =>
      OVERLAY_CLASS_OVERRIDES[token] ||
      token.replace(/^x-nt-/, 'x-ov-')
    )
    .join(' ');
}

function surfaceVariable(
  options: NormalizedOptions,
  value: string
): string {
  if (options.surface !== 'overlay') {
    return value;
  }
  return (
    OVERLAY_VARIABLE_OVERRIDES[value] ||
    value.replace(/^--x-nt-/, '--x-ov-')
  );
}

export function surfaceCssValue(
  options: NormalizedOptions,
  value: unknown
): string {
  const text = String(value || '');
  if (options.surface !== 'overlay') {
    return text;
  }
  return Object.entries(OVERLAY_VARIABLE_OVERRIDES).reduce(
    (next, [newtabName, overlayName]) =>
      next.replaceAll(newtabName, overlayName),
    text.replaceAll('--x-nt-', '--x-ov-')
  );
}

export function setSurfaceStyle(
  options: NormalizedOptions,
  target: HTMLElement,
  property: string,
  value: unknown
): void {
  target.style.setProperty(
    surfaceVariable(options, property),
    surfaceCssValue(options, value)
  );
}

function fallbackFormatMessage(
  key: string,
  fallback: string,
  values: Record<string, string> = {}
): string {
  let text = fallback || key || '';
  Object.entries(values).forEach(([name, value]) => {
    text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), value);
  });
  return text;
}

const BROWSER_NEWTAB_URLS = [
  'chrome://newtab',
  'chrome://new-tab-page',
  'edge://newtab',
  'brave://newtab',
  'vivaldi://newtab',
  'opera://startpage',
  'about:newtab',
  'about:home'
];

function isDefaultBrowserNewtabUrl(url: string): boolean {
  const normalized = String(url || '')
    .trim()
    .toLowerCase()
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');
  return BROWSER_NEWTAB_URLS.includes(normalized);
}

function isDefaultBrowserInternalUrl(url: string): boolean {
  return /^(chrome|edge|brave|vivaldi|opera):\/\/|^about:/i.test(String(url || '').trim());
}

// A positive whole limit read now from `read`, or `fallback`.
function readCurrentLimit(read: (() => unknown) | undefined, fallback: number): number {
  if (typeof read !== 'function') {
    return fallback;
  }
  try {
    const current = Number(read());
    return Number.isFinite(current) && current > 0 ? Math.max(1, Math.trunc(current)) : fallback;
  } catch {
    return fallback;
  }
}

function readPositive(value: unknown, fallback: number): number {
  return Number(value) > 0 ? Number(value) : fallback;
}

type OptionGroup<K extends keyof NormalizedOptions> = Pick<NormalizedOptions, K>;

// How many open tabs show, and how many render at first and per batch.
function readOpenTabLimits(raw: SuggestionsViewOptions): OptionGroup<'openTabSuggestionLimit' | 'openTabInitialRenderLimit' |
  'getOpenTabInitialRenderLimit' | 'openTabRenderBatchSize' | 'getOpenTabRenderBatchSize'> {
  const openTabSuggestionLimit = readPositive(raw.openTabSuggestionLimit, 3);
  const openTabInitialRenderLimit = readPositive(raw.openTabInitialRenderLimit, openTabSuggestionLimit);
  const openTabRenderBatchSize = readPositive(raw.openTabRenderBatchSize, openTabSuggestionLimit);
  return {
    openTabSuggestionLimit,
    openTabInitialRenderLimit,
    getOpenTabInitialRenderLimit: () => readCurrentLimit(raw.getOpenTabInitialRenderLimit, openTabInitialRenderLimit),
    openTabRenderBatchSize,
    getOpenTabRenderBatchSize: () => readCurrentLimit(raw.getOpenTabRenderBatchSize, openTabRenderBatchSize)
  };
}

// The text the rows show: messages, display forms of URLs and titles, and
// the labels of search actions.
function readTextOptions(raw: SuggestionsViewOptions): OptionGroup<'t' | 'formatMessage' | 'sanitizeDisplayText' |
  'formatTabRankDebugText' | 'isTabRankScoreDebugEnabled' | 'getHostFromUrl' | 'getUrlDisplay' | 'isSimpleModeEnabled' |
  'getSearchActionLabel' | 'getSiteSearchDisplayName' | 'isAiSiteSearchProvider'> {
  return {
    t: raw.t || ((_key, fallback) => fallback || _key || ''),
    formatMessage: raw.formatMessage || fallbackFormatMessage,
    sanitizeDisplayText: raw.sanitizeDisplayText || ((value) => String(value || '')),
    formatTabRankDebugText: raw.formatTabRankDebugText || (() => ''),
    isTabRankScoreDebugEnabled: raw.isTabRankScoreDebugEnabled || (() => false),
    getHostFromUrl: raw.getHostFromUrl || (() => ''),
    getUrlDisplay: raw.getUrlDisplay || ((url) => String(url || '')),
    isSimpleModeEnabled: raw.isSimpleModeEnabled || (() => false),
    getSearchActionLabel: raw.getSearchActionLabel || (() => 'Search'),
    getSiteSearchDisplayName: raw.getSiteSearchDisplayName || ((provider) => String(provider.name || provider.key || '')),
    isAiSiteSearchProvider: raw.isAiSiteSearchProvider ||
      ((provider) => String(provider.action || '').trim() === 'openAndSubmit')
  };
}

function readDefaultHoverColors(surface: SuggestionsViewOptions['surface']): { bg: string; border: string } {
  return {
    bg: surface === 'overlay' ? 'var(--x-ov-hover-bg, #F3F4F6)' : 'var(--x-nt-hover-bg, #F3F4F6)',
    border: 'transparent'
  };
}

// The themes rows take from their sites, and the colors read from them.
function readThemeOptions(raw: SuggestionsViewOptions): OptionGroup<'getThemeHostForSuggestion' | 'getImmediateThemeForSuggestion' |
  'getThemeForSuggestion' | 'shouldUseUrlFallbackThemeForSuggestion' | 'getThemeForMode' | 'getHoverColors' |
  'getHighlightColors' | 'getNeutralHoverActionColors' | 'applyThemeVariables' | 'applyMarkVariables' |
  'defaultTheme' | 'urlHighlightTheme'> {
  const defaultTheme = raw.defaultTheme || {};
  const getHoverColors = raw.getHoverColors || (() => readDefaultHoverColors(raw.surface));
  return {
    getThemeHostForSuggestion: raw.getThemeHostForSuggestion || (() => ''),
    getImmediateThemeForSuggestion: raw.getImmediateThemeForSuggestion || (() => defaultTheme),
    getThemeForSuggestion: raw.getThemeForSuggestion || (() => Promise.resolve(defaultTheme)),
    shouldUseUrlFallbackThemeForSuggestion: raw.shouldUseUrlFallbackThemeForSuggestion || (() => false),
    getThemeForMode: raw.getThemeForMode || ((theme) => theme || defaultTheme),
    getHoverColors,
    getHighlightColors: raw.getHighlightColors || getHoverColors,
    getNeutralHoverActionColors: raw.getNeutralHoverActionColors || (() => ({
      bg: 'rgba(200, 208, 218, 0.45)',
      border: 'rgba(148, 163, 184, 0.28)',
      text: '#4B5563'
    })),
    applyThemeVariables: raw.applyThemeVariables || noop,
    applyMarkVariables: raw.applyMarkVariables || noop,
    defaultTheme,
    urlHighlightTheme: raw.urlHighlightTheme || defaultTheme
  };
}

// The accents search rows take before their site's theme is known.
function readAccentOptions(raw: SuggestionsViewOptions): OptionGroup<'getDefaultSearchEngineThemeUrl' | 'getBrandAccentForUrl' |
  'buildThemeFromAccent'> {
  return {
    getDefaultSearchEngineThemeUrl: raw.getDefaultSearchEngineThemeUrl || (() => ''),
    getBrandAccentForUrl: raw.getBrandAccentForUrl || (() => null),
    buildThemeFromAccent: raw.buildThemeFromAccent || (() => null)
  };
}

// Where row icons come from, and the browser pages that have their own.
function readFaviconOptions(raw: SuggestionsViewOptions): OptionGroup<'shouldBlockFaviconForHost' | 'isLocalNetworkHost' |
  'getChromeFaviconUrl' | 'applyFaviconOpticalAlignment' | 'attachFaviconWithFallbacks' | 'getPageFaviconRenderCandidates' |
  'preloadIcon' | 'isBrowserNewtabUrl' | 'isBrowserInternalUrl'> {
  const isBrowserInternalUrl = raw.isBrowserInternalUrl || isDefaultBrowserInternalUrl;
  const shouldBlockFaviconForHost = raw.shouldBlockFaviconForHost || (() => false);
  const getChromeFaviconUrl = raw.getChromeFaviconUrl || (() => '');
  const getBrowserPageFaviconUrl = raw.getBrowserPageFaviconUrl || (() => '');
  return {
    shouldBlockFaviconForHost,
    isLocalNetworkHost: raw.isLocalNetworkHost || shouldBlockFaviconForHost,
    getChromeFaviconUrl,
    applyFaviconOpticalAlignment: raw.applyFaviconOpticalAlignment || noop,
    attachFaviconWithFallbacks: raw.attachFaviconWithFallbacks || noop,
    getPageFaviconRenderCandidates: raw.getPageFaviconRenderCandidates || ((url, explicitUrl, options) => {
      const browserPageUrl = getBrowserPageFaviconUrl(url);
      const chromeUrl = getChromeFaviconUrl(url);
      const internal = isBrowserInternalUrl(url);
      const primaryUrl = internal ? browserPageUrl || explicitUrl || chromeUrl : browserPageUrl || explicitUrl;
      return {
        primaryUrl,
        browserUrl: (internal || options?.includeChromeFallback) && chromeUrl !== primaryUrl ? chromeUrl : ''
      };
    }),
    preloadIcon: raw.preloadIcon || noop,
    isBrowserNewtabUrl: raw.isBrowserNewtabUrl || isDefaultBrowserNewtabUrl,
    isBrowserInternalUrl
  };
}

// A selection of the list's own, for a surface that does not keep one.
function createLocalSelection(): SuggestionSelection {
  const store = createStore({ selectedIndex: -1 });
  return { store, select: (selectedIndex) => store.setState({ selectedIndex }) };
}

// What the surface does when a row is chosen, selected or acted on.
function readCallbacks(raw: SuggestionsViewOptions): OptionGroup<'setSuggestionsVisible' | 'selection' | 'modifiers' | 'colorScheme' |
  'onSwitchToTab' | 'onActivateSuggestion' | 'onDeleteHistory' | 'onCopyUrl' | 'shouldSwitchMatchedTabSuggestion' |
  'showTopActionTooltip' | 'hideTopActionTooltip' | 'bindCursorTooltip'> {
  return {
    setSuggestionsVisible: raw.setSuggestionsVisible || noop,
    selection: raw.selection || createLocalSelection(),
    modifiers: raw.modifiers || { store: createStore<ModifierState>({ openInCurrentTab: false, openSwitchInNewTab: false, openInBackgroundTab: false }) },
    colorScheme: raw.colorScheme || createColorScheme(),
    onSwitchToTab: raw.onSwitchToTab || noop,
    onActivateSuggestion: raw.onActivateSuggestion || noop,
    onDeleteHistory: raw.onDeleteHistory || noop,
    onCopyUrl: raw.onCopyUrl || noop,
    shouldSwitchMatchedTabSuggestion: raw.shouldSwitchMatchedTabSuggestion || (() => false),
    showTopActionTooltip: raw.showTopActionTooltip || noop,
    hideTopActionTooltip: raw.hideTopActionTooltip || noop,
    bindCursorTooltip: raw.bindCursorTooltip
  };
}

export function normalizeOptions(raw: SuggestionsViewOptions): NormalizedOptions | null {
  const documentRef = raw.document || globalThis.document;
  if (!documentRef || !raw.container || !raw.portals) {
    return null;
  }
  return {
    surface: raw.surface === 'overlay' ? 'overlay' : 'newtab',
    document: documentRef,
    container: raw.container,
    portals: raw.portals,
    items: Array.isArray(raw.items) ? raw.items : [],
    actionModel: raw.actionModel || {},
    ...readTextOptions(raw),
    ...readThemeOptions(raw),
    ...readAccentOptions(raw),
    ...readFaviconOptions(raw),
    ...readCallbacks(raw),
    ...readOpenTabLimits(raw),
    enterAction: String(raw.enterAction || 'go'),
    autoHighlightFirstTab: Boolean(raw.autoHighlightFirstTab)
  };
}
