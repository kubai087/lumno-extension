(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoSearchNavigationShortcut = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  function getNavigatorPlatform(navigatorLike) {
    const source = navigatorLike || {};
    const userAgentDataPlatform = source.userAgentData &&
      typeof source.userAgentData.platform === 'string'
      ? source.userAgentData.platform
      : '';
    const candidates = [
      userAgentDataPlatform,
      source.platform,
      source.userAgent
    ];
    for (const candidate of candidates) {
      const value = String(candidate || '').trim().toLowerCase();
      if (!value) {
        continue;
      }
      if (/(mac|iphone|ipad|ipod)/.test(value)) {
        return 'mac';
      }
      if (/win/.test(value)) {
        return 'windows';
      }
      if (/(linux|android|cros)/.test(value)) {
        return 'other';
      }
    }
    return 'other';
  }

  function resolvePlatform(options) {
    const config = options || {};
    const explicitPlatform = String(config.platform || '').trim().toLowerCase();
    if (explicitPlatform.includes('mac')) {
      return 'mac';
    }
    if (explicitPlatform.includes('win')) {
      return 'windows';
    }
    if (explicitPlatform) {
      return 'other';
    }
    return getNavigatorPlatform(config.navigatorLike);
  }

  function getSuggestionNavigationKey(event, options) {
    const key = String(event && event.key || '');
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      return key;
    }
    if (!event) {
      return '';
    }
    if (resolvePlatform(options) !== 'mac') {
      return '';
    }
    if (!event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
      return '';
    }
    const normalizedKey = key.trim().toLowerCase();
    const code = String(event.code || '').trim();
    if (normalizedKey === 'n' || code === 'KeyN') {
      return 'ArrowDown';
    }
    if (normalizedKey === 'p' || code === 'KeyP') {
      return 'ArrowUp';
    }
    return '';
  }

  return Object.freeze({
    getNavigatorPlatform,
    getSuggestionNavigationKey
  });
});
