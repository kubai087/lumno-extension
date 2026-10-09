(function(root) {
  // URL classification, favicon source policy and the search/favicon blacklists
  // used by New Tab suggestions, recent sites and favicons.
  function createUrlPolicy(deps) {
    const {
      EXTENSION_ROUTES,
      t,
      getPageFaviconUrlResolver,
      normalizeFaviconHost,
      getExtensionResourceUrl,
      FAVICON_UTILS,
      BLACKLIST_UTILS,
      SETTINGS,
      storageArea,
      SEARCH_BLACKLIST_STORAGE_KEY,
      FAVICON_REQUEST_BLACKLIST_STORAGE_KEY,
      FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY,
      SEARCH_UTILS,
      getBrowserIconUrl
    } = deps;

    // Page state still owned by newtab.js; read and written through accessors.
    const pageState = deps.pageState;

    function isEnglishQuery(query) {
      if (!query) {
        return false;
      }
      return /^[A-Za-z0-9\s._/-]+$/.test(query);
    }

    function getUrlDisplay(url) {
      if (!url) {
        return '';
      }
      const ownExtensionDisplay = getOwnExtensionPageDisplay(url);
      if (ownExtensionDisplay) {
        return ownExtensionDisplay.urlText;
      }
      try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./i, '');
        const path = parsed.pathname === '/' ? '' : parsed.pathname;
        return `${host}${path}${parsed.search || ''}${parsed.hash || ''}`;
      } catch (e) {
        return url;
      }
    }

    function isBrowserExtensionProtocol(protocol) {
      const guards = window.LumnoUrlGuards;
      return guards.isBrowserExtensionProtocol(protocol);
    }

    function isBrowserNewtabUrl(url) {
      const guards = window.LumnoUrlGuards;
      return guards.isBrowserNewtabUrl(url);
    }

    function isBrowserInternalUrl(url) {
      const guards = window.LumnoUrlGuards;
      return guards.isBrowserInternalUrl(url);
    }

    function isBrowserPageRecentUrl(url) {
      return Boolean(url && isBrowserInternalUrl(url) && !isBrowserNewtabUrl(url));
    }

    function isOwnExtensionUrl(url) {
      if (!url || !chrome || !chrome.runtime || !chrome.runtime.id) {
        return false;
      }
      try {
        const parsed = new URL(url);
        return isBrowserExtensionProtocol(parsed.protocol) &&
          String(parsed.hostname || '') === String(chrome.runtime.id);
      } catch (e) {
        return false;
      }
    }

    function getOwnExtensionPageLabel(url) {
      if (!isOwnExtensionUrl(url)) {
        return '';
      }
      try {
        const routeType = EXTENSION_ROUTES.classifyExtensionUrl(url);
        if (routeType === 'newtab') {
          return t('newtab_page_label', '新标签页');
        }
        if (routeType === 'options') {
          return t('settings_title', '设置');
        }
        const parsed = new URL(url);
        const path = String(parsed.pathname || '').toLowerCase();
        if (path.endsWith('/newtab.html') || path === '/newtab.html') {
          return t('newtab_page_label', '新标签页');
        }
        if (path.endsWith('/options.html') || path === '/options.html') {
          return t('settings_title', '设置');
        }
        return t('extension_page_label', '扩展页面');
      } catch (e) {
        return t('extension_page_label', '扩展页面');
      }
    }

    function getOwnExtensionPageDisplay(url, title) {
      if (!isOwnExtensionUrl(url)) {
        return null;
      }
      const pageLabel = getOwnExtensionPageLabel(url);
      const rawTitle = String(title || '').trim();
      const runtimeId = String(chrome && chrome.runtime && chrome.runtime.id ? chrome.runtime.id : '').toLowerCase();
      const titleLooksLikeId = rawTitle && runtimeId && rawTitle.toLowerCase().includes(runtimeId);
      const titleText = rawTitle && !titleLooksLikeId
        ? rawTitle
        : `Lumno ${pageLabel}`.trim();
      return {
        siteName: 'Lumno',
        titleText: titleText,
        urlText: `Lumno · ${pageLabel}`.trim()
      };
    }

    function isRestrictedUrl(url) {
      const guards = window.LumnoUrlGuards;
      return guards.isRestrictedUrl(url);
    }

    function getExtensionFaviconUrl(pageUrl) {
      const resolver = getPageFaviconUrlResolver();
      const extensionUrl = resolver ? resolver.getExtensionFaviconUrl(pageUrl) : '';
      // Without _favicon (Firefox), the browser's own icons stand in for it.
      return extensionUrl || (typeof getBrowserIconUrl === 'function' ? getBrowserIconUrl(pageUrl) : '');
    }

    function getGstaticFaviconUrl(pageUrl) {
      const resolver = getPageFaviconUrlResolver();
      return resolver ? resolver.getGstaticFaviconUrl(pageUrl) : '';
    }

    function getChromeFaviconUrl(pageUrl) {
      const resolver = getPageFaviconUrlResolver();
      return resolver ? resolver.getChromeFaviconUrl(pageUrl) : '';
    }

    function getBrowserPageFaviconUrl(pageUrl) {
      const resolver = getPageFaviconUrlResolver();
      return resolver ? resolver.getBrowserPageFaviconUrl(pageUrl) : '';
    }

    function getPageFaviconCandidateUrl(pageUrl) {
      const resolver = getPageFaviconUrlResolver();
      return resolver ? resolver.getPageFaviconCandidateUrl(pageUrl) : '';
    }

    function getPageFaviconRenderCandidates(pageUrl, explicitUrl, options) {
      const resolver = getPageFaviconUrlResolver();
      return resolver && typeof resolver.getPageFaviconRenderCandidates === 'function'
        ? resolver.getPageFaviconRenderCandidates(pageUrl, explicitUrl, options)
        : { primaryUrl: '', browserUrl: '' };
    }

    function getHostFaviconUrl(hostname) {
      const normalized = normalizeFaviconHost(hostname);
      if (!normalized) {
        return '';
      }
      if (normalized === 'lumno.kubai.design') {
        return (chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function')
          ? getExtensionResourceUrl('assets/images/lumno.png')
          : 'https://lumno.kubai.design/favicon.png';
      }
      return getGstaticFaviconUrl(`https://${normalized}/`);
    }

    function isLocalNetworkHost(hostname) {
      return FAVICON_UTILS.isLocalNetworkHost(hostname);
    }

    function shouldBlockFaviconForHost(hostname) {
      return FAVICON_UTILS.shouldBlockFaviconForHost(hostname);
    }

    function shouldAvoidDirectFaviconForHost(hostname) {
      return FAVICON_UTILS.shouldAvoidDirectFaviconForHost(hostname);
    }

    function normalizeSearchBlacklistMatchModes(value) {
      if (BLACKLIST_UTILS.normalizeMatchModes) {
        return BLACKLIST_UTILS.normalizeMatchModes(value, 'prefix');
      }
      return ['prefix'];
    }

    function normalizeSearchBlacklistItems(items) {
      if (BLACKLIST_UTILS.normalizeItems) {
        return BLACKLIST_UTILS.normalizeItems(items, 'prefix');
      }
      return [];
    }

    function normalizeFaviconRequestBlacklistItems(items) {
      if (BLACKLIST_UTILS.normalizeItems) {
        return BLACKLIST_UTILS.normalizeItems(items, 'prefix');
      }
      return [];
    }

    function normalizeFaviconEnhancedFetchEnabled(value) {
      return SETTINGS.normalizeFaviconEnhancedFetchEnabled(value);
    }

    function loadSearchBlacklistItems() {
      return new Promise((resolve) => {
        if (!storageArea) {
          resolve([]);
          return;
        }
        storageArea.get([SEARCH_BLACKLIST_STORAGE_KEY], (result) => {
          const items = normalizeSearchBlacklistItems(result && result[SEARCH_BLACKLIST_STORAGE_KEY]);
          pageState.searchBlacklistItems = items;
          resolve(items);
        });
      });
    }

    function getFaviconRequestMatchUrl(url) {
      const raw = String(url || '').trim();
      if (!raw) {
        return '';
      }
      return String(FAVICON_UTILS.getCanonicalPageUrlForFavicon(raw) || raw).trim();
    }

    function isUrlBlockedByFaviconRequestBlacklist(url) {
      const target = getFaviconRequestMatchUrl(url);
      return Boolean(
        target &&
        BLACKLIST_UTILS.isUrlBlocked &&
        BLACKLIST_UTILS.isUrlBlocked(target, pageState.faviconRequestBlacklistItems)
      );
    }

    function getNewtabStrictFaviconReason(pageUrl) {
      if (isUrlBlockedByFaviconRequestBlacklist(pageUrl)) {
        return 'exclusion';
      }
      if (!pageState.faviconEnhancedFetchEnabled) {
        return 'global-off';
      }
      return '';
    }

    function isNewtabEnhancedFaviconFetchEnabled(pageUrl) {
      return getNewtabStrictFaviconReason(pageUrl) === '';
    }

    function loadFaviconRequestBlacklistItems() {
      return new Promise((resolve) => {
        if (!storageArea) {
          resolve([]);
          return;
        }
        storageArea.get([FAVICON_REQUEST_BLACKLIST_STORAGE_KEY], (result) => {
          const items = normalizeFaviconRequestBlacklistItems(result && result[FAVICON_REQUEST_BLACKLIST_STORAGE_KEY]);
          pageState.faviconRequestBlacklistItems = items;
          resolve(items);
        });
      });
    }

    function loadFaviconEnhancedFetchEnabled() {
      return new Promise((resolve) => {
        if (!storageArea) {
          pageState.faviconEnhancedFetchEnabled = true;
          resolve(true);
          return;
        }
        storageArea.get([FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY], (result) => {
          const rawValue = result && result[FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY];
          const enabled = normalizeFaviconEnhancedFetchEnabled(rawValue);
          pageState.faviconEnhancedFetchEnabled = enabled;
          if (rawValue !== enabled) {
            storageArea.set({ [FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY]: enabled });
          }
          resolve(enabled);
        });
      });
    }

    function isUrlBlockedBySearchBlacklist(url) {
      return BLACKLIST_UTILS.isUrlBlocked
        ? BLACKLIST_UTILS.isUrlBlocked(url, pageState.searchBlacklistItems)
        : false;
    }

    function isSuggestionBlockedBySearchBlacklist(suggestion) {
      if (!suggestion) {
        return false;
      }
      if (
        suggestion.type === 'newtab' ||
        suggestion.type === 'siteSearch' ||
        suggestion.type === 'inlineSiteSearch' ||
        suggestion.type === 'siteSearchPrompt'
      ) {
        return false;
      }
      if (suggestion.url && isUrlBlockedBySearchBlacklist(suggestion.url)) {
        return true;
      }
      return false;
    }

    function filterBlacklistedSuggestions(list, queryForProvider) {
      if (!Array.isArray(list) || list.length === 0) {
        return [];
      }
      return list.filter((suggestion) => !isSuggestionBlockedBySearchBlacklist(suggestion));
    }

    function limitSuggestionsForDisplay(list, options) {
      const config = options && typeof options === 'object' ? options : {};
      if (config.uncapped === true) {
        return Array.isArray(list) ? list : [];
      }
      return SEARCH_UTILS.limitSearchSuggestionsForDisplay(list, {
        limit: pageState.searchResultDisplayLimit
      });
    }

    function shouldExcludeFromRecentSites(url) {
      if (!url) {
        return true;
      }
      if (isBrowserNewtabUrl(url)) {
        return true;
      }
      try {
        const parsed = new URL(url);
        if (isBrowserExtensionProtocol(parsed.protocol)) {
          return true;
        }
        return isUrlBlockedBySearchBlacklist(parsed.toString());
      } catch (e) {
        return true;
      }
    }

    return {
      isEnglishQuery,
      getUrlDisplay,
      isBrowserPageRecentUrl,
      isOwnExtensionUrl,
      getOwnExtensionPageDisplay,
      getExtensionFaviconUrl,
      getGstaticFaviconUrl,
      getChromeFaviconUrl,
      getBrowserPageFaviconUrl,
      getPageFaviconCandidateUrl,
      getPageFaviconRenderCandidates,
      isLocalNetworkHost,
      shouldBlockFaviconForHost,
      shouldAvoidDirectFaviconForHost,
      normalizeSearchBlacklistItems,
      normalizeFaviconRequestBlacklistItems,
      normalizeFaviconEnhancedFetchEnabled,
      loadSearchBlacklistItems,
      isUrlBlockedByFaviconRequestBlacklist,
      getNewtabStrictFaviconReason,
      isNewtabEnhancedFaviconFetchEnabled,
      loadFaviconRequestBlacklistItems,
      loadFaviconEnhancedFetchEnabled,
      filterBlacklistedSuggestions,
      limitSuggestionsForDisplay,
      shouldExcludeFromRecentSites
    };
  }

  root.LumnoNewtabUrlPolicy = { createUrlPolicy };
})(globalThis);
