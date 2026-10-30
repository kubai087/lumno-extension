// The search engine this device last searched with: the stored choice, which
// a result page of a known engine updates, the search URLs it builds and its icon.
import { defaultSearchEngine } from '../../domain/settings';
import { normalizeHost, workerSettings } from '../worker-context';
import { isRecord } from './types';
import type { DefaultSearchEngineState } from './types';
import * as SearchDirectNavigation from '../../domain/search/utils/direct-navigation';
import { findSearchEngineByHostname, findSearchEngineById, isSearchEngineResultUrl, searchTemplateOn } from '../../domain/search/search-engines';
import * as SearchSiteSearchProviders from '../../domain/search/utils/site-search-providers';

let defaultSearchEngineState: DefaultSearchEngineState = {
  id: 'google',
  name: 'Google',
  host: 'www.google.com',
  searchTemplate: 'https://www.google.com/search?q={query}',
  updatedAt: 0
};

let defaultSearchEngineStateReady: Promise<DefaultSearchEngineState> = Promise.resolve(defaultSearchEngineState);

function setDefaultSearchEngineState(nextState: unknown, shouldPersist: boolean): void {
  if (!isRecord(nextState) || !nextState.id) {
    return;
  }
  const engine = findSearchEngineById(nextState.id);
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

function updateDefaultSearchEngineFromUrl(url: unknown): boolean {
  if (!url || !isSearchEngineResultUrl(url)) {
    return false;
  }
  try {
    const parsedUrl = new URL(String(url));
    const engine = findSearchEngineByHostname(parsedUrl.hostname);
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
  const engine = findSearchEngineById(defaultSearchEngineState.id);
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
  const engine = findSearchEngineById(defaultSearchEngineState.id);
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
