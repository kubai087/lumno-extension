(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoBackgroundNewtabFallback = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  function getChromeApi() {
    return typeof chrome !== 'undefined' ? chrome : null;
  }

  function getRoutesApi() {
    return typeof globalThis !== 'undefined' && globalThis.LumnoExtensionRoutes
      ? globalThis.LumnoExtensionRoutes
      : null;
  }

  function getTabGroupsApi() {
    return typeof globalThis !== 'undefined' && globalThis.LumnoBackgroundTabGroups
      ? globalThis.LumnoBackgroundTabGroups
      : null;
  }

  function createTab(options, callback) {
    const chromeApi = getChromeApi();
    const done = typeof callback === 'function' ? callback : () => {};
    if (!chromeApi || !chromeApi.tabs || typeof chromeApi.tabs.create !== 'function') {
      done(null, { ok: false, reason: 'tabs-api-unavailable', grouped: false });
      return;
    }
    const openOptions = options && typeof options === 'object' ? options : {};
    const createProperties = openOptions.createProperties && typeof openOptions.createProperties === 'object'
      ? openOptions.createProperties
      : {};
    const sourceTab = openOptions.sourceTab && typeof openOptions.sourceTab === 'object'
      ? openOptions.sourceTab
      : null;
    const tabGroups = getTabGroupsApi();
    if (tabGroups && typeof tabGroups.createTabInSourceGroup === 'function') {
      tabGroups.createTabInSourceGroup(chromeApi, createProperties, sourceTab, done);
      return;
    }
    chromeApi.tabs.create(createProperties, (tab) => {
      done(tab || null, {
        ok: !(chromeApi.runtime && chromeApi.runtime.lastError),
        reason: chromeApi.runtime && chromeApi.runtime.lastError
          ? chromeApi.runtime.lastError.message || 'tab-create-failed'
          : '',
        grouped: false
      });
    });
  }

  function isLocalFileLikeTargetUrl(url) {
    if (!url) {
      return false;
    }
    try {
      const parsed = new URL(url);
      const protocol = String(parsed.protocol || '').toLowerCase();
      if (protocol === 'file:') {
        return true;
      }
      const pathname = String(parsed.pathname || '').toLowerCase();
      if (pathname.endsWith('.pdf') || pathname.endsWith('.htm') || pathname.endsWith('.html')) {
        return true;
      }
      const srcParam = parsed.searchParams ? parsed.searchParams.get('src') : '';
      if (srcParam) {
        try {
          const nested = new URL(srcParam);
          const nestedProtocol = String(nested.protocol || '').toLowerCase();
          const nestedPath = String(nested.pathname || '').toLowerCase();
          if (nestedProtocol === 'file:' ||
            nestedPath.endsWith('.pdf') ||
            nestedPath.endsWith('.htm') ||
            nestedPath.endsWith('.html')) {
            return true;
          }
        } catch (e) {
          const lowerSrc = String(srcParam).toLowerCase();
          if (lowerSrc.startsWith('file://') ||
            lowerSrc.includes('.pdf') ||
            lowerSrc.includes('.htm') ||
            lowerSrc.includes('.html')) {
            return true;
          }
        }
      }
    } catch (e) {
      const lower = String(url).toLowerCase();
      return lower.startsWith('file://') ||
        lower.includes('.pdf') ||
        lower.includes('.htm') ||
        lower.includes('.html');
    }
    return false;
  }

  function checkFileSchemeAccess(callback) {
    const chromeApi = getChromeApi();
    const done = typeof callback === 'function' ? callback : () => {};
    if (!chromeApi || !chromeApi.extension || typeof chromeApi.extension.isAllowedFileSchemeAccess !== 'function') {
      done(null);
      return;
    }
    try {
      chromeApi.extension.isAllowedFileSchemeAccess((isAllowed) => {
        if (chromeApi.runtime && chromeApi.runtime.lastError) {
          done(null);
          return;
        }
        done(Boolean(isAllowed));
      });
    } catch (e) {
      done(null);
    }
  }

  function buildNewtabFallbackUrl(options) {
    const chromeApi = getChromeApi();
    const routes = getRoutesApi();
    if (routes && typeof routes.buildLumnoNewtabUrl === 'function') {
      return routes.buildLumnoNewtabUrl(chromeApi, {
        focus: true,
        notice: options && options.notice === 'file-access' ? 'file-access' : null
      });
    }
    if (routes && typeof routes.buildNewtabUrl === 'function') {
      return routes.buildNewtabUrl(chromeApi, {
        focus: true,
        notice: options && options.notice === 'file-access' ? 'file-access' : null
      });
    }
    const baseUrl = chromeApi && chromeApi.runtime && typeof chromeApi.runtime.getURL === 'function'
      ? chromeApi.runtime.getURL('src/newtab/lumno-newtab.html')
      : 'src/newtab/lumno-newtab.html';
    const newtabUrl = new URL(baseUrl, 'chrome-extension://lumno/');
    newtabUrl.searchParams.set('focus', '1');
    if (options && options.notice === 'file-access') {
      newtabUrl.searchParams.set('notice', 'file-access');
    }
    return newtabUrl.toString();
  }

  function openNewtabFallback(options) {
    const openOptions = options && typeof options === 'object' ? options : {};
    const newtabUrl = buildNewtabFallbackUrl(options);
    createTab({
      sourceTab: openOptions.sourceTab || null,
      createProperties: { url: newtabUrl }
    });
  }

  function openBrowserNewtabFallback(options) {
    const openOptions = options && typeof options === 'object' ? options : {};
    createTab({
      sourceTab: openOptions.sourceTab || null,
      createProperties: {}
    });
  }

  function openNewtabFallbackForUrl(url, options) {
    const openOptions = options && typeof options === 'object' ? options : {};
    if (!isLocalFileLikeTargetUrl(url)) {
      openNewtabFallback(openOptions);
      return;
    }
    checkFileSchemeAccess((isAllowed) => {
      if (isAllowed === false) {
        openNewtabFallback({
          ...openOptions,
          notice: 'file-access'
        });
        return;
      }
      openNewtabFallback(openOptions);
    });
  }

  function isLumnoNewtabPageUrl(chromeApi, url) {
    if (!chromeApi || !chromeApi.runtime || typeof chromeApi.runtime.getURL !== 'function') {
      return false;
    }
    try {
      const parsed = new URL(String(url || ''));
      const newtabUrl = new URL(chromeApi.runtime.getURL('newtab.html'));
      return parsed.origin === newtabUrl.origin && parsed.pathname === newtabUrl.pathname;
    } catch (e) {
      return false;
    }
  }

  // Session stores may record the close slightly later (Zen does), so retry;
  // lastModified keeps an older, user-closed New Tab from being forgotten.
  function forgetClosedNewtab(chromeApi, closedUrl, closedAfter, attemptsLeft) {
    const sessions = chromeApi && chromeApi.sessions;
    if (!sessions || typeof sessions.getRecentlyClosed !== 'function' ||
        typeof sessions.forgetClosedTab !== 'function') {
      return;
    }
    const remaining = typeof attemptsLeft === 'number' ? attemptsLeft : 3;
    sessions.getRecentlyClosed({ maxResults: 5 }, (entries) => {
      if (chromeApi.runtime && chromeApi.runtime.lastError) {
        return;
      }
      const entry = (Array.isArray(entries) ? entries : []).find((item) => (
        item && item.tab && item.tab.url === closedUrl && item.tab.sessionId &&
        Number(item.lastModified) >= closedAfter
      ));
      if (!entry) {
        if (remaining > 1) {
          setTimeout(() => forgetClosedNewtab(chromeApi, closedUrl, closedAfter, remaining - 1), 150);
        }
        return;
      }
      // Firefox-only API; its schema takes no callback and returns a promise.
      try {
        const forgetting = sessions.forgetClosedTab(entry.tab.windowId, entry.tab.sessionId);
        if (forgetting && typeof forgetting.catch === 'function') {
          forgetting.catch(() => {});
        }
      } catch (e) {
        // Keeping the closed entry is harmless.
      }
    });
  }

  // Firefox keeps URL-bar focus on a New Tab page through same-tab navigation
  // (its initial-page check ignores the query), so focus only reaches a
  // freshly created tab. Replace the sender tab with one marked #focus: a
  // query would leave the URL bar showing the extension URL once cleared,
  // because Firefox compares it with the page principal.
  function swapNewtabForFocus(sourceTab, senderUrl, callback) {
    const chromeApi = getChromeApi();
    const done = typeof callback === 'function' ? callback : () => {};
    if (!sourceTab || typeof sourceTab.id !== 'number' || !isLumnoNewtabPageUrl(chromeApi, senderUrl)) {
      done({ ok: false, reason: 'invalid-sender' });
      return;
    }
    // Recreating a container tab needs the cookies permission; leave it as is.
    if (/^firefox-container-/.test(String(sourceTab.cookieStoreId || ''))) {
      done({ ok: false, reason: 'container-tab' });
      return;
    }
    const focusUrl = new URL(String(senderUrl));
    focusUrl.hash = 'focus';
    const createProperties = {
      url: focusUrl.toString(),
      index: sourceTab.index,
      windowId: sourceTab.windowId,
      active: true
    };
    if (typeof sourceTab.openerTabId === 'number') {
      createProperties.openerTabId = sourceTab.openerTabId;
    }
    createTab({ sourceTab, createProperties }, (tab, result) => {
      if (!tab) {
        done({ ok: false, reason: (result && result.reason) || 'tab-create-failed' });
        return;
      }
      const removeStartedAt = Date.now();
      chromeApi.tabs.remove(sourceTab.id, () => {
        if (chromeApi.runtime && chromeApi.runtime.lastError) {
          done({ ok: true, removed: false });
          return;
        }
        forgetClosedNewtab(chromeApi, String(senderUrl), removeStartedAt);
        done({ ok: true, removed: true });
      });
    });
  }

  return Object.freeze({
    buildNewtabFallbackUrl,
    checkFileSchemeAccess,
    isLocalFileLikeTargetUrl,
    openBrowserNewtabFallback,
    openNewtabFallback,
    openNewtabFallbackForUrl,
    swapNewtabForFocus
  });
});
