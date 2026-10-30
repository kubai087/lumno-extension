// The words that open a browser page or a site from the search box
// (assets/data/shortcut-rules.json).
import * as browserProfile from '../platform/browser-profile';
import type { ShortcutRule } from '../domain/messages';
import { readShortcutRules, shortcutRuleMatches } from '../domain/shortcut-rules-reader';

interface ShortcutRulesOptions {
  chromeApi?: { runtime?: { getURL?: (path: string) => string } } | null;
  fetchImpl?: ((url: string) => Promise<{ json(): Promise<unknown> }>) | null;
  navigatorLike?: browserProfile.NavigatorLike | null;
}

interface ShortcutRules {
  loadShortcutRules(): Promise<ShortcutRule[]>;
  // The page a query that is a rule's word opens, or null.
  getShortcutUrl(query: string, rules: readonly ShortcutRule[] | null | undefined): string | null;
}

function getShortcutUrlForScheme(
  query: string,
  rules: readonly (ShortcutRule | null | undefined)[] | null | undefined,
  scheme: string
): string | null {
  if (!query || !Array.isArray(rules)) {
    return null;
  }
  const browserScheme = scheme || 'chrome://';
  for (let i = 0; i < rules.length; i += 1) {
    const rule = rules[i];
    if (!rule || !shortcutRuleMatches(rule, query)) {
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

function create(options?: ShortcutRulesOptions | null): Readonly<ShortcutRules> {
  const settings = options && typeof options === 'object' ? options : {};
  const chromeApi = settings.chromeApi || (typeof chrome !== 'undefined' ? chrome : null);
  const fetchImpl = settings.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  const navigatorLike = settings.navigatorLike || (typeof navigator !== 'undefined' ? navigator : null);
  let shortcutRulesCache: ShortcutRule[] | null = null;
  let shortcutRulesPromise: Promise<ShortcutRule[]> | null = null;

  function getRuntimeUrl(path: string): string {
    return chromeApi && chromeApi.runtime && typeof chromeApi.runtime.getURL === 'function'
      ? chromeApi.runtime.getURL(path)
      : path;
  }

  function loadShortcutRules(): Promise<ShortcutRule[]> {
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
        const items = readShortcutRules(data);
        shortcutRulesCache = items;
        return items;
      })
      .catch((): ShortcutRule[] => []);
    return shortcutRulesPromise;
  }

  function getShortcutUrl(query: string, rules: readonly ShortcutRule[] | null | undefined): string | null {
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

export { create, getShortcutUrlForScheme };
export type { ShortcutRules, ShortcutRulesOptions };
