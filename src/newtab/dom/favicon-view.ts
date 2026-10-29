// The New Tab's favicons: each image tries its icon sources in turn, falls
// back to a link icon, and is rescued later when a source recovers.
import type { FaviconDataEntry, FaviconUrlEntry } from '../../domain/favicon/favicon-cache';
import type { MessageRuntime } from '../../platform/messaging';
import * as LumnoFaviconViewCore from '../../shared/favicon/favicon-view-core';
import type { FaviconImage } from '../../shared/favicon/favicon-pixels';
import type {
  FaviconViewCoreOptions,
  FaviconViewWindow,
  FaviconWarmItem
} from '../../shared/favicon/favicon-view-core';
import type { FaviconAttachOptions } from '../newtab-types';
import { queryHtmlTags } from '../../shared/dom-lookup';
import type { FaviconPlanCandidate, FaviconResolverOptions } from '../../domain/favicon/types';
import * as FaviconCanonical from '../../domain/favicon/canonical';
import * as FaviconResolver from '../../domain/favicon/resolver';

// An icon image with the attach state this runtime keeps on it; tests read
// the session to tell an attach was replaced.
type ThemeFaviconImage = FaviconImage & {
  _xThemeFaviconSession?: number;
  _xThemeFaviconLoadTimer?: number | null;
  _xThemeFaviconErrorHandler?: (() => void) | null;
  // Rescues tried for the page the image shows.
  _xThemeFaviconRescue?: { pageUrl: string; attempts: number };
};

type FaviconRuntimeWindow = FaviconViewWindow & Partial<Pick<Window, 'clearTimeout' | 'getComputedStyle'>>;

interface FaviconViewRuntimeOptions extends Pick<FaviconViewCoreOptions,
  | 'requestFaviconData'
  | 'detectDefaultExtensionFavicon'
  | 'faviconDataCache'
  | 'faviconDataPending'
  | 'iconPreloadCache'
  | 'preloadThemeFromFavicon'>,
  Pick<FaviconResolverOptions,
    | 'getExtensionFaviconUrl'
    | 'getGstaticFaviconUrl'
    | 'getChromeFaviconUrl'
    | 'shouldBlockFaviconForHost'
    | 'shouldAvoidDirectFaviconForHost'
    | 'isEnhancedFaviconFetchEnabled'
    | 'getStrictFaviconReason'
    | 'logFaviconDecision'> {
  document?: Document | null;
  windowObj?: FaviconRuntimeWindow | null;
  chromeApi?: { runtime?: MessageRuntime & { id?: string; getURL?(path: string): string } } | null;
  isOwnExtensionUrl?(url: string): boolean;
  isBlockedLocalFaviconUrl?(url: string): boolean;
  getHostFromUrl?(url: string): string;
  getPersistedFaviconEntry?(cacheKey: string): FaviconUrlEntry | null;
  getPersistedFaviconDataEntry?(cacheKey: string): FaviconDataEntry | null;
  setPersistedFaviconUrl?(cacheKey: string, url: string): void;
  setPersistedFaviconData?(cacheKey: string, dataUrl: string): void;
  hasThemeForHost?(hostKey: string): boolean;
  // Logs each icon that could not load once, while debugging.
  missingIconCache?: Set<string>;
  missingIconDebugEnabled?: boolean;
  // How long a source may load before the next one is tried.
  faviconCandidateLoadTimeoutMs?: number;
}

// Where an image's icon comes from while it is being attached.
interface ThemeFaviconState {
  url: string;
  hostKey: string;
  cacheKey: string;
  persistedDataUrl: string;
  persistedUrl: string;
  onUnavailable: (() => void) | null;
  primaryUrl: string;
  browserUrl: string;
  pageSpecificUrl: string;
  extensionFavicon: string;
  gstaticFavicon: string;
  previousWorkingSrc: string;
  skipPersisted: boolean;
  sourceProfile: 'shortcut' | '';
  allowRemoteImage: boolean;
  customImageUrl: string;
  // Whether no newer attach replaced this one.
  isSessionCurrent(): boolean;
  isSessionMounted(): boolean;
}

function noop(): void {}

function createFaviconViewRuntime(options?: FaviconViewRuntimeOptions | null) {
  const config: FaviconViewRuntimeOptions = options || {};
  const doc = config.document || globalThis.document;
  const win: FaviconRuntimeWindow = config.windowObj || globalThis.window || globalThis;
  const chromeApi = config.chromeApi || globalThis.chrome || {};
  const setTimer: (callback: () => void, delay: number) => number = typeof win.setTimeout === 'function'
    ? win.setTimeout.bind(win)
    : (callback, delay) => setTimeout(callback, delay);
  const clearTimer: (timer: number) => void = typeof win.clearTimeout === 'function'
    ? win.clearTimeout.bind(win)
    : (timer) => clearTimeout(timer);
  const getExtensionFaviconUrl = typeof config.getExtensionFaviconUrl === 'function' ? config.getExtensionFaviconUrl : (() => '');
  const getGstaticFaviconUrl = typeof config.getGstaticFaviconUrl === 'function' ? config.getGstaticFaviconUrl : (() => '');
  const getChromeFaviconUrl = typeof config.getChromeFaviconUrl === 'function' ? config.getChromeFaviconUrl : (() => '');
  const isOwnExtensionUrl = typeof config.isOwnExtensionUrl === 'function' ? config.isOwnExtensionUrl : (() => false);
  const isBlockedLocalFaviconUrl = typeof config.isBlockedLocalFaviconUrl === 'function' ? config.isBlockedLocalFaviconUrl : (() => false);
  const shouldBlockFaviconForHost = typeof config.shouldBlockFaviconForHost === 'function' ? config.shouldBlockFaviconForHost : (() => false);
  const shouldAvoidDirectFaviconForHost = typeof config.shouldAvoidDirectFaviconForHost === 'function'
    ? config.shouldAvoidDirectFaviconForHost
    : (() => false);
  const isEnhancedFaviconFetchEnabled = typeof config.isEnhancedFaviconFetchEnabled === 'function'
    ? config.isEnhancedFaviconFetchEnabled
    : (() => true);
  const getStrictFaviconReason = typeof config.getStrictFaviconReason === 'function'
    ? config.getStrictFaviconReason
    : (() => '');
  const logFaviconDecision = typeof config.logFaviconDecision === 'function'
    ? config.logFaviconDecision
    : noop;
  const getHostFromUrl = typeof config.getHostFromUrl === 'function' ? config.getHostFromUrl : (() => '');
  const getPersistedFaviconEntry = typeof config.getPersistedFaviconEntry === 'function'
    ? config.getPersistedFaviconEntry
    : (() => null);
  const getPersistedFaviconDataEntry = typeof config.getPersistedFaviconDataEntry === 'function'
    ? config.getPersistedFaviconDataEntry
    : (() => null);
  const setPersistedFaviconUrl = typeof config.setPersistedFaviconUrl === 'function' ? config.setPersistedFaviconUrl : noop;
  const setPersistedFaviconData = typeof config.setPersistedFaviconData === 'function' ? config.setPersistedFaviconData : noop;
  const preloadThemeFromFavicon = typeof config.preloadThemeFromFavicon === 'function' ? config.preloadThemeFromFavicon : noop;
  const faviconDataCache = config.faviconDataCache || new Map<string, string>();
  const faviconDataPending = config.faviconDataPending || new Map<string, Promise<string | null>>();
  const iconPreloadCache = config.iconPreloadCache || new Map<string, HTMLImageElement>();
  const shortcutFaviconOptionsByImage = new WeakMap<HTMLImageElement, FaviconAttachOptions>();
  const missingIconCache = config.missingIconCache || new Set<string>();
  const missingIconDebugEnabled = config.missingIconDebugEnabled === true;
  const faviconUrlResolver = FaviconResolver.createFaviconUrlResolver({
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
  });
  const faviconViewCoreApi = LumnoFaviconViewCore;
  const faviconViewCore = faviconViewCoreApi.createFaviconViewCore({
    document: doc,
    windowObj: win,
    chromeApi,
    getHostFromUrl,
    shouldBlockFaviconForHost,
    isBlockedLocalFaviconUrl,
    showResolvedFavicon: (img) => showResolvedFavicon(img),
    showPendingFallbackIcon: (img) => showPendingFallbackIcon(img),
    getPersistCacheKey: (img) => img.getAttribute('data-x-nt-favicon-cache-key') || '',
    setPersistedFaviconUrl,
    setPersistedFaviconData,
    shouldPersistFaviconUrl: () => true,
    requestFaviconData: config.requestFaviconData,
    preloadThemeFromFavicon,
    getThemeFaviconUrl: getGstaticFaviconUrl,
    hasThemeForHost: (hostKey) => Boolean(config.hasThemeForHost && config.hasThemeForHost(hostKey)),
    faviconDataCache,
    faviconDataPending,
    iconPreloadCache,
    detectDefaultExtensionFavicon: config.detectDefaultExtensionFavicon,
    ignoreLastWorkingWhenFallback: true
  });
  const faviconCandidateLoadTimeoutMs = config.faviconCandidateLoadTimeoutMs !== undefined &&
    Number.isFinite(config.faviconCandidateLoadTimeoutMs)
    ? Math.max(0, config.faviconCandidateLoadTimeoutMs)
    : 2600;
  const THEME_FAVICON_RESCUE_MAX_ATTEMPTS = 2;
  let themeFaviconRescueTimer: number | null = null;

  const {
    applyFaviconOpticalShift,
    applyFaviconOpticalAlignment,
    requestFaviconData,
    setFaviconSrcWithAnimation,
    canReuseCurrentFavicon,
    getLastWorkingFaviconSrc
  } = faviconViewCore;

  function reportMissingIcon(context: string, url: string, iconUrl: string): void {
    if (!missingIconDebugEnabled) {
      return;
    }
    const key = `${context || 'unknown'}::${url || ''}::${iconUrl || ''}`;
    if (missingIconCache.has(key)) {
      return;
    }
    missingIconCache.add(key);
    const safeContext = String(context || 'unknown');
    const safeUrl = String(url || '');
    const safeIcon = String(iconUrl || '');
    console.warn(`[Lumno] icon missing context=${safeContext} url=${safeUrl} icon=${safeIcon}`);
  }

  function resolveFallbackIconDimension(img: HTMLImageElement, axis: 'width' | 'height', defaultSize: number): number {
    const inlineValue = Number.parseFloat(
      axis === 'width'
        ? (img.style && img.style.width ? img.style.width : '')
        : (img.style && img.style.height ? img.style.height : '')
    );
    if (Number.isFinite(inlineValue) && inlineValue > 0) {
      return inlineValue;
    }
    if (typeof win.getComputedStyle === 'function') {
      const computed = win.getComputedStyle(img);
      const computedValue = Number.parseFloat(axis === 'width' ? computed.width : computed.height);
      if (Number.isFinite(computedValue) && computedValue > 0) {
        return computedValue;
      }
    }
    const layoutValue = axis === 'width' ? img.clientWidth : img.clientHeight;
    if (Number.isFinite(layoutValue) && layoutValue > 0) {
      return layoutValue;
    }
    return defaultSize;
  }

  // A folder card's preview favicons stack, each with its fallback drawn
  // before it; elsewhere the fallback follows its image.
  function getFallbackSibling(img: FaviconImage): Element | null {
    return img.classList.contains('x-nt-folder-preview-favicon')
      ? img.previousElementSibling
      : img.nextElementSibling;
  }

  // The fallback tile takes the size of the image it stands in for.
  function sizeFallbackNode(img: FaviconImage, node: HTMLElement): void {
    if (!node.classList.contains('x-nt-favicon-fallback')) {
      return;
    }
    const isSearchSuggestionIcon = img.getAttribute('data-x-nt-suggestion-icon') === '1';
    const defaultDimension = isSearchSuggestionIcon ? 16 : 25;
    node.style.setProperty('--x-nt-favicon-fallback-width', `${resolveFallbackIconDimension(img, 'width', defaultDimension)}px`);
    node.style.setProperty('--x-nt-favicon-fallback-height', `${resolveFallbackIconDimension(img, 'height', defaultDimension)}px`);
  }

  const fallbackIcons = faviconViewCoreApi.createFallbackIconPresenter({
    fallbackClassName: '_x_extension_favicon_fallback_2024_unique_',
    getFallbackSibling,
    styleFallbackNode: sizeFallbackNode,
    setImageVisible(img: FaviconImage, visible: boolean) {
      if (visible) {
        img.style.setProperty('display', 'block');
      } else {
        img.style.removeProperty('display');
      }
    },
    clearCandidateTimer: clearThemeAwareCandidateLoadTimer,
    setTimer
  });
  const {
    setFallbackIconVisible,
    showResolvedFavicon,
    showPendingFallbackIcon,
    applyFallbackIcon
  } = fallbackIcons;

  // After a theme change the fallback tiles size and show again.
  function refreshFallbackIcons(): void {
    queryHtmlTags(doc, 'img[data-fallback-icon="true"]', 'img').forEach((img) => {
      setFallbackIconVisible(img, true);
      img.style.removeProperty('display');
    });
  }

  function restoreWorkingFaviconOrFallback(img: FaviconImage, previousSrc: string) {
    return faviconViewCore.restoreWorkingFaviconOrFallback(img, previousSrc, {
      applyFallbackIcon
    });
  }

  function attachFaviconData(img: FaviconImage, url: string, hostOverride?: string, pageUrl?: string): void {
    const safeUrl = faviconUrlResolver.getSafeFaviconCandidateUrl(url, pageUrl || url, 'data');
    if (safeUrl) {
      faviconViewCore.attachFaviconData(img, safeUrl, hostOverride, pageUrl || url);
    }
  }

  function preloadIcon(url: string, pageUrl?: string): void {
    const safeUrl = faviconUrlResolver.resolveFaviconSource(url, pageUrl || '');
    if (safeUrl) {
      faviconViewCore.preloadIcon(safeUrl);
    }
  }

  function warmIconCache(list: readonly (FaviconWarmItem | null | undefined)[] | null | undefined): void {
    const safeItems = (list || []).map((item) => {
      if (!item || !item.favicon) {
        return item;
      }
      const safeUrl = faviconUrlResolver.resolveFaviconSource(item.favicon, item.url || '');
      return { ...item, favicon: safeUrl };
    });
    faviconViewCore.warmIconCache(safeItems);
  }

  function getSafeFaviconCandidateUrl(
    ...args: Parameters<typeof faviconUrlResolver.getSafeFaviconCandidateUrl>
  ): string {
    const [value, pageUrl, candidateKind, sourceOptions] = args;
    return faviconUrlResolver.getSafeFaviconCandidateUrl(value, pageUrl, candidateKind, sourceOptions);
  }

  function getRuntimeExtensionFaviconUrl(pageUrl: string): string {
    return faviconUrlResolver.getExtensionFaviconUrl(pageUrl);
  }

  function getRuntimeGstaticFaviconUrl(pageUrl: string): string {
    return faviconUrlResolver.getGstaticFaviconUrl(pageUrl);
  }

  function getRuntimeChromeFaviconUrl(pageUrl: string): string {
    return faviconUrlResolver.getChromeFaviconUrl(pageUrl);
  }

  function createThemeAwareFaviconState(
    img: ThemeFaviconImage,
    url: string,
    host: string,
    optionsArg: FaviconAttachOptions | undefined
  ): ThemeFaviconState {
    img._xThemeFaviconSession = (img._xThemeFaviconSession || 0) + 1;
    const session = img._xThemeFaviconSession;
    const hostKey = host || getHostFromUrl(url);
    const cacheKey = FaviconCanonical.getFaviconPersistCacheKey(url, hostKey);
    const skipPersisted = Boolean(optionsArg && optionsArg.skipPersisted === true);
    const persistedDataEntry = !skipPersisted && cacheKey
      ? getPersistedFaviconDataEntry(cacheKey)
      : null;
    const persistedUrlEntry = !skipPersisted && cacheKey
      ? getPersistedFaviconEntry(cacheKey)
      : null;
    const previousSrc = getLastWorkingFaviconSrc(img);
    const previousPage = img.getAttribute('data-x-nt-favicon-page-url') || '';
    const canReusePrevious = previousPage
      ? FaviconCanonical.getFaviconPersistCacheKey(previousPage) === FaviconCanonical.getFaviconPersistCacheKey(url)
      : !String(previousSrc || '').startsWith('data:');
    const reusablePreviousSrc = canReusePrevious ? previousSrc : '';
    const previousWorkingSrc = optionsArg && optionsArg.sourceProfile === 'shortcut'
      ? faviconUrlResolver.getShortcutFaviconCandidateUrl(url, reusablePreviousSrc)
      : getSafeFaviconCandidateUrl(reusablePreviousSrc, url, 'previous');

    return {
      url: String(url || ''),
      hostKey: String(hostKey || ''),
      cacheKey,
      persistedDataUrl: persistedDataEntry && persistedDataEntry.dataUrl
        ? String(persistedDataEntry.dataUrl)
        : '',
      persistedUrl: persistedUrlEntry && persistedUrlEntry.url
        ? String(persistedUrlEntry.url)
        : '',
      onUnavailable: optionsArg && typeof optionsArg.onUnavailable === 'function'
        ? optionsArg.onUnavailable
        : null,
      primaryUrl: getSafeFaviconCandidateUrl(
        (optionsArg && (optionsArg.primaryUrl || optionsArg.fallbackUrl)) || '',
        url,
        'primary',
        { allowRemoteImage: Boolean(optionsArg && optionsArg.allowRemoteImage === true) }
      ),
      browserUrl: getSafeFaviconCandidateUrl((optionsArg && optionsArg.browserUrl) || '', url, 'browser') ||
        (/^https?:\/\//i.test(String(url || '')) ? '' : getRuntimeChromeFaviconUrl(url)),
      pageSpecificUrl: getSafeFaviconCandidateUrl(
        (optionsArg && optionsArg.pageSpecificUrl) || '',
        url,
        'page-specific'
      ),
      extensionFavicon: getRuntimeExtensionFaviconUrl(url),
      gstaticFavicon: getRuntimeGstaticFaviconUrl(url),
      previousWorkingSrc,
      skipPersisted,
      sourceProfile: optionsArg && optionsArg.sourceProfile === 'shortcut' ? 'shortcut' : '',
      allowRemoteImage: Boolean(optionsArg && optionsArg.allowRemoteImage === true),
      customImageUrl: optionsArg && optionsArg.allowRemoteImage === true
        ? String(optionsArg.primaryUrl || optionsArg.fallbackUrl || '') : '',
      isSessionCurrent() {
        return Boolean(img && img._xThemeFaviconSession === session);
      },
      isSessionMounted() {
        return Boolean(img && img.isConnected && img._xThemeFaviconSession === session);
      }
    };
  }

  function clearThemeAwareCandidateLoadTimer(img: ThemeFaviconImage): void {
    if (img._xThemeFaviconLoadTimer === null || img._xThemeFaviconLoadTimer === undefined) {
      return;
    }
    clearTimer(img._xThemeFaviconLoadTimer);
    img._xThemeFaviconLoadTimer = null;
  }

  function isThemeAwareCandidateLoaded(img: HTMLImageElement, nextSrc: string): boolean {
    if (!nextSrc) {
      return false;
    }
    const resolvedSrc = img.getAttribute('data-favicon-current-src') || '';
    if (resolvedSrc === nextSrc) {
      return true;
    }
    return Boolean(img.complete && img.naturalWidth > 0);
  }

  function scheduleThemeAwareCandidateLoadTimer(img: ThemeFaviconImage, state: ThemeFaviconState, nextSrc: string): void {
    if (!nextSrc || faviconCandidateLoadTimeoutMs <= 0) {
      return;
    }
    clearThemeAwareCandidateLoadTimer(img);
    const expectedToken = img._xFaviconLoadToken || 0;
    const expectedSrc = String(nextSrc);
    img._xThemeFaviconLoadTimer = setTimer(() => {
      img._xThemeFaviconLoadTimer = null;
      if (!state.isSessionCurrent()) {
        return;
      }
      if ((img._xFaviconLoadToken || 0) !== expectedToken) {
        return;
      }
      const currentRenderedSrc = String(img.getAttribute('src') || img.src || '');
      if (currentRenderedSrc && currentRenderedSrc !== expectedSrc) {
        return;
      }
      if (isThemeAwareCandidateLoaded(img, expectedSrc)) {
        return;
      }
      if (typeof img._xThemeFaviconErrorHandler === 'function') {
        img._xThemeFaviconErrorHandler();
      }
    }, faviconCandidateLoadTimeoutMs);
  }

  function syncThemeAwareFaviconAttributes(img: HTMLImageElement, state: ThemeFaviconState): void {
    img.setAttribute('data-x-nt-theme-favicon', '1');
    img.setAttribute('data-x-nt-favicon-page-url', state.url);
    img.setAttribute('data-x-nt-favicon-host', state.hostKey);
    img.setAttribute('data-x-nt-favicon-custom-image', state.customImageUrl);
    if (state.cacheKey) {
      img.setAttribute('data-x-nt-favicon-cache-key', state.cacheKey);
    } else {
      img.removeAttribute('data-x-nt-favicon-cache-key');
    }
  }

  function buildThemeAwareFaviconCandidatePlan(state: ThemeFaviconState): FaviconPlanCandidate[] {
    const runtimeCandidates = faviconUrlResolver.buildFaviconCandidatePlan(state);
    const seen = new Set<string>();
    return runtimeCandidates.filter((candidate) => {
      const safeUrl = getSafeFaviconCandidateUrl(candidate.url, state.url, candidate.kind,
        { allowRemoteImage: state.allowRemoteImage && candidate.kind === 'primary' });
      if (!safeUrl || seen.has(safeUrl)) {
        return false;
      }
      seen.add(safeUrl);
      candidate.url = safeUrl;
      return true;
    });
  }

  function persistResolvedThemeAwareCandidate(state: ThemeFaviconState, candidateUrl: string, resolvedDataUrl: string): void {
    if (state.skipPersisted) {
      return;
    }
    const cacheKey = state.cacheKey ? String(state.cacheKey) : '';
    const nextSrc = String(candidateUrl || '').trim();
    const dataUrl = String(resolvedDataUrl || '').trim();
    if (!cacheKey || !nextSrc) {
      return;
    }
    if (dataUrl.startsWith('data:')) {
      setPersistedFaviconData(cacheKey, dataUrl);
      return;
    }
    if (nextSrc.startsWith('data:')) {
      setPersistedFaviconData(cacheKey, nextSrc);
      return;
    }
    setPersistedFaviconUrl(cacheKey, nextSrc);
    faviconViewCore.requestFaviconData(nextSrc, state.url).then((nextDataUrl) => {
      if (nextDataUrl) {
        setPersistedFaviconData(cacheKey, nextDataUrl);
      }
    }).catch(noop);
  }

  function tryApplyThemeAwareFaviconCandidate(
    img: ThemeFaviconImage,
    state: ThemeFaviconState,
    tried: Set<string>,
    candidate: FaviconPlanCandidate
  ): boolean {
    const nextSrc = candidate.url ? String(candidate.url) : '';
    if (!nextSrc || !state.isSessionCurrent()) {
      return false;
    }
    if (tried.has(nextSrc)) {
      return false;
    }
    tried.add(nextSrc);
    clearThemeAwareCandidateLoadTimer(img);

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
        if (!state.isSessionCurrent()) {
          return;
        }
        const currentSrc = img.getAttribute('data-favicon-current-src') || img.src || '';
        if (currentSrc !== nextSrc) {
          return;
        }
        const defaultCheckPromise = faviconProxyCheckKind === 'extension'
          ? faviconViewCore.detectDefaultExtensionFavicon(img, nextSrc).then((isDefault) => ({
            isDefault: Boolean(isDefault),
            dataUrl: ''
          }))
          : faviconViewCore.requestFaviconData(nextSrc, state.url).then((dataUrl) => ({
            isDefault: !dataUrl,
            dataUrl: dataUrl || ''
          }));
        void defaultCheckPromise.catch(() => ({ isDefault: false, dataUrl: '' })).then((result) => {
          if (!state.isSessionCurrent()) {
            return;
          }
          const latestSrc = img.getAttribute('data-favicon-current-src') || img.src || '';
          if (latestSrc !== nextSrc) {
            return;
          }
          if (result.isDefault) {
            if (faviconProxyCheckKind === 'gstatic') {
              finalizeDefaultThemeAwareFaviconFailure(img, state, nextSrc);
              return;
            }
            if (typeof img._xThemeFaviconErrorHandler === 'function') {
              img._xThemeFaviconErrorHandler();
            }
            return;
          }
          showResolvedFavicon(img);
          persistResolvedThemeAwareCandidate(state, nextSrc, result.dataUrl);
        });
      }, 0);
    };
    const handleProxyLoad = () => {
      scheduleDefaultProxyFaviconCheck();
    };
    if (shouldCheckDefaultProxy) {
      img.addEventListener('load', handleProxyLoad, { once: true });
    } else {
      img.addEventListener('load', () => {
        if (state.isSessionCurrent()) {
          persistResolvedThemeAwareCandidate(state, nextSrc, '');
        }
      }, { once: true });
    }
    const applied = setFaviconSrcWithAnimation(img, nextSrc, {
      persist: false,
      deferResolve: shouldCheckDefaultProxy
    });
    const reused = !applied && canReuseCurrentFavicon(img, nextSrc);
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
        persistResolvedThemeAwareCandidate(state, nextSrc, '');
      }
    } else if (applied) {
      scheduleThemeAwareCandidateLoadTimer(img, state, nextSrc);
      if (shouldCheckDefaultProxy && img.complete && img.naturalWidth > 0) {
        scheduleDefaultProxyFaviconCheck();
      }
    }
    return true;
  }

  function finalizeDefaultThemeAwareFaviconFailure(img: ThemeFaviconImage, state: ThemeFaviconState, iconUrl: string): void {
    clearThemeAwareCandidateLoadTimer(img);
    reportMissingIcon('favicon', state.url, iconUrl || '');
    if (state.onUnavailable) {
      state.onUnavailable();
      return;
    }
    applyFallbackIcon(img);
    scheduleThemeAwareFaviconRescue();
  }

  function finalizeThemeAwareFaviconFailure(img: ThemeFaviconImage, state: ThemeFaviconState, iconUrl: string): void {
    reportMissingIcon('favicon', state.url, iconUrl || '');
    if (state.onUnavailable) {
      state.onUnavailable();
      return;
    }
    restoreWorkingFaviconOrFallback(img, state.previousWorkingSrc);
    scheduleThemeAwareFaviconRescue();
  }

  function attachFaviconWithFallbacks(img: ThemeFaviconImage, url: string, host: string, optionsArg?: FaviconAttachOptions): void {
    if (!url) {
      return;
    }
    if (optionsArg && optionsArg.sourceProfile === 'shortcut') {
      shortcutFaviconOptionsByImage.set(img, { ...optionsArg });
    } else {
      shortcutFaviconOptionsByImage.delete(img);
    }
    if (img._xThemeFaviconErrorHandler) {
      img.removeEventListener('error', img._xThemeFaviconErrorHandler);
      img._xThemeFaviconErrorHandler = null;
    }
    clearThemeAwareCandidateLoadTimer(img);

    if (isOwnExtensionUrl(url) && chromeApi.runtime && typeof chromeApi.runtime.getURL === 'function') {
      const ownIconUrl = chromeApi.runtime.getURL('assets/images/lumno.png');
      setFaviconSrcWithAnimation(img, ownIconUrl, { persist: false });
      return;
    }
    const state = createThemeAwareFaviconState(img, url, host, optionsArg);
    if (shouldBlockFaviconForHost(state.hostKey)) {
      if (state.onUnavailable) {
        state.onUnavailable();
      } else {
        applyFallbackIcon(img);
      }
      return;
    }
    syncThemeAwareFaviconAttributes(img, state);

    const candidates = buildThemeAwareFaviconCandidatePlan(state);
    const tried = new Set<string>();
    let candidateIndex = 0;

    const tryNextAvailableCandidate = (): boolean => {
      while (candidateIndex < candidates.length) {
        const candidate = candidates[candidateIndex];
        candidateIndex += 1;
        if (tryApplyThemeAwareFaviconCandidate(img, state, tried, candidate)) {
          return true;
        }
      }
      return false;
    };

    const finalizeFailure = (iconUrl?: string): void => {
      clearThemeAwareCandidateLoadTimer(img);
      finalizeThemeAwareFaviconFailure(
        img,
        state,
        iconUrl || img.getAttribute('data-favicon-current-src') || img.src || ''
      );
    };

    const handleImageError = function() {
      if (!state.isSessionCurrent()) {
        return;
      }
      if (tryNextAvailableCandidate()) {
        return;
      }
      finalizeFailure();
    };

    img._xThemeFaviconErrorHandler = handleImageError;
    img.addEventListener('error', handleImageError);

    if (!tryNextAvailableCandidate()) {
      finalizeFailure('');
    }
  }

  function refreshThemeAwareFavicons(): void {
    queryHtmlTags(doc, 'img[data-x-nt-theme-favicon="1"]', 'img').forEach((img) => {
      if (!img.isConnected) {
        return;
      }
      const pageUrl = img.getAttribute('data-x-nt-favicon-page-url') || '';
      if (!pageUrl) {
        return;
      }
      const host = img.getAttribute('data-x-nt-favicon-host') || '';
      const customImageUrl = img.getAttribute('data-x-nt-favicon-custom-image') || '';
      attachFaviconWithFallbacks(img, pageUrl, host, {
        primaryUrl: customImageUrl,
        allowRemoteImage: Boolean(customImageUrl),
        ...shortcutFaviconOptionsByImage.get(img)
      });
    });
  }

  // Every failed rescue schedules another rescue, so an icon that can never
  // load would be refetched forever. Cap the extra attempts per image and page.
  function consumeThemeAwareFaviconRescueAttempt(img: ThemeFaviconImage, pageUrl: string): boolean {
    const previous = img._xThemeFaviconRescue;
    const attempts = previous && previous.pageUrl === pageUrl ? previous.attempts : 0;
    if (attempts >= THEME_FAVICON_RESCUE_MAX_ATTEMPTS) {
      return false;
    }
    img._xThemeFaviconRescue = { pageUrl, attempts: attempts + 1 };
    return true;
  }

  function rescueThemeAwareFallbackFavicons(): void {
    queryHtmlTags(doc, 'img[data-x-nt-theme-favicon="1"][data-fallback-icon="true"], ' +
      'img[data-x-nt-theme-favicon="1"][data-favicon-placeholder="true"]', 'img').forEach((img) => {
      if (!img.isConnected) {
        return;
      }
      const pageUrl = img.getAttribute('data-x-nt-favicon-page-url') || '';
      if (!pageUrl || !consumeThemeAwareFaviconRescueAttempt(img, pageUrl)) {
        return;
      }
      const host = img.getAttribute('data-x-nt-favicon-host') || '';
      const customImageUrl = img.getAttribute('data-x-nt-favicon-custom-image') || '';
      attachFaviconWithFallbacks(img, pageUrl, host, {
        primaryUrl: customImageUrl,
        allowRemoteImage: Boolean(customImageUrl),
        ...shortcutFaviconOptionsByImage.get(img)
      });
    });
  }

  function scheduleThemeAwareFaviconRescue(): void {
    if (themeFaviconRescueTimer !== null) {
      clearTimer(themeFaviconRescueTimer);
      themeFaviconRescueTimer = null;
    }
    themeFaviconRescueTimer = setTimer(() => {
      themeFaviconRescueTimer = null;
      rescueThemeAwareFallbackFavicons();
      setTimer(() => {
        rescueThemeAwareFallbackFavicons();
      }, 900);
    }, 700);
  }

  return {
    applyFaviconOpticalShift,
    applyFaviconOpticalAlignment,
    applyFallbackIcon,
    refreshFallbackIcons,
    requestFaviconData,
    setFaviconSrcWithAnimation,
    attachFaviconData,
    preloadIcon,
    warmIconCache,
    attachFaviconWithFallbacks,
    refreshThemeAwareFavicons,
    rescueThemeAwareFallbackFavicons,
    scheduleThemeAwareFaviconRescue
  };
}

type FaviconViewRuntime = ReturnType<typeof createFaviconViewRuntime>;

export { createFaviconViewRuntime };
export type { FaviconViewRuntime, FaviconViewRuntimeOptions, ThemeFaviconImage };
