// The search engine a typed query goes to: the browser's default as the
// worker stored it. This is its one owner; it follows the stored choice
// and answers the search and theme addresses. An engine Lumno no longer
// offers is ignored, keeping the previous one.
import { readSearchEngineState } from '../../domain/search/search-engine-state-reader';
import type { SearchEngineState } from '../../domain/search/types';
import * as SearchSiteSearchProviders from '../../domain/search/utils/site-search-providers';
import { defaultSearchEngine } from '../../domain/settings/search';
import type { SettingsStore } from '../../platform/settings-store';
import { createStore } from '../state/store';
import type { Store } from '../state/store';

// Search addresses of the engines the worker reports by id, for a stored
// choice without its own template.
const SEARCH_URL_BY_ENGINE_ID: Readonly<Record<string, (query: string) => string>> = Object.freeze({
  google: (query: string) => `https://www.google.com/search?q=${query}`,
  kagi: (query: string) => `https://kagi.com/search?q=${query}`,
  bing: (query: string) => `https://www.bing.com/search?q=${query}`,
  baidu: (query: string) => `https://www.baidu.com/s?wd=${query}`,
  duckduckgo: (query: string) => `https://duckduckgo.com/?q=${query}`,
  yahoo: (query: string) => `https://search.yahoo.com/search?p=${query}`,
  yandex: (query: string) => `https://yandex.com/search/?text=${query}`,
  sogou: (query: string) => `https://www.sogou.com/web?query=${query}`,
  shenma: (query: string) => `https://m.sm.cn/s?q=${query}`
});

type EngineSettings = Pick<SettingsStore, 'include' | 'get' | 'subscribe'>;

class DefaultSearchEngine {
  readonly store: Store<{ engine: SearchEngineState }> = createStore({ engine: {} });
  // Settles once the stored choice is read.
  ready: Promise<void> = Promise.resolve();
  private readonly settings: EngineSettings;

  constructor(settings: EngineSettings) {
    this.settings = settings;
  }

  get engine(): SearchEngineState {
    return this.store.getSnapshot().engine;
  }

  // Reads the stored choice and follows it until the returned function
  // stops it.
  follow(): () => void {
    const unsubscribe = this.settings.subscribe(defaultSearchEngine, () => this.read());
    this.ready = this.settings.include(defaultSearchEngine).then(() => this.read());
    return unsubscribe;
  }

  searchUrl(query: string): string {
    const encoded = encodeURIComponent(query || '');
    const { searchTemplate, id } = this.engine;
    if (searchTemplate) {
      return searchTemplate.replace(/\{query\}/g, encoded);
    }
    const byId = id ? SEARCH_URL_BY_ENGINE_ID[id] : undefined;
    return byId ? byId(encoded) : SEARCH_URL_BY_ENGINE_ID.google(encoded);
  }

  // An address on the engine's site, to read its icon and theme from.
  themeUrl(): string {
    const { searchTemplate, id, host } = this.engine;
    if (searchTemplate || (id && SEARCH_URL_BY_ENGINE_ID[id])) {
      return this.searchUrl('test');
    }
    return host ? `https://${host}` : 'https://www.google.com';
  }

  private read(): void {
    const stored = readSearchEngineState(this.settings.get(defaultSearchEngine));
    if (stored && stored.id && !SearchSiteSearchProviders.isRetiredSearchEngineState(stored)) {
      this.store.setState({ engine: stored });
    }
  }
}

export { DefaultSearchEngine };
