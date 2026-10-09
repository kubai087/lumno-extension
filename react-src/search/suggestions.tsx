import {
  memo,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject
} from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { isElementTextTruncated } from '../shared/text-overflow';

type ThemeValue = Record<string, unknown> | null;
type Translate = (key: string, fallback: string) => string;
export type SuggestionsSurface = 'newtab' | 'overlay';
export type SuggestionUpdateKind =
  | 'highlight'
  | 'content'
  | 'append'
  | 'structure';

export interface Suggestion {
  type?: string;
  title?: string;
  url?: string;
  favicon?: string;
  path?: string;
  commandText?: string;
  reasons?: unknown[];
  isTopSite?: boolean;
  provider?: Record<string, unknown> | null;
  searchQuery?: string;
  [key: string]: unknown;
}

export interface OpenTabSuggestion {
  id?: number;
  title?: string;
  url?: string;
  favIconUrl?: string;
  [key: string]: unknown;
}

interface SuggestionActionTagModel {
  action: string;
  keyLabel?: string;
}

interface SuggestionActionModelResult {
  actionTags: SuggestionActionTagModel[];
  visitButtonAction: string;
  alwaysHideVisitButton: boolean;
  hasActionTags: boolean;
  hasSwitchAction: boolean;
}

interface SuggestionActionModel {
  createSearchActionModel?: (
    options: Record<string, unknown>
  ) => Partial<SuggestionActionModelResult> | null;
  getModifierAdjustedAction?: (
    action: string,
    modifiers: {
      openInCurrentTab: boolean;
      openSwitchInNewTab: boolean;
      openInBackgroundTab: boolean;
    }
  ) => string;
  shouldShowVisitButton?: (
    model: SuggestionActionModelResult,
    active: boolean
  ) => boolean;
  getSuggestionPresentationFingerprint?: (
    suggestion: Suggestion,
    options?: { includeDebugReasons?: boolean }
  ) => string;
  getSuggestionStructureIdentity?: (suggestion: Suggestion) => string;
}

interface CursorTooltipOptions {
  maxWidth: number;
  shouldShow: (target: HTMLElement) => boolean;
  deferHideVisibility: boolean;
  preserveVisibleOnTargetSwitch: boolean;
  renderContent?: (
    element: HTMLElement,
    text: string
  ) => HTMLElement;
}

interface FaviconCandidates {
  primaryUrl?: string;
  browserUrl?: string;
  allowRemoteImage?: boolean;
}

interface ModeTheme {
  accent?: string;
  buttonText?: string;
  buttonBg?: string;
  buttonBorder?: string;
  tagBg?: string;
  tagText?: string;
  tagBorder?: string;
  [key: string]: unknown;
}

export interface SuggestionActionTagElement extends HTMLSpanElement {
  _xActionLabel?: HTMLSpanElement | null;
  _xAction?: string;
  _xSuggestion?: Suggestion;
  _xDefaultBg?: string;
  _xDefaultText?: string;
  _xDefaultBorder?: string;
}

interface SuggestionUtilityActionElements {
  slot: HTMLDivElement;
  button: HTMLButtonElement;
}

interface SuggestionIconSlotElement extends HTMLSpanElement {
  _xIsFavicon?: boolean;
}

export interface SuggestionElement extends HTMLDivElement {
  _xIsSearchSuggestion?: boolean;
  _xIsAutocompleteTop?: boolean;
  _xTheme?: ThemeValue;
  _xThemeHost?: string;
  _xIconWrap?: HTMLSpanElement | null;
  _xIconIsFavicon?: boolean;
  _xDirectIconWrap?: HTMLSpanElement | null;
  _xTitle?: HTMLSpanElement | null;
  _xCommandLabel?: HTMLSpanElement | null;
  _xSwitchButton?: HTMLButtonElement | null;
  _xHistoryTag?: SuggestionActionTagElement | null;
  _xBookmarkTag?: SuggestionActionTagElement | null;
  _xTopSiteTag?: SuggestionActionTagElement | null;
  _xOpenTabTag?: SuggestionActionTagElement | null;
  _xTagContainer?: HTMLDivElement | null;
  _xActionModel?: SuggestionActionModelResult;
  _xHasActionTags?: boolean;
  _xVisitButton?: HTMLButtonElement | null;
  _xVisitButtonLabel?: HTMLSpanElement | null;
  _xVisitButtonAction?: string;
  _xActionTags?: SuggestionActionTagElement[];
  _xSuggestion?: Suggestion;
  _xAlwaysHideVisitButton?: boolean;
  _xHasSwitchAction?: boolean;
  _xHistoryDeleteButton?: HTMLButtonElement | null;
  _xUtilityActions?: SuggestionUtilityActionElements[];
  _xIsHovering?: boolean;
  _xTabId?: number | null;
  _xSimpleMode?: boolean;
}

export interface SuggestionsRenderPayload {
  suggestions?: Suggestion[];
  query?: string;
  updateKind?: SuggestionUpdateKind;
  canAppend?: boolean;
  startIndex?: number;
  primaryHighlightIndex?: number;
  primarySuggestion?: Suggestion | null;
  primaryHighlightReason?: string;
  onlyKeywordSuggestions?: boolean;
  mergedProvider?: Record<string, unknown> | null;
  emptyMessage?: string;
}

export interface SuggestionsViewOptions {
  surface?: SuggestionsSurface;
  document?: Document;
  container?: HTMLElement | null;
  items?: SuggestionElement[];
  t?: Translate;
  formatMessage?: (
    key: string,
    fallback: string,
    values?: Record<string, string>
  ) => string;
  actionModel?: SuggestionActionModel;
  getRiSvg?: (name: string, sizeClass?: string) => string;
  sanitizeDisplayText?: (value: unknown) => string;
  formatTabRankDebugText?: (tab: OpenTabSuggestion) => string;
  isTabRankScoreDebugEnabled?: () => boolean;
  shouldBlockFaviconForHost?: (host: string) => boolean;
  isLocalNetworkHost?: (host: string) => boolean;
  getChromeFaviconUrl?: (url: string) => string;
  getHostFromUrl?: (url: string) => string;
  getUrlDisplay?: (url: string) => string;
  isSimpleModeEnabled?: () => boolean;
  getThemeHostForSuggestion?: (suggestion: Suggestion) => string;
  getImmediateThemeForSuggestion?: (
    suggestion: Suggestion
  ) => ThemeValue;
  getThemeForSuggestion?: (
    suggestion: Suggestion
  ) => Promise<ThemeValue>;
  shouldUseUrlFallbackThemeForSuggestion?: (
    suggestion: Suggestion,
    theme: ThemeValue
  ) => boolean;
  getThemeForMode?: (theme: ThemeValue) => ModeTheme;
  getHoverColors?: (
    theme: ThemeValue
  ) => { bg?: string; border?: string; text?: string };
  getHighlightColors?: (
    theme: ThemeValue
  ) => { bg?: string; border?: string };
  getNeutralHoverActionColors?: () => {
    bg?: string;
    border?: string;
    text?: string;
  };
  applyThemeVariables?: (
    target: SuggestionElement,
    theme: ThemeValue
  ) => void;
  applyMarkVariables?: (
    target: SuggestionElement,
    theme: ThemeValue,
    active: boolean
  ) => void;
  applyFaviconOpticalAlignment?: (image: HTMLImageElement) => void;
  applyFaviconOpticalShift?: (image: HTMLImageElement) => void;
  setFaviconSrcWithAnimation?: (
    image: HTMLImageElement,
    source: string
  ) => boolean;
  applyFallbackIcon?: (image: HTMLImageElement) => void;
  attachFaviconWithFallbacks?: (
    image: HTMLImageElement,
    url: string,
    host: string,
    candidates: FaviconCandidates
  ) => void;
  getBrowserPageFaviconUrl?: (url: string) => string;
  getPageFaviconRenderCandidates?: (
    url: string,
    explicitUrl: string,
    options?: { includeChromeFallback?: boolean; allowRemoteImage?: boolean }
  ) => FaviconCandidates;
  reportMissingIcon?: (...args: unknown[]) => void;
  preloadIcon?: (favicon: string, url: string) => void;
  setSuggestionsVisible?: (visible: boolean) => void;
  onSetSelectedIndex?: (index: number) => void;
  getSelectedIndex?: () => number;
  onSwitchToTab?: (
    tab: OpenTabSuggestion,
    event: MouseEvent
  ) => void;
  onActivateSuggestion?: (
    suggestion: Suggestion,
    query: string,
    event: MouseEvent,
    index: number,
    item: SuggestionElement
  ) => void;
  onDeleteHistory?: (
    suggestion: Suggestion,
    query: string
  ) => void;
  onCopyUrl?: (url: string) => boolean | Promise<boolean> | void;
  shouldSwitchMatchedTabSuggestion?: (
    suggestion: Suggestion,
    index: number
  ) => boolean;
  showTopActionTooltip?: (
    target: HTMLElement,
    text: string
  ) => void;
  hideTopActionTooltip?: () => void;
  bindCursorTooltip?: (
    target: HTMLElement,
    getText: () => string,
    options: CursorTooltipOptions
  ) => unknown;
  getSearchActionLabel?: () => string;
  getSiteSearchDisplayName?: (
    provider: Record<string, unknown>
  ) => string;
  isAiSiteSearchProvider?: (
    provider: Record<string, unknown>
  ) => boolean;
  getDefaultSearchEngineThemeUrl?: () => string;
  getBrandAccentForUrl?: (url: string) => unknown;
  buildThemeFromAccent?: (
    accent: unknown,
    kind: string
  ) => ThemeValue;
  isBrowserNewtabUrl?: (url: string) => boolean;
  isBrowserInternalUrl?: (url: string) => boolean;
  defaultTheme?: ThemeValue;
  urlHighlightTheme?: ThemeValue;
  openTabSuggestionLimit?: number;
  openTabInitialRenderLimit?: number;
  getOpenTabInitialRenderLimit?: () => number;
  openTabRenderBatchSize?: number;
  getOpenTabRenderBatchSize?: () => number;
  enterAction?: string;
  autoHighlightFirstTab?: boolean;
}

export interface SuggestionsViewController {
  render(payload?: SuggestionsRenderPayload): void;
  renderTabs(tabList?: OpenTabSuggestion[]): void;
  updateSelection(selectedIndex?: number): void;
  setOpenInCurrentTabModifierActive(active: boolean): void;
  setOpenSwitchInNewTabModifierActive(active: boolean): void;
  setOpenInBackgroundTabModifierActive(active: boolean): void;
  clear(): void;
  destroy(): void;
  getAutoHighlightIndex(): number;
  markAutocompleteTop(primaryHighlightIndex: number): void;
  getItems(): SuggestionElement[];
}

interface NormalizedOptions {
  surface: SuggestionsSurface;
  document: Document;
  container: HTMLElement;
  items: SuggestionElement[];
  t: Translate;
  formatMessage: NonNullable<SuggestionsViewOptions['formatMessage']>;
  actionModel: SuggestionActionModel;
  getRiSvg: NonNullable<SuggestionsViewOptions['getRiSvg']>;
  sanitizeDisplayText: NonNullable<
    SuggestionsViewOptions['sanitizeDisplayText']
  >;
  formatTabRankDebugText: NonNullable<
    SuggestionsViewOptions['formatTabRankDebugText']
  >;
  isTabRankScoreDebugEnabled: NonNullable<
    SuggestionsViewOptions['isTabRankScoreDebugEnabled']
  >;
  shouldBlockFaviconForHost: NonNullable<
    SuggestionsViewOptions['shouldBlockFaviconForHost']
  >;
  isLocalNetworkHost: NonNullable<
    SuggestionsViewOptions['isLocalNetworkHost']
  >;
  getChromeFaviconUrl: NonNullable<
    SuggestionsViewOptions['getChromeFaviconUrl']
  >;
  getHostFromUrl: NonNullable<SuggestionsViewOptions['getHostFromUrl']>;
  getUrlDisplay: NonNullable<SuggestionsViewOptions['getUrlDisplay']>;
  isSimpleModeEnabled: NonNullable<
    SuggestionsViewOptions['isSimpleModeEnabled']
  >;
  getThemeHostForSuggestion: NonNullable<
    SuggestionsViewOptions['getThemeHostForSuggestion']
  >;
  getImmediateThemeForSuggestion: NonNullable<
    SuggestionsViewOptions['getImmediateThemeForSuggestion']
  >;
  getThemeForSuggestion: NonNullable<
    SuggestionsViewOptions['getThemeForSuggestion']
  >;
  shouldUseUrlFallbackThemeForSuggestion: NonNullable<
    SuggestionsViewOptions['shouldUseUrlFallbackThemeForSuggestion']
  >;
  getThemeForMode: NonNullable<SuggestionsViewOptions['getThemeForMode']>;
  getHoverColors: NonNullable<SuggestionsViewOptions['getHoverColors']>;
  getHighlightColors: NonNullable<
    SuggestionsViewOptions['getHighlightColors']
  >;
  getNeutralHoverActionColors: NonNullable<
    SuggestionsViewOptions['getNeutralHoverActionColors']
  >;
  applyThemeVariables: NonNullable<
    SuggestionsViewOptions['applyThemeVariables']
  >;
  applyMarkVariables: NonNullable<
    SuggestionsViewOptions['applyMarkVariables']
  >;
  applyFaviconOpticalAlignment: NonNullable<
    SuggestionsViewOptions['applyFaviconOpticalAlignment']
  >;
  attachFaviconWithFallbacks: NonNullable<
    SuggestionsViewOptions['attachFaviconWithFallbacks']
  >;
  getPageFaviconRenderCandidates: NonNullable<
    SuggestionsViewOptions['getPageFaviconRenderCandidates']
  >;
  preloadIcon: NonNullable<SuggestionsViewOptions['preloadIcon']>;
  setSuggestionsVisible: NonNullable<
    SuggestionsViewOptions['setSuggestionsVisible']
  >;
  onSetSelectedIndex: NonNullable<
    SuggestionsViewOptions['onSetSelectedIndex']
  >;
  getSelectedIndex: NonNullable<
    SuggestionsViewOptions['getSelectedIndex']
  >;
  onSwitchToTab: NonNullable<SuggestionsViewOptions['onSwitchToTab']>;
  onActivateSuggestion: NonNullable<
    SuggestionsViewOptions['onActivateSuggestion']
  >;
  onDeleteHistory: NonNullable<
    SuggestionsViewOptions['onDeleteHistory']
  >;
  onCopyUrl: NonNullable<SuggestionsViewOptions['onCopyUrl']>;
  shouldSwitchMatchedTabSuggestion: NonNullable<
    SuggestionsViewOptions['shouldSwitchMatchedTabSuggestion']
  >;
  showTopActionTooltip: NonNullable<
    SuggestionsViewOptions['showTopActionTooltip']
  >;
  hideTopActionTooltip: NonNullable<
    SuggestionsViewOptions['hideTopActionTooltip']
  >;
  bindCursorTooltip: SuggestionsViewOptions['bindCursorTooltip'];
  getSearchActionLabel: NonNullable<
    SuggestionsViewOptions['getSearchActionLabel']
  >;
  getSiteSearchDisplayName: NonNullable<
    SuggestionsViewOptions['getSiteSearchDisplayName']
  >;
  isAiSiteSearchProvider: NonNullable<
    SuggestionsViewOptions['isAiSiteSearchProvider']
  >;
  getDefaultSearchEngineThemeUrl: NonNullable<
    SuggestionsViewOptions['getDefaultSearchEngineThemeUrl']
  >;
  getBrandAccentForUrl: NonNullable<
    SuggestionsViewOptions['getBrandAccentForUrl']
  >;
  buildThemeFromAccent: NonNullable<
    SuggestionsViewOptions['buildThemeFromAccent']
  >;
  isBrowserNewtabUrl: NonNullable<
    SuggestionsViewOptions['isBrowserNewtabUrl']
  >;
  isBrowserInternalUrl: NonNullable<
    SuggestionsViewOptions['isBrowserInternalUrl']
  >;
  defaultTheme: ThemeValue;
  urlHighlightTheme: ThemeValue;
  openTabSuggestionLimit: number;
  openTabInitialRenderLimit: number;
  getOpenTabInitialRenderLimit: () => number;
  openTabRenderBatchSize: number;
  getOpenTabRenderBatchSize: () => number;
  enterAction: string;
  autoHighlightFirstTab: boolean;
}

interface ModifierState {
  openInCurrentTab: boolean;
  openSwitchInNewTab: boolean;
  openInBackgroundTab: boolean;
}

interface SuggestionsRuntime {
  options: NormalizedOptions;
  modifiers: ModifierState;
  queryStore: QueryStore;
  updateSelection: (selectedIndex?: number) => void;
}

interface QueryStore {
  getSnapshot: () => string;
  subscribe: (listener: () => void) => () => void;
  set: (query: string) => void;
}

interface SuggestionValueRef {
  current: Suggestion;
}

function createQueryStore(): QueryStore {
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

function surfaceClass(
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

function surfaceCssValue(
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

function setSurfaceStyle(
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

function normalizeOptions(
  raw: SuggestionsViewOptions
): NormalizedOptions | null {
  const documentRef = raw.document || globalThis.document;
  if (!documentRef || !raw.container) {
    return null;
  }
  const defaultTheme = raw.defaultTheme || {};
  const isBrowserNewtabUrl = raw.isBrowserNewtabUrl || ((url) => {
    const normalized = String(url || '')
      .trim()
      .toLowerCase()
      .replace(/[?#].*$/, '')
      .replace(/\/+$/, '');
    return [
      'chrome://newtab',
      'chrome://new-tab-page',
      'edge://newtab',
      'brave://newtab',
      'vivaldi://newtab',
      'opera://startpage',
      'about:newtab',
      'about:home'
    ].includes(normalized);
  });
  const isBrowserInternalUrl = raw.isBrowserInternalUrl || ((url) =>
    /^(chrome|edge|brave|vivaldi|opera):\/\/|^about:/i.test(
      String(url || '').trim()
    ));
  const shouldBlockFaviconForHost =
    raw.shouldBlockFaviconForHost || (() => false);
  const getChromeFaviconUrl = raw.getChromeFaviconUrl || (() => '');
  const getBrowserPageFaviconUrl =
    raw.getBrowserPageFaviconUrl || (() => '');
  const getHoverColors =
    raw.getHoverColors ||
    (() => ({
      bg: raw.surface === 'overlay'
        ? 'var(--x-ov-hover-bg, #F3F4F6)'
        : 'var(--x-nt-hover-bg, #F3F4F6)',
      border: 'transparent'
    }));
  const openTabSuggestionLimit =
    Number(raw.openTabSuggestionLimit) > 0
      ? Number(raw.openTabSuggestionLimit)
      : 3;
  const openTabInitialRenderLimit =
    Number(raw.openTabInitialRenderLimit) > 0
      ? Number(raw.openTabInitialRenderLimit)
      : openTabSuggestionLimit;
  const getOpenTabInitialRenderLimit = (): number => {
    if (typeof raw.getOpenTabInitialRenderLimit !== 'function') {
      return openTabInitialRenderLimit;
    }
    try {
      const currentLimit = Number(raw.getOpenTabInitialRenderLimit());
      return Number.isFinite(currentLimit) && currentLimit > 0
        ? Math.max(1, Math.trunc(currentLimit))
        : openTabInitialRenderLimit;
    } catch {
      return openTabInitialRenderLimit;
    }
  };
  const openTabRenderBatchSize =
    Number(raw.openTabRenderBatchSize) > 0
      ? Number(raw.openTabRenderBatchSize)
      : openTabSuggestionLimit;
  const getOpenTabRenderBatchSize = (): number => {
    if (typeof raw.getOpenTabRenderBatchSize !== 'function') {
      return openTabRenderBatchSize;
    }
    try {
      const currentBatchSize = Number(raw.getOpenTabRenderBatchSize());
      return Number.isFinite(currentBatchSize) && currentBatchSize > 0
        ? Math.max(1, Math.trunc(currentBatchSize))
        : openTabRenderBatchSize;
    } catch {
      return openTabRenderBatchSize;
    }
  };
  return {
    surface: raw.surface === 'overlay' ? 'overlay' : 'newtab',
    document: documentRef,
    container: raw.container,
    items: Array.isArray(raw.items) ? raw.items : [],
    t: raw.t || ((_key, fallback) => fallback || _key || ''),
    formatMessage: raw.formatMessage || fallbackFormatMessage,
    actionModel: raw.actionModel || {},
    getRiSvg: raw.getRiSvg || (() => ''),
    sanitizeDisplayText:
      raw.sanitizeDisplayText || ((value) => String(value || '')),
    formatTabRankDebugText: raw.formatTabRankDebugText || (() => ''),
    isTabRankScoreDebugEnabled:
      raw.isTabRankScoreDebugEnabled || (() => false),
    shouldBlockFaviconForHost,
    isLocalNetworkHost:
      raw.isLocalNetworkHost || shouldBlockFaviconForHost,
    getChromeFaviconUrl,
    getHostFromUrl: raw.getHostFromUrl || (() => ''),
    getUrlDisplay: raw.getUrlDisplay || ((url) => String(url || '')),
    isSimpleModeEnabled: raw.isSimpleModeEnabled || (() => false),
    getThemeHostForSuggestion:
      raw.getThemeHostForSuggestion || (() => ''),
    getImmediateThemeForSuggestion:
      raw.getImmediateThemeForSuggestion || (() => defaultTheme),
    getThemeForSuggestion:
      raw.getThemeForSuggestion ||
      (() => Promise.resolve(defaultTheme)),
    shouldUseUrlFallbackThemeForSuggestion:
      raw.shouldUseUrlFallbackThemeForSuggestion || (() => false),
    getThemeForMode:
      raw.getThemeForMode || ((theme) => (theme || defaultTheme) as ModeTheme),
    getHoverColors,
    getHighlightColors: raw.getHighlightColors || getHoverColors,
    getNeutralHoverActionColors:
      raw.getNeutralHoverActionColors ||
      (() => ({
        bg: 'rgba(200, 208, 218, 0.45)',
        border: 'rgba(148, 163, 184, 0.28)',
        text: '#4B5563'
      })),
    applyThemeVariables: raw.applyThemeVariables || noop,
    applyMarkVariables: raw.applyMarkVariables || noop,
    applyFaviconOpticalAlignment:
      raw.applyFaviconOpticalAlignment || noop,
    attachFaviconWithFallbacks:
      raw.attachFaviconWithFallbacks || noop,
    getPageFaviconRenderCandidates:
      raw.getPageFaviconRenderCandidates ||
      ((url, explicitUrl, options) => {
        const browserPageUrl = getBrowserPageFaviconUrl(url);
        const chromeUrl = getChromeFaviconUrl(url);
        const internal = isBrowserInternalUrl(url);
        const primaryUrl = internal
          ? browserPageUrl || explicitUrl || chromeUrl
          : browserPageUrl || explicitUrl;
        return {
          primaryUrl,
          browserUrl:
            (internal || options?.includeChromeFallback) &&
            chromeUrl !== primaryUrl
              ? chromeUrl
              : ''
        };
      }),
    preloadIcon: raw.preloadIcon || noop,
    setSuggestionsVisible: raw.setSuggestionsVisible || noop,
    onSetSelectedIndex: raw.onSetSelectedIndex || noop,
    getSelectedIndex: raw.getSelectedIndex || (() => -1),
    onSwitchToTab: raw.onSwitchToTab || noop,
    onActivateSuggestion: raw.onActivateSuggestion || noop,
    onDeleteHistory: raw.onDeleteHistory || noop,
    onCopyUrl: raw.onCopyUrl || noop,
    shouldSwitchMatchedTabSuggestion:
      raw.shouldSwitchMatchedTabSuggestion || (() => false),
    showTopActionTooltip: raw.showTopActionTooltip || noop,
    hideTopActionTooltip: raw.hideTopActionTooltip || noop,
    bindCursorTooltip: raw.bindCursorTooltip,
    getSearchActionLabel: raw.getSearchActionLabel || (() => 'Search'),
    getSiteSearchDisplayName:
      raw.getSiteSearchDisplayName ||
      ((provider) => String(provider.name || provider.key || '')),
    isAiSiteSearchProvider:
      raw.isAiSiteSearchProvider ||
      ((provider) => String(provider.action || '').trim() === 'openAndSubmit'),
    getDefaultSearchEngineThemeUrl:
      raw.getDefaultSearchEngineThemeUrl || (() => ''),
    getBrandAccentForUrl: raw.getBrandAccentForUrl || (() => null),
    buildThemeFromAccent:
      raw.buildThemeFromAccent || ((theme) => (theme || defaultTheme) as ThemeValue),
    isBrowserNewtabUrl,
    isBrowserInternalUrl,
    defaultTheme,
    urlHighlightTheme: raw.urlHighlightTheme || defaultTheme,
    openTabSuggestionLimit,
    openTabInitialRenderLimit,
    getOpenTabInitialRenderLimit,
    openTabRenderBatchSize,
    getOpenTabRenderBatchSize,
    enterAction: String(raw.enterAction || 'go'),
    autoHighlightFirstTab: Boolean(raw.autoHighlightFirstTab)
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getHighlightNeedles(query: string): string[] {
  const fullQuery = String(query || '').trim();
  if (!fullQuery) {
    return [];
  }
  const needles = [
    fullQuery,
    ...fullQuery.split(/[^a-z0-9\u4e00-\u9fff]+/i)
  ];
  const seen = new Set<string>();
  return needles
    .map((needle) => needle.trim())
    .filter((needle) => {
      const key = needle.toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((left, right) => right.length - left.length);
}

function getHighlightedParts(
  options: NormalizedOptions,
  text: unknown,
  query: string
): Array<{ text: string; highlighted: boolean }> {
  const safeText = options.sanitizeDisplayText(text);
  const needles = getHighlightNeedles(query);
  if (needles.length === 0) {
    return [{ text: safeText, highlighted: false }];
  }
  const needleSet = new Set(needles.map((needle) => needle.toLowerCase()));
  const parts = safeText.split(
    new RegExp(`(${needles.map(escapeRegExp).join('|')})`, 'gi')
  );
  if (parts.length === 1) {
    return [{ text: safeText, highlighted: false }];
  }
  return parts.filter(Boolean).map((part) => ({
    text: part,
    highlighted: needleSet.has(part.toLowerCase())
  }));
}

function HighlightedText({
  options,
  text,
  queryStore,
  simpleMode
}: {
  options: NormalizedOptions;
  text: unknown;
  queryStore: QueryStore;
  simpleMode: boolean;
}) {
  const query = useSyncExternalStore(
    queryStore.subscribe,
    queryStore.getSnapshot,
    queryStore.getSnapshot
  );
  if (simpleMode) {
    return options.sanitizeDisplayText(text);
  }
  return getHighlightedParts(options, text, query).map((part, index) =>
    part.highlighted ? (
      <mark
        key={`highlight:${index}`}
        className={surfaceClass(options, 'x-nt-suggestion-mark')}
      >
        {part.text}
      </mark>
    ) : (
      part.text
    )
  );
}

function isOverflowing(target: HTMLElement): boolean {
  return isElementTextTruncated(target);
}

function bindTextTooltip(
  options: NormalizedOptions,
  target: HTMLElement | null,
  text: unknown
): void {
  const safeText = options.sanitizeDisplayText(text);
  if (!options.bindCursorTooltip || !target || !safeText) {
    return;
  }
  options.bindCursorTooltip(target, () => safeText, {
    maxWidth: 520,
    shouldShow: isOverflowing,
    deferHideVisibility: true,
    preserveVisibleOnTargetSwitch: true
  });
}

function getSuggestionUrlLineText(
  options: NormalizedOptions,
  suggestion: Suggestion
): string {
  const rawUrl = String(suggestion.url || '').trim();
  if (!rawUrl) {
    return '';
  }
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return options.getUrlDisplay(rawUrl);
    }
    const hostname = parsed.hostname.replace(/^www\./i, '');
    const host = parsed.port ? `${hostname}:${parsed.port}` : hostname;
    let pathname = parsed.pathname || '/';
    try {
      pathname = decodeURI(pathname);
    } catch {
      // Keep encoded paths when they cannot be decoded safely.
    }
    const displayPath = pathname === '/'
      ? ''
      : (pathname.replace(/\/+$/, '') || '');
    return `${host}${displayPath}`;
  } catch {
    return options.getUrlDisplay(rawUrl);
  }
}

function isLocalUrlSuggestion(
  options: NormalizedOptions,
  suggestion: Suggestion
): boolean {
  const url = String(suggestion.url || '');
  if (!url) {
    return false;
  }
  try {
    if (new URL(url).protocol.toLowerCase() === 'file:') {
      return true;
    }
  } catch {
    // Continue with the host-based check for partially typed URLs.
  }
  const host = options.getHostFromUrl(url);
  return Boolean(
    host &&
    (options.isLocalNetworkHost(host) ||
      options.shouldBlockFaviconForHost(host))
  );
}

function resolveTheme(
  options: NormalizedOptions,
  suggestion: Suggestion,
  theme: ThemeValue
): ThemeValue {
  const nextTheme = theme || options.defaultTheme;
  return options.shouldUseUrlFallbackThemeForSuggestion(
    suggestion,
    nextTheme
  )
    ? options.urlHighlightTheme
    : nextTheme;
}

function getModifierAction(
  runtime: SuggestionsRuntime,
  action: string
): string {
  const { actionModel } = runtime.options;
  if (actionModel.getModifierAdjustedAction) {
    return actionModel.getModifierAdjustedAction(
      action,
      runtime.modifiers
    );
  }
  if (
    runtime.modifiers.openSwitchInNewTab &&
    action === 'switch'
  ) {
    return runtime.modifiers.openInBackgroundTab &&
      !runtime.modifiers.openInCurrentTab
      ? 'openBackgroundTab'
      : 'openNewTab';
  }
  if (
    runtime.modifiers.openInBackgroundTab &&
    !runtime.modifiers.openInCurrentTab &&
    ['openNewTab', 'go', 'switch'].includes(action)
  ) {
    return 'openBackgroundTab';
  }
  return runtime.modifiers.openInCurrentTab && action === 'openNewTab'
    ? 'go'
    : action;
}

function getActionLabel(
  runtime: SuggestionsRuntime,
  action: string,
  suggestion: Suggestion
): string {
  const options = runtime.options;
  if (action === 'search') {
    const provider = suggestion.provider;
    if (provider && options.isAiSiteSearchProvider(provider)) {
      const site = options.getSiteSearchDisplayName(provider);
      return options.formatMessage(
        'action_open_ai_web',
        '打开 {site} 网页版',
        { site }
      );
    }
    return options.t('action_search', '搜索');
  }
  const labels: Record<string, [string, string]> = {
    switch: ['action_switch', '切换'],
    open: ['action_open', '打开'],
    openBackgroundTab: [
      'action_open_background_new_tab',
      '在后台新开'
    ],
    openNewTab: ['action_open_new_tab', '新开'],
    go: ['action_go_current_tab', '前往'],
    commandNewTab: ['command_newtab', '新建标签页'],
    commandOpenTabs: ['command_tabs_action', '搜索标签页'],
    commandCopyUrl: ['command_copy_action', '复制链接'],
    commandDocumentPip: ['document_pip_command_action', '开始剪裁']
  };
  if (action === 'commandSettings') {
    return options.formatMessage(
      'command_settings',
      '打开设置',
      { name: 'Lumno' }
    );
  }
  const entry = labels[action] || labels.openNewTab;
  return options.t(entry[0], entry[1]);
}

function createActionModel(
  options: NormalizedOptions,
  input: Record<string, unknown>
): SuggestionActionModelResult {
  const model =
    options.actionModel.createSearchActionModel?.(input) || {};
  const tags = Array.isArray(model.actionTags)
    ? model.actionTags.filter(
        (tag): tag is SuggestionActionTagModel =>
          Boolean(tag && typeof tag.action === 'string')
      )
    : [];
  return {
    actionTags: tags,
    visitButtonAction: String(
      model.visitButtonAction || 'openNewTab'
    ),
    alwaysHideVisitButton: Boolean(model.alwaysHideVisitButton),
    hasActionTags:
      typeof model.hasActionTags === 'boolean'
        ? model.hasActionTags
        : tags.length > 0,
    hasSwitchAction: Boolean(model.hasSwitchAction)
  };
}

function setIconEmphasis(
  item: SuggestionElement,
  active: boolean
): void {
  if (!item._xIconWrap || item._xIconIsFavicon) {
    return;
  }
  item._xIconWrap.setAttribute(
    'data-emphasis',
    active ? 'true' : 'false'
  );
}

function setPalette(
  options: NormalizedOptions,
  button: HTMLElement,
  text?: unknown,
  bg?: unknown,
  border?: unknown
): void {
  setSurfaceStyle(
    options,
    button,
    '--x-nt-suggestion-action-button-text',
    text || 'var(--x-nt-subtext, #9CA3AF)'
  );
  setSurfaceStyle(
    options,
    button,
    '--x-nt-suggestion-action-button-bg',
    bg || 'transparent'
  );
  setSurfaceStyle(
    options,
    button,
    '--x-nt-suggestion-action-button-border',
    border || 'transparent'
  );
}

function applyTagStyle(
  options: NormalizedOptions,
  tag: SuggestionActionTagElement | null | undefined,
  theme: ModeTheme,
  active: boolean,
  textOnlyTheme = false,
  themedText = ''
): void {
  if (!tag) {
    return;
  }
  setSurfaceStyle(
    options,
    tag,
    '--x-nt-suggestion-tag-bg',
    (
      active
        ? textOnlyTheme ? 'transparent' : theme.tagBg || ''
        : tag._xDefaultBg || 'var(--x-nt-tag-bg, #F3F4F6)'
    )
  );
  setSurfaceStyle(
    options,
    tag,
    '--x-nt-suggestion-tag-text',
    (
      active
        ? textOnlyTheme
          ? themedText || theme.accent || theme.tagText || ''
          : theme.tagText || ''
        : tag._xDefaultText || 'var(--x-nt-tag-text, #667085)'
    )
  );
  setSurfaceStyle(
    options,
    tag,
    '--x-nt-suggestion-tag-border',
    (
      active
        ? textOnlyTheme ? 'transparent' : theme.tagBorder || ''
        : tag._xDefaultBorder || 'transparent'
    )
  );
}

function applySearchActionStyles(
  runtime: SuggestionsRuntime,
  item: SuggestionElement,
  themeValue: ThemeValue,
  active: boolean,
  hovering: boolean
): void {
  const { options } = runtime;
  const theme = options.getThemeForMode(themeValue);
  const themed = active || (
    hovering && Boolean(themeValue?._xIsBrand)
  );
  const themedSourceTagText = active
    ? theme.accent || theme.tagText || ''
    : themed
      ? options.getHoverColors(themeValue).text ||
        theme.accent ||
        theme.tagText ||
        ''
      : '';
  item.setAttribute('data-active', active ? 'true' : 'false');
  item.setAttribute(
    'data-has-action-tags',
    item._xHasActionTags ? 'true' : 'false'
  );
  options.applyMarkVariables(
    item,
    themed ? themeValue : options.defaultTheme,
    active
  );
  if (!themed) {
    setSurfaceStyle(
      options,
      item,
      '--x-ext-mark-bg',
      'var(--x-nt-neutral-mark-bg, #E5E7EB)'
    );
    setSurfaceStyle(
      options,
      item,
      '--x-ext-mark-text',
      'var(--x-nt-neutral-mark-text, #111827)'
    );
  }
  if (item._xVisitButton && item._xActionModel) {
    const visible = options.actionModel.shouldShowVisitButton
      ? options.actionModel.shouldShowVisitButton(
          item._xActionModel,
          active
        )
      : Boolean(
          !item._xAlwaysHideVisitButton &&
          !(active && item._xHasActionTags)
        );
    item._xVisitButton.setAttribute(
      'data-visible',
      visible ? 'true' : 'false'
    );
    if (themed) {
      setPalette(
        options,
        item._xVisitButton,
        theme.buttonText,
        item._xSimpleMode ? theme.buttonBg : 'transparent',
        item._xSimpleMode ? theme.buttonBorder : 'transparent'
      );
    } else {
      setPalette(options, item._xVisitButton);
    }
  }
  applyTagStyle(
    options,
    item._xHistoryTag,
    theme,
    themed,
    true,
    themedSourceTagText
  );
  applyTagStyle(
    options,
    item._xBookmarkTag,
    theme,
    themed,
    true,
    themedSourceTagText
  );
  applyTagStyle(
    options,
    item._xTopSiteTag,
    theme,
    themed,
    true,
    themedSourceTagText
  );
  applyTagStyle(options, item._xOpenTabTag, theme, themed);
  const showSourceTags = !item._xSimpleMode && !item._xHasSwitchAction;
  [
    item._xHistoryTag,
    item._xBookmarkTag,
    item._xTopSiteTag
  ].forEach((tag) => {
    tag?.setAttribute(
      'data-visible',
      showSourceTags ? 'true' : 'false'
    );
  });
  item._xOpenTabTag?.setAttribute(
    'data-visible',
    !item._xSimpleMode && item._xHasSwitchAction ? 'true' : 'false'
  );
  item._xTagContainer?.setAttribute(
    'data-visible',
    active && item._xHasActionTags ? 'true' : 'false'
  );
}

function applyUtilityActionStyles(
  options: NormalizedOptions,
  item: SuggestionElement,
  theme: ThemeValue,
  themed: boolean
): void {
  const visible = Boolean(item._xIsHovering);
  const simpleMode = Boolean(item._xSimpleMode);
  const useTheme = visible && themed && !simpleMode;
  const neutralHover = simpleMode
    ? options.getNeutralHoverActionColors()
    : null;
  item._xUtilityActions?.forEach(({ slot, button }) => {
    slot.setAttribute('data-visible', visible ? 'true' : 'false');
    button.setAttribute('data-visible', visible ? 'true' : 'false');
    setSurfaceStyle(
      options,
      button,
      '--x-nt-suggestion-utility-color',
      useTheme
        ? theme?.buttonText || ''
        : surfaceCssValue(
            options,
            'var(--x-nt-subtext, #6B7280)'
          )
    );
    setSurfaceStyle(
      options,
      button,
      '--x-nt-suggestion-utility-bg',
      'transparent'
    );
    setSurfaceStyle(
      options,
      button,
      '--x-nt-suggestion-utility-border',
      'transparent'
    );
    if (neutralHover) {
      setSurfaceStyle(
        options,
        button,
        '--x-nt-suggestion-utility-hover-bg',
        neutralHover.bg || ''
      );
      setSurfaceStyle(
        options,
        button,
        '--x-nt-suggestion-utility-hover-border',
        neutralHover.border || ''
      );
      setSurfaceStyle(
        options,
        button,
        '--x-nt-suggestion-utility-hover-color',
        neutralHover.text || ''
      );
    }
  });
}

function updateSelectionForRuntime(
  runtime: SuggestionsRuntime,
  selectedIndex?: number
): void {
  const resolvedIndex = Number.isInteger(selectedIndex)
    ? Number(selectedIndex)
    : -1;
  const { options } = runtime;
  options.items.forEach((item, index) => {
    const selected = index === resolvedIndex;
    const autoHighlighted = Boolean(
      resolvedIndex === -1 && item._xIsAutocompleteTop
    );
    const highlighted = selected || autoHighlighted;
    const hovering = Boolean(item._xIsHovering);
    const theme = item._xTheme || options.defaultTheme;
    const themed = highlighted || (
      hovering && Boolean(theme?._xIsBrand)
    );
    const simpleMode = Boolean(item._xSimpleMode);
    const hoverColors = !simpleMode && hovering && theme?._xIsBrand
      ? options.getHoverColors(theme)
      : null;
    if (highlighted) {
      item.setAttribute('data-row-state', 'active');
      if (options.surface === 'overlay' || simpleMode) {
        const highlight = simpleMode
          ? {
              bg: options.surface === 'overlay'
                ? 'var(--x-ov-hover-bg, #F3F4F6)'
                : 'var(--x-nt-hover-bg, #F3F4F6)'
            }
          : options.getHighlightColors(theme);
        setSurfaceStyle(
          options,
          item,
          '--x-nt-suggestion-active-bg',
          highlight.bg || 'transparent'
        );
      }
    } else {
      item.removeAttribute('data-row-state');
      if (options.surface === 'overlay') {
        setSurfaceStyle(
          options,
          item,
          '--x-nt-suggestion-active-bg',
          hovering
            ? hoverColors?.bg || 'var(--x-ov-hover-bg, #F3F4F6)'
            : 'transparent'
        );
      } else if (hovering) {
        setSurfaceStyle(
          options,
          item,
          '--x-nt-suggestion-hover-bg',
          hoverColors?.bg || 'var(--x-nt-hover-bg, #F3F4F6)'
        );
      } else {
        setSurfaceStyle(
          options,
          item,
          '--x-nt-suggestion-hover-bg',
          ''
        );
      }
    }
    if (item._xTitle && options.surface === 'overlay') {
      item._xTitle.style.setProperty(
        '--x-ov-suggestion-title-weight',
        highlighted ? '600' : '400'
      );
    }
    setIconEmphasis(
      item,
      Boolean(highlighted || hovering)
    );
    if (item._xIsSearchSuggestion) {
      applySearchActionStyles(
        runtime,
        item,
        theme,
        highlighted,
        hovering
      );
      if (item._xDirectIconWrap) {
        const modeTheme = options.getThemeForMode(theme);
        setSurfaceStyle(
          options,
          item._xDirectIconWrap,
          '--x-nt-suggestion-icon-color',
          (
            themed && theme?._xIsBrand
              ? modeTheme.accent || ''
              : 'var(--x-nt-subtext, #6B7280)'
          )
        );
      }
    } else {
      if (!simpleMode && selected && theme?._xIsBrand) {
        const hover = options.getHoverColors(theme);
        setSurfaceStyle(
          options,
          item,
          '--x-nt-suggestion-active-bg',
          hover.bg || ''
        );
      }
      if (options.surface === 'overlay') {
        const active = highlighted;
        item._xTagContainer?.setAttribute(
          'data-visible',
          active && item._xHasActionTags ? 'true' : 'false'
        );
        if (item._xSwitchButton) {
          item._xSwitchButton.setAttribute(
            'data-visible',
            active && item._xHasActionTags ? 'false' : 'true'
          );
          setPalette(
            options,
            item._xSwitchButton,
            active
              ? 'var(--x-ov-text, #1F2937)'
              : 'var(--x-ov-subtext, #9CA3AF)'
          );
        }
      }
    }
    applyUtilityActionStyles(
      options,
      item,
      theme,
      themed
    );
  });
}

function syncModifierLabels(runtime: SuggestionsRuntime): void {
  runtime.options.items.forEach((item) => {
    if (!item._xSuggestion) {
      return;
    }
    if (
      item._xVisitButtonLabel &&
      item._xVisitButtonAction
    ) {
      item._xVisitButtonLabel.textContent = getActionLabel(
        runtime,
        getModifierAction(runtime, item._xVisitButtonAction),
        item._xSuggestion
      );
      item._xVisitButton?.setAttribute(
        'aria-label',
        item._xVisitButtonLabel.textContent || ''
      );
    }
    item._xActionTags?.forEach((tag) => {
      if (!tag._xActionLabel || !tag._xAction) {
        return;
      }
      tag._xActionLabel.textContent = getActionLabel(
        runtime,
        getModifierAction(runtime, tag._xAction),
        item._xSuggestion as Suggestion
      );
    });
  });
}

function getBrowserFallbackIcon(
  options: NormalizedOptions,
  url: string
): string {
  if (options.isBrowserNewtabUrl(url)) {
    return 'ri-link';
  }
  return options.isBrowserInternalUrl(url) ? 'ri-link' : '';
}

function getFaviconCandidates(
  options: NormalizedOptions,
  url: string,
  favicon: string,
  host: string,
  allowRemoteImage = false
): FaviconCandidates {
  return {
    ...options.getPageFaviconRenderCandidates(url, favicon, {
      allowRemoteImage,
      includeChromeFallback:
        Boolean(url && !/^https?:\/\//i.test(url)) ||
        Boolean(host && options.isLocalNetworkHost(host))
    }),
    allowRemoteImage
  };
}

interface IconSpec {
  kind: 'favicon' | 'inline';
  iconName?: string;
  tone?: string;
  src?: string;
  attach?: boolean;
  url?: string;
  host?: string;
  favicon?: string;
  objectFitContain?: boolean;
  fallbackIconName?: string;
  allowRemoteImage?: boolean;
}

function getSuggestionIconSpec(
  options: NormalizedOptions,
  suggestion: Suggestion
): IconSpec {
  const type = suggestion.type || '';
  const url = String(suggestion.url || '');
  const favicon = String(suggestion.favicon || '');
  const host = url ? options.getHostFromUrl(url) : '';
  if (type === 'directUrl') {
    return {
      kind: 'inline',
      iconName: 'ri-link'
    };
  }
  if (type === 'browserPage') {
    const useBrowserFavicon =
      type === 'browserPage' &&
      options.isBrowserInternalUrl(url);
    if (favicon || useBrowserFavicon) {
      return {
        kind: 'favicon',
        attach: true,
        url,
        host,
        favicon,
        objectFitContain: true,
        fallbackIconName: getBrowserFallbackIcon(options, url)
      };
    }
    return {
      kind: 'inline',
      iconName: 'ri-window-2-line'
    };
  }
  const commandIcons: Record<string, string> = {
    commandNewTab: 'ri-add-line',
    commandSettings: 'ri-settings-3-line',
    commandDocumentPip: 'ri-scissors-cut-line'
  };
  if (commandIcons[type]) {
    return {
      kind: 'inline',
      iconName: commandIcons[type],
      tone: 'subtext'
    };
  }
  if ((type === 'modeSwitch' || type === 'zenSwitch') && favicon) {
    return {
      kind: 'favicon',
      src: favicon,
      fallbackIconName: 'ri-link'
    };
  }
  if (type === 'newtab' || type === 'googleSuggest') {
    return {
      kind: 'inline',
      iconName: 'ri-search-line',
      tone: 'subtext'
    };
  }
  if (
    favicon &&
    ['siteSearch', 'inlineSiteSearch', 'siteSearchPrompt'].includes(
      type
    )
  ) {
    return {
      kind: 'favicon',
      attach: true,
      url,
      host,
      favicon,
      allowRemoteImage: true,
      objectFitContain: true
    };
  }
  if (favicon) {
    if (host && options.shouldBlockFaviconForHost(host)) {
      return { kind: 'inline', iconName: 'ri-link' };
    }
    return {
      kind: 'favicon',
      attach: true,
      url: url || favicon,
      host,
      favicon,
      objectFitContain: true
    };
  }
  return {
    kind: 'inline',
    iconName:
      host && options.shouldBlockFaviconForHost(host)
        ? 'ri-link'
        : 'ri-search-line',
    tone: 'subtext'
  };
}

function InlineIcon({
  options,
  name,
  tone
}: {
  options: NormalizedOptions;
  name: string;
  tone?: string;
}) {
  return (
    <span
      className={surfaceClass(
        options,
        'x-nt-suggestion-inline-icon'
      )}
      data-tone={tone || undefined}
      dangerouslySetInnerHTML={{
        __html: options.getRiSvg(name, 'ri-size-16')
      }}
    />
  );
}

function SuggestionIcon({
  spec,
  index,
  options,
  iconSlotRef
}: {
  spec: IconSpec;
  index: number;
  options: NormalizedOptions;
  iconSlotRef: React.RefObject<HTMLSpanElement | null>;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  const isFavicon = spec.kind === 'favicon' && !failed;

  useLayoutEffect(() => {
    const slot =
      iconSlotRef.current as SuggestionIconSlotElement | null;
    if (!slot) {
      return;
    }
    const handleFallback = (): void => {
      setFailed(true);
    };
    const handleRetry = (): void => {
      setFailed(false);
    };
    slot.addEventListener(
      'lumno-favicon-fallback',
      handleFallback
    );
    slot.addEventListener('lumno-favicon-retry', handleRetry);
    return () => {
      slot.removeEventListener(
        'lumno-favicon-fallback',
        handleFallback
      );
      slot.removeEventListener(
        'lumno-favicon-retry',
        handleRetry
      );
    };
  }, [iconSlotRef]);

  useLayoutEffect(() => {
    const image = imageRef.current;
    const slot =
      iconSlotRef.current as SuggestionIconSlotElement | null;
    if (slot) {
      slot._xIsFavicon = isFavicon;
    }
    if (!image || !isFavicon) {
      return;
    }
    options.applyFaviconOpticalAlignment(image);
    if (spec.attach) {
      options.attachFaviconWithFallbacks(
        image,
        spec.url || spec.favicon || '',
        spec.host || '',
        getFaviconCandidates(
          options,
          spec.url || '',
          spec.favicon || '',
          spec.host || '',
          spec.allowRemoteImage === true
        )
      );
    }
  }, [
    isFavicon,
    options,
    spec.attach,
    spec.allowRemoteImage,
    spec.favicon,
    spec.host,
    spec.objectFitContain,
    spec.url
  ]);

  return (
    <span
      ref={iconSlotRef}
      className={surfaceClass(
        options,
        'x-nt-suggestion-icon-slot'
      )}
      data-favicon={isFavicon ? 'true' : 'false'}
      data-favicon-failed={failed ? 'true' : undefined}
    >
      {isFavicon ? (
        <img
          ref={imageRef}
          data-x-nt-suggestion-icon={
            options.surface === 'newtab' ? '1' : undefined
          }
          data-x-ov-suggestion-icon={
            options.surface === 'overlay' ? '1' : undefined
          }
          className={surfaceClass(
            options,
            'x-nt-suggestion-favicon'
          )}
          decoding="async"
          loading="eager"
          referrerPolicy="no-referrer"
          fetchPriority={index < 4 ? 'high' : undefined}
          data-object-fit={
            spec.objectFitContain ? 'contain' : undefined
          }
          data-fallback-icon-name={
            spec.fallbackIconName || undefined
          }
          src={spec.src}
          onError={
            spec.src && !spec.attach
              ? () => setFailed(true)
              : undefined
          }
        />
      ) : (
        <InlineIcon
          options={options}
          name={spec.fallbackIconName || spec.iconName || 'ri-link'}
          tone={spec.tone || (failed ? 'subtext' : undefined)}
        />
      )}
      {index < 10 ? (
        <span
          className={surfaceClass(
            options,
            'x-nt-suggestion-number-shortcut'
          )}
          aria-hidden="true"
        >
          {index}
        </span>
      ) : null}
    </span>
  );
}

function isTopSite(suggestion: Suggestion): boolean {
  return Boolean(
    suggestion.type === 'topSite' || suggestion.isTopSite
  );
}

function canDeleteHistory(suggestion: Suggestion): boolean {
  return Boolean(
    suggestion.url &&
    (suggestion.type === 'history' || isTopSite(suggestion))
  );
}

function SuggestionUtilityAction({
  options,
  itemRef,
  slotRef,
  buttonRef,
  leading = false,
  tooltip,
  iconName,
  onActivate
}: {
  options: NormalizedOptions;
  itemRef: RefObject<SuggestionElement | null>;
  slotRef: RefObject<HTMLDivElement | null>;
  buttonRef: RefObject<HTMLButtonElement | null>;
  leading?: boolean;
  tooltip: string;
  iconName: string;
  onActivate: () => void;
}) {
  const showTooltip = (): void => {
    if (buttonRef.current) {
      options.showTopActionTooltip(buttonRef.current, tooltip);
    }
  };

  const applyHover = (): void => {
    const item = itemRef.current;
    const button = buttonRef.current;
    if (!item || !button) {
      return;
    }
    const itemIndex = options.items.indexOf(item);
    const selectedIndex = options.getSelectedIndex();
    const theme = item._xTheme || options.defaultTheme;
    const useTheme =
      !item._xSimpleMode && (
        itemIndex === selectedIndex ||
        (selectedIndex === -1 && item._xIsAutocompleteTop) ||
        (item._xIsHovering && Boolean(theme?._xIsBrand))
      );
    const modeTheme = options.getThemeForMode(theme);
    const hover = useTheme
      ? options.getHoverColors(theme)
      : options.getNeutralHoverActionColors();
    showTooltip();
    button.style.removeProperty('transform');
    setSurfaceStyle(
      options,
      button,
      '--x-nt-suggestion-utility-hover-bg',
      hover.bg || ''
    );
    setSurfaceStyle(
      options,
      button,
      '--x-nt-suggestion-utility-hover-border',
      hover.border || ''
    );
    setSurfaceStyle(
      options,
      button,
      '--x-nt-suggestion-utility-hover-color',
      useTheme
        ? modeTheme.buttonText || ''
        : 'text' in hover
          ? hover.text || ''
          : ''
    );
    button.setAttribute('data-hover', 'true');
  };

  const reset = (): void => {
    options.hideTopActionTooltip();
    buttonRef.current?.removeAttribute('data-hover');
    buttonRef.current?.style.removeProperty('transform');
  };

  return (
    <div
      ref={slotRef}
      className={surfaceClass(options, 'x-nt-suggestion-utility-slot')}
      data-leading={leading ? 'true' : undefined}
      data-visible="false"
    >
      <button
        ref={buttonRef}
        type="button"
        className={surfaceClass(
          options,
          'x-nt-suggestion-utility-button'
        )}
        data-visible="false"
        aria-label={tooltip}
        dangerouslySetInnerHTML={{
          __html: options.getRiSvg(iconName, 'ri-size-14')
        }}
        onMouseEnter={applyHover}
        onMouseLeave={reset}
        onFocus={applyHover}
        onBlur={reset}
        onPointerUp={(
          event: ReactPointerEvent<HTMLButtonElement>
        ) => {
          event.currentTarget.style.setProperty('transform', 'none');
        }}
        onPointerCancel={(
          event: ReactPointerEvent<HTMLButtonElement>
        ) => {
          event.currentTarget.style.setProperty('transform', 'none');
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          reset();
          onActivate();
        }}
      />
    </div>
  );
}

interface SearchSuggestionRowProps {
  runtime: SuggestionsRuntime;
  suggestionRef: SuggestionValueRef;
  suggestionFingerprint: string;
  index: number;
  isPrimary: boolean;
  primaryHighlightReason: string;
  isMergedHighlight: boolean;
  onlyKeywordSuggestions: boolean;
  last: boolean;
  simpleMode: boolean;
}

function SearchSuggestionRowComponent({
  runtime,
  suggestionRef,
  suggestionFingerprint,
  index,
  isPrimary,
  primaryHighlightReason,
  isMergedHighlight,
  onlyKeywordSuggestions,
  last,
  simpleMode
}: SearchSuggestionRowProps) {
  const { options, queryStore } = runtime;
  const suggestion = suggestionRef.current;
  const itemRef = useRef<SuggestionElement>(null);
  const iconSlotRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const commandRef = useRef<HTMLSpanElement>(null);
  const historyTagRef = useRef<SuggestionActionTagElement>(null);
  const bookmarkTagRef = useRef<SuggestionActionTagElement>(null);
  const topSiteTagRef = useRef<SuggestionActionTagElement>(null);
  const openTabTagRef = useRef<SuggestionActionTagElement>(null);
  const actionTagsRef = useRef<HTMLDivElement>(null);
  const visitButtonRef = useRef<HTMLButtonElement>(null);
  const visitLabelRef = useRef<HTMLSpanElement>(null);
  const copySlotRef = useRef<HTMLDivElement>(null);
  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const deleteSlotRef = useRef<HTMLDivElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const primarySearch =
    isPrimary && suggestion.type === 'googleSuggest';
  const localFallback = isLocalUrlSuggestion(options, suggestion);
  const searchTheme =
    primarySearch ||
    (onlyKeywordSuggestions &&
      isPrimary &&
      suggestion.type === 'newtab');
  const themeHost = options.getThemeHostForSuggestion(suggestion);
  const usesUrlFallbackTheme =
    suggestion.type === 'directUrl' ||
    suggestion.type === 'browserPage' ||
    localFallback;
  const defaultSearchEngineThemeUrl =
    options.getDefaultSearchEngineThemeUrl();
  const immediateTheme = useMemo(() => {
    const latestSuggestion = suggestionRef.current;
    let nextTheme =
      options.getImmediateThemeForSuggestion(latestSuggestion) ||
      options.defaultTheme;
    if (usesUrlFallbackTheme) {
      nextTheme = options.urlHighlightTheme;
    }
    if (searchTheme) {
      const accent = options.getBrandAccentForUrl(
        defaultSearchEngineThemeUrl
      );
      if (accent) {
        nextTheme =
          options.buildThemeFromAccent(accent, 'brand') ||
          options.defaultTheme;
        if (nextTheme) {
          nextTheme._xIsBrand = true;
        }
      }
    }
    return nextTheme;
  }, [
    options,
    searchTheme
      ? defaultSearchEngineThemeUrl
      : usesUrlFallbackTheme
        ? 1
        : suggestionFingerprint
  ]);
  const iconSpec = useMemo(
    () => getSuggestionIconSpec(options, suggestionRef.current),
    [
      options,
      suggestion.type === 'directUrl' ? '' : suggestionFingerprint
    ]
  );
  const command = Boolean(suggestion.commandText);
  const shouldSwitchMatchedTab =
    options.shouldSwitchMatchedTabSuggestion(
      suggestion,
      index
    );
  const actionModel = useMemo(
    () => createActionModel(options, {
      suggestion,
      isPrimaryHighlight: isPrimary,
      isPrimarySearchSuggest: primarySearch,
      primaryHighlightReason,
      onlyKeywordSuggestions,
      isMergedHighlight,
      shouldSwitchMatchedTab,
      enterAction: options.enterAction,
      simpleMode
    }),
    [
      isPrimary,
      isMergedHighlight,
      onlyKeywordSuggestions,
      options,
      primaryHighlightReason,
      primarySearch,
      simpleMode,
      shouldSwitchMatchedTab,
      suggestion
    ]
  );
  const actionTagRefs = useRef<SuggestionActionTagElement[]>([]);
  const copyableUrl = suggestion.commandText
    ? ''
    : String(suggestion.url || '').trim();
  const removable = canDeleteHistory(suggestion);
  const deleteTooltip = isTopSite(suggestion)
    ? options.t('search_remove_top_site_tooltip', '移除该常用')
    : options.t('search_remove_history_tooltip', '移除该历史');

  useLayoutEffect(() => {
    const item = itemRef.current;
    if (!item) {
      return;
    }
    item._xIsSearchSuggestion = true;
    item._xThemeHost = themeHost;
    item._xIsAutocompleteTop = isPrimary;
    item._xIconWrap = iconSlotRef.current;
    item._xIconIsFavicon =
      iconSpec.kind === 'favicon' &&
      iconSlotRef.current?.getAttribute('data-favicon') === 'true';
    item._xDirectIconWrap =
      suggestion.type === 'directUrl' ||
      suggestion.type === 'browserPage'
        ? iconSlotRef.current
        : null;
    item._xTitle = command
      ? commandRef.current
      : titleRef.current;
    item._xCommandLabel = command ? commandRef.current : null;
    item._xHistoryTag = historyTagRef.current;
    item._xBookmarkTag = bookmarkTagRef.current;
    item._xTopSiteTag = topSiteTagRef.current;
    item._xOpenTabTag = openTabTagRef.current;
    if (item._xHistoryTag) {
      item._xHistoryTag._xDefaultBg =
        surfaceCssValue(
          options,
          'var(--x-nt-tag-bg, #F3F4F6)'
        );
      item._xHistoryTag._xDefaultText =
        surfaceCssValue(
          options,
          'var(--x-nt-tag-text, #667085)'
        );
      item._xHistoryTag._xDefaultBorder = 'transparent';
    }
    if (item._xTopSiteTag) {
      item._xTopSiteTag._xDefaultBg =
        surfaceCssValue(
          options,
          'var(--x-nt-tag-bg, #F3F4F6)'
        );
      item._xTopSiteTag._xDefaultText =
        surfaceCssValue(
          options,
          'var(--x-nt-tag-text, #667085)'
        );
      item._xTopSiteTag._xDefaultBorder = 'transparent';
    }
    if (item._xBookmarkTag) {
      item._xBookmarkTag._xDefaultBg =
        surfaceCssValue(
          options,
          'var(--x-nt-tag-bg, #F3F4F6)'
        );
      item._xBookmarkTag._xDefaultText =
        surfaceCssValue(
          options,
          'var(--x-nt-tag-text, #667085)'
        );
      item._xBookmarkTag._xDefaultBorder = 'transparent';
    }
    if (item._xOpenTabTag) {
      item._xOpenTabTag._xDefaultBg = surfaceCssValue(
        options,
        'var(--x-nt-tag-bg, #F3F4F6)'
      );
      item._xOpenTabTag._xDefaultText = surfaceCssValue(
        options,
        'var(--x-nt-tag-text, #667085)'
      );
      item._xOpenTabTag._xDefaultBorder = 'transparent';
    }
    item._xTagContainer = actionTagsRef.current;
    item._xActionModel = actionModel;
    item._xHasActionTags = actionModel.hasActionTags;
    item._xVisitButton = visitButtonRef.current;
    item._xVisitButtonLabel = visitLabelRef.current;
    item._xVisitButtonAction = actionModel.visitButtonAction;
    item._xActionTags = actionTagRefs.current;
    item._xActionTags.forEach((tag) => {
      tag._xActionLabel = tag.querySelector<HTMLSpanElement>(
        `.${surfaceClass(
          options,
          'x-nt-suggestion-action-tag__label'
        )}`
      );
    });
    item._xSuggestion = suggestionRef.current;
    item._xAlwaysHideVisitButton =
      actionModel.alwaysHideVisitButton;
    item._xHasSwitchAction = actionModel.hasSwitchAction;
    item._xSimpleMode = simpleMode;
    item._xHistoryDeleteButton = deleteButtonRef.current;
    item._xUtilityActions = [
      copySlotRef.current && copyButtonRef.current
        ? {
            slot: copySlotRef.current,
            button: copyButtonRef.current
          }
        : null,
      deleteSlotRef.current && deleteButtonRef.current
        ? {
            slot: deleteSlotRef.current,
            button: deleteButtonRef.current
          }
        : null
    ].filter((action): action is SuggestionUtilityActionElements =>
      Boolean(action)
    );
  }, [
    actionModel,
    command,
    copyableUrl,
    iconSpec.kind,
    isPrimary,
    options,
    removable,
    suggestion.type,
    suggestionRef,
    simpleMode,
    themeHost
  ]);

  const shouldLoadTheme =
    !searchTheme &&
    (!onlyKeywordSuggestions || suggestion.type !== 'newtab') &&
    !usesUrlFallbackTheme;

  useLayoutEffect(() => {
    const item = itemRef.current;
    if (!item) {
      return;
    }
    item._xTheme = immediateTheme;
    options.applyThemeVariables(item, immediateTheme);

    let active = true;
    if (shouldLoadTheme) {
      const latestSuggestion = suggestionRef.current;
      void options.getThemeForSuggestion(latestSuggestion).then((theme) => {
        if (!active || !item.isConnected) {
          return;
        }
        const nextTheme = resolveTheme(
          options,
          latestSuggestion,
          theme
        );
        item._xTheme = nextTheme;
        options.applyThemeVariables(item, nextTheme);
        runtime.updateSelection(options.getSelectedIndex());
      });
    }
    return () => {
      active = false;
    };
  }, [
    immediateTheme,
    options,
    runtime,
    simpleMode,
    shouldLoadTheme
  ]);

  useLayoutEffect(() => {
    const item = itemRef.current;
    if (!item) {
      return;
    }
    bindTextTooltip(
      options,
      titleRef.current,
      suggestion.title || ''
    );
    const urlLine = item.querySelector<HTMLElement>(
      `.${surfaceClass(options, 'x-nt-suggestion-url-line')}`
    );
    bindTextTooltip(options, urlLine, suggestion.url || '');
  }, [
    options,
    suggestion.title,
    suggestion.url
  ]);

  const handleRowMouseEnter = (): void => {
    const item = itemRef.current;
    if (!item) {
      return;
    }
    item._xIsHovering = true;
    setIconEmphasis(item, true);
    runtime.updateSelection(options.getSelectedIndex());
    if (options.items.indexOf(item) !== options.getSelectedIndex()) {
      if (
        options.getSelectedIndex() === -1 &&
        item._xIsAutocompleteTop
      ) {
        return;
      }
      item.setAttribute('data-row-state', 'hover');
    }
  };

  const activate = (
    event: ReactMouseEvent<HTMLElement>
  ): void => {
    const item = itemRef.current;
    if (item) {
      options.onActivateSuggestion(
        suggestionRef.current,
        queryStore.getSnapshot(),
        event.nativeEvent,
        index,
        item
      );
    }
  };

  const preserveCommandInputFocus = (
    event: ReactMouseEvent<HTMLElement>
  ): void => {
    if (command) {
      // New Tab clears slash commands on input blur, before click fires.
      event.preventDefault();
    }
  };

  const handleAuxClick = (
    event: ReactMouseEvent<HTMLElement>
  ): void => {
    if (event.button !== 1) {
      return;
    }
    event.preventDefault();
    activate(event);
  };

  const showUrl =
    (suggestion.type === 'history' && !suggestion.isTopSite) ||
    isTopSite(suggestion);
  const urlLineText = getSuggestionUrlLineText(options, suggestion);

  return (
    <div
      ref={itemRef}
      id={`_x_extension_${options.surface === 'overlay' ? '' : 'newtab_'}suggestion_item_${index}_2024_unique_`}
      className={surfaceClass(options, 'x-nt-suggestion-item')}
      data-last={last ? 'true' : 'false'}
      data-row-state={isPrimary ? 'active' : undefined}
      data-command-row={command ? 'true' : undefined}
      data-simple-mode={simpleMode ? 'true' : 'false'}
      onMouseEnter={handleRowMouseEnter}
      onMouseDown={preserveCommandInputFocus}
      onMouseLeave={() => {
        if (itemRef.current) {
          itemRef.current._xIsHovering = false;
        }
        runtime.updateSelection(options.getSelectedIndex());
      }}
      onClick={activate}
      onAuxClick={handleAuxClick}
    >
      <div
        className={surfaceClass(
          options,
          'x-nt-suggestion-left'
        )}
        data-motion={
          options.surface === 'overlay' ? 'true' : undefined
        }
      >
        <SuggestionIcon
          spec={iconSpec}
          index={index}
          options={options}
          iconSlotRef={iconSlotRef}
        />
        <div
          className={surfaceClass(
            options,
            'x-nt-suggestion-text'
          )}
        >
          {command && (
            <span
              ref={commandRef}
              className={surfaceClass(
                options,
                'x-nt-suggestion-command'
              )}
            >
              <HighlightedText
                options={options}
                text={suggestion.commandText || ''}
                queryStore={queryStore}
                simpleMode={simpleMode}
              />
            </span>
          )}
          <span
            ref={titleRef}
            className={surfaceClass(
              options,
              command
                ? 'x-nt-suggestion-title x-nt-suggestion-command-description'
                : 'x-nt-suggestion-title'
            )}
          >
            {command ? (
              options.sanitizeDisplayText(suggestion.title || '')
            ) : (
              <HighlightedText
                options={options}
                text={suggestion.title || ''}
                queryStore={queryStore}
                simpleMode={simpleMode}
              />
            )}
          </span>
          {options.isTabRankScoreDebugEnabled() &&
            Array.isArray(suggestion.reasons) &&
            suggestion.reasons
              .map((reason) => String(reason || '').trim())
              .filter(Boolean).length > 0 && (
              <span
                className={surfaceClass(
                  options,
                  'x-nt-suggestion-reason'
                )}
              >
                {suggestion.reasons
                  .map((reason) => String(reason || '').trim())
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
          {showUrl && (
            <span
              className={surfaceClass(
                options,
                'x-nt-suggestion-url-line'
              )}
            >
              <HighlightedText
                options={options}
                text={urlLineText}
                queryStore={queryStore}
                simpleMode={simpleMode}
              />
            </span>
          )}
          {!simpleMode && suggestion.type === 'history' &&
            !suggestion.isTopSite && (
            <span
              ref={historyTagRef}
              className={surfaceClass(
                options,
                'x-nt-suggestion-tag'
              )}
              data-visible="true"
              data-tag-type="history"
            >
              {options.t('search_tag_history', '历史')}
            </span>
          )}
          {!simpleMode && isTopSite(suggestion) && (
            <span
              ref={topSiteTagRef}
              className={surfaceClass(
                options,
                'x-nt-suggestion-tag'
              )}
              data-visible="true"
              data-tag-type="top-site"
            >
              {options.t('search_tag_top_site', '常用')}
            </span>
          )}
          {suggestion.type === 'bookmark' && (
            <>
              {suggestion.path && (
                <span
                  className={surfaceClass(
                    options,
                    'x-nt-suggestion-bookmark-path'
                  )}
                >
                  {String(suggestion.path)}
                </span>
              )}
              {!simpleMode && (
                <span
                  ref={bookmarkTagRef}
                  className={surfaceClass(
                    options,
                    'x-nt-suggestion-tag'
                  )}
                  data-visible="true"
                  data-tag-type="bookmark"
                >
                  {options.t('search_tag_bookmark', '书签')}
                </span>
              )}
            </>
          )}
          {!simpleMode && options.surface === 'overlay' &&
            shouldSwitchMatchedTab && (
            <span
              ref={openTabTagRef}
              className={surfaceClass(
                options,
                'x-nt-suggestion-tag'
              )}
              data-visible="true"
              data-tag-type="open-tab"
            >
              {options.t('search_tag_open_tab', '已打开')}
            </span>
          )}
        </div>
      </div>
      <div
        className={surfaceClass(
          options,
          'x-nt-suggestion-right'
        )}
        data-action-column={
          !actionModel.alwaysHideVisitButton ||
          actionModel.hasActionTags
            ? 'true'
            : undefined
        }
      >
        <div
          ref={actionTagsRef}
          className={surfaceClass(
            options,
            'x-nt-suggestion-action-tags'
          )}
          data-visible="false"
        >
          {actionModel.actionTags.map((tag, tagIndex) => (
            <span
              ref={(node) => {
                if (node) {
                  const actionTag =
                    node as SuggestionActionTagElement;
                  actionTagRefs.current[tagIndex] = actionTag;
                  actionTag._xAction = tag.action;
                  actionTag._xSuggestion = suggestionRef.current;
                  actionTag._xDefaultBg =
                    surfaceCssValue(
                      options,
                      'var(--x-nt-tag-bg, #F3F4F6)'
                    );
                  actionTag._xDefaultText =
                    surfaceCssValue(
                      options,
                      'var(--x-nt-tag-text, #6B7280)'
                    );
                  actionTag._xDefaultBorder = 'transparent';
                }
              }}
              key={`${tag.action}:${tagIndex}`}
              className={surfaceClass(
                options,
                'x-nt-suggestion-action-tag'
              )}
              data-action={tag.action}
            >
              <span
                ref={(node) => {
                  const tagNode =
                    actionTagRefs.current[tagIndex];
                  if (tagNode) {
                    tagNode._xActionLabel = node;
                  }
                }}
                className={surfaceClass(
                  options,
                  'x-nt-suggestion-action-tag__label'
                )}
              >
                {getActionLabel(
                  runtime,
                  getModifierAction(runtime, tag.action),
                  suggestion
                )}
              </span>
            </span>
          ))}
        </div>
        <button
          ref={visitButtonRef}
          type="button"
          className={surfaceClass(
            options,
            'x-nt-suggestion-action-button x-nt-suggestion-visit-button'
          )}
          data-visible={
            actionModel.alwaysHideVisitButton ? 'false' : 'true'
          }
          aria-label={getActionLabel(
            runtime,
            getModifierAction(
              runtime,
              actionModel.visitButtonAction
            ),
            suggestion
          )}
          onClick={(event) => {
            event.stopPropagation();
            activate(event);
          }}
          onAuxClick={(event) => {
            if (event.button !== 1) {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            activate(event);
          }}
        >
          <span
            ref={visitLabelRef}
            className={surfaceClass(
              options,
              'x-nt-suggestion-action-button__label'
            )}
          >
            {getActionLabel(
              runtime,
              getModifierAction(
                runtime,
                actionModel.visitButtonAction
              ),
              suggestion
            )}
          </span>
          {simpleMode && (
            <span
              className={surfaceClass(
                options,
                'x-nt-suggestion-action-button__icon'
              )}
              dangerouslySetInnerHTML={{
                __html: options.getRiSvg(
                  'ri-arrow-right-line',
                  'ri-size-12'
                )
              }}
            />
          )}
        </button>
        {copyableUrl && (
          <SuggestionUtilityAction
            options={options}
            itemRef={itemRef}
            slotRef={copySlotRef}
            buttonRef={copyButtonRef}
            leading
            tooltip={options.t(
              'search_copy_url_tooltip',
              '复制链接'
            )}
            iconName="ri-file-copy-line"
            onActivate={() => {
              void options.onCopyUrl(copyableUrl);
            }}
          />
        )}
        {removable && (
          <SuggestionUtilityAction
            options={options}
            itemRef={itemRef}
            slotRef={deleteSlotRef}
            buttonRef={deleteButtonRef}
            leading={!copyableUrl}
            tooltip={deleteTooltip}
            iconName="ri-delete-bin-6-line"
            onActivate={() => {
              options.onDeleteHistory(
                suggestionRef.current,
                queryStore.getSnapshot()
              );
            }}
          />
        )}
      </div>
    </div>
  );
}

const SearchSuggestionRow = memo(SearchSuggestionRowComponent);

function OpenTabRowComponent({
  runtime,
  tab,
  index,
  last,
  simpleMode
}: {
  runtime: SuggestionsRuntime;
  tab: OpenTabSuggestion;
  index: number;
  last: boolean;
  simpleMode: boolean;
}) {
  const { options } = runtime;
  const itemRef = useRef<SuggestionElement>(null);
  const iconSlotRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const switchButtonRef = useRef<HTMLButtonElement>(null);
  const switchButtonLabelRef = useRef<HTMLSpanElement>(null);
  const copySlotRef = useRef<HTMLDivElement>(null);
  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const actionTagsRef = useRef<HTMLDivElement>(null);
  const switchActionTagRef =
    useRef<SuggestionActionTagElement>(null);
  let host = '';
  try {
    host = tab.url ? new URL(tab.url).hostname : '';
  } catch {
    host = '';
  }
  const hasFavicon = Boolean(String(tab.favIconUrl || '').trim());
  const fallback =
    options.shouldBlockFaviconForHost(host) ||
    (!hasFavicon && options.isBrowserNewtabUrl(tab.url || ''));
  const iconSpec: IconSpec = fallback
    ? {
        kind: 'inline',
        iconName:
          getBrowserFallbackIcon(options, tab.url || '') || 'ri-link'
      }
    : {
        kind: 'favicon',
        attach: true,
        url: tab.url || '',
        favicon: tab.favIconUrl || '',
        host,
        fallbackIconName: getBrowserFallbackIcon(
          options,
          tab.url || ''
        )
      };
  const themeSuggestion: Suggestion = {
    url: tab.url || '',
    favicon: tab.favIconUrl || ''
  };
  const localFallback = isLocalUrlSuggestion(
    options,
    themeSuggestion
  );
  const immediateTheme = localFallback
    ? options.urlHighlightTheme
    : options.getImmediateThemeForSuggestion(themeSuggestion) ||
      options.defaultTheme;
  const titleText = options.sanitizeDisplayText(
    tab.title || options.t('untitled', '无标题')
  );
  const tabSuggestion = useMemo<Suggestion>(
    () => ({
      type: 'openTab',
      title: titleText,
      url: tab.url || '',
      favicon: tab.favIconUrl || '',
      _xMatchedTabId:
        typeof tab.id === 'number' ? tab.id : null
    }),
    [tab.favIconUrl, tab.id, tab.url, titleText]
  );
  const copyableUrl = String(tab.url || '').trim();

  useLayoutEffect(() => {
    const item = itemRef.current;
    if (!item) {
      return;
    }
    item._xIsSearchSuggestion = false;
    item._xIsAutocompleteTop =
      options.autoHighlightFirstTab && index === 0;
    item._xTheme = immediateTheme;
    item._xThemeHost =
      options.getThemeHostForSuggestion(themeSuggestion);
    item._xIconWrap = iconSlotRef.current;
    item._xIconIsFavicon = !fallback;
    item._xTitle = titleRef.current;
    item._xSwitchButton = switchButtonRef.current;
    item._xVisitButton = switchButtonRef.current;
    item._xVisitButtonLabel = switchButtonLabelRef.current;
    item._xVisitButtonAction = 'switch';
    item._xSuggestion = tabSuggestion;
    item._xTabId = typeof tab.id === 'number' ? tab.id : null;
    item._xSimpleMode = simpleMode;
    item._xUtilityActions =
      copySlotRef.current && copyButtonRef.current
        ? [{
            slot: copySlotRef.current,
            button: copyButtonRef.current
          }]
        : [];
    item._xTagContainer = actionTagsRef.current;
    item._xActionTags = switchActionTagRef.current
      ? [switchActionTagRef.current]
      : [];
    item._xHasActionTags =
      options.surface === 'overlay';
    if (switchActionTagRef.current) {
      switchActionTagRef.current._xAction = 'switch';
      switchActionTagRef.current._xSuggestion = tabSuggestion;
      switchActionTagRef.current._xActionLabel =
        switchActionTagRef.current.querySelector<HTMLSpanElement>(
          `.${surfaceClass(
            options,
            'x-nt-suggestion-action-tag__label'
          )}`
        );
    }
    options.applyThemeVariables(item, immediateTheme);
    bindTextTooltip(options, titleRef.current, titleText);
    let active = true;
    if (!localFallback) {
      void options
        .getThemeForSuggestion(themeSuggestion)
        .then((theme) => {
          if (!active || !item.isConnected) {
            return;
          }
          const nextTheme = resolveTheme(
            options,
            themeSuggestion,
            theme
          );
          item._xTheme = nextTheme;
          options.applyThemeVariables(item, nextTheme);
          runtime.updateSelection(options.getSelectedIndex());
        });
    }
    return () => {
      active = false;
    };
  }, [
    fallback,
    immediateTheme,
    localFallback,
    options,
    runtime,
    simpleMode,
    tab.id,
    tabSuggestion,
    themeSuggestion,
    titleText
  ]);

  const activate = (
    event: ReactMouseEvent<HTMLElement>
  ): void => {
    options.onSwitchToTab(tab, event.nativeEvent);
  };

  const handleAuxClick = (
    event: ReactMouseEvent<HTMLElement>
  ): void => {
    if (event.button !== 1) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    activate(event);
  };

  return (
    <div
      ref={itemRef}
      id={`_x_extension_${options.surface === 'overlay' ? '' : 'newtab_'}suggestion_item_${index}_2024_unique_`}
      className={surfaceClass(options, 'x-nt-suggestion-item')}
      data-last={last ? 'true' : 'false'}
      data-simple-mode={simpleMode ? 'true' : 'false'}
      onMouseEnter={() => {
        const item = itemRef.current;
        if (!item) {
          return;
        }
        item._xIsHovering = true;
        setIconEmphasis(item, true);
        runtime.updateSelection(options.getSelectedIndex());
        if (options.items.indexOf(item) === options.getSelectedIndex()) {
          return;
        }
        if (
          options.getSelectedIndex() === -1 &&
          item._xIsAutocompleteTop
        ) {
          return;
        }
        const theme = item._xTheme;
        if (!simpleMode && theme?._xIsBrand) {
          const hover = options.getHoverColors(theme);
          setSurfaceStyle(
            options,
            item,
            '--x-nt-suggestion-hover-bg',
            hover.bg || ''
          );
        } else if (options.surface === 'overlay') {
          setSurfaceStyle(
            options,
            item,
            '--x-nt-suggestion-hover-bg',
            'var(--x-ov-hover-bg, #F3F4F6)'
          );
        }
        item.setAttribute('data-row-state', 'hover');
      }}
      onMouseLeave={() => {
        const item = itemRef.current;
        if (!item) {
          return;
        }
        item._xIsHovering = false;
        runtime.updateSelection(options.getSelectedIndex());
      }}
      onClick={activate}
      onAuxClick={handleAuxClick}
    >
      <div
        className={surfaceClass(
          options,
          'x-nt-suggestion-left'
        )}
      >
        <SuggestionIcon
          spec={iconSpec}
          index={index}
          options={options}
          iconSlotRef={iconSlotRef}
        />
        <span
          ref={titleRef}
          className={surfaceClass(
            options,
            'x-nt-suggestion-title'
          )}
        >
          {titleText}
        </span>
        {options.isTabRankScoreDebugEnabled() && (
          <span
            className={surfaceClass(
              options,
              'x-nt-tab-rank-debug'
            )}
          >
            {options.formatTabRankDebugText(tab)}
          </span>
        )}
      </div>
      <div
        className={surfaceClass(
          options,
          'x-nt-suggestion-right'
        )}
        data-action-column="true"
      >
        {options.surface === 'overlay' && (
          <div
            ref={actionTagsRef}
            className={surfaceClass(
              options,
              'x-nt-suggestion-action-tags'
            )}
            data-visible="false"
          >
            <span
              ref={switchActionTagRef}
              className={surfaceClass(
                options,
                'x-nt-suggestion-action-tag'
              )}
            >
              <span
                className={surfaceClass(
                  options,
                  'x-nt-suggestion-action-tag__label'
                )}
              >
                {getActionLabel(
                  runtime,
                  getModifierAction(runtime, 'switch'),
                  tabSuggestion
                )}
              </span>
            </span>
          </div>
        )}
        <button
          ref={switchButtonRef}
          type="button"
          className={surfaceClass(
            options,
            'x-nt-tab-switch-button'
          )}
          data-visible="true"
          onClick={(event) => {
            event.stopPropagation();
            activate(event);
          }}
          onAuxClick={handleAuxClick}
        >
          <span
            ref={switchButtonLabelRef}
            className={
              options.surface === 'overlay'
                ? 'x-ov-inline-label'
                : undefined
            }
          >
            {options.surface === 'overlay'
              ? getActionLabel(
                  runtime,
                  getModifierAction(runtime, 'switch'),
                  tabSuggestion
                )
              : options.t('switch_to_tab', '切换到标签页')}
          </span>
          {simpleMode && (
            <>
              {' '}
              <span
                className={
                  options.surface === 'overlay'
                    ? 'x-ov-inline-icon'
                    : undefined
                }
                dangerouslySetInnerHTML={{
                  __html: options.getRiSvg(
                    'ri-arrow-right-line',
                    'ri-size-12'
                  )
                }}
              />
            </>
          )}
        </button>
        {copyableUrl && (
          <SuggestionUtilityAction
            options={options}
            itemRef={itemRef}
            slotRef={copySlotRef}
            buttonRef={copyButtonRef}
            leading
            tooltip={options.t(
              'search_copy_url_tooltip',
              '复制链接'
            )}
            iconName="ri-file-copy-line"
            onActivate={() => {
              void options.onCopyUrl(copyableUrl);
            }}
          />
        )}
      </div>
    </div>
  );
}

const OpenTabRow = memo(OpenTabRowComponent);

function EmptyState({
  options,
  message
}: {
  options: NormalizedOptions;
  message: string;
}) {
  return (
    <div
      className={surfaceClass(options, 'x-nt-empty-state')}
      data-theme={
        options.surface === 'overlay'
          ? options.container
              .closest<HTMLElement>('[data-theme]')
              ?.getAttribute('data-theme') || undefined
          : undefined
      }
    >
      <span
        className={surfaceClass(
          options,
          'x-nt-empty-state__icon'
        )}
        dangerouslySetInnerHTML={{
          __html: options.getRiSvg(
            'ri-file-3-line',
            'ri-size-16'
          )
        }}
      />
      <span
        className={surfaceClass(
          options,
          'x-nt-empty-state__text'
        )}
      >
        {options.sanitizeDisplayText(message)}
      </span>
    </div>
  );
}

function syncItems(options: NormalizedOptions): void {
  options.items.length = 0;
  options.container
    .querySelectorAll<SuggestionElement>(
      `.${surfaceClass(options, 'x-nt-suggestion-item')}`
    )
    .forEach((item) => options.items.push(item));
}

function createNoopController(
  rawOptions: SuggestionsViewOptions
): SuggestionsViewController {
  const items = Array.isArray(rawOptions.items)
    ? rawOptions.items
    : [];
  return {
    render() {},
    renderTabs() {},
    updateSelection() {},
    setOpenInCurrentTabModifierActive() {},
    setOpenSwitchInNewTabModifierActive() {},
    setOpenInBackgroundTabModifierActive() {},
    clear() {
      items.length = 0;
    },
    destroy() {
      items.length = 0;
    },
    getAutoHighlightIndex() {
      return -1;
    },
    markAutocompleteTop() {},
    getItems() {
      return items;
    }
  };
}

function getStableRenderKeys<T>(
  values: T[],
  getIdentity: (value: T) => string
): string[] {
  const occurrences = new Map<string, number>();
  return values.map((value) => {
    const identity = getIdentity(value);
    const occurrence = occurrences.get(identity) || 0;
    occurrences.set(identity, occurrence + 1);
    return `${identity}:occurrence:${occurrence}`;
  });
}

function updateSuggestionValueRefs(
  previous: Map<string, SuggestionValueRef>,
  renderKeys: string[],
  suggestions: Suggestion[]
): {
  refs: SuggestionValueRef[];
  byKey: Map<string, SuggestionValueRef>;
} {
  const byKey = new Map<string, SuggestionValueRef>();
  const refs = renderKeys.map((key, index) => {
    const valueRef = previous.get(key) || {
      current: suggestions[index]
    };
    valueRef.current = suggestions[index];
    byKey.set(key, valueRef);
    return valueRef;
  });
  return { refs, byKey };
}

function syncLatestSuggestionMetadata(
  options: NormalizedOptions,
  suggestions: Suggestion[]
): void {
  options.items.forEach((item, index) => {
    const suggestion = suggestions[index];
    if (!suggestion) {
      return;
    }
    item._xSuggestion = suggestion;
    item._xActionTags?.forEach((tag) => {
      tag._xSuggestion = suggestion;
    });
  });
}

export function createSuggestionsView(
  rawOptions: SuggestionsViewOptions = {}
): SuggestionsViewController {
  const normalizedOptions = normalizeOptions(rawOptions);
  if (!normalizedOptions) {
    return createNoopController(rawOptions);
  }
  const options: NormalizedOptions = normalizedOptions;
  if (
    typeof options.actionModel.getSuggestionStructureIdentity !== 'function' ||
    typeof options.actionModel.getSuggestionPresentationFingerprint !== 'function'
  ) {
    return createNoopController(rawOptions);
  }
  const getSuggestionStructureIdentity =
    options.actionModel.getSuggestionStructureIdentity;
  const getSuggestionPresentationFingerprint =
    options.actionModel.getSuggestionPresentationFingerprint;
  const root: Root = createRoot(options.container);
  const queryStore = createQueryStore();
  options.container.setAttribute(
    'data-react-island',
    'suggestions'
  );
  let destroyed = false;
  let lastRenderWasSuggestions = false;
  let lastSimpleModeEnabled = options.isSimpleModeEnabled();
  let suggestionValueRefs = new Map<string, SuggestionValueRef>();
  let pendingTabRenderTask: {
    id: number;
    kind: 'idle' | 'timeout';
  } | null = null;
  let tabRenderGeneration = 0;
  const runtime: SuggestionsRuntime = {
    options,
    queryStore,
    modifiers: {
      openInCurrentTab: false,
      openSwitchInNewTab: false,
      openInBackgroundTab: false
    },
    updateSelection(index) {
      updateSelectionForRuntime(runtime, index);
    }
  };

  function cancelPendingTabRender(): void {
    tabRenderGeneration += 1;
    if (pendingTabRenderTask === null) {
      return;
    }
    const windowRef = options.document.defaultView;
    if (windowRef) {
      if (
        pendingTabRenderTask.kind === 'idle' &&
        typeof windowRef.cancelIdleCallback === 'function'
      ) {
        windowRef.cancelIdleCallback(pendingTabRenderTask.id);
      } else {
        windowRef.clearTimeout(pendingTabRenderTask.id);
      }
    }
    pendingTabRenderTask = null;
  }

  function clear(): void {
    if (destroyed) {
      return;
    }
    cancelPendingTabRender();
    options.hideTopActionTooltip();
    flushSync(() => root.render(null));
    lastRenderWasSuggestions = false;
    suggestionValueRefs.clear();
    options.items.length = 0;
    options.onSetSelectedIndex(-1);
    options.setSuggestionsVisible(false);
  }

  function render(
    payload: SuggestionsRenderPayload = {}
  ): void {
    if (destroyed) {
      return;
    }
    cancelPendingTabRender();
    const suggestions = Array.isArray(payload.suggestions)
      ? payload.suggestions
      : [];
    const query = payload.query || '';
    const simpleMode = options.isSimpleModeEnabled();
    const renderKeys = getStableRenderKeys(
      suggestions,
      getSuggestionStructureIdentity
    );
    const nextValueRefs = updateSuggestionValueRefs(
      suggestionValueRefs,
      renderKeys,
      suggestions
    );
    suggestionValueRefs = nextValueRefs.byKey;
    if (
      payload.updateKind === 'highlight' &&
      lastRenderWasSuggestions &&
      simpleMode === lastSimpleModeEnabled
    ) {
      flushSync(() => queryStore.set(query));
      syncLatestSuggestionMetadata(options, suggestions);
      return;
    }
    queryStore.set(query);
    const primaryHighlightIndex =
      Number.isInteger(payload.primaryHighlightIndex)
        ? Number(payload.primaryHighlightIndex)
        : -1;
    const preserveSelection = payload.updateKind
      ? payload.updateKind !== 'structure'
      : Boolean(payload.canAppend);
    if (!preserveSelection) {
      options.onSetSelectedIndex(-1);
    }
    if (suggestions.length === 0 && payload.emptyMessage) {
      flushSync(() => {
        root.render(
          <EmptyState
            key="empty"
            options={options}
            message={payload.emptyMessage || ''}
          />
        );
      });
      options.items.length = 0;
      lastRenderWasSuggestions = false;
      options.onSetSelectedIndex(-1);
      options.setSuggestionsVisible(true);
      return;
    }
    flushSync(() => {
      root.render(
        suggestions.map((suggestion, index) => (
          <SearchSuggestionRow
            key={renderKeys[index]}
            runtime={runtime}
            suggestionRef={nextValueRefs.refs[index]}
            suggestionFingerprint={getSuggestionPresentationFingerprint(
              suggestion,
              {
                includeDebugReasons: options.isTabRankScoreDebugEnabled()
              }
            )}
            index={index}
            isPrimary={index === primaryHighlightIndex}
            primaryHighlightReason={
              payload.primaryHighlightReason || 'none'
            }
            isMergedHighlight={Boolean(
              payload.mergedProvider &&
              payload.primarySuggestion === suggestion &&
              index === primaryHighlightIndex
            )}
            onlyKeywordSuggestions={Boolean(
              payload.onlyKeywordSuggestions
            )}
            last={index === suggestions.length - 1}
            simpleMode={simpleMode}
          />
        ))
      );
    });
    syncItems(options);
    syncLatestSuggestionMetadata(options, suggestions);
    lastRenderWasSuggestions = true;
    lastSimpleModeEnabled = simpleMode;
    runtime.updateSelection(options.getSelectedIndex());
  }

  function renderTabs(
    tabList: OpenTabSuggestion[] = []
  ): void {
    if (destroyed) {
      return;
    }
    cancelPendingTabRender();
    suggestionValueRefs.clear();
    const tabs = Array.isArray(tabList)
      ? tabList.slice(
          0,
          Math.max(1, options.openTabSuggestionLimit)
        )
      : [];
    const simpleMode = options.isSimpleModeEnabled();
    const renderKeys = getStableRenderKeys(
      tabs,
      (tab) =>
        typeof tab.id === 'number'
          ? `tab:id:${tab.id}`
          : `tab:url:${String(tab.url || '')}:title:${String(
              tab.title || ''
            )}`
    );
    const windowRef = options.document.defaultView;
    const initialRenderLimit = options.getOpenTabInitialRenderLimit();
    const initialRenderCount = windowRef
      ? Math.min(
          tabs.length,
          Math.max(1, initialRenderLimit)
        )
      : tabs.length;
    let renderedCount = initialRenderCount;
    const preloadTabRange = (start: number, end: number): void => {
      tabs.slice(start, end).forEach((tab) => {
        if (tab.favIconUrl) {
          options.preloadIcon(
            String(tab.favIconUrl),
            String(tab.url || '')
          );
        }
      });
    };
    const commitTabRows = (count: number): void => {
      flushSync(() => {
        root.render(
          tabs.slice(0, count).map((tab, index) => (
            <OpenTabRow
              key={renderKeys[index]}
              runtime={runtime}
              tab={tab}
              index={index}
              last={index === count - 1 && count === tabs.length}
              simpleMode={simpleMode}
            />
          ))
        );
      });
      syncItems(options);
      runtime.updateSelection(options.getSelectedIndex());
    };
    options.onSetSelectedIndex(-1);
    preloadTabRange(0, initialRenderCount);
    commitTabRows(initialRenderCount);
    lastRenderWasSuggestions = false;
    lastSimpleModeEnabled = simpleMode;
    options.setSuggestionsVisible(tabs.length > 0);
    if (renderedCount >= tabs.length || !windowRef) {
      return;
    }
    const generation = tabRenderGeneration;
    const scheduleNextBatch = (): void => {
      if (generation !== tabRenderGeneration || destroyed) {
        return;
      }
      const renderNextBatch = (): void => {
        pendingTabRenderTask = null;
        if (generation !== tabRenderGeneration || destroyed) {
          return;
        }
        const nextCount = Math.min(
          tabs.length,
          renderedCount + Math.max(1, options.getOpenTabRenderBatchSize())
        );
        preloadTabRange(renderedCount, nextCount);
        renderedCount = nextCount;
        commitTabRows(renderedCount);
        if (renderedCount < tabs.length) {
          scheduleNextBatch();
        }
      };
      // Rows below the visible viewport are non-critical. Scheduling their
      // synchronous React commits on animation frames competes directly with
      // the host page while it is loading, so only fill them when Chromium
      // reports idle time. The timeout fallback still yields multiple frames
      // in browsers without requestIdleCallback.
      if (typeof windowRef.requestIdleCallback === 'function') {
        pendingTabRenderTask = {
          id: windowRef.requestIdleCallback(renderNextBatch, {
            timeout: 500
          }),
          kind: 'idle'
        };
      } else {
        pendingTabRenderTask = {
          id: windowRef.setTimeout(renderNextBatch, 48),
          kind: 'timeout'
        };
      }
    };
    scheduleNextBatch();
  }

  function setModifier(
    key: keyof ModifierState,
    active: boolean
  ): void {
    const next = Boolean(active);
    if (runtime.modifiers[key] === next) {
      return;
    }
    runtime.modifiers[key] = next;
    syncModifierLabels(runtime);
  }

  return {
    render,
    renderTabs,
    updateSelection(index) {
      runtime.updateSelection(index);
    },
    setOpenInCurrentTabModifierActive(active) {
      setModifier('openInCurrentTab', active);
    },
    setOpenSwitchInNewTabModifierActive(active) {
      setModifier('openSwitchInNewTab', active);
    },
    setOpenInBackgroundTabModifierActive(active) {
      setModifier('openInBackgroundTab', active);
    },
    clear,
    destroy() {
      if (destroyed) {
        return;
      }
      cancelPendingTabRender();
      options.hideTopActionTooltip();
      flushSync(() => root.unmount());
      destroyed = true;
      lastRenderWasSuggestions = false;
      options.items.length = 0;
      options.onSetSelectedIndex(-1);
      options.setSuggestionsVisible(false);
    },
    getAutoHighlightIndex() {
      return options.items.findIndex(
        (item) => Boolean(item?._xIsAutocompleteTop)
      );
    },
    markAutocompleteTop(index) {
      options.items.forEach((item, itemIndex) => {
        item._xIsAutocompleteTop = itemIndex === index;
      });
    },
    getItems() {
      return options.items;
    }
  };
}

export function createSuggestionsViewApi() {
  return Object.freeze({
    implementation: 'react',
    createSuggestionsView(options?: SuggestionsViewOptions) {
      return createSuggestionsView(options);
    }
  });
}
