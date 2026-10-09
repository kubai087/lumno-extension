(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoBrowserProfile = api;
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

  return Object.freeze({
    getBrowserInternalScheme,
    getClientHintBrowserName,
    getFallbackBrowserName,
    getBrowserInternalProfile,
    canOpenBrowserPages
  });
});
