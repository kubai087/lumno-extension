import * as LumnoFaviconViewCore from '../shared/favicon/favicon-view-core';
import type { FaviconImage } from '../shared/favicon/favicon-pixels';
import type { FaviconViewCoreOptions, FaviconViewWindow, FaviconWarmItem } from '../shared/favicon/favicon-view-core';
import * as LumnoMessaging from '../platform/messaging';
import type { MessageRuntime } from '../platform/messaging';
import { queryHtmlTags } from '../shared/dom-lookup';
import type { FaviconChromeApi, FaviconDecisionLogger, FaviconPlanCandidate } from '../domain/favicon/types';
import * as FaviconCanonical from '../domain/favicon/canonical';
import * as FaviconEnhancedFetchPolicy from '../domain/favicon/enhanced-fetch-policy';
import * as FaviconResolver from '../domain/favicon/resolver';
import * as FaviconUrlKinds from '../domain/favicon/url-kinds';

// An overlay favicon image and the attach session state kept on it.
type OverlayFaviconImage = FaviconImage & {
  // Raised by each attach, so callbacks of an older attach stop.
  _xOverlayThemeFaviconSession?: number;
  _xOverlayThemeFaviconLoadTimer?: number | null;
  _xOverlayThemeFaviconCandidateToken?: number;
  _xOverlayThemeFaviconErrorHandler?: (() => void) | null;
};

type OverlayFaviconWindow = FaviconViewWindow & Partial<Pick<Window, 'setTimeout' | 'clearTimeout'>>;

type FaviconDataListener = (url: string, dataUrl: string, hostKey?: string) => void;

interface OverlayFaviconViewOptions {
  document?: Document | null;
  windowObj?: OverlayFaviconWindow | null;
  chromeApi?: (FaviconChromeApi & { runtime?: FaviconChromeApi['runtime'] & MessageRuntime }) | null;
  getHostFromUrl?(url: string): string;
  getExtensionFaviconUrl?(pageUrl: string): string;
  getGstaticFaviconUrl?(pageUrl: string): string;
  getChromeFaviconUrl?(pageUrl: string): string;
  shouldBlockFaviconForHost?(host: string): boolean;
  shouldAvoidDirectFaviconForHost?(host: string): boolean;
  // Hosts whose icons the page under the overlay must not load directly.
  shouldBlockOverlayFaviconForHost?(host: string): boolean;
  isEnhancedFaviconFetchEnabled?(pageUrl: string): boolean;
  getStrictFaviconReason?(pageUrl: string): string;
  logFaviconDecision?: FaviconDecisionLogger;
  isFaviconProxyUrl?(url: string): boolean;
  isBlockedLocalFaviconUrl?(url: string): boolean;
  isChromeMonogramFaviconUrl?(url: string): boolean;
  hasThemeForHost?(hostKey: string): boolean;
  getOverlayPanel?(): Element | null;
  // The list's rows, which re-render with their icons on a policy change.
  getSuggestionRowsRoot?(): Element | null;
  setPersistedFaviconUrl?(key: string, url: string): void;
  setPersistedFaviconData?(key: string, dataUrl: string): void;
  requestFaviconData?(url: string, pageUrl?: string): Promise<string | null> | string | null;
  detectDefaultExtensionFavicon?: FaviconViewCoreOptions['detectDefaultExtensionFavicon'];
  faviconDataCache?: Map<string, string>;
  faviconDataPending?: Map<string, Promise<string | null>>;
  iconPreloadCache?: Map<string, HTMLImageElement>;
  faviconCandidateLoadTimeoutMs?: number;
}

// One attach of a page's icon: the sources to try and the session it
// belongs to.
interface FaviconAttachState {
  pageUrl: string;
  hostKey: string;
  rawFallbackUrl: string;
  fallbackUrl: string;
  primaryUrl: string;
  allowRemoteImage: boolean;
  extensionFavicon: string;
  browserUrl: string;
  gstaticFavicon: string;
  previousWorkingSrc: string;
  hasFailedHandler: boolean;
  handleFailed(): void;
  isSessionCurrent(): boolean;
  isSessionMounted(): boolean;
}

function noop(): void {}

function createOverlayFaviconViewRuntime(options?: OverlayFaviconViewOptions | null) {
  const config: OverlayFaviconViewOptions = options || {};
  const doc = config.document || (typeof document !== 'undefined' ? document : null);
  const win: OverlayFaviconWindow = config.windowObj || (typeof window !== 'undefined' ? window : {});
  const chromeApi = config.chromeApi || (typeof chrome !== 'undefined' ? chrome : {});
  const getHostFromUrl = typeof config.getHostFromUrl === 'function' ? config.getHostFromUrl : (() => '');
  const getExtensionFaviconUrl = typeof config.getExtensionFaviconUrl === 'function' ? config.getExtensionFaviconUrl : (() => '');
  const getGstaticFaviconUrl = typeof config.getGstaticFaviconUrl === 'function' ? config.getGstaticFaviconUrl : (() => '');
  const getChromeFaviconUrl = typeof config.getChromeFaviconUrl === 'function' ? config.getChromeFaviconUrl : (() => '');
  const shouldBlockFaviconForHost = typeof config.shouldBlockFaviconForHost === 'function' ? config.shouldBlockFaviconForHost : (() => false);
  const shouldAvoidDirectFaviconForHost = typeof config.shouldAvoidDirectFaviconForHost === 'function'
    ? config.shouldAvoidDirectFaviconForHost
    : (() => false);
  const shouldBlockOverlayFaviconForHost = typeof config.shouldBlockOverlayFaviconForHost === 'function'
    ? config.shouldBlockOverlayFaviconForHost
    : shouldBlockFaviconForHost;
  const isEnhancedFaviconFetchEnabled = typeof config.isEnhancedFaviconFetchEnabled === 'function'
    ? config.isEnhancedFaviconFetchEnabled
    : (() => true);
  const getStrictFaviconReason = typeof config.getStrictFaviconReason === 'function'
    ? config.getStrictFaviconReason
    : (() => '');
  const logFaviconDecision = typeof config.logFaviconDecision === 'function'
    ? config.logFaviconDecision
    : noop;
  const isFaviconProxyUrl = typeof config.isFaviconProxyUrl === 'function' ? config.isFaviconProxyUrl : (() => false);
  const isBlockedLocalFaviconUrl = typeof config.isBlockedLocalFaviconUrl === 'function'
    ? config.isBlockedLocalFaviconUrl
    : (() => false);
  const isChromeMonogramFaviconUrl = typeof config.isChromeMonogramFaviconUrl === 'function'
    ? config.isChromeMonogramFaviconUrl
    : ((url: string) => /^chrome:\/\/favicon2\//i.test(String(url || '').trim()));
  // Told of every icon's data as it arrives, so its theme can be read.
  const faviconDataListeners = new Set<FaviconDataListener>();
  const preloadThemeFromFavicon: FaviconDataListener = (url, dataUrl, hostKey) => {
    faviconDataListeners.forEach((listener) => listener(url, dataUrl, hostKey));
  };
  const hasThemeForHost = typeof config.hasThemeForHost === 'function' ? config.hasThemeForHost : (() => false);
  const getOverlayPanel: () => Element | null = typeof config.getOverlayPanel === 'function'
    ? config.getOverlayPanel
    : (() => null);
  const getSuggestionRowsRoot: () => Element | null = typeof config.getSuggestionRowsRoot === 'function'
    ? config.getSuggestionRowsRoot
    : (() => null);
  const setPersistedFaviconUrl = typeof config.setPersistedFaviconUrl === 'function'
    ? config.setPersistedFaviconUrl
    : noop;
  const setPersistedFaviconData = typeof config.setPersistedFaviconData === 'function'
    ? config.setPersistedFaviconData
    : noop;
  const requestFaviconDataFromBackground = typeof config.requestFaviconData === 'function'
    ? config.requestFaviconData
    : null;
  const faviconDataCache: Map<string, string> = config.faviconDataCache || new Map();
  const faviconDataPending: Map<string, Promise<string | null>> = config.faviconDataPending || new Map();
  const iconPreloadCache: Map<string, HTMLImageElement> = config.iconPreloadCache || new Map();
  const windowSetTimeout = win.setTimeout;
  const windowClearTimeout = win.clearTimeout;
  const setTimer = (callback: () => void, delay: number): number => (
    typeof windowSetTimeout === 'function' ? windowSetTimeout.call(win, callback, delay) : window.setTimeout(callback, delay)
  );
  const clearTimer = (id: number): void => {
    if (typeof windowClearTimeout === 'function') {
      windowClearTimeout.call(win, id);
    } else {
      window.clearTimeout(id);
    }
  };
  const configuredTimeoutMs = config.faviconCandidateLoadTimeoutMs;
  const faviconCandidateLoadTimeoutMs = typeof configuredTimeoutMs === 'number' && Number.isFinite(configuredTimeoutMs)
    ? Math.max(0, configuredTimeoutMs)
    : 2600;
  function isSourceAllowedByEnhancedFetchPolicy(url: string, pageUrl: string): boolean {
    return FaviconEnhancedFetchPolicy.isFaviconSourceAllowedByEnhancedFetchPolicy(
      url,
      isEnhancedFaviconFetchEnabled(pageUrl || url),
      { chromeApi, allowThirdPartyFetch: getStrictFaviconReason(pageUrl || url) !== 'exclusion' }
    );
  }
  const faviconResolverOptions = {
    chromeApi,
    size: 128,
    getExtensionFaviconUrl,
    getGstaticFaviconUrl,
    getChromeFaviconUrl,
    shouldBlockFaviconForHost,
    shouldAvoidDirectFaviconForHost,
    isBlockedLocalFaviconUrl,
    isEnhancedFaviconFetchEnabled,
    getStrictFaviconReason,
    logFaviconDecision
  };
  const faviconUrlResolver = FaviconResolver.createFaviconUrlResolver({
    ...faviconResolverOptions,
    shouldBlockFaviconForHost: shouldBlockOverlayFaviconForHost
  });
  const faviconDataSourceResolver = FaviconResolver.createFaviconUrlResolver(faviconResolverOptions);
  const faviconViewCoreApi = LumnoFaviconViewCore;
  const faviconViewCore = faviconViewCoreApi.createFaviconViewCore({
    document: doc,
    windowObj: win,
    chromeApi,
    getHostFromUrl,
    shouldBlockFaviconForHost: shouldBlockOverlayFaviconForHost,
    isBlockedLocalFaviconUrl: isBlockedOverlayFaviconUrl,
    showResolvedFavicon: (img) => showResolvedFavicon(img),
    showPendingFallbackIcon: (img) => showPendingFallbackIcon(img),
    getPersistCacheKey: (img) => img.getAttribute('data-x-ov-favicon-cache-key') || '',
    setPersistedFaviconUrl,
    setPersistedFaviconData,
    shouldPersistFaviconUrl: (url) => !isChromeMonogramFaviconUrl(url) && !isFaviconProxyUrl(url),
    requestFaviconData: config.requestFaviconData,
    preloadThemeFromFavicon,
    getThemeFaviconUrl: getGstaticFaviconUrl,
    hasThemeForHost,
    faviconDataCache,
    faviconDataPending,
    iconPreloadCache,
    detectDefaultExtensionFavicon: config.detectDefaultExtensionFavicon
  });
  const {
    applyFaviconOpticalShift,
    applyFaviconOpticalAlignment,
    setFaviconSrcWithAnimation,
    canReuseCurrentFavicon
  } = faviconViewCore;

  function setFaviconVisibility(img: FaviconImage | null, visibility: string): void {
    if (!img) {
      return;
    }
    if (visibility) {
      img.setAttribute('data-favicon-visibility', visibility);
    } else {
      img.removeAttribute('data-favicon-visibility');
    }
  }

  const {
    hideFallbackIconNode,
    showResolvedFavicon,
    showPendingFallbackIcon,
    applyFallbackIcon
  } = faviconViewCoreApi.createFallbackIconPresenter({
    fallbackClassName: '_x_extension_overlay_favicon_fallback_2026_unique_',
    // The suggestion row draws the fallback right after its image.
    getFallbackSibling: (img) => img.nextElementSibling,
    setImageVisible: (img, visible) => setFaviconVisibility(img, visible ? 'visible' : 'hidden'),
    clearCandidateTimer: clearOverlayCandidateLoadTimer,
    setTimer
  });

  function getSafeOverlayFaviconCandidateUrl(
    value: unknown,
    pageUrl?: string,
    candidateKind?: string,
    sourceOptions?: { allowRemoteImage?: boolean } | null
  ): string {
    return faviconUrlResolver.getSafeFaviconCandidateUrl(value, pageUrl, candidateKind, sourceOptions);
  }

  function isBrowserInternalPageUrl(url: string): boolean {
    return faviconUrlResolver.isBrowserInternalPageUrl(url);
  }

  function isBlockedOverlayFaviconUrl(url: string): boolean {
    return faviconUrlResolver.isBlockedFaviconUrl(url);
  }

  function getRuntimeExtensionFaviconUrl(pageUrl: string): string {
    return getSafeOverlayFaviconCandidateUrl(getRuntimeExtensionFaviconDataSourceUrl(pageUrl));
  }

  function getRuntimeExtensionFaviconDataSourceUrl(pageUrl: string): string {
    return isBrowserInternalPageUrl(pageUrl)
      ? faviconUrlResolver.getBrowserPageFaviconUrl(pageUrl)
      : faviconUrlResolver.getExtensionFaviconUrl(pageUrl);
  }

  function getRuntimeGstaticFaviconUrl(pageUrl: string): string {
    return getSafeOverlayFaviconCandidateUrl(getRuntimeGstaticFaviconDataSourceUrl(pageUrl));
  }

  function getRuntimeGstaticFaviconDataSourceUrl(pageUrl: string): string {
    return faviconDataSourceResolver.getSafeFaviconCandidateUrl(
      faviconDataSourceResolver.getGstaticFaviconUrl(pageUrl), pageUrl, 'third-party-proxy'
    );
  }

  function getRuntimeChromeFaviconUrl(pageUrl: string): string {
    return faviconUrlResolver.getChromeFaviconUrl(pageUrl);
  }

  function requestFaviconData(url: string, pageUrl: string): Promise<string | null> {
    if (!isSourceAllowedByEnhancedFetchPolicy(url, pageUrl)) {
      return Promise.resolve(null);
    }
    return faviconViewCore.requestFaviconData(url, pageUrl);
  }

  // An icon's data from the worker even on a host whose icons the page must
  // not load: the page then only renders local bytes.
  function requestFaviconDataBypassingOverlayBlock(url: string, pageUrl: string): Promise<string | null> {
    const sourceUrl = faviconDataSourceResolver.getSafeFaviconCandidateUrl(url, pageUrl || url, 'blocked-data');
    if (!sourceUrl) {
      return Promise.resolve(null);
    }
    if (!isSourceAllowedByEnhancedFetchPolicy(sourceUrl, pageUrl)) {
      return Promise.resolve(null);
    }
    if (sourceUrl.startsWith('data:')) {
      return Promise.resolve(sourceUrl);
    }
    if (!isBlockedOverlayFaviconUrl(sourceUrl)) {
      return requestFaviconData(sourceUrl, pageUrl);
    }
    const cachedData = faviconDataCache.get(sourceUrl);
    if (cachedData) {
      return Promise.resolve(cachedData);
    }
    const pendingData = faviconDataPending.get(sourceUrl);
    if (pendingData) {
      return pendingData;
    }
    const promise = new Promise<string | null>((resolve) => {
      const finish = (dataUrl: unknown): void => {
        const value = String(dataUrl || '').trim();
        if (value && value.startsWith('data:')) {
          faviconViewCore.cacheFaviconData(sourceUrl, value);
          resolve(value);
          return;
        }
        resolve(null);
      };
      if (requestFaviconDataFromBackground) {
        Promise.resolve(requestFaviconDataFromBackground(sourceUrl, pageUrl))
          .then(finish)
          .catch(() => finish(''));
        return;
      }
      const runtime = chromeApi.runtime;
      if (!runtime || typeof runtime.sendMessage !== 'function') {
        finish('');
        return;
      }
      LumnoMessaging.sendBackgroundMessage(runtime, {
        action: 'getFaviconData',
        url: sourceUrl,
        pageUrl: pageUrl || ''
      }, (response) => {
        finish(response && response.data ? response.data : '');
      });
    }).then((dataUrl) => {
      faviconDataPending.delete(sourceUrl);
      return dataUrl || null;
    }).catch(() => {
      faviconDataPending.delete(sourceUrl);
      return null;
    });
    faviconDataPending.set(sourceUrl, promise);
    return promise;
  }

  function getLastWorkingFaviconSrc(img: FaviconImage): string {
    const source = faviconViewCore.getLastWorkingFaviconSrc(img);
    return isBackgroundFetchedFavicon(source) ? (faviconDataCache.get(source) || '') : source;
  }

  function restoreWorkingFaviconOrFail(img: FaviconImage, previousSrc: string, onFailed: () => void) {
    return faviconViewCore.restoreWorkingFaviconOrFallback(img, previousSrc, {
      hideFallbackNode: hideFallbackIconNode,
      onFailed,
      applyFallbackIcon
    });
  }

  function createOverlayThemeAwareFaviconState(
    img: OverlayFaviconImage,
    pageUrl: string,
    hostKey: string,
    fallbackUrl: string,
    onFailed: (() => void) | null,
    sourceOptions: { allowRemoteImage?: boolean } | null
  ): FaviconAttachState {
    img._xOverlayThemeFaviconSession = (img._xOverlayThemeFaviconSession || 0) + 1;
    const session = img._xOverlayThemeFaviconSession;
    const normalizedHostKey = hostKey || getHostFromUrl(pageUrl);
    const rawFallbackUrl = String(fallbackUrl || '').trim();
    const cachedSourcePage = FaviconCanonical.getPageUrlFromFaviconProxyUrl(rawFallbackUrl);
    const mappedSource = FaviconUrlKinds.isFaviconProxyUrl(rawFallbackUrl) ||
      FaviconUrlKinds.isSafeVirtualFaviconRequestUrl(rawFallbackUrl);
    const canReuseCachedData = !mappedSource || Boolean(
      cachedSourcePage &&
      FaviconCanonical.getFaviconPersistCacheKey(cachedSourcePage) === FaviconCanonical.getFaviconPersistCacheKey(pageUrl) &&
      !FaviconUrlKinds.isChromeMonogramFaviconUrl(rawFallbackUrl) &&
      (!FaviconUrlKinds.isSafeVirtualFaviconRequestUrl(rawFallbackUrl) ||
        new URL(rawFallbackUrl).searchParams.get('fallbackToHost') === '0')
    );
    const cachedFallbackData = canReuseCachedData ? faviconDataCache.get(rawFallbackUrl) || '' : '';
    const safeFallbackUrl = getSafeOverlayFaviconCandidateUrl(rawFallbackUrl, pageUrl, 'primary', sourceOptions) ||
      getSafeOverlayFaviconCandidateUrl(cachedFallbackData, pageUrl, 'cached-data');
    const previousSrc = getLastWorkingFaviconSrc(img);
    const previousPage = img.getAttribute('data-x-ov-favicon-page-url') || '';
    const canReusePrevious = previousPage
      ? FaviconCanonical.getFaviconPersistCacheKey(previousPage) === FaviconCanonical.getFaviconPersistCacheKey(pageUrl)
      : !String(previousSrc || '').startsWith('data:');

    return {
      pageUrl: String(pageUrl || ''),
      hostKey: String(normalizedHostKey || ''),
      rawFallbackUrl,
      fallbackUrl: safeFallbackUrl,
      primaryUrl: safeFallbackUrl,
      allowRemoteImage: Boolean(sourceOptions && sourceOptions.allowRemoteImage === true),
      extensionFavicon: getRuntimeExtensionFaviconUrl(pageUrl),
      browserUrl: /^https?:\/\//i.test(String(pageUrl || '')) ? '' : getRuntimeChromeFaviconUrl(pageUrl),
      gstaticFavicon: getRuntimeGstaticFaviconUrl(pageUrl),
      previousWorkingSrc: getSafeOverlayFaviconCandidateUrl(
        canReusePrevious ? previousSrc : '',
        pageUrl,
        'previous'
      ),
      hasFailedHandler: typeof onFailed === 'function',
      handleFailed: typeof onFailed === 'function' ? onFailed : function() {},
      isSessionCurrent() {
        return Boolean(img && img._xOverlayThemeFaviconSession === session);
      },
      isSessionMounted() {
        return Boolean(img && img.isConnected && img._xOverlayThemeFaviconSession === session);
      }
    };
  }

  function buildBlockedOverlayFaviconDataSourcePlan(state: FaviconAttachState): string[] {
    const unique: string[] = [];
    const seen = new Set<string>();
    [
      state.rawFallbackUrl,
      getRuntimeExtensionFaviconDataSourceUrl(state.pageUrl),
      getRuntimeGstaticFaviconDataSourceUrl(state.pageUrl)
    ].forEach((url) => {
      const value = String(url || '').trim();
      if (!value || seen.has(value) || !isSourceAllowedByEnhancedFetchPolicy(value, state.pageUrl)) {
        return;
      }
      seen.add(value);
      unique.push(value);
    });
    return unique;
  }

  function attachBlockedOverlayFaviconData(img: OverlayFaviconImage, state: FaviconAttachState): void {
    const candidates = buildBlockedOverlayFaviconDataSourcePlan(state);
    if (candidates.length === 0) {
      finalizeOverlayOwnedFaviconFailure(img, state);
      return;
    }
    showPendingFallbackIcon(img);
    let index = 0;
    const tryNext = () => {
      if (!img || !state.isSessionCurrent()) {
        return;
      }
      const sourceUrl = candidates[index];
      index += 1;
      if (!sourceUrl) {
        finalizeOverlayOwnedFaviconFailure(img, state);
        return;
      }
      requestFaviconDataBypassingOverlayBlock(sourceUrl, state.pageUrl).then((dataUrl) => {
        if (!img || !state.isSessionCurrent()) {
          return;
        }
        if (!dataUrl) {
          tryNext();
          return;
        }
        const applied = setFaviconSrcWithAnimation(img, dataUrl, {
          sourceUrl,
          persist: false
        });
        if (!applied && canReuseCurrentFavicon(img, dataUrl)) {
          showResolvedFavicon(img);
        }
        preloadThemeFromFavicon(sourceUrl, dataUrl, state.hostKey);
      }).catch(() => {
        if (img && state.isSessionCurrent()) {
          tryNext();
        }
      });
    };
    tryNext();
  }

  function syncOverlayThemeAwareFaviconAttributes(img: OverlayFaviconImage, state: FaviconAttachState): void {
    img.setAttribute('data-x-ov-theme-favicon', '1');
    img.setAttribute('data-x-ov-favicon-page-url', state.pageUrl);
    img.setAttribute('data-x-ov-favicon-host', state.hostKey);
    img.setAttribute('data-x-ov-favicon-fallback-url', state.rawFallbackUrl);
    img.setAttribute('data-x-ov-favicon-custom-image', state.allowRemoteImage ? '1' : '0');
    img.removeAttribute('data-x-ov-favicon-cache-key');
  }

  function buildOverlayThemeAwareFaviconCandidatePlan(state: FaviconAttachState): FaviconPlanCandidate[] {
    return faviconUrlResolver.buildFaviconCandidatePlan(state);
  }

  function clearOverlayCandidateLoadTimer(img: OverlayFaviconImage | null): void {
    const timer = img ? img._xOverlayThemeFaviconLoadTimer : null;
    if (!img || timer === null || timer === undefined) {
      return;
    }
    clearTimer(timer);
    img._xOverlayThemeFaviconLoadTimer = null;
  }

  function isOverlayCandidateLoaded(img: OverlayFaviconImage, nextUrl: string): boolean {
    if (!img || !nextUrl) {
      return false;
    }
    const resolvedSrc = img.getAttribute('data-favicon-current-src') || '';
    if (resolvedSrc === nextUrl) {
      return true;
    }
    return Boolean(img.complete && img.naturalWidth > 0);
  }

  // Treats a candidate that has not loaded within the timeout as failed.
  function scheduleOverlayCandidateLoadTimer(img: OverlayFaviconImage, state: FaviconAttachState, nextUrl: string): void {
    if (!img || !state || !nextUrl || faviconCandidateLoadTimeoutMs <= 0) {
      return;
    }
    clearOverlayCandidateLoadTimer(img);
    const expectedToken = img._xFaviconLoadToken || 0;
    const expectedSrc = String(nextUrl);
    img._xOverlayThemeFaviconLoadTimer = setTimer(() => {
      img._xOverlayThemeFaviconLoadTimer = null;
      if (!img || !state.isSessionCurrent()) {
        return;
      }
      if ((img._xFaviconLoadToken || 0) !== expectedToken) {
        return;
      }
      const currentRenderedSrc = String(img.getAttribute('src') || img.src || '');
      if (currentRenderedSrc && currentRenderedSrc !== expectedSrc) {
        return;
      }
      if (isOverlayCandidateLoaded(img, expectedSrc)) {
        return;
      }
      if (typeof img._xOverlayThemeFaviconErrorHandler === 'function') {
        img._xOverlayThemeFaviconErrorHandler();
      }
    }, faviconCandidateLoadTimeoutMs);
  }

  // Shows one candidate; false when it was tried already or cannot show.
  function tryApplyOverlayThemeAwareFaviconCandidate(
    img: OverlayFaviconImage,
    state: FaviconAttachState,
    tried: Set<string>,
    candidate: FaviconPlanCandidate
  ): boolean {
    const nextUrl = candidate && candidate.url ? String(candidate.url) : '';
    if (!nextUrl || !img || !state.isSessionCurrent()) {
      return false;
    }
    if (tried.has(nextUrl)) {
      return false;
    }
    tried.add(nextUrl);
    clearOverlayCandidateLoadTimer(img);
    img._xOverlayThemeFaviconCandidateToken = (img._xOverlayThemeFaviconCandidateToken || 0) + 1;
    const candidateToken = img._xOverlayThemeFaviconCandidateToken;

    if (isBackgroundFetchedFavicon(nextUrl)) {
      attachBackgroundFaviconCandidate(img, state, nextUrl);
      return true;
    }

    const faviconProxyCheckKind = faviconUrlResolver.getFaviconProxyCheckKind(candidate);
    const shouldCheckDefaultProxy = Boolean(faviconProxyCheckKind);
    let defaultProxyCheckStarted = false;
    const scheduleDefaultProxyFaviconCheck = () => {
      if (!shouldCheckDefaultProxy) {
        return;
      }
      if (defaultProxyCheckStarted) {
        return;
      }
      defaultProxyCheckStarted = true;
      setTimer(() => {
        if (!img || !state.isSessionCurrent() || img._xOverlayThemeFaviconCandidateToken !== candidateToken) {
          return;
        }
        const currentSrc = img.getAttribute('data-favicon-current-src') || img.src || '';
        if (currentSrc !== nextUrl) {
          return;
        }
        const defaultCheckPromise: Promise<boolean> = faviconProxyCheckKind === 'extension'
          ? faviconViewCore.detectDefaultExtensionFavicon(img, nextUrl)
          : faviconViewCore.requestFaviconData(nextUrl, state.pageUrl).then((dataUrl) => !dataUrl);
        void defaultCheckPromise.catch(() => false).then((isDefault) => {
          if (!img || !state.isSessionCurrent() || img._xOverlayThemeFaviconCandidateToken !== candidateToken) {
            return;
          }
          const latestSrc = img.getAttribute('data-favicon-current-src') || img.src || '';
          if (latestSrc !== nextUrl) {
            return;
          }
          if (isDefault) {
            if (faviconProxyCheckKind === 'gstatic') {
              finalizeOverlayDefaultProxyFaviconFailure(img, state);
              return;
            }
            if (typeof img._xOverlayThemeFaviconErrorHandler === 'function') {
              img._xOverlayThemeFaviconErrorHandler();
            }
            return;
          }
          showResolvedFavicon(img);
        });
      }, 0);
    };
    const handleProxyLoad = () => {
      scheduleDefaultProxyFaviconCheck();
    };
    if (shouldCheckDefaultProxy) {
      img.addEventListener('load', handleProxyLoad, { once: true });
    }
    const applied = setFaviconSrcWithAnimation(img, nextUrl, {
      persist: false,
      deferResolve: shouldCheckDefaultProxy
    });
    const reused = !applied && canReuseCurrentFavicon(img, nextUrl);
    if (!applied && !reused) {
      img.removeEventListener('load', handleProxyLoad);
      return false;
    }
    if (reused) {
      img.removeEventListener('load', handleProxyLoad);
      if (shouldCheckDefaultProxy) {
        showPendingFallbackIcon(img);
        scheduleDefaultProxyFaviconCheck();
      } else {
        showResolvedFavicon(img);
      }
    } else {
      if (!shouldCheckDefaultProxy) {
        setFaviconVisibility(img, 'visible');
      }
      scheduleOverlayCandidateLoadTimer(img, state, nextUrl);
      if (shouldCheckDefaultProxy && img.complete && img.naturalWidth > 0) {
        scheduleDefaultProxyFaviconCheck();
      }
    }
    return true;
  }

  // Icon services and the browser's _favicon cache are fetched by the
  // extension background: the host page only renders local image bytes, never
  // connects to a service, and the _favicon endpoint stays unreachable from
  // web pages (it would reveal which sites the user has visited).
  function isBackgroundFetchedFavicon(url: string): boolean {
    return (/^https:\/\//i.test(String(url || '')) && FaviconUrlKinds.isFaviconProxyUrl(url)) ||
      FaviconUrlKinds.isExtensionFaviconEndpointUrl(url);
  }

  function attachBackgroundFaviconCandidate(img: OverlayFaviconImage, state: FaviconAttachState, sourceUrl: string): void {
    const token = img._xOverlayThemeFaviconCandidateToken;
    let settled = false;
    showPendingFallbackIcon(img);
    const finish = (value: string | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (!state.isSessionCurrent() || img._xOverlayThemeFaviconCandidateToken !== token) {
        return;
      }
      clearOverlayCandidateLoadTimer(img);
      const dataUrl = String(value || '');
      if (!dataUrl.startsWith('data:image/')) {
        if (typeof img._xOverlayThemeFaviconErrorHandler === 'function') {
          img._xOverlayThemeFaviconErrorHandler();
        }
        return;
      }
      faviconViewCore.cacheFaviconData(sourceUrl, dataUrl);
      const applied = setFaviconSrcWithAnimation(img, dataUrl, { sourceUrl, persist: false });
      if (!applied && canReuseCurrentFavicon(img, dataUrl)) {
        showResolvedFavicon(img);
      } else if (applied) {
        scheduleOverlayCandidateLoadTimer(img, state, dataUrl);
      } else if (typeof img._xOverlayThemeFaviconErrorHandler === 'function') {
        img._xOverlayThemeFaviconErrorHandler();
      }
      preloadThemeFromFavicon(sourceUrl, dataUrl, state.hostKey);
    };
    if (faviconCandidateLoadTimeoutMs > 0) {
      img._xOverlayThemeFaviconLoadTimer = setTimer(() => finish(null), faviconCandidateLoadTimeoutMs);
    }
    void requestFaviconData(sourceUrl, state.pageUrl).then(finish).catch(() => finish(null));
  }

  function finalizeOverlayOwnedFaviconFailure(img: OverlayFaviconImage, state: FaviconAttachState): void {
    clearOverlayCandidateLoadTimer(img);
    if (state.hasFailedHandler) {
      hideFallbackIconNode(img);
      state.handleFailed();
      return;
    }
    applyFallbackIcon(img);
  }

  function finalizeOverlayDefaultProxyFaviconFailure(img: OverlayFaviconImage, state: FaviconAttachState): void {
    finalizeOverlayOwnedFaviconFailure(img, state);
  }

  function finalizeOverlayThemeAwareFaviconFailure(img: OverlayFaviconImage, state: FaviconAttachState): void {
    clearOverlayCandidateLoadTimer(img);
    restoreWorkingFaviconOrFail(img, state.previousWorkingSrc, state.handleFailed);
  }

  // Shows a page's icon in img, trying each candidate source in turn; on
  // hosts the page must not load icons from, only worker-fetched data.
  function attachResolvedFaviconWithFallbacks(
    img: OverlayFaviconImage | null,
    pageUrl: string,
    hostKey: string,
    fallbackUrl: string,
    onFailed?: (() => void) | null,
    sourceOptions?: { allowRemoteImage?: boolean } | null
  ): void {
    if (!img) {
      return;
    }
    const previousErrorHandler = img._xOverlayThemeFaviconErrorHandler;
    if (previousErrorHandler) {
      img.removeEventListener('error', previousErrorHandler);
      img._xOverlayThemeFaviconErrorHandler = null;
    }
    clearOverlayCandidateLoadTimer(img);

    const state = createOverlayThemeAwareFaviconState(img, pageUrl, hostKey, fallbackUrl, onFailed || null, sourceOptions || null);
    if (state.hostKey &&
        shouldBlockOverlayFaviconForHost(state.hostKey) &&
        !isBrowserInternalPageUrl(state.pageUrl)) {
      syncOverlayThemeAwareFaviconAttributes(img, state);
      attachBlockedOverlayFaviconData(img, state);
      return;
    }
    syncOverlayThemeAwareFaviconAttributes(img, state);
    const candidates = buildOverlayThemeAwareFaviconCandidatePlan(state);
    const tried = new Set<string>();
    let candidateIndex = 0;

    const tryNextAvailableCandidate = () => {
      while (candidateIndex < candidates.length) {
        const candidate = candidates[candidateIndex];
        candidateIndex += 1;
        if (tryApplyOverlayThemeAwareFaviconCandidate(img, state, tried, candidate)) {
          return true;
        }
      }
      return false;
    };

    const handleImageError = () => {
      if (!state.isSessionCurrent()) {
        return;
      }
      if (tryNextAvailableCandidate()) {
        return;
      }
      finalizeOverlayThemeAwareFaviconFailure(img, state);
    };

    img._xOverlayThemeFaviconErrorHandler = handleImageError;
    img.addEventListener('error', handleImageError);

    const appliedInitial = tryNextAvailableCandidate();
    if (!appliedInitial) {
      finalizeOverlayThemeAwareFaviconFailure(img, state);
    }
  }

  // Attaches every themed icon in the panel again, as after a policy change.
  function refreshOverlayThemeAwareFavicons(optionsArg?: { skipWithin?: Element | null } | null): void {
    const overlay = getOverlayPanel();
    if (!overlay) {
      return;
    }
    const skipWithin = optionsArg && optionsArg.skipWithin ? optionsArg.skipWithin : null;
    queryHtmlTags(overlay, 'img[data-x-ov-theme-favicon="1"]', 'img').forEach((img) => {
      if (!img || !img.isConnected) {
        return;
      }
      if (skipWithin && typeof skipWithin.contains === 'function' && skipWithin.contains(img)) {
        return;
      }
      const pageUrl = img.getAttribute('data-x-ov-favicon-page-url') || '';
      if (!pageUrl) {
        return;
      }
      const hostKey = img.getAttribute('data-x-ov-favicon-host') || '';
      const fallbackUrl = img.getAttribute('data-x-ov-favicon-fallback-url') || '';
      attachResolvedFaviconWithFallbacks(img, pageUrl, hostKey, fallbackUrl, null, {
        allowRemoteImage: img.getAttribute('data-x-ov-favicon-custom-image') === '1'
      });
    });
  }

  // Asks every row whose icon failed to try again; true when one did.
  function retryFailedFaviconRows(): boolean {
    const rowsRoot = getSuggestionRowsRoot();
    if (!rowsRoot) {
      return false;
    }
    const failedSlots = Array.from(rowsRoot.querySelectorAll('[data-favicon-failed="true"]'));
    failedSlots.forEach((slot) => {
      slot.dispatchEvent(new CustomEvent('lumno-favicon-retry'));
    });
    return failedSlots.length > 0;
  }

  function refreshOverlayFaviconsForPolicyChange(): boolean {
    const rowsRerendered = retryFailedFaviconRows();
    refreshOverlayThemeAwareFavicons({
      skipWithin: rowsRerendered ? getSuggestionRowsRoot() : null
    });
    return rowsRerendered;
  }

  function attachFaviconData(img: FaviconImage | null, url: string, hostOverride?: string, pageUrl?: string): void {
    const safeUrl = getSafeOverlayFaviconCandidateUrl(url, pageUrl || url, 'data');
    if (safeUrl) {
      faviconViewCore.attachFaviconData(img, safeUrl, hostOverride, pageUrl || url);
    }
  }

  function preloadIcon(url: string, pageUrl?: string): void {
    const safeUrl = faviconUrlResolver.resolveFaviconSource(url, pageUrl || '');
    if (safeUrl) {
      if (isBackgroundFetchedFavicon(safeUrl)) {
        requestFaviconData(safeUrl, pageUrl || '').then((dataUrl) => {
          if (dataUrl) {
            preloadThemeFromFavicon(safeUrl, dataUrl, getHostFromUrl(pageUrl || ''));
          }
        }).catch(noop);
        return;
      }
      faviconViewCore.preloadIcon(safeUrl);
    }
  }

  // Loads the rows' icons ahead of rendering; worker-fetched icons warm as
  // data instead.
  function warmIconCache(list: ReadonlyArray<FaviconWarmItem | null> | null): void {
    if (!Array.isArray(list)) {
      return;
    }
    faviconViewCore.warmIconCache(list.map((item) => {
      if (!item || !item.favicon) {
        return item;
      }
      const favicon = faviconUrlResolver.resolveFaviconSource(item.favicon, item.url || '');
      if (isBackgroundFetchedFavicon(favicon)) {
        preloadIcon(favicon, item.url || '');
      }
      return {
        ...item,
        favicon: isBackgroundFetchedFavicon(favicon) ? '' : favicon
      };
    }));
  }

  return Object.freeze({
    onFaviconData(listener: FaviconDataListener): () => void {
      faviconDataListeners.add(listener);
      return () => faviconDataListeners.delete(listener);
    },
    applyFaviconOpticalShift,
    applyFaviconOpticalAlignment,
    isBlockedLocalFaviconUrl: isBlockedOverlayFaviconUrl,
    isChromeMonogramFaviconUrl,
    requestFaviconData,
    setFaviconSrcWithAnimation,
    attachFaviconData,
    attachResolvedFaviconWithFallbacks,
    refreshOverlayThemeAwareFavicons,
    refreshOverlayFaviconsForPolicyChange,
    preloadIcon,
    warmIconCache
  });
}

type OverlayFaviconRuntime = ReturnType<typeof createOverlayFaviconViewRuntime>;

export { createOverlayFaviconViewRuntime };
export type { OverlayFaviconImage, OverlayFaviconRuntime, OverlayFaviconViewOptions };
