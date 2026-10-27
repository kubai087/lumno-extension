// The site searches and aggregate searches a search panel offers: the
// stored lists, loaded on demand and replaced when Settings changes them.
// This is their one owner; a newer load wins over one still running, so a
// slow read never overwrites a newer list. Its store's revision moves on
// every list change, for the panel to redraw what depends on them.
import * as AGGREGATE_SEARCH_STORE from '../../../domain/search/aggregate-search-store';
import type { AggregateSearch } from '../../../domain/search/aggregate-search-store';
import { readSiteSearchProviders } from '../../../domain/search/site-search-provider-reader';
import type { SiteSearchProvider } from '../../../domain/search/types';
import * as SearchSiteSearchProviders from '../../../domain/search/utils/site-search-providers';
import { aggregateSearches, siteSearchCustom, siteSearchDisabled } from '../../../domain/settings/search';
import * as LumnoAggregateSearchStorage from '../../../platform/aggregate-search-storage';
import type { SettingsStore } from '../../../platform/settings-store';
import * as SITE_SEARCH_STORE from '../../search/site-search-store';
import { createStore } from '../../state/store';
import type { Store } from '../../state/store';
import type { DefaultSearchEngine } from '../default-engine';

const CATALOG_SETTINGS = [siteSearchCustom, siteSearchDisabled, aggregateSearches];

function getProviderId(provider: Partial<SiteSearchProvider> | null | undefined): string {
  return SearchSiteSearchProviders.getSearchModeProviderId(provider);
}

class SiteSearchCatalog {
  // The bundled providers, for when the stored list is not read yet.
  readonly defaults: SiteSearchProvider[] = SearchSiteSearchProviders.getDefaultSiteSearchProviders();
  readonly store: Store<{ revision: number }> = createStore({ revision: 0 });
  private readonly settings: SettingsStore;
  private readonly engine: DefaultSearchEngine;
  private providerList: SiteSearchProvider[] | null;
  private providerVersion = 0;
  private providerLoad: Promise<SiteSearchProvider[]> | null = null;
  private aggregateList: AggregateSearch[] | null = null;
  private aggregateVersion = 0;
  private aggregateLoad: Promise<AggregateSearch[]> | null = null;

  // The surface may already hold the providers the worker read.
  constructor(settings: SettingsStore, engine: DefaultSearchEngine, initialProviders: SiteSearchProvider[] = []) {
    this.settings = settings;
    this.engine = engine;
    this.providerList = initialProviders.length > 0 ? initialProviders : null;
  }

  // The stored providers, or null until they are read.
  get loadedProviders(): SiteSearchProvider[] | null {
    return this.providerList;
  }

  // The stored providers, or the bundled ones until those are read.
  get providers(): SiteSearchProvider[] {
    return this.providerList && this.providerList.length > 0 ? this.providerList : this.defaults;
  }

  get aggregates(): AggregateSearch[] {
    return this.aggregateList || [];
  }

  // The providers the mode menu offers: the stored ones, with the default
  // search engine first when the list lacks it.
  get modeProviders(): SiteSearchProvider[] {
    const providers = this.providers;
    const engineProvider = SearchSiteSearchProviders.getSearchEngineSiteSearchProvider(this.engine.engine, providers);
    if (!engineProvider || providers.some((provider) => getProviderId(provider) === getProviderId(engineProvider))) {
      return providers;
    }
    return [engineProvider].concat(providers);
  }

  // The providers a typed trigger can switch to: the site searches and
  // the aggregate searches whose sources are all there.
  get triggerProviders(): SiteSearchProvider[] {
    const providers = this.providers;
    const available = this.aggregates.filter((definition) => this.isAggregateAvailable(definition, providers));
    return AGGREGATE_SEARCH_STORE.mergeTriggerProviders(providers, available);
  }

  isAggregateAvailable(definition: AggregateSearch, providers: readonly SiteSearchProvider[] = this.modeProviders): boolean {
    return AGGREGATE_SEARCH_STORE.isAggregateSearchAvailable(definition, providers);
  }

  // Loads both lists, then reloads them whenever Settings changes them,
  // until the returned function stops it.
  follow(): () => void {
    const unsubscribes = [
      this.settings.subscribe([siteSearchCustom, siteSearchDisabled], () => void this.reloadProviders()),
      this.settings.subscribe(aggregateSearches, () => this.readStoredAggregates())
    ];
    void this.settings.include(CATALOG_SETTINGS);
    void this.loadProviders();
    void this.loadAggregates();
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }

  loadProviders(): Promise<SiteSearchProvider[]> {
    if (this.providerLoad) {
      return this.providerLoad;
    }
    if (this.providerList) {
      return Promise.resolve(this.providerList);
    }
    return this.beginProviderLoad(() => SITE_SEARCH_STORE.loadSiteSearchProviders({
      chromeApi: chrome,
      settingsStore: this.settings,
      defaultProviders: this.defaults,
      mergeCustomProviders: SearchSiteSearchProviders.mergeCustomProviders
    }));
  }

  loadAggregates(): Promise<AggregateSearch[]> {
    if (this.aggregateList) {
      return Promise.resolve(this.aggregateList);
    }
    if (this.aggregateLoad) {
      return this.aggregateLoad;
    }
    const version = this.aggregateVersion;
    const load: Promise<AggregateSearch[]> = LumnoAggregateSearchStorage.readAggregateSearches(this.settings)
      .then((items) => {
        if (version === this.aggregateVersion) {
          this.setAggregates(items);
          return items;
        }
        return this.aggregates;
      })
      .catch((): AggregateSearch[] => {
        if (version === this.aggregateVersion) {
          this.aggregateList = null;
        }
        return this.aggregates;
      })
      .finally(() => {
        if (this.aggregateLoad === load) {
          this.aggregateLoad = null;
        }
      });
    this.aggregateLoad = load;
    return load;
  }

  // Reads the stored providers again, dropping any load underway.
  private reloadProviders(): Promise<SiteSearchProvider[]> {
    this.providerVersion += 1;
    this.providerLoad = null;
    const settings = this.settings;
    return this.beginProviderLoad(() => settings.include([siteSearchCustom, siteSearchDisabled]).then(() => {
      const storedDisabledKeys: unknown = settings.get(siteSearchDisabled);
      return SITE_SEARCH_STORE.mergeStoredProviders(
        this.defaults,
        readSiteSearchProviders(settings.get(siteSearchCustom)),
        Array.isArray(storedDisabledKeys) ? storedDisabledKeys : [],
        SearchSiteSearchProviders.mergeCustomProviders
      );
    }));
  }

  // The stored aggregate searches changed: they replace the list now, over
  // any read still underway.
  private readStoredAggregates(): void {
    this.aggregateVersion += 1;
    this.aggregateLoad = null;
    this.setAggregates(AGGREGATE_SEARCH_STORE.normalizeAggregateSearches(this.settings.getStored(aggregateSearches)));
  }

  private setAggregates(items: AggregateSearch[]): void {
    this.aggregateList = items;
    this.store.setState((state) => ({ revision: state.revision + 1 }));
  }

  private beginProviderLoad(loader: () => Promise<SiteSearchProvider[]>): Promise<SiteSearchProvider[]> {
    const version = this.providerVersion;
    const isCurrent = () => version === this.providerVersion && this.providerLoad === load;
    const load: Promise<SiteSearchProvider[]> = Promise.resolve().then(loader).then((items) => {
      const list = Array.isArray(items) ? items : [];
      if (isCurrent()) {
        this.providerList = list;
        this.store.setState((state) => ({ revision: state.revision + 1 }));
        return list;
      }
      return this.providerList || [];
    }).catch(() => {
      if (isCurrent()) {
        this.providerList = null;
      }
      return this.providerList || [];
    }).finally(() => {
      if (this.providerLoad === load) {
        this.providerLoad = null;
      }
    });
    this.providerLoad = load;
    return load;
  }
}

export { SiteSearchCatalog };
