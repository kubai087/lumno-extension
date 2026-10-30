// The search engine this device last searched with: recognizing an engine's
// result pages, building search URLs for it, and its icon.
import { defaultSearchEngine } from '../../domain/settings';
import { normalizeHost, workerSettings } from '../worker-context';
import { isRecord } from './types';
import type { DefaultSearchEngineState, SearchEngineDef } from './types';
import * as SearchDirectNavigation from '../../domain/search/utils/direct-navigation';
import * as SearchSiteSearchProviders from '../../domain/search/utils/site-search-providers';

const SEARCH_ENGINE_DEFS: readonly SearchEngineDef[] = [
  {
    id: 'google',
    name: 'Google',
    hostMatches: ['google.'],
    searchTemplate: 'https://www.google.com/search?q={query}',
    searchUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`
  },
  {
    id: 'kagi',
    name: 'Kagi',
    hostMatches: ['kagi.com'],
    searchTemplate: 'https://kagi.com/search?q={query}',
    searchUrl: (query) => `https://kagi.com/search?q=${encodeURIComponent(query)}`
  },
  {
    id: 'bing',
    name: 'Bing',
    hostMatches: ['bing.com'],
    searchTemplate: 'https://www.bing.com/search?q={query}',
    searchUrl: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`
  },
  {
    id: 'baidu',
    name: 'Baidu',
    hostMatches: ['baidu.com'],
    searchTemplate: 'https://www.baidu.com/s?wd={query}',
    searchUrl: (query) => `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    hostMatches: ['duckduckgo.com'],
    searchTemplate: 'https://duckduckgo.com/?q={query}',
    searchUrl: (query) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
  },
  {
    id: 'yahoo',
    name: 'Yahoo',
    hostMatches: ['search.yahoo.com'],
    searchTemplate: 'https://search.yahoo.com/search?p={query}',
    searchUrl: (query) => `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`
  },
  {
    id: 'yandex',
    name: 'Yandex',
    hostMatches: ['yandex.com'],
    searchTemplate: 'https://yandex.com/search/?text={query}',
    searchUrl: (query) => `https://yandex.com/search/?text=${encodeURIComponent(query)}`,
    regionalHosts: /^(?:www\.)?(?:yandex\.(?:[a-z]{2,3}|com\.[a-z]{2})|ya\.ru)$/
  },
  {
    id: 'sogou',
    name: '搜狗',
    hostMatches: ['sogou.com'],
    searchTemplate: 'https://www.sogou.com/web?query={query}',
    searchUrl: (query) => `https://www.sogou.com/web?query=${encodeURIComponent(query)}`
  },
  {
    id: 'shenma',
    name: '神马',
    hostMatches: ['sm.cn'],
    searchTemplate: 'https://m.sm.cn/s?q={query}',
    searchUrl: (query) => `https://m.sm.cn/s?q=${encodeURIComponent(query)}`
  }
];

let defaultSearchEngineState: DefaultSearchEngineState = {
  id: 'google',
  name: 'Google',
  host: 'www.google.com',
  searchTemplate: 'https://www.google.com/search?q={query}',
  updatedAt: 0
};

let defaultSearchEngineStateReady: Promise<DefaultSearchEngineState> = Promise.resolve(defaultSearchEngineState);

// A search the overlay or New Tab handed to the browser's default engine:
// its results tab is found as it opens, and joins the source tab's group.

function getSearchEngineByHostname(hostname: unknown): SearchEngineDef | null {
  const normalized = normalizeHost(hostname);
  if (!normalized) {
    return null;
  }
  return SEARCH_ENGINE_DEFS.find((engine) => engine.regionalHosts?.test(normalized)) ||
    SEARCH_ENGINE_DEFS.find((engine) =>
      engine.hostMatches.some((match) => normalized.includes(match))
    ) || null;
}

function getSearchEngineById(id: unknown): SearchEngineDef | null {
  if (!id) {
    return null;
  }
  return SEARCH_ENGINE_DEFS.find((engine) => engine.id === id) || null;
}

function setDefaultSearchEngineState(nextState: unknown, shouldPersist: boolean): void {
  if (!isRecord(nextState) || !nextState.id) {
    return;
  }
  const engine = getSearchEngineById(nextState.id);
  const updated: DefaultSearchEngineState = {
    id: String(nextState.id),
    name: String(nextState.name || ''),
    host: String(nextState.host || ''),
    searchTemplate: String(nextState.searchTemplate || (engine ? engine.searchTemplate : '')),
    updatedAt: Number(nextState.updatedAt) || Date.now()
  };
  defaultSearchEngineState = updated;
  if (shouldPersist) {
    void workerSettings.set(defaultSearchEngine, updated);
  }
}

// Re-reads the stored default engine; callers wait on defaultSearchEngineStateReady.
function refreshDefaultSearchEngineState(): void {
  defaultSearchEngineStateReady = loadDefaultSearchEngineState();
}

function loadDefaultSearchEngineState(): Promise<DefaultSearchEngineState> {
  return new Promise((resolve) => {
    void workerSettings.ready.then(() => {
      const stored = workerSettings.get(defaultSearchEngine);
      if (isRecord(stored) && stored.id) {
        if (SearchSiteSearchProviders.isRetiredSearchEngineState({
          id: typeof stored.id === 'string' ? stored.id : undefined,
          host: typeof stored.host === 'string' ? stored.host : undefined,
          searchTemplate: typeof stored.searchTemplate === 'string' ? stored.searchTemplate : undefined
        })) {
          setDefaultSearchEngineState({
            id: 'google',
            name: 'Google',
            host: 'www.google.com',
            searchTemplate: 'https://www.google.com/search?q={query}',
            updatedAt: Date.now()
          }, true);
        } else {
          setDefaultSearchEngineState(stored, false);
        }
      }
      resolve(defaultSearchEngineState);
    });
  });
}

function isSearchEngineResultUrl(url: unknown): boolean {
  try {
    const parsedUrl = new URL(String(url));
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return false;
    }
    const hostname = parsedUrl.hostname.toLowerCase();
    const engine = SEARCH_ENGINE_DEFS.find((candidate) => candidate.regionalHosts?.test(hostname)) ||
      SEARCH_ENGINE_DEFS.find((candidate) =>
        candidate.hostMatches.some((match) => {
          if (match === 'google.') {
            return /(^|\.)google\.(?:com|[a-z]{2}|(?:co|com)\.[a-z]{2})$/.test(hostname);
          }
          return hostname === match || hostname.endsWith(`.${match}`);
        })
      );
    if (!engine) {
      return false;
    }
    const queryMarker = '__lumno_search_query__';
    const searchUrl = new URL(engine.searchTemplate.replace('{query}', queryMarker));
    const normalizePath = (value: string): string => value.toLowerCase().replace(/\/+$/, '') || '/';
    // A prefix such as /web also matches ordinary pages like /webstore.
    if (normalizePath(parsedUrl.pathname) !== normalizePath(searchUrl.pathname)) {
      return false;
    }
    const queryParam = Array.from(searchUrl.searchParams.entries())
      .find(([, value]) => value === queryMarker);
    return Boolean(queryParam && String(parsedUrl.searchParams.get(queryParam[0]) || '').trim());
  } catch (_error) {
    return false;
  }
}

// The engine's search template on the site a result page came from, for
// an engine with regional sites.
function searchTemplateOn(engine: SearchEngineDef, hostname: string): string {
  if (!engine.regionalHosts?.test(hostname)) {
    return engine.searchTemplate;
  }
  const template = new URL(engine.searchTemplate);
  template.hostname = hostname;
  return decodeURI(template.href);
}

function updateDefaultSearchEngineFromUrl(url: unknown): boolean {
  if (!url || !isSearchEngineResultUrl(url)) {
    return false;
  }
  try {
    const parsedUrl = new URL(String(url));
    const engine = getSearchEngineByHostname(parsedUrl.hostname);
    if (!engine) {
      return false;
    }
    setDefaultSearchEngineState({
      id: engine.id,
      name: engine.name,
      host: normalizeHost(parsedUrl.hostname),
      searchTemplate: searchTemplateOn(engine, parsedUrl.hostname.toLowerCase()),
      updatedAt: Date.now()
    }, true);
    return true;
  } catch (_error) {
    return false;
  }
}

function buildDefaultSearchUrl(query: string): string {
  const engine = getSearchEngineById(defaultSearchEngineState.id);
  const { searchTemplate } = defaultSearchEngineState;
  if (engine && searchTemplate.includes('{query}')) {
    return searchTemplate.replace('{query}', encodeURIComponent(query));
  }
  if (engine && typeof engine.searchUrl === 'function') {
    return engine.searchUrl(query);
  }
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function getDirectNavigationUrl(input: unknown): string {
  return SearchDirectNavigation.getDirectNavigationUrl(input);
}

function getDefaultSearchEngineFaviconUrl(): string {
  if (defaultSearchEngineState.id === 'google') {
    return 'https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png';
  }
  if (defaultSearchEngineState.host) {
    return `https://${defaultSearchEngineState.host}/favicon.ico`;
  }
  const engine = getSearchEngineById(defaultSearchEngineState.id);
  if (engine) {
    try {
      const host = new URL(engine.searchUrl('test')).hostname;
      return `https://${host}/favicon.ico`;
    } catch (_error) {
      return '';
    }
  }
  return 'https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png';
}


// The engine's id, '' until one is known.
function getDefaultSearchEngineId(): string {
  return defaultSearchEngineState.id;
}

export {
  buildDefaultSearchUrl,
  getDefaultSearchEngineId,
  defaultSearchEngineStateReady,
  getDefaultSearchEngineFaviconUrl,
  getDirectNavigationUrl,
  isSearchEngineResultUrl,
  refreshDefaultSearchEngineState,
  setDefaultSearchEngineState,
  updateDefaultSearchEngineFromUrl
};
