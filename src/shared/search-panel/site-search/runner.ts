// Runs a query with a site search: an aggregate search asks the worker to
// open its sources, an interactive one has the worker type into the site,
// any other opens its search address. Both search panels run queries here;
// a surface says how it opens an address in the current tab and shows a
// notice.
import type { OpenDisposition } from '../../../domain/messages';
import { isAggregateSearchProvider } from '../../../domain/search/aggregate-search-store';
import { createAggregateSearchRequestController } from '../../../domain/search/aggregate-search-surface';
import type { SiteSearchProvider } from '../../../domain/search/types';
import { isInteractiveSiteSearchProvider, withHelpCenterLocale } from '../../../domain/search/utils/site-search-providers';
import * as LumnoMessaging from '../../../platform/messaging';

type AggregateRequestController = ReturnType<typeof createAggregateSearchRequestController>;
type AggregateRunCallbacks = Parameters<AggregateRequestController['run']>[1];

interface SiteSearchRunnerOptions {
  t(key: string, fallback: string): string;
  showToast(message: string, isError?: boolean): void;
  // The language a help center opens in.
  getHelpCenterLocale(): string;
  // New Tab navigates itself; the overlay asks the worker.
  openInCurrentTab(url: string): void;
}

class SiteSearchRunner {
  private readonly options: SiteSearchRunnerOptions;
  private aggregateRequests: AggregateRequestController | null = null;

  constructor(options: SiteSearchRunnerOptions) {
    this.options = options;
  }

  // The provider's search address for the query; '' without a template.
  readonly buildSearchUrl = (template: string | undefined, query: string, provider?: SiteSearchProvider | null): string => {
    if (!template) {
      return '';
    }
    const url = template.replace(/\{query\}/g, encodeURIComponent(query));
    return provider ? withHelpCenterLocale(url, provider, this.options.getHelpCenterLocale()) : url;
  };

  // Runs the query; false when it cannot, or when an aggregate search's
  // callbacks will say when it opened.
  readonly run = (
    provider: SiteSearchProvider | null | undefined,
    query: string,
    disposition: OpenDisposition = 'currentTab',
    aggregateCallbacks?: AggregateRunCallbacks
  ): boolean => {
    const trimmedQuery = String(query || '').trim();
    if (!provider || !trimmedQuery) {
      return false;
    }
    const aggregateId = isAggregateSearchProvider(provider) && 'aggregateId' in provider &&
      typeof provider.aggregateId === 'string'
      ? provider.aggregateId
      : '';
    if (aggregateId) {
      this.getAggregateRequests().run({ aggregateId, disposition, query: trimmedQuery }, aggregateCallbacks);
      return !aggregateCallbacks;
    }
    if (isInteractiveSiteSearchProvider(provider)) {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'runSiteSearchProviderQuery',
        provider,
        query: trimmedQuery,
        disposition
      });
      return true;
    }
    const siteUrl = this.buildSearchUrl(provider.template, trimmedQuery, provider);
    if (!siteUrl) {
      return false;
    }
    if (disposition === 'currentTab') {
      this.options.openInCurrentTab(siteUrl);
    } else {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'createTab', url: siteUrl, disposition });
    }
    return true;
  };

  private getAggregateRequests(): AggregateRequestController {
    if (!this.aggregateRequests) {
      this.aggregateRequests = createAggregateSearchRequestController({
        chromeApi: chrome,
        onFeedback: (descriptor) => {
          this.options.showToast(this.options.t(descriptor.messageKey, descriptor.fallback), descriptor.isError);
        }
      });
    }
    return this.aggregateRequests;
  }
}

export { SiteSearchRunner };
