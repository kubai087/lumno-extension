(function(root, factory) {
  const browserProfile = root.LumnoBrowserProfile ||
    (typeof module === 'object' && module.exports
      ? require('../shared/browser-profile.js')
      : {});
  const api = factory(browserProfile);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoShortcutRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(browserProfile) {

  function getShortcutUrlForScheme(query, rules, scheme) {
    if (!query || !Array.isArray(rules)) {
      return null;
    }
    const queryLower = query.toLowerCase();
    const browserScheme = scheme || 'chrome://';
    for (let i = 0; i < rules.length; i += 1) {
      const rule = rules[i];
      if (!rule || !Array.isArray(rule.keys)) {
        continue;
      }
      const isMatch = rule.keys.some((key) => queryLower.startsWith(key));
      if (!isMatch) {
        continue;
      }
      if (rule.type === 'browserPage' && rule.path) {
        return `${browserScheme}${rule.path}`;
      }
      if (rule.type === 'url' && rule.url) {
        return rule.url;
      }
    }
    return null;
  }

  function create(options) {
    const settings = options && typeof options === 'object' ? options : {};
    const chromeApi = settings.chromeApi || (typeof chrome !== 'undefined' ? chrome : null);
    const fetchImpl = settings.fetchImpl || (typeof fetch === 'function' ? fetch : null);
    const navigatorLike = settings.navigatorLike || (typeof navigator !== 'undefined' ? navigator : null);
    let shortcutRulesCache = null;
    let shortcutRulesPromise = null;

    function getRuntimeUrl(path) {
      return chromeApi && chromeApi.runtime && typeof chromeApi.runtime.getURL === 'function'
        ? chromeApi.runtime.getURL(path)
        : path;
    }

    function loadShortcutRules() {
      if (shortcutRulesCache) {
        return Promise.resolve(shortcutRulesCache);
      }
      if (shortcutRulesPromise) {
        return shortcutRulesPromise;
      }
      if (typeof fetchImpl !== 'function') {
        return Promise.resolve([]);
      }
      const rulesUrl = getRuntimeUrl('assets/data/shortcut-rules.json');
      shortcutRulesPromise = fetchImpl(rulesUrl)
        .then((response) => response.json())
        .then((data) => {
          const items = data && Array.isArray(data.items) ? data.items : [];
          shortcutRulesCache = items;
          return items;
        })
        .catch(() => []);
      return shortcutRulesPromise;
    }

    function getShortcutUrl(query, rules) {
      const scheme = browserProfile.getBrowserInternalProfile(navigatorLike).scheme;
      const usableRules = browserProfile.canOpenBrowserPages(scheme)
        ? rules
        : (Array.isArray(rules) ? rules.filter((rule) => !rule || rule.type !== 'browserPage') : rules);
      return getShortcutUrlForScheme(query, usableRules, scheme);
    }

    return Object.freeze({
      loadShortcutRules,
      getShortcutUrl
    });
  }

  return Object.freeze({
    create,
    getShortcutUrlForScheme
  });
});
