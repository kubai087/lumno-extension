(function(global) {
  function noop() {}

  function createFaviconViewRuntime(options) {
    const config = options || {};
    const doc = config.document || global.document;
    const win = config.windowObj || global.window || global;
    const chromeApi = config.chromeApi || global.chrome || {};
    const setTimer = typeof win.setTimeout === 'function' ? win.setTimeout.bind(win) : setTimeout;
    const clearTimer = typeof win.clearTimeout === 'function' ? win.clearTimeout.bind(win) : clearTimeout;
    const getRiSvg = typeof config.getRiSvg === 'function' ? config.getRiSvg : (() => '');
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
    const faviconDataCache = config.faviconDataCache || new Map();
    const faviconDataPending = config.faviconDataPending || new Map();
    const iconPreloadCache = config.iconPreloadCache || new Map();
    const shortcutFaviconOptionsByImage = new WeakMap();
    const missingIconCache = config.missingIconCache || new Set();
    const missingIconDebugEnabled = config.missingIconDebugEnabled === true;
    const faviconUtils = global.LumnoFaviconUtils;
    const faviconUrlResolver = faviconUtils.createFaviconUrlResolver({
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
    const faviconViewCoreApi = global.LumnoFaviconViewCore;
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
    const faviconCandidateLoadTimeoutMs = Number.isFinite(config.faviconCandidateLoadTimeoutMs)
      ? Math.max(0, config.faviconCandidateLoadTimeoutMs)
      : 2600;
    const THEME_FAVICON_RESCUE_MAX_ATTEMPTS = 2;
    let themeFaviconRescueTimer = null;

    const {
      setFallbackNodeVisible,
      setFaviconLoadState,
      applyFaviconOpticalShift,
      applyFaviconOpticalAlignment,
      requestFaviconData,
      setFaviconSrcWithAnimation,
      canReuseCurrentFavicon,
      getLastWorkingFaviconSrc
    } = faviconViewCore;

    function reportMissingIcon(context, url, iconUrl) {
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

    function resolveFallbackIconDimension(img, axis, defaultSize) {
      if (!img) {
        return defaultSize;
      }
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
        if (computed) {
          const computedValue = Number.parseFloat(axis === 'width' ? computed.width : computed.height);
          if (Number.isFinite(computedValue) && computedValue > 0) {
            return computedValue;
          }
        }
      }
      const layoutValue = axis === 'width' ? img.clientWidth : img.clientHeight;
      if (Number.isFinite(layoutValue) && layoutValue > 0) {
        return layoutValue;
      }
      return defaultSize;
    }

    function getFallbackIconName(img, fallback) {
      const raw = img && typeof img.getAttribute === 'function'
        ? String(img.getAttribute('data-fallback-icon-name') || '').trim()
        : '';
      return raw || fallback || 'ri-link';
    }

    function createFallbackIconNode(img) {
      const node = doc.createElement('span');
      const isFolderPreview = !!(img.classList && img.classList.contains('x-nt-folder-preview-favicon'));
      const isBookmarkLeadingIcon = !!(
        img.classList &&
        img.classList.contains('x-nt-bookmark-icon') &&
        img.parentElement &&
        img.parentElement.classList &&
        img.parentElement.classList.contains('x-nt-bookmark-card')
      );
      const isSearchSuggestionIcon = (img.getAttribute('data-x-nt-suggestion-icon') === '1') || Boolean(
        img.closest && img.closest('#_x_extension_newtab_suggestions_container_2024_unique_')
      );
      if (isFolderPreview) {
        node.className = 'x-nt-folder-preview-favicon x-nt-folder-preview-favicon--fallback _x_extension_favicon_fallback_2024_unique_';
        setFallbackNodeVisible(node, true);
        node.innerHTML = getRiSvg(getFallbackIconName(img, 'ri-link'), 'ri-size-12');
        img.parentElement.insertBefore(node, img);
        return node;
      }
      const defaultDimension = isSearchSuggestionIcon ? 16 : 25;
      const fallbackWidth = resolveFallbackIconDimension(img, 'width', defaultDimension);
      const fallbackHeight = resolveFallbackIconDimension(img, 'height', defaultDimension);
      const fallbackBackground = isBookmarkLeadingIcon
        ? 'var(--x-nt-bookmark-icon-color, var(--x-nt-bookmark-icon-bg, rgba(241, 245, 249, 0.92)))'
        : (isSearchSuggestionIcon ? 'transparent' : 'var(--x-nt-tag-bg, #F3F4F6)');
      node.className = 'x-nt-favicon-fallback _x_extension_favicon_fallback_2024_unique_';
      node.style.setProperty('--x-nt-favicon-fallback-width', `${fallbackWidth}px`);
      node.style.setProperty('--x-nt-favicon-fallback-height', `${fallbackHeight}px`);
      node.style.setProperty('--x-nt-favicon-fallback-radius', `${isSearchSuggestionIcon ? 2 : 6}px`);
      node.style.setProperty('--x-nt-favicon-fallback-bg', fallbackBackground);
      node.style.setProperty(
        '--x-nt-favicon-fallback-color',
        isSearchSuggestionIcon ? 'var(--x-nt-subtext, #6B7280)' : 'var(--x-nt-tag-text, #6B7280)'
      );
      node.style.setProperty('--x-nt-favicon-fallback-padding', `${isSearchSuggestionIcon ? 0 : 3}px`);
      setFallbackNodeVisible(node, true);
      node.innerHTML = getRiSvg(getFallbackIconName(img, 'ri-link'), 'ri-size-16');
      img.parentElement.insertBefore(node, img.nextSibling);
      return node;
    }

    const fallbackIcons = faviconViewCoreApi.createFallbackIconPresenter({
      fallbackClassName: '_x_extension_favicon_fallback_2024_unique_',
      nodeMap: config.faviconFallbackNodeMap,
      createFallbackNode: createFallbackIconNode,
      setImageVisible(img, visible) {
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
      ensureFallbackIconNode,
      showResolvedFavicon,
      showPendingFallbackIcon,
      applyFallbackIcon
    } = fallbackIcons;

    function refreshFallbackIcons() {
      doc.querySelectorAll('img[data-fallback-icon="true"]').forEach((img) => {
        const node = ensureFallbackIconNode(img);
        if (node) {
          setFallbackNodeVisible(node, true);
        }
        img.setAttribute('data-fallback-icon', 'true');
        img.style.removeProperty('display');
      });
    }

    function restoreWorkingFaviconOrFallback(img, previousSrc) {
      return faviconViewCore.restoreWorkingFaviconOrFallback(img, previousSrc, {
        applyFallbackIcon
      });
    }

    function attachFaviconData(img, url, hostOverride, pageUrl) {
      const safeUrl = faviconUrlResolver.getSafeFaviconCandidateUrl(url, pageUrl || url, 'data');
      if (safeUrl) {
        faviconViewCore.attachFaviconData(img, safeUrl, hostOverride, pageUrl || url);
      }
    }

    function preloadIcon(url, pageUrl) {
      const safeUrl = faviconUrlResolver.resolveFaviconSource(url, pageUrl || '');
      if (safeUrl) {
        faviconViewCore.preloadIcon(safeUrl);
      }
    }

    function warmIconCache(list) {
      const safeItems = (Array.isArray(list) ? list : []).map((item) => {
        if (!item || !item.favicon) {
          return item;
        }
        const safeUrl = faviconUrlResolver.resolveFaviconSource(item.favicon, item.url || '');
        return { ...item, favicon: safeUrl };
      });
      faviconViewCore.warmIconCache(safeItems);
    }

    function getSafeFaviconCandidateUrl(value, pageUrl, candidateKind, sourceOptions) {
      return faviconUrlResolver.getSafeFaviconCandidateUrl(value, pageUrl, candidateKind, sourceOptions);
    }

    function getRuntimeExtensionFaviconUrl(pageUrl) {
      return faviconUrlResolver.getExtensionFaviconUrl(pageUrl);
    }

    function getRuntimeGstaticFaviconUrl(pageUrl) {
      return faviconUrlResolver.getGstaticFaviconUrl(pageUrl);
    }

    function getRuntimeChromeFaviconUrl(pageUrl) {
      return faviconUrlResolver.getChromeFaviconUrl(pageUrl);
    }

    function createThemeAwareFaviconState(img, url, host, optionsArg) {
      img._xThemeFaviconSession = (img._xThemeFaviconSession || 0) + 1;
      const session = img._xThemeFaviconSession;
      const hostKey = host || getHostFromUrl(url);
      const cacheKey = faviconUtils.getFaviconPersistCacheKey(url, hostKey);
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
        ? faviconUtils.getFaviconPersistCacheKey(previousPage) === faviconUtils.getFaviconPersistCacheKey(url)
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

    function clearThemeAwareCandidateLoadTimer(img) {
      if (!img || img._xThemeFaviconLoadTimer === null || img._xThemeFaviconLoadTimer === undefined) {
        return;
      }
      clearTimer(img._xThemeFaviconLoadTimer);
      img._xThemeFaviconLoadTimer = null;
    }

    function isThemeAwareCandidateLoaded(img, nextSrc) {
      if (!img || !nextSrc) {
        return false;
      }
      const resolvedSrc = img.getAttribute('data-favicon-current-src') || '';
      if (resolvedSrc === nextSrc) {
        return true;
      }
      return Boolean(img.complete && img.naturalWidth > 0);
    }

    function scheduleThemeAwareCandidateLoadTimer(img, state, nextSrc) {
      if (!img || !state || !nextSrc || faviconCandidateLoadTimeoutMs <= 0) {
        return;
      }
      clearThemeAwareCandidateLoadTimer(img);
      const expectedToken = img._xFaviconLoadToken || 0;
      const expectedSrc = String(nextSrc);
      img._xThemeFaviconLoadTimer = setTimer(() => {
        img._xThemeFaviconLoadTimer = null;
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
        if (isThemeAwareCandidateLoaded(img, expectedSrc)) {
          return;
        }
        if (typeof img._xThemeFaviconErrorHandler === 'function') {
          img._xThemeFaviconErrorHandler();
        }
      }, faviconCandidateLoadTimeoutMs);
    }

    function syncThemeAwareFaviconAttributes(img, state) {
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

    function buildThemeAwareFaviconCandidatePlan(state) {
      const runtimeCandidates = faviconUrlResolver.buildFaviconCandidatePlan(state);
      const seen = new Set();
      return runtimeCandidates.filter((candidate) => {
        const safeUrl = getSafeFaviconCandidateUrl(candidate && candidate.url, state.url, candidate && candidate.kind,
          { allowRemoteImage: state.allowRemoteImage && candidate && candidate.kind === 'primary' });
        if (!safeUrl || seen.has(safeUrl)) {
          return false;
        }
        seen.add(safeUrl);
        candidate.url = safeUrl;
        return true;
      });
    }

    function persistResolvedThemeAwareCandidate(state, candidateUrl, resolvedDataUrl) {
      if (state && state.skipPersisted) {
        return;
      }
      const cacheKey = state && state.cacheKey ? String(state.cacheKey) : '';
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

    function tryApplyThemeAwareFaviconCandidate(img, state, tried, candidate) {
      const nextSrc = candidate && candidate.url ? String(candidate.url) : '';
      if (!nextSrc || !img || !state.isSessionCurrent()) {
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
          if (!img || !state.isSessionCurrent()) {
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
          defaultCheckPromise.catch(() => ({ isDefault: false, dataUrl: '' })).then((result) => {
            if (!img || !state.isSessionCurrent()) {
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

    function finalizeDefaultThemeAwareFaviconFailure(img, state, iconUrl) {
      clearThemeAwareCandidateLoadTimer(img);
      reportMissingIcon('favicon', state.url, iconUrl || '');
      if (state.onUnavailable) {
        state.onUnavailable();
        return;
      }
      applyFallbackIcon(img);
      scheduleThemeAwareFaviconRescue();
    }

    function finalizeThemeAwareFaviconFailure(img, state, iconUrl) {
      reportMissingIcon('favicon', state.url, iconUrl || '');
      if (state.onUnavailable) {
        state.onUnavailable();
        return;
      }
      restoreWorkingFaviconOrFallback(img, state.previousWorkingSrc);
      scheduleThemeAwareFaviconRescue();
    }

    function attachFaviconWithFallbacks(img, url, host, optionsArg) {
      if (!img || !url) {
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
      const tried = new Set();
      let candidateIndex = 0;

      const tryNextAvailableCandidate = () => {
        while (candidateIndex < candidates.length) {
          const candidate = candidates[candidateIndex];
          candidateIndex += 1;
          if (tryApplyThemeAwareFaviconCandidate(img, state, tried, candidate)) {
            return true;
          }
        }
        return false;
      };

      const finalizeFailure = (iconUrl) => {
        clearThemeAwareCandidateLoadTimer(img);
        finalizeThemeAwareFaviconFailure(
          img,
          state,
          iconUrl || (img ? (img.getAttribute('data-favicon-current-src') || img.src || '') : '')
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

    function refreshThemeAwareFavicons() {
      doc.querySelectorAll('img[data-x-nt-theme-favicon="1"]').forEach((img) => {
        if (!img || !img.isConnected) {
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
    function consumeThemeAwareFaviconRescueAttempt(img, pageUrl) {
      const previous = img._xThemeFaviconRescue;
      const attempts = previous && previous.pageUrl === pageUrl ? previous.attempts : 0;
      if (attempts >= THEME_FAVICON_RESCUE_MAX_ATTEMPTS) {
        return false;
      }
      img._xThemeFaviconRescue = { pageUrl, attempts: attempts + 1 };
      return true;
    }

    function rescueThemeAwareFallbackFavicons() {
      doc.querySelectorAll(
        'img[data-x-nt-theme-favicon="1"][data-fallback-icon="true"], ' +
        'img[data-x-nt-theme-favicon="1"][data-favicon-placeholder="true"]'
      ).forEach((img) => {
        if (!img || !img.isConnected) {
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

    function scheduleThemeAwareFaviconRescue() {
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
      reportMissingIcon,
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

  global.LumnoNewtabFaviconView = {
    createFaviconViewRuntime
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
