// The help pages matching the query while the help center site search is
// on, and the ways to ask when it has none. The worker answers after the
// first ask and the community links are fetched fresh once; either way the
// surface draws its rows again while that query is still the one typed.
import { createSuggestionSource } from '../../domain/search/help-center/search';
import type { HelpArticleSuggestion, HelpFeedbackSuggestion } from '../../domain/search/help-center/types';
import type { SiteSearchProvider } from '../../domain/search/types';
import { isHelpCenterSiteSearchProvider } from '../../domain/search/utils/site-search-providers';
import * as COMMUNITY_LINKS from '../../platform/community-links';
import * as LumnoMessaging from '../../platform/messaging';
import type { SurfaceLocale } from '../i18n/surface-locale';
import type { SearchQuery } from './search-query';

class HelpCenterRows {
  private readonly locale: Pick<SurfaceLocale, 't' | 'store'>;
  private readonly query: Pick<SearchQuery, 'text'>;
  private readonly redraw: (query: string) => void;
  private readonly source: ReturnType<typeof createSuggestionSource>;
  private linksRequested = false;

  // `redraw` draws the surface's rows for the query again.
  constructor(locale: Pick<SurfaceLocale, 't' | 'store'>, query: Pick<SearchQuery, 'text'>, redraw: (query: string) => void) {
    this.locale = locale;
    this.query = query;
    this.redraw = redraw;
    this.source = createSuggestionSource({
      sendMessage: (message, callback) => {
        try {
          LumnoMessaging.sendBackgroundMessage(chrome.runtime, message, (response) => {
            callback(chrome.runtime.lastError ? undefined : response);
          });
          return true;
        } catch {
          return false;
        }
      },
      onUpdate: (updatedQuery) => this.redrawIfTyped(String(updatedQuery))
    });
  }

  // The rows for the query under the site search `provider`; none unless
  // it is the help center.
  readonly getRows = (
    query: string,
    provider: SiteSearchProvider | null | undefined,
    favicon: string
  ): Array<HelpArticleSuggestion | HelpFeedbackSuggestion> => {
    if (!provider || !isHelpCenterSiteSearchProvider(provider)) {
      return [];
    }
    const locale = this.locale.store.getSnapshot().locale;
    if (!this.linksRequested) {
      this.linksRequested = true;
      void COMMUNITY_LINKS.load().then(() => this.redrawIfTyped(query));
    }
    const links = COMMUNITY_LINKS.getLinks();
    return this.source.getSuggestions(query, locale, favicon, {
      links,
      channel: COMMUNITY_LINKS.getCommunityChannel(links, locale),
      t: this.locale.t
    });
  };

  private redrawIfTyped(query: string): void {
    if (query === this.query.text) {
      this.redraw(query);
    }
  }
}

export { HelpCenterRows };
