// The search engines Lumno recognizes as the browser's default: which pages
// are their result pages and the address a search on each goes to.
import { normalizeHost } from './utils/direct-navigation';

interface SearchEngineDef {
  id: string;
  name: string;
  hostMatches: string[];
  searchTemplate: string;
  searchUrl(query: string): string;
  // The engine's regional sites; a search goes to the one this device used.
  regionalHosts?: RegExp;
}

const SEARCH_ENGINES: readonly SearchEngineDef[] = [
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

function findSearchEngineByHostname(hostname: unknown): SearchEngineDef | null {
  const normalized = normalizeHost(hostname);
  if (!normalized) {
    return null;
  }
  return SEARCH_ENGINES.find((engine) => engine.regionalHosts?.test(normalized)) ||
    SEARCH_ENGINES.find((engine) =>
      engine.hostMatches.some((match) => normalized.includes(match))
    ) || null;
}

function findSearchEngineById(id: unknown): SearchEngineDef | null {
  if (!id) {
    return null;
  }
  return SEARCH_ENGINES.find((engine) => engine.id === id) || null;
}

function isSearchEngineResultUrl(url: unknown): boolean {
  try {
    const parsedUrl = new URL(String(url));
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return false;
    }
    const hostname = parsedUrl.hostname.toLowerCase();
    const engine = SEARCH_ENGINES.find((candidate) => candidate.regionalHosts?.test(hostname)) ||
      SEARCH_ENGINES.find((candidate) =>
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

export {
  SEARCH_ENGINES,
  findSearchEngineByHostname,
  findSearchEngineById,
  isSearchEngineResultUrl,
  searchTemplateOn
};
export type { SearchEngineDef };
