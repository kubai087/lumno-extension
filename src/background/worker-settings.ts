// The settings the service worker reads, loaded into one store
// (worker-context.ts) on every wake.
import type { Setting } from '../domain/settings/define';
import {
  documentPipEnabled,
  globalPipOwner,
  graphicsProbe,
  linkPreviewSessions,
  pinnedTabRecoveryEnabled,
  pinnedTabSnapshot,
  releasePageOpened,
  selectionQuickActionsEnabled,
  selectionQuickActionsGroupEnabled,
  selectionQuickActionsProvider,
  tabSwitchStats,
  tabSwitcherCurrentWindowOnly,
  tabSwitcherEnabled,
  tabSwitcherThumbnails
} from '../domain/settings/features';
import { language } from '../domain/settings/locale';
import { restrictedAction, restrictedActionAutoBrowserSettingDone } from '../domain/settings/overlay-panel';
import { pinnedRecentSites, progressTrackingEnabled } from '../domain/settings/recent-sites';
import {
  SHOWN_SEARCH_RESULT_SOURCE_SETTINGS,
  aggregateSearchAutoGroupEnabled,
  aggregateSearches,
  defaultSearchEngine,
  faviconEnhancedFetchEnabled,
  faviconRequestBlacklist,
  faviconVisitDirty,
  searchBlacklist,
  searchFuzzyPinyinEnabled,
  searchResultTabPosition,
  searchSelectionStats,
  siteSearchCustom,
  siteSearchDisabled
} from '../domain/settings/search';
import { webdavStatus } from '../domain/settings/sync-state';
import { themeMode } from '../domain/settings/appearance';
import {
  NEWTAB_SHORTCUT_LIST_SETTINGS,
  newtabShortcutFaviconCache,
  newtabShortcutIcons,
  newtabShortcutsLocalOverflow,
  shortcutFolderBindings
} from '../domain/settings/newtab-shortcuts';

const WORKER_SETTINGS: readonly Setting<unknown>[] = Object.freeze([
  restrictedAction,
  restrictedActionAutoBrowserSettingDone,
  documentPipEnabled,
  globalPipOwner,
  graphicsProbe,
  tabSwitcherEnabled,
  tabSwitcherCurrentWindowOnly,
  tabSwitcherThumbnails,
  tabSwitchStats,
  pinnedTabRecoveryEnabled,
  pinnedTabSnapshot,
  linkPreviewSessions,
  releasePageOpened,
  selectionQuickActionsEnabled,
  selectionQuickActionsProvider,
  selectionQuickActionsGroupEnabled,
  language,
  themeMode,
  pinnedRecentSites,
  progressTrackingEnabled,
  defaultSearchEngine,
  siteSearchCustom,
  siteSearchDisabled,
  aggregateSearches,
  aggregateSearchAutoGroupEnabled,
  searchBlacklist,
  ...SHOWN_SEARCH_RESULT_SOURCE_SETTINGS,
  searchResultTabPosition,
  searchFuzzyPinyinEnabled,
  searchSelectionStats,
  faviconRequestBlacklist,
  faviconEnhancedFetchEnabled,
  faviconVisitDirty,
  ...NEWTAB_SHORTCUT_LIST_SETTINGS,
  newtabShortcutsLocalOverflow,
  newtabShortcutIcons,
  newtabShortcutFaviconCache,
  shortcutFolderBindings,
  webdavStatus
]);

export { WORKER_SETTINGS };
