(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoBrowserProfile = api;
  // Extension pages only: this file is also injected into web pages for the
  // overlay, which must never be restyled.
  const location = root.location;
  if (location && /^(?:chrome|moz)-extension:$/.test(location.protocol) && root.document) {
    api.applyDocumentBrowserFamily(root.document, root.navigator);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  function getBrowserInternalScheme(userAgent) {
    const ua = String(userAgent || '');
    // Firefox and its forks (Zen, LibreWolf) report Firefox/ and no Chrome/.
    if (ua.includes('Firefox/') && !ua.includes('Chrome/')) {
      return 'about:';
    }
    if (ua.includes('Edg/')) {
      return 'edge://';
    }
    if (ua.includes('Brave')) {
      return 'brave://';
    }
    if (ua.includes('Vivaldi')) {
      return 'vivaldi://';
    }
    if (ua.includes('OPR/') || ua.includes('Opera')) {
      return 'opera://';
    }
    return 'chrome://';
  }

  function normalizeBrandName(brand) {
    return String(brand || '').replace(/\s+/g, ' ').trim();
  }

  function isGreaseBrandName(brand) {
    const compact = normalizeBrandName(brand).toLowerCase().replace(/[^a-z]/g, '');
    return compact.includes('not') && compact.includes('brand');
  }

  function isChromiumEngineBrandName(brand) {
    return normalizeBrandName(brand).toLowerCase() === 'chromium';
  }

  function getClientHintBrowserName(userAgentData) {
    const brands = userAgentData && Array.isArray(userAgentData.brands)
      ? userAgentData.brands
      : [];
    const names = brands
      .map((item) => normalizeBrandName(item && item.brand))
      .filter((name) => name && !isGreaseBrandName(name));
    const productName = names.find((name) => {
      const lower = name.toLowerCase();
      return !isChromiumEngineBrandName(name) &&
        lower !== 'google chrome' &&
        lower !== 'chrome';
    });
    if (productName) {
      return productName;
    }
    return names.find((name) => !isChromiumEngineBrandName(name)) ||
      names.find((name) => isChromiumEngineBrandName(name)) ||
      '';
  }

  function getFallbackBrowserName(scheme) {
    if (scheme === 'about:') {
      return 'Firefox';
    }
    if (scheme === 'edge://') {
      return 'Microsoft Edge';
    }
    if (scheme === 'brave://') {
      return 'Brave';
    }
    if (scheme === 'vivaldi://') {
      return 'Vivaldi';
    }
    if (scheme === 'opera://') {
      return 'Opera';
    }
    return 'Chrome';
  }

  // Firefox refuses to let extensions open privileged about: pages, so its
  // internal-page shortcuts would only fail silently.
  function canOpenBrowserPages(scheme) {
    return scheme !== 'about:';
  }

  function getBrowserInternalProfile(navigatorLike) {
    const source = navigatorLike && typeof navigatorLike === 'object'
      ? navigatorLike
      : { userAgent: navigatorLike };
    const scheme = getBrowserInternalScheme(source.userAgent);
    return Object.freeze({
      scheme,
      name: getClientHintBrowserName(source.userAgentData) ||
        getFallbackBrowserName(scheme)
    });
  }

  function getBrowserFamily(navigatorLike) {
    return getBrowserInternalProfile(navigatorLike).scheme === 'about:' ? 'firefox' : 'chromium';
  }

  // Marks an extension page with its browser family and hides UI declared for
  // the other one, e.g. <button data-browser-only="chromium"> in Firefox.
  function applyDocumentBrowserFamily(documentObj, navigatorLike) {
    const rootElement = documentObj && documentObj.documentElement;
    if (!rootElement) {
      return '';
    }
    const family = getBrowserFamily(navigatorLike);
    rootElement.setAttribute('data-browser-family', family);
    if (!documentObj.getElementById('lumno-browser-family-style')) {
      const style = documentObj.createElement('style');
      style.id = 'lumno-browser-family-style';
      style.textContent = 'html[data-browser-family="firefox"] [data-browser-only="chromium"],' +
        'html[data-browser-family="chromium"] [data-browser-only="firefox"]{display:none !important;}';
      (documentObj.head || rootElement).appendChild(style);
    }
    return family;
  }

  return Object.freeze({
    getBrowserFamily,
    applyDocumentBrowserFamily,
    getBrowserInternalScheme,
    getClientHintBrowserName,
    getFallbackBrowserName,
    getBrowserInternalProfile,
    canOpenBrowserPages
  });
});
