// Whether a trigger key is taken: by a site search provider that is on
// (ignoring the one being edited) or by an aggregate search (ignoring the
// one being edited). Both lists share one set of trigger keys. A built-in
// that was turned off, or replaced by an edited copy, no longer holds its
// key, since searches skip it too.
import type { AggregateSearch } from '../../../domain/search/aggregate-search-store';
import { createSiteSearchModel } from '../../options-site-search';
import { getActiveProviders } from '../site-search/providers';
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
    providers: getActiveProviders(providers)
  }));
}

export { hasSearchKeyConflict };
