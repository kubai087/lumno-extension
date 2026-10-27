// Whether a trigger key is taken: by a site search provider (ignoring the
// one being edited) or by an aggregate search (ignoring the one being
// edited). Both lists share one set of trigger keys.
import type { AggregateSearch } from '../../../domain/search/aggregate-search-store';
import { createSiteSearchModel } from '../../options-site-search';
import type { SiteSearchProvidersState } from '../site-search/providers';

const siteSearchModel = createSiteSearchModel();

function hasSearchKeyConflict(
  providers: SiteSearchProvidersState,
  aggregateSearches: readonly AggregateSearch[],
  key: string,
  allowedKey = '',
  allowedAggregateId = ''
): boolean {
  return Boolean(siteSearchModel.findSiteSearchKeyConflict(key, allowedKey, allowedAggregateId, {
    aggregateSearches,
    providers: providers.defaults.concat(providers.custom)
  }));
}

export { hasSearchKeyConflict };
