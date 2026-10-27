// The site searches and aggregate searches an overlay session offers: the
// stored lists, loaded on demand and replaced when Settings changes them.
// This is their one owner; a newer load wins over one still running, so a
// slow read never overwrites a newer list.
import * as AGGREGATE_SEARCH_STORE from '../../../domain/search/aggregate-search-store';
import type { AggregateSearch } from '../../../domain/search/aggregate-search-store';
import { readSiteSearchProviders } from '../../../domain/search/site-search-provider-reader';
import type { SiteSearchProvider } from '../../../domain/search/types';
import * as SearchSiteSearchProviders from '../../../domain/search/utils/site-search-providers';
import { aggregateSearches, siteSearchCustom, siteSearchDisabled } from '../../../domain/settings/search';
import * as LumnoAggregateSearchStorage from '../../../platform/aggregate-search-storage';
import * as SITE_SEARCH_STORE from '../../../shared/search/site-search-store';
import type { OverlaySettings } from '../../overlay-settings';

class SiteSearchCatalog {
  // The bundled providers, for when the stored list is not read yet.
  readonly defaults: SiteSearchProvider[] = SearchSiteSearchProviders.getDefaultSiteSearchProviders();
  private readonly settings: Pick<OverlaySettings, 'store' | 'loaded' | 'get'>;
  private providerList: SiteSearchProvider[] | null;
  private providerVersion = 0;
  private providerLoad: Promise<SiteSearchProvider[]> | null = null;
  private aggregateList: AggregateSearch[] | null = null;
  private aggregateVersion = 0;
  private aggregateLoad: Promise<AggregateSearch[]> | null = null;

  // The open context may carry the providers the worker already read.
  constructor(settings: Pick<OverlaySettings, 'store' | 'loaded' | 'get'>, initialProviders: SiteSearchProvider[]) {
    this.settings = settings;
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

  loadProviders(): Promise<SiteSearchProvider[]> {
    if (this.providerLoad) {
      return this.providerLoad;
    }
    if (this.providerList) {
      return Promise.resolve(this.providerList);
    }
    return this.beginProviderLoad(() => SITE_SEARCH_STORE.loadSiteSearchProviders({
      chromeApi: chrome,
      settingsStore: this.settings.store,
      defaultProviders: this.defaults,
      mergeCustomProviders: SearchSiteSearchProviders.mergeCustomProviders
    }));
  }

  // Reads the stored providers again, dropping any load underway; resolves
  // true unless a newer reload replaced this one.
  reloadProviders(): Promise<boolean> {
    this.providerVersion += 1;
    this.providerLoad = null;
    const version = this.providerVersion;
    const settings = this.settings;
    return this.beginProviderLoad(() => settings.loaded.then(() => {
      const storedDisabledKeys: unknown = settings.get(siteSearchDisabled);
      return SITE_SEARCH_STORE.mergeStoredProviders(
        this.defaults,
        readSiteSearchProviders(settings.get(siteSearchCustom)),
        Array.isArray(storedDisabledKeys) ? storedDisabledKeys : [],
        SearchSiteSearchProviders.mergeCustomProviders
      );
    })).then(() => version === this.providerVersion);
  }

  loadAggregates(): Promise<AggregateSearch[]> {
    if (this.aggregateList) {
      return Promise.resolve(this.aggregateList);
    }
    if (this.aggregateLoad) {
      return this.aggregateLoad;
    }
    const version = this.aggregateVersion;
    const load: Promise<AggregateSearch[]> = LumnoAggregateSearchStorage.readAggregateSearches(this.settings.store)
      .then((items) => {
        if (version === this.aggregateVersion) {
          this.aggregateList = items;
          return items;
        }
        return this.aggregateList || [];
      })
      .catch((): AggregateSearch[] => {
        if (version === this.aggregateVersion) {
          this.aggregateList = null;
        }
        return this.aggregateList || [];
      })
      .finally(() => {
        if (this.aggregateLoad === load) {
          this.aggregateLoad = null;
        }
      });
    this.aggregateLoad = load;
    return load;
  }

  // The stored aggregate searches changed: they replace the list now, over
  // any read still underway.
  readStoredAggregates(): AggregateSearch[] {
    this.aggregateVersion += 1;
    this.aggregateLoad = null;
    this.aggregateList = AGGREGATE_SEARCH_STORE.normalizeAggregateSearches(this.settings.store.getStored(aggregateSearches));
    return this.aggregateList;
  }

  private beginProviderLoad(loader: () => Promise<SiteSearchProvider[]>): Promise<SiteSearchProvider[]> {
    const version = this.providerVersion;
    const isCurrent = () => version === this.providerVersion && this.providerLoad === load;
    const load: Promise<SiteSearchProvider[]> = Promise.resolve().then(loader).then((items) => {
      const list = Array.isArray(items) ? items : [];
      if (isCurrent()) {
        this.providerList = list;
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
