// The shortcuts and what keeps them: their list and stored data, their icon
// snapshots and the icons of websites in shortcut folders, the folder
// bindings, the shortcut dialog, and the tiles' slide and scrolling.
import * as FOLDER_BINDINGS from '../../platform/bookmark-folder-bindings';
import * as LumnoShortcutFaviconStore from '../../platform/shortcut-favicon-store';
import * as LumnoNewtabFolderItemIcons from '../bookmarks/folder-item-icons';
import * as NEWTAB_SHORTCUT_ICON_STORE from '../shortcuts/shortcut-icon-store';
import { normalizeHost } from '../../domain/favicon/brand-accents';
import type { ShortcutTileElement } from '../react/shortcuts';
import { shortcutFolderBindings } from '../../domain/settings/newtab-shortcuts';
import { createSettingsStore } from '../../platform/settings-store';
import { ShortcutList } from '../shortcuts/shortcut-list';
import { createShortcutFavicons } from '../shortcuts/shortcut-favicons';
import { createShortcutData } from '../shortcuts/shortcut-data';
import { createShortcutDialogActions } from '../shortcuts/shortcut-dialog-actions';
import { ShortcutLayoutAnimation } from '../shortcuts/shortcut-layout-animation';
import { ShortcutAreaScroll } from '../shortcuts/shortcut-area-scroll';
import type { PageContext } from '../app/context';
import type { ShellFeature } from './shell';
import type { BookmarkStoreFeature } from './bookmark-store';

interface ShortcutStoreFeatureDeps {
  shell: ShellFeature;
  bookmarkStore: BookmarkStoreFeature;
}

function createShortcutStoreFeature(ctx: PageContext, deps: ShortcutStoreFeatureDeps) {
  const { formatMessage, localStorageArea, locale, providerStorageRuntime, settings, storageArea, t } = ctx;
  const shortcutGrid = ctx.structure.shortcut.grid;
  const {
    bindShortcutDialogTooltip,
    dragSessions,
    faviconCacheRuntime,
    getPageFaviconUrlResolver,
    getPersistedFaviconDataEntry,
    hideShortcutDialogTooltip,
    hideShortcutTooltip,
    historyLock,
    sanitizeDisplayText,
    showToast
  } = deps.shell;
  const { bookmarkMoveHistory, bookmarkParts, bookmarksRuntime } = deps.bookmarkStore;

  // The slide the shortcut tiles make when the grid changes.
  const shortcutLayoutAnimation = new ShortcutLayoutAnimation(shortcutGrid);
  // The shortcut section's scrolling while a drag holds the pointer by its edge.
  const shortcutAreaScroll = new ShortcutAreaScroll(shortcutGrid);
  // The shortcuts the page shows and their icons.
  const shortcutList = new ShortcutList();
  const shortcutIconStore = NEWTAB_SHORTCUT_ICON_STORE.createShortcutIconStore({
    documentObj: document,
    windowObj: window,
    storageArea: localStorageArea
  });
  const folderItemIconStore = LumnoNewtabFolderItemIcons.createStore({
    storageArea: localStorageArea
  });
  const shortcutFaviconStore = LumnoShortcutFaviconStore.createShortcutFaviconStore({
    chromeApi: typeof chrome !== 'undefined' ? chrome : null,
    storageArea: localStorageArea,
    lockManager: window.navigator && window.navigator.locks
  });

  // Shortcut icon snapshots and the icons of websites in shortcut folders.
  const shortcutFavicons = createShortcutFavicons({
    settings,
    shortcutList,
    bookmarksRuntime,
    folderItemIconStore,
    shortcutFaviconStore,
    faviconCacheRuntime,
    getPersistedFaviconDataEntry,
    getPageFaviconUrlResolver
  });
  const {
    getFolderItemIconUrl,
    getFolderItemIcon,
    getFolderItemIconForShortcut,
    updateFolderItemIcons,
    getShortcutFaviconDataUrl,
    getShortcutFaviconCandidateUrl
  } = shortcutFavicons;

  const shortcutFolderRuntime = FOLDER_BINDINGS.createRuntime({
    settingsStore: createSettingsStore({ chromeApi: chrome, settings: [shortcutFolderBindings] })
  });
  shortcutFolderRuntime.ready.catch((error) => {
    console.warn('[Lumno] Could not load shortcut folder bindings.', error);
  });
  // The shortcuts and their groups, loaded, saved and kept in step with other pages.
  const shortcutData = createShortcutData({
    settings,
    storageArea,
    providerStorageRuntime,
    shortcutList,
    shortcutIconStore,
    shortcutFavicons,
    shortcutFolderRuntime,
    bookmarksRuntime,
    bookmarkMoveHistory,
    historyLock,
    dragSessions,
    normalizeHost,
    sanitizeDisplayText,
    t,
    formatMessage,
    showToast
  });
  const {
    getShortcutFolderId,
    getVisibleShortcuts,
    getShortcutTitle,
    getShortcutIconDataUrl,
    getShortcutStoreOptions,
    refreshShortcutFolderReferences,
    followStoredShortcutData,
    loadVisibleShortcuts,
    persistShortcuts,
    isWebDavBackingUpShortcuts,
    getShortcutGroups,
    moveShortcutGroup,
    moveShortcutGroupToIndex,
    deleteShortcutGroup,
    applyShortcutGroupDeleteRecord,
    hasShortcutForSite,
    addSiteToShortcuts,
    removeShortcutById,
    getShortcutById
  } = shortcutData;
  followStoredShortcutData();

  // The shortcut dialog, which adds and edits shortcuts and names groups.
  const {
    openShortcutDialog,
    closeShortcutDialog,
    openShortcutAddDialog,
    openShortcutGroupDialog,
    confirmDeleteShortcutGroupWithSites
  } = createShortcutDialogActions({
    settings,
    locale,
    t,
    formatMessage,
    showToast,
    hideShortcutTooltip,
    bindShortcutDialogTooltip,
    hideShortcutDialogTooltip,
    shortcutList,
    shortcutIconStore,
    shortcutData,
    shortcutFavicons,
    bookmarksRuntime,
    bookmarkParts
  });

  const shortcutTiles: ShortcutTileElement[] = [];

  const shortcutGroupHeaders: HTMLElement[] = [];

  return {
    addSiteToShortcuts,
    applyShortcutGroupDeleteRecord,
    closeShortcutDialog,
    confirmDeleteShortcutGroupWithSites,
    deleteShortcutGroup,
    getFolderItemIcon,
    getFolderItemIconForShortcut,
    getFolderItemIconUrl,
    getShortcutById,
    getShortcutFaviconCandidateUrl,
    getShortcutFaviconDataUrl,
    getShortcutFolderId,
    getShortcutGroups,
    getShortcutIconDataUrl,
    getShortcutStoreOptions,
    getShortcutTitle,
    getVisibleShortcuts,
    hasShortcutForSite,
    isWebDavBackingUpShortcuts,
    loadVisibleShortcuts,
    moveShortcutGroup,
    moveShortcutGroupToIndex,
    openShortcutAddDialog,
    openShortcutDialog,
    openShortcutGroupDialog,
    persistShortcuts,
    refreshShortcutFolderReferences,
    removeShortcutById,
    shortcutAreaScroll,
    shortcutData,
    shortcutFavicons,
    shortcutFolderRuntime,
    shortcutGroupHeaders,
    shortcutLayoutAnimation,
    shortcutList,
    shortcutTiles,
    updateFolderItemIcons
  };
}

type ShortcutStoreFeature = ReturnType<typeof createShortcutStoreFeature>;

export { createShortcutStoreFeature };
export type { ShortcutStoreFeature };
