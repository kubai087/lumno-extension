// The recent sites: what the section last drew, the cards and the pointer
// over them, the controller that keeps the pinned, hidden and tracked sites
// and the change history, and the browser reads the first pass shares.
import * as PROGRESS_HISTORY from '../../domain/progress-history';
import * as PROGRESS_MATCH from '../../domain/progress-match';
import * as NEWTAB_RECENT_SITES_CONTROLLER from '../recent/recent-sites-controller';
import * as NEWTAB_RECENT_SOURCES from '../recent/recent-sources';
import { normalizeHost } from '../../domain/favicon/brand-accents';
import type { RecentCardElement } from '../react/recent-sites';
import { RecentPointer } from '../recent/recent-pointer';
import { RecentSourceReads } from '../recent/recent-source-reads';
import { RecentSitesShown } from '../recent/recent-sites-shown';
import type { PageContext } from '../app/context';
import type { ShellFeature } from './shell';
import type { ShortcutStoreFeature } from './shortcut-store';
import type { NavigationFeature } from './navigation';
import type { SearchCoreFeature } from './search-core';

interface RecentCoreFeatureDeps {
  shell: ShellFeature;
  shortcutStore: ShortcutStoreFeature;
  navigation: NavigationFeature;
  searchCore: SearchCoreFeature;
}

function createRecentCoreFeature(ctx: PageContext, deps: RecentCoreFeatureDeps) {
  const { locale, settings, t } = ctx;
  const {
    bookmarkContextMenuSelectController,
    firefoxBrowserIcons,
    firefoxBrowserIconsReady,
    getSiteDisplayName,
    hideCursorTooltip,
    hideTopActionTooltip,
    isBrowserPageRecentUrl,
    recentContextMenuSelectController,
    sanitizeDisplayText,
    shortcutContextMenuSelectController,
    shouldExcludeFromRecentSites,
    showToast
  } = deps.shell;
  const { addSiteToShortcuts, hasShortcutForSite } = deps.shortcutStore;
  const { openExternalNewTabUrl } = deps.navigation;
  const { getCanonicalPageUrlForFavicon } = deps.searchCore;

  // The recent sites the section last drew.
  const recentShown = new RecentSitesShown();
  // The browser reads the first recent sites pass shares, started now.
  const recentSourceReads = new RecentSourceReads();


  const recentCards: RecentCardElement[] = [];
  const recentPointer = new RecentPointer();

  const {
    followStoredSites,
    getPinnedRecentSites,
    getHiddenRecentSites,
    closeRecentContextMenu,
    handleRecentCardContextMenu,
    getRecentStoreOptions,
    getRecentSiteUrlKey,
    writeHiddenRecentSites,
    isRecentSiteHidden,
    normalizeRecentSiteRecord,
    isRecentSitePinned,
    mergeRecentSitesWithPinned,
    togglePinnedRecentSite,
    getRecentProgressState,
    toggleRecentProgressTracking
  } = NEWTAB_RECENT_SITES_CONTROLLER.createRecentSitesController({
    otherContextMenus: [shortcutContextMenuSelectController, bookmarkContextMenuSelectController],
    recentShown,
    locale,
    recentContextMenuSelectController,
    settings,
    t,
    showToast,
    openExternalNewTabUrl,
    hasShortcutForSite,
    addSiteToShortcuts,
    hideCursorTooltip,
    hideTopActionTooltip,
    normalizeHost,
    getCanonicalPageUrlForFavicon,
    sanitizeDisplayText,
    getSiteDisplayName,
    shouldExcludeFromRecentSites,
    isBrowserPageRecentUrl,
    progressMatch: PROGRESS_MATCH,
    progressHistory: PROGRESS_HISTORY
  });

  const { getRecentSites } = NEWTAB_RECENT_SOURCES.createRecentSources({
    sourceReads: recentSourceReads,
    firefoxBrowserIconsReady,
    firefoxBrowserIcons,
    getRecentStoreOptions,
    isBrowserPageRecentUrl
  });
  const recentSitesReadyTask = followStoredSites();

  return {
    closeRecentContextMenu,
    getHiddenRecentSites,
    getPinnedRecentSites,
    getRecentProgressState,
    getRecentSiteUrlKey,
    getRecentSites,
    handleRecentCardContextMenu,
    isRecentSiteHidden,
    isRecentSitePinned,
    mergeRecentSitesWithPinned,
    normalizeRecentSiteRecord,
    recentCards,
    recentPointer,
    recentShown,
    recentSitesReadyTask,
    recentSourceReads,
    togglePinnedRecentSite,
    toggleRecentProgressTracking,
    writeHiddenRecentSites
  };
}

type RecentCoreFeature = ReturnType<typeof createRecentCoreFeature>;

export { createRecentCoreFeature };
export type { RecentCoreFeature };
