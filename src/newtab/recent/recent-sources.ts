// Where recent sites come from: the open tabs, top sites and history the
// source reads hand over, merged into the recent list.
import type {
} from '../react/recent-history-dialog';
import type { BrowserIconIndex } from '../../domain/favicon/types';
import type { RecentSite, RecentSiteOptions, RecentSiteSources } from '../../domain/recent-sites-store';
import * as RecentSitesMerge from '../../domain/recent-sites-merge';
import type { RecentSourceReads as BrowserSourceReads } from './recent-source-reads';



interface RecentSourcesDeps {
  getRecentStoreOptions(): RecentSiteOptions;
  isBrowserPageRecentUrl(url: string | undefined): boolean;
  // Firefox's own cached icons, which recent cards wait for there.
  firefoxBrowserIcons: Readonly<BrowserIconIndex> | null;
  firefoxBrowserIconsReady: Promise<unknown>;
  sourceReads: Pick<BrowserSourceReads, 'historyItems' | 'tabs' | 'topSites'>;
}

// What a merge reads, without the list settings each merge sets itself.
type RecentSourceReads = Pick<RecentSiteSources, 'tabs' | 'topSites' | 'historyItems'>;

function createRecentSources(deps: RecentSourcesDeps) {
  const {
    firefoxBrowserIconsReady,
    firefoxBrowserIcons,
    getRecentStoreOptions,
    isBrowserPageRecentUrl,
    sourceReads
  } = deps;



  function getRecentSites(limit: number, mode: string): Promise<RecentSite[]> {
    const safeLimit = Math.max(0, Number(limit) || 0);
    if (safeLimit > 0 && firefoxBrowserIcons) {
      // Render recent cards once Firefox's own icons are indexed.
      return firefoxBrowserIconsReady.then(() => getRecentSitesNow(safeLimit, mode));
    }
    return getRecentSitesNow(limit, mode);
  }

  function getRecentSitesNow(limit: number, mode: string): Promise<RecentSite[]> {
    const safeLimit = Math.max(0, Number(limit) || 0);
    const viewMode = mode === 'most' ? 'most' : 'latest';
    if (safeLimit <= 0) {
      return Promise.resolve([]);
    }

    const mergeSources = (sources: RecentSourceReads, mergeMode: string): RecentSite[] => RecentSitesMerge.mergeRecentSiteSources({
      ...getRecentStoreOptions(),
      ...(sources || {}),
      mode: mergeMode || viewMode,
      limit: safeLimit,
      candidateLimit: safeLimit,
      pinned: [],
      hidden: []
    });

    const readOpenTabs = () => sourceReads.tabs();
    const readTopSites = () => sourceReads.topSites();
    const readHistoryItems = () => sourceReads.historyItems();

    const mergeWithTabsIfNeeded = (sources: RecentSourceReads, mergeMode: string): Promise<RecentSite[]> => {
      const withoutTabs = mergeSources(sources, mergeMode);
      return readOpenTabs().then((tabs) => {
        const shouldMergeTabs = withoutTabs.length < safeLimit ||
          tabs.some((tab) => isBrowserPageRecentUrl(tab.url));
        if (!shouldMergeTabs) {
          return withoutTabs;
        }
        return mergeSources({
          ...(sources || {}),
          tabs
        }, mergeMode);
      });
    };

    const loadLatestRecentSites = (): Promise<RecentSite[]> => readHistoryItems().then((historyItems) => {
      if (!historyItems) {
        return [];
      }
      const historyOnly = mergeSources({ historyItems }, 'latest');
      if (historyOnly.length >= safeLimit) {
        return mergeWithTabsIfNeeded({ historyItems }, 'latest');
      }
      return readTopSites().then((topSites) => mergeWithTabsIfNeeded({
        historyItems,
        topSites: topSites || []
      }, 'latest'));
    });

    if (viewMode === 'most') {
      return readTopSites().then((topSites) => {
        const topSiteItems = topSites || [];
        const topOnly = mergeSources({ topSites: topSiteItems }, 'most');
        if (topOnly.length >= safeLimit) {
          return mergeWithTabsIfNeeded({ topSites: topSiteItems }, 'most');
        }
        // Fill a short topSites list from history ranked by visit counts.
        return readHistoryItems().then((historyItems) => mergeWithTabsIfNeeded({
          topSites: topSiteItems,
          historyItems: historyItems || []
        }, 'most'));
      });
    }

    return loadLatestRecentSites();
  }



  return {
    getRecentSites
  };
}

type RecentSources = ReturnType<typeof createRecentSources>;

export { createRecentSources };
export type { RecentSources, RecentSourcesDeps };
