// Where recent sites come from: open tabs, top sites and history, read
// once at startup and then on demand, merged into the recent list; plus the
// change history dialog and the recent context menu's copy.
import type { SelectMenuOption } from '../../shared/react/select-menu/menu-options';
import type { ShowToast, Translate } from '../newtab-types';
import type {
  RecentHistoryDialogController,
  RecentHistoryDialogOptions,
  RecentHistoryItem
} from '../react/recent-history-dialog';
import type { RecentContextTarget, StartupRecentSourceReads } from './recent-types';
import { createRecentHistoryDialog } from '../react/recent-history-dialog-lazy';
import type { BrowserIconIndex } from '../../domain/favicon/types';
import type { RecentSite, RecentSiteOptions, RecentSiteSources } from '../../domain/recent-sites-store';
import * as RecentSitesMerge from '../../domain/recent-sites-merge';
import type { SettingsStore } from '../../platform/settings-store';
import { progressTrackingEnabled } from '../../domain/settings/recent-sites';
import { getBrowserInternalScheme } from '../../platform/browser-profile';

// Edge's topSites lists its own promoted sites instead of the user's, so Edge
// ranks most-visited from history visit counts alone.
const TOP_SITES_FOLLOW_HISTORY = getBrowserInternalScheme(navigator.userAgent) !== 'edge://';


interface RecentSourcesDeps {
  settings: Pick<SettingsStore, 'get' | 'subscribe'>;
  t: Translate;
  getRecentContextMenuOptions(target?: RecentContextTarget | null): SelectMenuOption[];
  restoreProgressVersion: NonNullable<RecentHistoryDialogOptions['onRestore']>;
  showToast: ShowToast;
  startupRecentSourceReadsAt: number;
  getRecentStoreOptions(): RecentSiteOptions;
  isBrowserPageRecentUrl(url: string | undefined): boolean;
  // Firefox's own cached icons, which recent cards wait for there.
  firefoxBrowserIcons: Readonly<BrowserIconIndex> | null;
  firefoxBrowserIconsReady: Promise<unknown>;
}

// What a merge reads, without the list settings each merge sets itself.
type RecentSourceReads = Pick<RecentSiteSources, 'tabs' | 'topSites' | 'historyItems'>;

function createRecentSources(deps: RecentSourcesDeps) {
  const {
    firefoxBrowserIconsReady,
    firefoxBrowserIcons,
    settings,
    t,
    restoreProgressVersion,
    showToast,
    startupRecentSourceReadsAt,
    getRecentStoreOptions,
    isBrowserPageRecentUrl
  } = deps;

  // The browser reads the first recent-sites pass shares, started below.
  let startupRecentSourceReads: StartupRecentSourceReads | null = null;
  // The change history dialog, loaded the first time it opens.
  let recentHistoryDialogController: RecentHistoryDialogController | null = null;

  // The first recent-sites pass waits for every layout preference, so the browser reads start now.
  // Preferences that arrive before it start passes of their own, which it then discards, so every
  // pass shares these reads until the first pass lands or the history changes; later passes, or
  // one long after load, read afresh.
  const STARTUP_RECENT_SOURCE_MAX_AGE_MS = 3000;
  let recentHistoryDialogLoadPromise: Promise<RecentHistoryDialogController> | null = null;

  // The change history dialog is loaded the first time someone opens it.
  function openRecentHistoryDialog(item: RecentHistoryItem): Promise<void> {
    if (!recentHistoryDialogLoadPromise) {
      recentHistoryDialogLoadPromise = createRecentHistoryDialog({
        documentObj: document,
        windowObj: window,
        t,
        onRestore: restoreProgressVersion,
        onRestoreSuccess() {
          showToast(t('recent_history_restore_success', '已恢复为所选版本'), false);
        }
      }).then((controller) => {
        if (!controller) throw new Error('Recent history dialog unavailable');
        controller.mount(document.body);
        recentHistoryDialogController = controller;
        return controller;
      }).catch((error: unknown) => {
        recentHistoryDialogLoadPromise = null;
        throw error;
      });
    }
    return recentHistoryDialogLoadPromise.then((controller) => {
      if (settings.get(progressTrackingEnabled)) controller.open({ item });
    }).catch(() => {
      showToast(t('toast_error', '操作失败，请重试。'), true);
    });
  }

  function readRecentOpenTabs(): Promise<chrome.tabs.Tab[]> {
    return new Promise((resolve) => {
      if (!chrome.tabs || !chrome.tabs.query) {
        resolve([]);
        return;
      }
      chrome.tabs.query({}, (tabs) => {
        resolve(chrome.runtime.lastError || !Array.isArray(tabs) ? [] : tabs);
      });
    });
  }

  function readRecentTopSites(): Promise<chrome.topSites.MostVisitedURL[] | null> {
    return new Promise((resolve) => {
      if (!chrome.topSites || !chrome.topSites.get || !TOP_SITES_FOLLOW_HISTORY) {
        resolve(null);
        return;
      }
      chrome.topSites.get((items) => {
        resolve(chrome.runtime.lastError || !Array.isArray(items) ? null : items);
      });
    });
  }

  function readRecentHistoryItems(): Promise<chrome.history.HistoryItem[] | null> {
    return new Promise((resolve) => {
      if (!chrome.history || !chrome.history.search) {
        resolve(null);
        return;
      }
      // Most-visited ranks sites by summed visit counts, so it needs more than the latest few URLs.
      chrome.history.search({
        text: '',
        maxResults: 500,
        startTime: Date.now() - 1000 * 60 * 60 * 24 * 90
      }, (items) => {
        resolve(chrome.runtime.lastError || !Array.isArray(items) ? null : items);
      });
    });
  }

  function releaseStartupRecentSourceReads(): void {
    startupRecentSourceReads = null;
  }

  function takeStartupRecentSourceRead<K extends keyof StartupRecentSourceReads>(
    name: K,
    read: () => StartupRecentSourceReads[K]
  ): StartupRecentSourceReads[K] {
    const pending = startupRecentSourceReads ? startupRecentSourceReads[name] : null;
    return pending && Date.now() - startupRecentSourceReadsAt <= STARTUP_RECENT_SOURCE_MAX_AGE_MS
      ? pending
      : read();
  }

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

    const readOpenTabs = () => takeStartupRecentSourceRead('tabs', readRecentOpenTabs);
    const readTopSites = () => takeStartupRecentSourceRead('topSites', readRecentTopSites);
    const readHistoryItems = () => takeStartupRecentSourceRead('historyItems', readRecentHistoryItems);

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


  // Turning progress tracking off closes the change history it shows.
  settings.subscribe(progressTrackingEnabled, () => {
    if (!settings.get(progressTrackingEnabled) && recentHistoryDialogController) {
      recentHistoryDialogController.close({ restoreFocus: false });
    }
  });

  startupRecentSourceReads = {
    historyItems: readRecentHistoryItems(),
    topSites: readRecentTopSites(),
    tabs: readRecentOpenTabs()
  };
  return {
    openRecentHistoryDialog,
    readRecentOpenTabs,
    readRecentTopSites,
    readRecentHistoryItems,
    releaseStartupRecentSourceReads,
    getRecentSites
  };
}

type RecentSources = ReturnType<typeof createRecentSources>;

export { createRecentSources };
export type { RecentSources, RecentSourcesDeps };
