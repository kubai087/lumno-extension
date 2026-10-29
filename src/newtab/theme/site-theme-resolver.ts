// Resolves per-site accent themes from favicons and brand colors, caches them,
// and applies them to suggestion rows, shortcut tiles and bookmark/recent cards.
import type { SiteThemeEntry } from '../../domain/favicon/favicon-cache';
import type { SiteSearchProvider } from '../../domain/search/types';
import { buildTheme, getHoverColors as getModeHoverColors, getThemeFingerprint, getThemeForMode as getThemeVariantForMode } from '../../shared/favicon/favicon-theme';
import { getBrandAccentForHost } from '../../domain/favicon/brand-accents';
import type * as Color from '../../domain/color';
import type { HoverColors, ThemeLike, ThemeVariant } from '../../shared/favicon/favicon-theme';
import * as LumnoMessaging from '../../platform/messaging';
import type { SiteSearchProviders } from '../search/site-search-providers';
import type { ThemeConfidence, ThemeSource, ThemeSubject } from './theme-types';
import { siteThemeEvents, themeColorCache, themeHostCache } from '../../shared/favicon/theme-caches';
import * as FaviconCanonical from '../../domain/favicon/canonical';
import type { FaviconUrlResolver } from '../../domain/favicon/resolver';
import * as FaviconThemeColor from '../../domain/favicon/theme-color';
import * as FaviconThemedCandidates from '../../domain/favicon/themed-candidates';
import type { ThemeRgb } from '../../domain/favicon/types';
import * as FaviconUrlKinds from '../../domain/favicon/url-kinds';
import type { SearchMode } from '../../shared/search-panel/search-mode';
import type { SearchModeActions } from '../../shared/search-panel/mode-actions';
import type { FaviconParts } from './favicon-parts';
import type { PageFaviconCache } from './page-favicon-cache';


// A theme as the card and suggestion views hold it: possibly partial, where
// a missing color clears its variable.
type ViewTheme = Partial<ThemeVariant> | null | undefined;

interface SiteThemeResolverDeps {
  modeActions: SearchModeActions<SiteSearchProvider>;
  searchMode: SearchMode<SiteSearchProvider>;
  normalizeHost(hostname: string): string;
  parseCssColor: typeof Color.parseCssColor;
  defaultAccentColor: ThemeRgb;
  defaultTheme: ThemeVariant;
  getProviderHost: SiteSearchProviders['getProviderHost'];
  getPersistedSiteThemeEntry(hostKey: string): SiteThemeEntry | null;
  getPageFaviconUrlResolver(): Pick<FaviconUrlResolver, 'getSafeFaviconCandidateUrl' | 'resolveFaviconSource'> | null;
  getBrandAccentForUrl(url: string): ThemeRgb | null;
  extractAverageColor(image: HTMLImageElement): ThemeRgb | null;
  getProviderIcon: SiteSearchProviders['getProviderIcon'];
  // Whether the site's icon may have changed since its theme was stored.
  isHostFaviconVisitDirty(hostKey: string): boolean;
  stableHashCode(value: string): number;
  // The icon a subject's theme is read from; '' for none.
  getThemeSourceForSuggestion(subject: ThemeSubject): string;
  areFaviconRenderCachesReady(): boolean;
  faviconParts: Pick<FaviconParts, 'dataCache' | 'view'>;
  faviconCacheRuntime: Pick<PageFaviconCache['faviconCacheRuntime'], 'ensureCachesReady' | 'setPersistedThemeEntry'>;
}

// A theme read from a page's declared color, or a stored one.
interface ThemeResult {
  accentRgb: unknown;
  source?: string;
  neutral?: boolean;
  confidence?: string;
}

// How a resolved theme updates the caches.
interface ResolvedThemeOptions {
  // The icon the theme was read from, to cache it under.
  iconUrl?: string;
  // false keeps it out of the persisted cache.
  persist?: boolean;
  // false leaves the elements showing the site as they are.
  refresh?: boolean;
}

// How an icon is read for a theme.
interface ImageThemeOptions {
  crossOrigin?: boolean;
  // Keep the icon's own theme in the icon cache even when the host has a
  // stronger one.
  preferIconTheme?: boolean;
}

// An element waiting for its theme, and what to do with it.
interface ThemeResolutionItem {
  target: Element;
  suggestion: ThemeSubject;
  applyTheme(theme: ThemeVariant): void;
  // Lower goes first.
  priority: number;
  sequence: number;
}

function createSiteThemeResolver(deps: SiteThemeResolverDeps) {
  const {
    modeActions,
    searchMode,
    normalizeHost,
    parseCssColor,
    defaultAccentColor,
    defaultTheme,
    getProviderHost,
    getPersistedSiteThemeEntry,
    getPageFaviconUrlResolver,
    getBrandAccentForUrl,
    extractAverageColor,
    getProviderIcon,
    isHostFaviconVisitDirty,
    stableHashCode,
    getThemeSourceForSuggestion,
    areFaviconRenderCachesReady,
    faviconParts,
    faviconCacheRuntime
  } = deps;


  const THEME_ICON_LOAD_TIMEOUT_MS = 2400;
  const THEME_RESOLUTION_BATCH_SIZE = 2;
  const THEME_RESOLUTION_BATCH_DELAY_MS = 160;
  const normalizeFaviconHost = FaviconUrlKinds.normalizeFaviconHost;
  const isFaviconProxyUrl = FaviconUrlKinds.isFaviconProxyUrl;

  const siteThemeRequestPending = new Map<string, Promise<ThemeResult | null>>();
  const themeFaviconCandidateRequestPending = new Map<string, Promise<string[]>>();

  function getHighlightColors(theme: ViewTheme): { bg: string; border: string } {
    const resolvedTheme = getThemeForMode(theme);
    if (!resolvedTheme || !resolvedTheme._xIsBrand) {
      return {
        bg: 'var(--x-nt-hover-bg, #F3F4F6)',
        border: 'transparent'
      };
    }
    return {
      bg: resolvedTheme.highlightBg || '',
      border: resolvedTheme.highlightBorder || ''
    };
  }

  function getHostFromUrl(url: string): string {
    if (!url) {
      return '';
    }
    try {
      return normalizeHost(new URL(getCanonicalPageUrlForFavicon(url) || url).hostname);
    } catch {
      return '';
    }
  }

  function getCanonicalPageUrlForFavicon(url: string): string {
    return FaviconCanonical.getCanonicalPageUrlForFavicon(url);
  }

  // An RGB triple of whole channels from 0 to 255; null for anything else.
  function normalizeAccentRgb(value: unknown): ThemeRgb | null {
    if (!Array.isArray(value) || value.length !== 3) {
      return null;
    }
    const red = Math.round(Number(value[0]));
    const green = Math.round(Number(value[1]));
    const blue = Math.round(Number(value[2]));
    return [red, green, blue].every((channel) => Number.isFinite(channel) && channel >= 0 && channel <= 255)
      ? [red, green, blue]
      : null;
  }

  function isNeutralThemeAccent(value: unknown): boolean {
    const rgb = normalizeAccentRgb(value);
    if (!rgb) {
      return false;
    }
    return FaviconThemeColor.isNeutralThemeColor(rgb);
  }

  function normalizeThemeConfidence(value: unknown, accentRgb: unknown): ThemeConfidence {
    const confidence = String(value || '').trim().toLowerCase();
    if (confidence === 'color' || confidence === 'neutral') {
      return confidence;
    }
    return isNeutralThemeAccent(accentRgb) ? 'neutral' : 'color';
  }

  function normalizeThemeSource(source: unknown): ThemeSource {
    const value = String(source || '').trim().toLowerCase();
    if (
      value === 'brand' ||
      value === 'mask-icon' ||
      value === 'meta' ||
      value === 'manifest' ||
      value === 'favicon' ||
      value === 'url'
    ) {
      return value;
    }
    return 'fallback';
  }

  function getThemeSourcePriority(source: unknown, theme?: ThemeLike | null): number {
    const value = normalizeThemeSource(source);
    if (value === 'brand') {
      return 40;
    }
    if (value === 'mask-icon') {
      return 38;
    }
    if (value === 'meta') {
      return theme && isLowConfidenceTheme(theme) ? 20 : 34;
    }
    if (value === 'manifest') {
      return theme && isLowConfidenceTheme(theme) ? 18 : 32;
    }
    if (value === 'favicon') {
      return 24;
    }
    if (value === 'url') {
      return 18;
    }
    return 10;
  }

  function getThemeSource(theme: ThemeLike | null | undefined): ThemeSource {
    if (!theme) {
      return 'fallback';
    }
    return normalizeThemeSource(theme._xThemeSource || (theme._xIsDefault ? 'fallback' : (theme._xIsBrand ? 'brand' : 'fallback')));
  }

  function getThemeColorFingerprint(theme: ThemeVariant): string {
    const rgb = theme && normalizeAccentRgb(theme.accentRgb || parseCssColor(theme.accent));
    return (rgb || defaultAccentColor).join(',');
  }

  function buildThemeFromAccent(accentRgb: unknown, source: unknown): ThemeVariant {
    const rgb = normalizeAccentRgb(accentRgb);
    if (!rgb) {
      return defaultTheme;
    }
    const theme = buildTheme(rgb);
    const normalizedSource = normalizeThemeSource(source);
    const confidence = normalizeThemeConfidence(null, rgb);
    theme._xThemeSource = normalizedSource;
    theme._xIsBrand = normalizedSource !== 'fallback';
    theme._xIsDefault = normalizedSource === 'fallback';
    theme._xThemeNeutral = confidence === 'neutral';
    theme._xThemeConfidence = confidence;
    return theme;
  }

  function buildThemeFromThemeResult(result: ThemeResult | null | undefined, fallbackSource: unknown): ThemeVariant | null {
    const accentRgb = result ? normalizeAccentRgb(result.accentRgb) : null;
    if (!accentRgb) {
      return null;
    }
    const source = normalizeThemeSource((result && result.source) || fallbackSource || 'meta');
    const confidence = normalizeThemeConfidence(result && result.confidence, accentRgb);
    const theme = buildThemeFromAccent(accentRgb, source);
    theme._xThemeNeutral = result && typeof result.neutral === 'boolean'
      ? result.neutral
      : confidence === 'neutral';
    theme._xThemeConfidence = confidence;
    return theme;
  }

  function isLowConfidenceTheme(theme: ThemeLike | null | undefined): boolean {
    if (!theme) {
      return false;
    }
    const source = getThemeSource(theme);
    if (source !== 'meta' && source !== 'manifest') {
      return false;
    }
    const accentRgb = normalizeAccentRgb(theme.accentRgb || parseCssColor(theme.accent));
    const confidence = normalizeThemeConfidence(theme._xThemeConfidence, accentRgb);
    return theme._xThemeNeutral === true || confidence === 'neutral';
  }

  function isPersistableTheme(theme: ThemeLike | null | undefined): boolean {
    const source = getThemeSource(theme);
    return source === 'brand' ||
      source === 'mask-icon' ||
      source === 'meta' ||
      source === 'manifest' ||
      source === 'favicon';
  }

  function getProviderThemeHost(provider: Partial<SiteSearchProvider> | null | undefined): string {
    return normalizeHost(getProviderHost(provider));
  }

  function getThemeHostForSuggestion(suggestion: ThemeSubject | null | undefined): string {
    if (!suggestion) {
      return '';
    }
    if (suggestion.provider) {
      return getProviderThemeHost(suggestion.provider);
    }
    if (suggestion.url) {
      return getHostFromUrl(suggestion.url);
    }
    if (suggestion.favicon) {
      return getHostFromUrl(suggestion.favicon);
    }
    return '';
  }

  function getThemePageUrlForSuggestion(suggestion: ThemeSubject | null | undefined, hostKey: string): string {
    if (suggestion && suggestion.url) {
      try {
        const parsed = new URL(getCanonicalPageUrlForFavicon(suggestion.url) || suggestion.url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          return parsed.href;
        }
      } catch {
        // Ignore malformed URLs.
      }
    }
    const host = normalizeHost(hostKey || '');
    return host ? `https://${host}/` : '';
  }

  function refreshThemeConsumersForHost(hostKey: string, theme: ThemeVariant): void {
    const normalizedHost = normalizeHost(hostKey);
    if (!normalizedHost || !theme) {
      return;
    }
    if (searchMode.site && getProviderThemeHost(searchMode.site) === normalizedHost) {
      modeActions.setSiteSearchPrefix(searchMode.site, theme);
    }
    siteThemeEvents.emit('changed', { host: normalizedHost, theme });
  }

  function setResolvedThemeForHost(hostKey: string, theme: ThemeVariant | null | undefined, options?: ResolvedThemeOptions): ThemeVariant {
    const normalizedHost = normalizeHost(hostKey);
    const nextTheme = theme || defaultTheme;
    const iconUrl = options && options.iconUrl ? String(options.iconUrl) : '';
    if (iconUrl) {
      themeColorCache.set(iconUrl, nextTheme);
    }
    if (!normalizedHost) {
      return nextTheme;
    }
    const currentTheme = themeHostCache.get(normalizedHost);
    if (
      currentTheme &&
      getThemeSourcePriority(getThemeSource(currentTheme), currentTheme) >
        getThemeSourcePriority(getThemeSource(nextTheme), nextTheme)
    ) {
      if (iconUrl) {
        themeColorCache.set(iconUrl, currentTheme);
      }
      return currentTheme;
    }
    const previousFingerprint = currentTheme ? getThemeFingerprint(currentTheme) : '';
    const nextFingerprint = getThemeFingerprint(nextTheme);
    if (currentTheme && previousFingerprint === nextFingerprint) {
      return currentTheme;
    }
    const shouldRefreshConsumers = !currentTheme ||
      getThemeColorFingerprint(currentTheme) !== getThemeColorFingerprint(nextTheme);
    themeHostCache.set(normalizedHost, nextTheme);
    if (isPersistableTheme(nextTheme) && (!options || options.persist !== false)) {
      setPersistedSiteThemeEntry(normalizedHost, nextTheme);
    }
    if (shouldRefreshConsumers && (!options || options.refresh !== false)) {
      refreshThemeConsumersForHost(normalizedHost, nextTheme);
    }
    return nextTheme;
  }

  function getPersistedThemeForHost(hostKey: string): ThemeVariant | null {
    const normalizedHost = normalizeHost(hostKey);
    if (!normalizedHost) {
      return null;
    }
    const entry = getPersistedSiteThemeEntry(normalizedHost);
    const accentRgb = entry ? normalizeAccentRgb(entry.accentRgb) : null;
    if (!entry || !accentRgb) {
      return null;
    }
    // Entries saved before placeholder globes were filtered out.
    if (normalizeThemeSource(entry.source) === 'favicon' && FaviconThemeColor.isPlaceholderFaviconColor(accentRgb)) {
      return null;
    }
    const theme = buildThemeFromThemeResult(entry, entry.source);
    if (!theme) {
      return null;
    }
    if (isLowConfidenceTheme(theme)) {
      return theme;
    }
    return setResolvedThemeForHost(normalizedHost, theme, { persist: false, refresh: false });
  }

  function requestSiteThemeColor(pageUrl: string, hostKey: string): Promise<ThemeResult | null> {
    const url = String(pageUrl || '').trim();
    const host = normalizeHost(hostKey);
    if (!url || !host || !chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      return Promise.resolve(null);
    }
    const requestKey = `${host}::${url}::${getFaviconPreferredTheme()}`;
    const pendingRequest = siteThemeRequestPending.get(requestKey);
    if (pendingRequest) {
      return pendingRequest;
    }
    const promise = new Promise<ThemeResult | null>((resolve) => {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'resolveSiteThemeColor',
        url,
        host,
        preferredTheme: getFaviconPreferredTheme()
      }, (response) => {
        const accentRgb = response ? normalizeAccentRgb(response.accentRgb) : null;
        resolve(response && accentRgb ? {
          accentRgb,
          source: response.source || 'meta',
          neutral: response.neutral === true,
          confidence: normalizeThemeConfidence(response.confidence, accentRgb)
        } : null);
      });
    }).catch(() => null).then((result) => {
      siteThemeRequestPending.delete(requestKey);
      return result;
    });
    siteThemeRequestPending.set(requestKey, promise);
    return promise;
  }

  function getThemeFaviconCandidateUrls(urls: readonly string[]): string[] {
    return FaviconThemedCandidates.getThemeFaviconCandidateUrls(urls, { includeProxy: true });
  }

  function requestThemeFaviconCandidates(pageUrl: string, hostKey: string): Promise<string[]> {
    const url = String(pageUrl || '').trim();
    const host = normalizeHost(hostKey);
    if (!url || !host || !chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      return Promise.resolve([]);
    }
    const requestKey = `${host}::${url}::${getFaviconPreferredTheme()}`;
    const pendingCandidates = themeFaviconCandidateRequestPending.get(requestKey);
    if (pendingCandidates) {
      return pendingCandidates;
    }
    const promise = new Promise<string[]>((resolve) => {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'resolveFaviconCandidates',
        url,
        host,
        fallbackUrl: '',
        preferredTheme: getFaviconPreferredTheme(),
        excludeChromeFallback: true
      }, (response) => {
        resolve(getThemeFaviconCandidateUrls(response ? response.urls : []));
      });
    }).catch((): string[] => []).then((result) => {
      themeFaviconCandidateRequestPending.delete(requestKey);
      return result;
    });
    themeFaviconCandidateRequestPending.set(requestKey, promise);
    return promise;
  }

  function getThemeFromUrl(rawUrl: string, hostOverride?: string, options?: ImageThemeOptions): Promise<ThemeVariant> {
    const resolver = getPageFaviconUrlResolver();
    const url = resolver ? resolver.getSafeFaviconCandidateUrl(rawUrl, '', 'theme') : '';
    if (!url) {
      return Promise.resolve(defaultTheme);
    }
    const hostKey = normalizeHost(hostOverride || getHostFromUrl(url));
    const isProxy = isFaviconProxyUrl(url);
    const useHostCache = hostKey && (!isProxy || Boolean(hostOverride));
    const preferIconTheme = Boolean(options && options.preferIconTheme);
    if (useHostCache && !preferIconTheme && themeHostCache.has(hostKey)) {
      const cachedTheme = themeHostCache.get(hostKey);
      if (
        cachedTheme &&
        !cachedTheme._xIsDefault &&
        getThemeSourcePriority(getThemeSource(cachedTheme), cachedTheme) >= getThemeSourcePriority('favicon')
      ) {
        return Promise.resolve(cachedTheme);
      }
    }
    if (themeColorCache.has(url)) {
      const cachedTheme = themeColorCache.get(url);
      if (cachedTheme && !isLowConfidenceTheme(cachedTheme)) {
        return Promise.resolve(cachedTheme);
      }
    }
    const brandAccent = (isProxy && hostOverride) ? null : getBrandAccentForUrl(url);
    if (brandAccent) {
      const brandTheme = buildThemeFromAccent(brandAccent, 'brand');
      themeColorCache.set(url, brandTheme);
      if (useHostCache) {
        setResolvedThemeForHost(hostKey, brandTheme, { iconUrl: url });
      }
      return Promise.resolve(brandTheme);
    }
    const cachedFaviconData = faviconParts.dataCache.get(url);
    if (cachedFaviconData) {
      return loadThemeFromImageSource(url, cachedFaviconData, hostKey, Boolean(useHostCache), { preferIconTheme });
    }
    const faviconView = faviconParts.view;
    const faviconData = faviconView ? faviconView.requestFaviconData(url) : Promise.resolve(null);
    return withThemeTimeout(faviconData, THEME_ICON_LOAD_TIMEOUT_MS, null).then((dataUrl) => {
      if (dataUrl) {
        return loadThemeFromImageSource(url, dataUrl, hostKey, Boolean(useHostCache), { preferIconTheme });
      }
      if (isProxy) {
        themeColorCache.set(url, defaultTheme);
        return defaultTheme;
      }
      return loadThemeFromImageSource(url, url, hostKey, Boolean(useHostCache), { crossOrigin: true, preferIconTheme });
    });
  }

  function withThemeTimeout<T, F>(promise: Promise<T>, timeoutMs: number, fallbackValue: F): Promise<T | F> {
    return new Promise((resolve) => {
      let settled = false;
      const timer = Number.isFinite(timeoutMs) && timeoutMs > 0
        ? window.setTimeout(() => finish(fallbackValue), timeoutMs)
        : null;
      function finish(value: T | F): void {
        if (settled) {
          return;
        }
        settled = true;
        if (timer !== null) {
          window.clearTimeout(timer);
        }
        resolve(value);
      }
      promise.then(finish).catch(() => finish(fallbackValue));
    });
  }

  function loadThemeFromImageSource(
    url: string,
    imageSource: string,
    hostKey: string,
    useHostCache: boolean,
    options?: ImageThemeOptions
  ): Promise<ThemeVariant> {
    return new Promise((resolve) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        themeColorCache.set(url, defaultTheme);
        finish(defaultTheme);
      }, THEME_ICON_LOAD_TIMEOUT_MS);
      function finish(theme: ThemeVariant | null): void {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timer);
        resolve(theme || defaultTheme);
      }
      const image = new Image();
      if (options && options.crossOrigin) {
        image.crossOrigin = 'anonymous';
      }
      image.onload = function() {
        const avg = extractAverageColor(image);
        // A generic globe says nothing about the site; treat it as unresolved so
        // it neither tints this consumer nor leaks into the host cache.
        if (!avg || FaviconThemeColor.isPlaceholderFaviconColor(avg)) {
          themeColorCache.set(url, defaultTheme);
          finish(defaultTheme);
          return;
        }
        const theme = buildThemeFromAccent(avg, 'favicon');
        themeColorCache.set(url, theme);
        if (useHostCache) {
          // A higher-priority host theme would otherwise replace this icon's
          // own cache entry; icon-first consumers keep what they measured.
          setResolvedThemeForHost(hostKey, theme, {
            iconUrl: options && options.preferIconTheme ? '' : url
          });
        }
        finish(theme);
      };
      image.onerror = function() {
        themeColorCache.set(url, defaultTheme);
        finish(defaultTheme);
      };
      image.src = imageSource;
    });
  }

  function buildAndCacheBrandThemeForHost(hostKey: string, iconUrl: string): ThemeVariant | null {
    const normalizedHost = normalizeHost(hostKey);
    if (!normalizedHost) {
      return null;
    }
    const brandAccent = getBrandAccentForHost(normalizedHost);
    if (!brandAccent) {
      return null;
    }
    const brandTheme = buildThemeFromAccent(brandAccent, 'brand');
    setResolvedThemeForHost(normalizedHost, brandTheme, {
      iconUrl,
      refresh: false
    });
    if (iconUrl) {
      themeColorCache.set(iconUrl, brandTheme);
    }
    return brandTheme;
  }

  function getThemeFromResolvedFaviconCandidates(pageUrl: string, hostKey: string, iconUrl: string): Promise<ThemeVariant> {
    return requestThemeFaviconCandidates(pageUrl, hostKey).then((candidateUrls) => {
      const candidates = getThemeFaviconCandidateUrls([
        ...candidateUrls,
        iconUrl
      ]);
      let index = 0;
      const next = (): Promise<ThemeVariant> => {
        const candidate = candidates[index];
        index += 1;
        if (!candidate) {
          return Promise.resolve(defaultTheme);
        }
        return getThemeFromUrl(candidate, hostKey).then((theme) => {
          if (theme && !theme._xIsDefault) {
            return theme;
          }
          return next();
        });
      };
      return next();
    });
  }

  function resolveThemeWithFaviconFallback(
    hostKey: string,
    iconUrl: string,
    persistedTheme: ThemeVariant | null,
    siteTheme: ThemeResult | null,
    pageUrl: string
  ): Promise<ThemeVariant> {
    const siteThemeValue = siteTheme ? buildThemeFromThemeResult(siteTheme, siteTheme.source || 'meta') : null;
    if (siteThemeValue && !isLowConfidenceTheme(siteThemeValue)) {
      return Promise.resolve(setResolvedThemeForHost(hostKey, siteThemeValue, { iconUrl }));
    }
    return getThemeFromUrl(iconUrl, hostKey).then((theme) => {
      if (theme && !theme._xIsDefault) {
        return theme;
      }
      return getThemeFromResolvedFaviconCandidates(pageUrl, hostKey, iconUrl).then((candidateTheme) => {
        if (candidateTheme && !candidateTheme._xIsDefault) {
          return candidateTheme;
        }
        if (siteThemeValue) {
          return setResolvedThemeForHost(hostKey, siteThemeValue, { iconUrl });
        }
        if (persistedTheme) {
          return setResolvedThemeForHost(hostKey, persistedTheme, {
            iconUrl,
            persist: false
          });
        }
        return defaultTheme;
      });
    });
  }

  function getThemeForProvider(provider: Partial<SiteSearchProvider>): Promise<ThemeVariant> {
    const hostKey = getProviderThemeHost(provider);
    const providerPageUrl = getThemePageUrlForSuggestion({ provider }, hostKey);
    const resolver = getPageFaviconUrlResolver();
    const iconUrl = resolver ? resolver.resolveFaviconSource(getProviderIcon(provider), providerPageUrl) : '';
    const cachedTheme = hostKey ? themeHostCache.get(hostKey) : undefined;
    if (cachedTheme && !isLowConfidenceTheme(cachedTheme)) {
      return Promise.resolve(cachedTheme);
    }
    const cachedIconTheme = iconUrl ? themeColorCache.get(iconUrl) : undefined;
    if (cachedIconTheme && !isLowConfidenceTheme(cachedIconTheme)) {
      return Promise.resolve(cachedIconTheme);
    }
    const brandTheme = buildAndCacheBrandThemeForHost(hostKey, iconUrl);
    if (brandTheme) {
      return Promise.resolve(brandTheme);
    }
    const persistedTheme = getPersistedThemeForHost(hostKey);
    if (persistedTheme && !isHostFaviconVisitDirty(hostKey) && !isLowConfidenceTheme(persistedTheme)) {
      return Promise.resolve(persistedTheme);
    }
    const pageUrl = providerPageUrl;
    return requestSiteThemeColor(pageUrl, hostKey).then((siteTheme) => {
      return resolveThemeWithFaviconFallback(hostKey, iconUrl, persistedTheme, siteTheme, pageUrl);
    });
  }

  function shouldUseBrandTheme(suggestion: ThemeSubject | null | undefined): suggestion is ThemeSubject {
    if (!suggestion) {
      return false;
    }
    const neutralTypes = ['googleSuggest', 'newtab', 'modeSwitch', 'zenSwitch', 'webAppearanceSwitch', 'chatgpt', 'perplexity', 'commandNewTab', 'commandSettings', 'commandDocumentPip'];
    if (neutralTypes.includes(String(suggestion.type || ''))) {
      return false;
    }
    return true;
  }

  function getCustomShortcutThemeImageDataUrl(suggestion: ThemeSubject): string {
    const dataUrl = String(
      suggestion && suggestion.customIconDataUrl
        ? suggestion.customIconDataUrl
        : ''
    ).trim();
    return /^data:image\/(?:png|jpe?g|webp);base64,/i.test(dataUrl)
      ? dataUrl
      : '';
  }

  function getCustomShortcutThemeCacheKey(dataUrl: string): string {
    const source = String(dataUrl || '');
    return source
      ? `shortcut-custom-icon:${source.length}:${stableHashCode(source)}`
      : '';
  }

  function markCustomShortcutTheme(theme: ThemeVariant | null | undefined): ThemeVariant {
    if (theme && theme !== defaultTheme && !theme._xIsDefault) {
      theme._xIsCustomShortcutIcon = true;
    }
    return theme || defaultTheme;
  }

  // The theme a shortcut tile takes when its site's theme changes: the one
  // read from the upload, snapshot or glyph it shows, or else the site's.
  function getTileThemeOnSiteChange(suggestion: ThemeSubject, siteTheme: ThemeVariant): Promise<ThemeVariant> {
    if (!suggestion.customIconDataUrl && (!suggestion.url || !getThemeSourceForSuggestion(suggestion))) {
      return Promise.resolve(siteTheme);
    }
    return getThemeForSuggestion(suggestion).then((iconTheme) => iconTheme || defaultTheme);
  }

  function getThemeForSuggestion(suggestion: ThemeSubject | null | undefined): Promise<ThemeVariant> {
    if (!shouldUseBrandTheme(suggestion)) {
      return Promise.resolve(defaultTheme);
    }
    const customShortcutIcon = getCustomShortcutThemeImageDataUrl(suggestion);
    if (customShortcutIcon) {
      const customThemeCacheKey = getCustomShortcutThemeCacheKey(customShortcutIcon);
      if (customThemeCacheKey && themeColorCache.has(customThemeCacheKey)) {
        return Promise.resolve(markCustomShortcutTheme(
          themeColorCache.get(customThemeCacheKey)
        ));
      }
      return loadThemeFromImageSource(
        customThemeCacheKey,
        customShortcutIcon,
        '',
        false
      ).then(markCustomShortcutTheme);
    }
    if (suggestion.provider) {
      return getThemeForProvider(suggestion.provider);
    }
    const hostKey = getThemeHostForSuggestion(suggestion);
    const iconUrl = getThemeSourceForSuggestion(suggestion);
    const brandTheme = buildAndCacheBrandThemeForHost(hostKey, iconUrl);
    if (brandTheme) {
      return Promise.resolve(brandTheme);
    }
    if (suggestion.type === 'shortcut') {
      // Tint from the artwork the tile actually shows, not whatever icon another
      // surface happened to load for the same host.
      if (!iconUrl) {
        return Promise.resolve(defaultTheme);
      }
      return getThemeFromUrl(iconUrl, hostKey, { preferIconTheme: true }).then((theme) => {
        if (theme && !theme._xIsDefault) {
          return theme;
        }
        const hostTheme = hostKey ? themeHostCache.get(hostKey) : null;
        return hostTheme && !hostTheme._xIsDefault && !isLowConfidenceTheme(hostTheme)
          ? hostTheme
          : theme;
      });
    }
    const persistedTheme = getPersistedThemeForHost(hostKey);
    if (persistedTheme && !isHostFaviconVisitDirty(hostKey) && !isLowConfidenceTheme(persistedTheme)) {
      return Promise.resolve(persistedTheme);
    }
    const pageUrl = getThemePageUrlForSuggestion(suggestion, hostKey);
    return requestSiteThemeColor(pageUrl, hostKey).then((siteTheme) => {
      return resolveThemeWithFaviconFallback(hostKey, iconUrl, persistedTheme, siteTheme, pageUrl);
    });
  }

  function getImmediateThemeForSuggestion(suggestion: ThemeSubject | null | undefined): ThemeVariant {
    if (!shouldUseBrandTheme(suggestion)) {
      return defaultTheme;
    }
    const customShortcutIcon = getCustomShortcutThemeImageDataUrl(suggestion);
    if (customShortcutIcon) {
      const customThemeCacheKey = getCustomShortcutThemeCacheKey(customShortcutIcon);
      return customThemeCacheKey && themeColorCache.has(customThemeCacheKey)
        ? markCustomShortcutTheme(themeColorCache.get(customThemeCacheKey))
        : defaultTheme;
    }
    if (suggestion.provider) {
      const hostKey = getProviderThemeHost(suggestion.provider);
      const iconUrl = getProviderIcon(suggestion.provider);
      const cachedTheme = hostKey ? themeHostCache.get(hostKey) : undefined;
      if (cachedTheme && !isLowConfidenceTheme(cachedTheme)) {
        return cachedTheme;
      }
      const cachedIconTheme = iconUrl ? themeColorCache.get(iconUrl) : undefined;
      if (cachedIconTheme && !isLowConfidenceTheme(cachedIconTheme)) {
        return cachedIconTheme;
      }
      const brandTheme = buildAndCacheBrandThemeForHost(hostKey, iconUrl);
      if (brandTheme) {
        return brandTheme;
      }
      const persistedTheme = getPersistedThemeForHost(hostKey);
      if (persistedTheme && !isLowConfidenceTheme(persistedTheme)) {
        return persistedTheme;
      }
      return defaultTheme;
    }
    if (suggestion.url) {
      const hostKey = getHostFromUrl(suggestion.url);
      if (suggestion.type === 'shortcut') {
        const iconUrl = getThemeSourceForSuggestion(suggestion);
        const iconTheme = iconUrl ? themeColorCache.get(iconUrl) : null;
        if (iconTheme && !iconTheme._xIsDefault) {
          return iconTheme;
        }
      }
      const cachedTheme = hostKey ? themeHostCache.get(hostKey) : undefined;
      if (cachedTheme && !isLowConfidenceTheme(cachedTheme)) {
        return cachedTheme;
      }
      const cachedUrlTheme = themeColorCache.get(suggestion.url);
      if (cachedUrlTheme && !isLowConfidenceTheme(cachedUrlTheme)) {
        return cachedUrlTheme;
      }
      const brandTheme = buildAndCacheBrandThemeForHost(hostKey, suggestion.url);
      if (brandTheme) {
        return brandTheme;
      }
      const persistedTheme = getPersistedThemeForHost(hostKey);
      if (persistedTheme && !isLowConfidenceTheme(persistedTheme)) {
        return persistedTheme;
      }
      return defaultTheme;
    }
    return defaultTheme;
  }

  function shouldUseUrlFallbackThemeForSuggestion(suggestion: ThemeSubject | null | undefined, theme: ViewTheme): boolean {
    if (!suggestion || !shouldUseBrandTheme(suggestion)) {
      return false;
    }
    const resolvedTheme = theme || defaultTheme;
    if (!resolvedTheme._xIsDefault && !isLowConfidenceTheme(resolvedTheme)) {
      return false;
    }
    const iconUrl = getThemeSourceForSuggestion(suggestion);
    return Boolean(iconUrl && isFaviconProxyUrl(iconUrl));
  }

  const themeResolutionQueue: ThemeResolutionItem[] = [];
  const queuedThemeResolutionByTarget = new WeakMap<Element, ThemeResolutionItem>();
  let themeResolutionSequence = 0;
  let themeResolutionFlushTimer: number | null = null;
  let themeResolutionCacheWaitStarted = false;

  function scheduleThemeResolutionFlush(delayMs: number): void {
    if (themeResolutionFlushTimer !== null) {
      return;
    }
    themeResolutionFlushTimer = window.setTimeout(() => {
      themeResolutionFlushTimer = null;
      flushThemeResolutionQueue();
    }, Math.max(0, Number(delayMs) || 0));
  }

  function flushThemeResolutionQueue(): void {
    if (themeResolutionQueue.length === 0) {
      return;
    }
    if (!areFaviconRenderCachesReady()) {
      if (!themeResolutionCacheWaitStarted && faviconCacheRuntime) {
        themeResolutionCacheWaitStarted = true;
        void faviconCacheRuntime.ensureCachesReady().then(() => {
          themeResolutionCacheWaitStarted = false;
          scheduleThemeResolutionFlush(0);
        });
      }
      return;
    }
    themeResolutionQueue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.sequence - b.sequence;
    });
    const batch = themeResolutionQueue.splice(0, THEME_RESOLUTION_BATCH_SIZE);
    batch.forEach((item) => {
      if (!item.target.isConnected) {
        return;
      }
      if (queuedThemeResolutionByTarget.get(item.target) !== item) {
        return;
      }
      queuedThemeResolutionByTarget.delete(item.target);
      void getThemeForSuggestion(item.suggestion).then((theme) => {
        if (!item.target.isConnected) {
          return;
        }
        item.applyTheme(theme || defaultTheme);
      });
    });
    if (themeResolutionQueue.length > 0) {
      scheduleThemeResolutionFlush(THEME_RESOLUTION_BATCH_DELAY_MS);
    }
  }

  // Resolves the subject's theme for the element in a batch, then applies
  // it while the element is still on the page.
  function queueThemeForTarget(
    target: Element,
    suggestion: ThemeSubject,
    applyTheme: (theme: ThemeVariant) => void,
    options?: { priority?: number; delayMs?: number }
  ): void {
    if (!shouldUseBrandTheme(suggestion)) {
      return;
    }
    const existing = queuedThemeResolutionByTarget.get(target);
    const priority = options && options.priority !== undefined && Number.isFinite(options.priority) ? options.priority : 1;
    themeResolutionSequence += 1;
    const item: ThemeResolutionItem = {
      target,
      suggestion,
      applyTheme,
      priority,
      sequence: themeResolutionSequence
    };
    if (existing) {
      existing.suggestion = item.suggestion;
      existing.applyTheme = item.applyTheme;
      existing.priority = Math.min(existing.priority, item.priority);
      existing.sequence = item.sequence;
    } else {
      queuedThemeResolutionByTarget.set(target, item);
      themeResolutionQueue.push(item);
    }
    scheduleThemeResolutionFlush(options && options.delayMs !== undefined && Number.isFinite(options.delayMs)
      ? options.delayMs
      : THEME_RESOLUTION_BATCH_DELAY_MS);
  }

  function isNewtabDarkMode(): boolean {
    return document.body.getAttribute('data-theme') === 'dark';
  }

  function getFaviconPreferredTheme(): 'dark' | 'light' {
    return isNewtabDarkMode() ? 'dark' : 'light';
  }

  function getThemeForMode<T extends ThemeLike>(theme: T | null | undefined): T | ThemeVariant {
    return getThemeVariantForMode(theme, {
      defaultTheme,
      isDarkMode: isNewtabDarkMode
    });
  }

  function getHoverColors(theme: ViewTheme): HoverColors {
    return getModeHoverColors(theme, {
      defaultTheme,
      isDarkMode: isNewtabDarkMode
    });
  }

  function getNeutralHoverActionColors(): HoverColors {
    return isNewtabDarkMode()
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

  function applyThemeVariables(target: HTMLElement, theme: ViewTheme): void {
    if (!theme) {
      return;
    }
    const resolvedTheme = getThemeForMode(theme);
    target.style.setProperty('--x-ext-mark-bg', resolvedTheme.markBg || '');
    target.style.setProperty('--x-ext-mark-text', resolvedTheme.markText || '');
    target.style.setProperty('--x-ext-tag-bg', resolvedTheme.tagBg || '');
    target.style.setProperty('--x-ext-tag-text', resolvedTheme.tagText || '');
    target.style.setProperty('--x-ext-tag-border', resolvedTheme.tagBorder || '');
    target.style.setProperty('--x-ext-key-bg', resolvedTheme.keyBg || '');
    target.style.setProperty('--x-ext-key-text', resolvedTheme.keyText || '');
    target.style.setProperty('--x-ext-key-border', resolvedTheme.keyBorder || '');
    target.style.setProperty('--x-ext-icon-color', resolvedTheme.accent || '');
    const highlight = getHighlightColors(theme);
    const hover: { bg: string; border: string } = resolvedTheme._xIsBrand
      ? getHoverColors(theme)
      : {
        bg: 'var(--x-nt-hover-bg, #F3F4F6)',
        border: 'transparent'
    };
    target.style.setProperty('--x-nt-suggestion-active-bg', highlight.bg);
    target.style.setProperty('--x-nt-suggestion-hover-bg', hover.bg);
  }

  function applyMarkVariables(target: HTMLElement, theme: ViewTheme, active: boolean): void {
    if (!theme) {
      return;
    }
    const resolvedTheme = getThemeForMode(theme);
    const markBg = active
      ? resolvedTheme.activeMarkBg || resolvedTheme.markBg
      : resolvedTheme.markBg;
    const markText = active
      ? resolvedTheme.activeMarkText || resolvedTheme.markText
      : resolvedTheme.markText;
    target.style.setProperty('--x-ext-mark-bg', markBg || '');
    target.style.setProperty('--x-ext-mark-text', markText || '');
  }


  // Stores a theme strong enough to keep; false when it is not one.
  function setPersistedSiteThemeEntry(hostKey: string, theme: ThemeVariant | null | undefined): boolean {
    if (!theme || !isPersistableTheme(theme)) {
      return false;
    }
    const accentRgb = normalizeAccentRgb(theme.accentRgb || parseCssColor(theme.accent));
    if (!accentRgb) {
      return false;
    }
    return faviconCacheRuntime.setPersistedThemeEntry(hostKey, {
      accentRgb,
      source: getThemeSource(theme),
      neutral: isLowConfidenceTheme(theme) || theme._xThemeNeutral === true,
      confidence: normalizeThemeConfidence(theme._xThemeConfidence, accentRgb)
    });
  }
  return {
    normalizeFaviconHost,
    isFaviconProxyUrl,
    themeColorCache,
    themeHostCache,
    getHostFromUrl,
    getCanonicalPageUrlForFavicon,
    normalizeAccentRgb,
    normalizeThemeConfidence,
    getThemeSourcePriority,
    getThemeSource,
    buildThemeFromAccent,
    isLowConfidenceTheme,
    isPersistableTheme,
    getProviderThemeHost,
    getThemeHostForSuggestion,
    setResolvedThemeForHost,
    getThemeForProvider,
    getThemeForSuggestion,
    getTileThemeOnSiteChange,
    getImmediateThemeForSuggestion,
    shouldUseUrlFallbackThemeForSuggestion,
    scheduleThemeResolutionFlush,
    queueThemeForTarget,
    isNewtabDarkMode,
    getThemeForMode,
    getHoverColors,
    getNeutralHoverActionColors,
    applyThemeVariables,
    applyMarkVariables
  };
}

type SiteThemeResolver = ReturnType<typeof createSiteThemeResolver>;

export { createSiteThemeResolver };
export type { SiteThemeResolver, SiteThemeResolverDeps };
