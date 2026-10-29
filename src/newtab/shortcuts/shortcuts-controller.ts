// Shortcut storage, favicons, loading, persistence, rendering and the add/edit
// dialog.
import * as ShortcutIconCache from '../../domain/favicon/shortcut-favicon/persisted';
import { shortcutIconEvents } from './shortcut-icon-events';
import * as BundledIcons from '../../domain/favicon/shortcut-favicon/bundled-icons';
import type { FaviconDataEntry } from '../../domain/favicon/favicon-cache';
import type { StorageAreaLike, StorageItems } from '../../domain/storage-port';
import type { FolderBindingRuntime } from '../../platform/bookmark-folder-bindings';
import type { FaviconCacheRuntime } from '../../platform/favicon-cache';
import type { ShortcutFaviconStore } from '../../platform/shortcut-favicon-store';
import * as LumnoShortcutStorage from '../../platform/shortcut-storage';
import { isRecord, isThenable } from '../../platform/storage-call';
import type { BookmarkMoveHistory, ShortcutGroupDeleteRecord } from '../bookmarks/bookmark-move-history';
import type { BookmarksRuntime } from '../bookmarks/bookmarks-runtime';
import type {
  FolderItemIcon,
  FolderItemIconMap,
  FolderItemIconStore,
  FolderItemShortcutSettings
} from '../bookmarks/folder-item-icons';
import type { BindTooltip, FormatMessage, SendRuntimeMessage, ShowToast, Translate } from '../newtab-types';
import type { PageStructureRuntime } from '../react/page-structure';
import type {
  OnlineShortcutIcon,
  ShortcutDialogController,
  ShortcutDialogPayload
} from '../react/shortcut-dialog';
import type { ShortcutContextMenuMark, ShortcutsViewController, ShortcutsViewOptions } from '../react/shortcuts';
import type { ShortcutContextMenu } from './shortcut-context-menu';
import type { ShortcutDock } from './shortcut-dock';
import type { ShortcutIconMap, ShortcutIconStore } from './shortcut-icon-store';
import type { ShortcutPageActions } from './shortcut-page-actions';
import type { PersistShortcuts, PersistShortcutsOptions, ShortcutIconChange, ShortcutSite } from './shortcut-types';
import * as FaviconCanonical from '../../domain/favicon/canonical';
import type { FaviconUrlResolver } from '../../domain/favicon/resolver';
import type { CachedIconMap, CachedIconSource } from '../../domain/favicon/shortcut-favicon/types';
import * as SearchSiteSearchProviders from '../../domain/search/utils/site-search-providers';
import { getShortcutUrl, isShortcutFolder } from '../../domain/shortcuts/normalize';
import type { ShortcutGroup, ShortcutIconSource, ShortcutItem, ShortcutLink, ShortcutNormalizeOptions, ShortcutState, VisibleShortcutItem } from '../../domain/shortcuts/types';
import * as ShortcutConstants from '../../domain/shortcuts/constants';
import * as ShortcutNormalize from '../../domain/shortcuts/normalize';
import * as ShortcutStoragePlan from '../../domain/shortcuts/storage-plan';
import type { ProviderStorageRuntime } from '../../platform/settings-storage';
import { NEWTAB_SHORTCUT_GRID_SETTINGS, NEWTAB_SHORTCUT_LIST_SETTINGS, newtabShortcutAddVisible, newtabShortcutColumns, newtabShortcutFaviconCache, newtabShortcutIcons, newtabShortcutWidth, newtabShortcutsLocalOverflow, shortcutFolderBindings } from '../../domain/settings/newtab-shortcuts';
import type { SettingsStore } from '../../platform/settings-store';
import * as NEWTAB_SHORTCUT_ICON_STORE from './shortcut-icon-store';
import * as NEWTAB_SHORTCUT_ICON_PLATE from './shortcut-icon-plate';
import * as NEWTAB_BOOKMARK_MOVE_HISTORY from '../bookmarks/bookmark-move-history';
import { SHORTCUT_DIALOG_ITEM_BOOKMARK, SHORTCUT_DIALOG_ITEM_FOLDER } from '../menu-values';
import { DEFAULT_MAX_SHORTCUTS, DEFAULT_SHORTCUTS_SYNC_RESERVE_BYTES } from '../../domain/shortcuts/constants';
import { webdavStatus } from '../../domain/settings/sync-state';
import { createShortcutsView } from '../react/shortcuts';
import { createShortcutDialog } from '../react/shortcut-dialog-lazy';
import type { ShortcutList } from './shortcut-list';
import { faviconEnhancedFetchEnabled, faviconRequestBlacklist } from '../../domain/settings/search';
import type { BookmarkSectionParts } from '../bookmarks/bookmark-section-parts';
import type { MoveHistoryLock } from '../bookmarks/move-history-lock';
import { adaptiveToneEvents } from '../wallpaper/tone-requests';
import type { DragSessions } from '../drag-sessions';
import * as NAVIGATION_DISPOSITION from '../../domain/navigation-disposition';
import type { PageNavigation } from '../page-navigation';
import type { BookmarkNode } from '../bookmarks/bookmarks-store';
import type { OpenEvent } from '../../domain/navigation-disposition';
import { playFolderPathMorph } from '../bookmarks/bookmark-folder-icon';
import { bookmarkSectionEvents } from '../bookmarks/bookmark-section-events';


// An option the shortcuts view is handed as it is.
type ViewOption<K extends keyof ShortcutsViewOptions> = NonNullable<ShortcutsViewOptions[K]>;

interface ShortcutsControllerDeps {
  settings: Pick<SettingsStore, 'get' | 'getStored' | 'include' | 'set' | 'subscribe'>;
  shortcutFolderRuntime: Pick<FolderBindingRuntime, 'ready' | 'flush' | 'getNode' | 'reconcile' | 'visibleItems'>;
  bookmarksRuntime: Pick<BookmarksRuntime,
    'getNode' | 'getNodeMap' | 'getSnapshot' | 'ensureReady' | 'runControlledMutation' | 'update'>;
  moveShortcutByKeyboard: ViewOption<'moveShortcut'>;
  normalizeHost: NonNullable<ShortcutNormalizeOptions['normalizeHost']>;
  sanitizeDisplayText(text: unknown): string;
  providerStorageRuntime: Pick<ProviderStorageRuntime, 'getActiveAreaName'> | null;
  shortcutIconStore: ShortcutIconStore;
  folderItemIconStore: Pick<FolderItemIconStore, 'get' | 'update'>;
  getPageFaviconUrlResolver(): Pick<FaviconUrlResolver,
    'getShortcutFaviconCandidateUrl' | 'getShortcutFaviconFetchCandidates'> | null;
  getExtensionResourceUrl(resourcePath: string): string;
  sendRuntimeMessage: SendRuntimeMessage;
  shortcutFaviconStore: Pick<ShortcutFaviconStore, 'readAll' | 'mergeAll' | 'retainAll'>;
  faviconCacheRuntime: Pick<FaviconCacheRuntime, 'ensureCachesReady'>;
  getPersistedFaviconDataEntry(cacheKey: string): FaviconDataEntry | null;
  t: Translate;
  hideShortcutTooltip(): void;
  closeShortcutContextMenu(): void;
  syncOpenBookmarkCascadeAnchorVisual(): void;
  applyNewtabShortcutsVisibility(): void;
  updateShortcutLanguageStrings(): void;
  updateBookmarkSectionPosition(options?: { preserveSearchEntryLayout?: boolean }): void;
  storageArea: StorageAreaLike | null;
  pickShortcutIconPlateColor: ShortcutPageActions['pickShortcutIconPlateColor'];
  applyNewtabShortcutLayoutPreferences(): void;
  applyNewtabShortcutDockMagnification(): void;
  // The column count an older version's width setting stands for.
  inferNewtabShortcutColumnsFromWidth(value: unknown): number;
  loadFolderColors(): Promise<void>;
  showToast: ShowToast;
  formatMessage: FormatMessage;
  getShortcutById(shortcutId: unknown): ShortcutItem | null;
  markBookmarkTreeDirty(options?: { preserveCascadeOpen?: boolean }): void;
  loadBookmarks(options?: { force?: boolean }): unknown;
  refreshOpenBookmarkCascadeMenu(): unknown;
  bookmarkMoveHistory: Pick<BookmarkMoveHistory, 'push'>;
  getBookmarkUndoShortcutLabel(): string;
  resetShortcutDockHover: ShortcutDock['resetShortcutDockHover'];
  pageStructureRuntime: { shortcut: Pick<PageStructureRuntime['shortcut'], 'section' | 'grid'> };
  shortcutTiles: ViewOption<'tiles'>;
  shortcutGroupHeaders: ViewOption<'groupHeaders'>;
  initFolderPathMorph: ViewOption<'initFolderIcon'>;
  getHostFromUrl: ViewOption<'getHostFromUrl'>;
  getImmediateThemeForSuggestion: ViewOption<'getImmediateThemeForSuggestion'>;
  applyShortcutTileTheme: ViewOption<'applyShortcutTileTheme'>;
  queueThemeForTarget: ViewOption<'queueThemeForTarget'>;
  getTileThemeOnSiteChange: ViewOption<'getTileThemeOnSiteChange'>;
  attachFaviconWithFallbacks: ViewOption<'attachFaviconWithFallbacks'>;
  bindShortcutTooltip: BindTooltip;
  isMiddleClick: ViewOption<'isMiddleClick'>;
  isCardActivationSuppressed(): boolean;
  handleShortcutContextMenu: ShortcutContextMenu['handleShortcutContextMenu'];
  handleShortcutNativeDragStart: ShortcutPageActions['handleShortcutNativeDragStart'];
  openShortcutDialog: ShortcutPageActions['openShortcutDialog'];
  openShortcutAddContextMenu: ShortcutContextMenu['openShortcutAddContextMenu'];
  handleShortcutDragPointerDown(event: PointerEvent): void;
  handleShortcutDockPointerOver: ShortcutDock['handleShortcutDockPointerOver'];
  handleShortcutDockPointerMove: ShortcutDock['handleShortcutDockPointerMove'];
  syncShortcutDockFolderMenu: ShortcutDock['syncShortcutDockFolderMenu'];
  bindShortcutDialogTooltip: BindTooltip;
  hideShortcutDialogTooltip(): void;
  handleShortcutGroupMenu: ShortcutContextMenu['openShortcutGroupMenu'];
  // Slides the tiles to where `apply` puts them.
  animateShortcutLayoutChange?(apply: () => void): void;
  shortcutList: Pick<ShortcutList, 'icons' | 'items' | 'replaceIcons' | 'replaceItems'>;
  bookmarkParts: Pick<BookmarkSectionParts, 'cascade'>;
  historyLock: Pick<MoveHistoryLock, 'busy' | 'hold' | 'release'>;
  setShortcutError(message: string): void;
  setShortcutIconError(message: string): void;
  dragSessions: Pick<DragSessions, 'shortcutDragging'>;
  getShortcutTileById(id: string): HTMLElement | null;
  openBookmarkCascadeMenu(folder: BookmarkNode & { type: 'folder' }, anchor: HTMLElement | null): void;
  openUrlFromNewtabCard: PageNavigation['openUrlFromNewtabCard'];
}

// The icon choice a dialog submitted.
interface DialogIconState {
  action?: ShortcutDialogPayload['iconAction'];
  dataUrl?: string;
  source?: ShortcutDialogPayload['iconSource'];
  plate?: ShortcutDialogPayload['iconPlate'];
  plateColor?: string;
}

// The icon a website in a shortcut folder was given in the dialog.
interface FolderItemIconChoice {
  source: NonNullable<ShortcutDialogPayload['iconSource']>;
  action?: ShortcutDialogPayload['iconAction'];
  dataUrl?: string;
  onlineIcon?: OnlineShortcutIcon;
}

// What the dialog submitted for a shortcut.
interface ShortcutDialogSubmission {
  mode: ShortcutDialogPayload['mode'];
  shortcutId: string;
  iconAction: ShortcutDialogPayload['iconAction'];
  iconDataUrl: string;
  iconSource?: ShortcutDialogPayload['iconSource'];
  iconPlate?: ShortcutDialogPayload['iconPlate'];
  iconPlateColor?: string;
}

// What the dialog submitted for a bookmark or folder inside a shortcut folder.
interface BookmarkDialogSubmission {
  itemType: ShortcutDialogPayload['itemType'];
  itemId: string;
  shortcutId: string;
  iconSource?: ShortcutDialogPayload['iconSource'];
  iconAction: ShortcutDialogPayload['iconAction'];
  iconDataUrl: string;
  onlineIcon?: OnlineShortcutIcon;
}

// How a group's deletion changes the groups and the shortcuts.
interface ShortcutGroupDeletePlan {
  index: number;
  groups: ShortcutGroup[];
  // The group its sites move to; '' when they are deleted with it.
  targetGroupId: string;
  members: ShortcutItem[];
  items: ShortcutItem[];
}

// The sync bytes a save may use, and whether the legacy flat list is still
// in browser sync.
interface ShortcutSyncBudget {
  maxTotalBytes: number;
  legacyKeysPresent: boolean;
}

// What a save stored, and the entries only this device keeps because
// browser sync is full.
interface SavedShortcutState {
  state: ShortcutState;
  localOnlyIds: readonly string[];
  syncLimited: boolean;
}

// An area that reports its byte usage through the callback, or through the
// promise it returns.
interface ByteUsageArea {
  getBytesInUse?(keys: string | string[] | null, callback: (bytesInUse: number) => void): unknown;
}

interface FaviconRequestTask {
  run(): Promise<string>;
  resolve(dataUrl: string): void;
}

function isCachedIconSource(value: unknown): value is CachedIconSource {
  return value === 'service' || value === 'favicon-is' || value === 'cache';
}

function isIconChangeList(
  value: ShortcutIconChange | readonly ShortcutIconChange[]
): value is readonly ShortcutIconChange[] {
  return Array.isArray(value);
}

function createShortcutsController(deps: ShortcutsControllerDeps) {
  const {
    historyLock,
    bookmarkParts,
    shortcutList,
    settings,
    shortcutFolderRuntime,
    bookmarksRuntime,
    moveShortcutByKeyboard,
    normalizeHost,
    sanitizeDisplayText,
    providerStorageRuntime,
    shortcutIconStore,
    folderItemIconStore,
    getPageFaviconUrlResolver,
    getExtensionResourceUrl,
    sendRuntimeMessage,
    shortcutFaviconStore,
    faviconCacheRuntime,
    getPersistedFaviconDataEntry,
    t,
    hideShortcutTooltip,
    closeShortcutContextMenu,
    syncOpenBookmarkCascadeAnchorVisual,
    applyNewtabShortcutsVisibility,
    updateShortcutLanguageStrings,
    updateBookmarkSectionPosition,
    storageArea,
    pickShortcutIconPlateColor,
    applyNewtabShortcutLayoutPreferences,
    applyNewtabShortcutDockMagnification,
    inferNewtabShortcutColumnsFromWidth,
    loadFolderColors,
    showToast,
    formatMessage,
    getShortcutById,
    markBookmarkTreeDirty,
    loadBookmarks,
    refreshOpenBookmarkCascadeMenu,
    bookmarkMoveHistory,
    getBookmarkUndoShortcutLabel,
    resetShortcutDockHover,
    pageStructureRuntime,
    shortcutTiles,
    shortcutGroupHeaders,
    initFolderPathMorph,
    getHostFromUrl,
    getImmediateThemeForSuggestion,
    applyShortcutTileTheme,
    queueThemeForTarget,
    getTileThemeOnSiteChange,
    attachFaviconWithFallbacks,
    bindShortcutTooltip,
    isMiddleClick,
    isCardActivationSuppressed,
    handleShortcutContextMenu,
    handleShortcutNativeDragStart,
    openShortcutDialog,
    openShortcutAddContextMenu,
    handleShortcutDragPointerDown,
    handleShortcutDockPointerOver,
    handleShortcutDockPointerMove,
    syncShortcutDockFolderMenu,
    bindShortcutDialogTooltip,
    hideShortcutDialogTooltip,
    handleShortcutGroupMenu,
    animateShortcutLayoutChange,
    setShortcutError,
    setShortcutIconError,
    dragSessions,
    getShortcutTileById,
    openBookmarkCascadeMenu,
    openUrlFromNewtabCard
  } = deps;

  // Bumped when the favicon policy changes, so requests made before it are
  // dropped.
  let shortcutFaviconPolicyRevision = 0;
  // Saved favicon snapshots by page URL, and the ones not yet written.
  let newtabShortcutFavicons: CachedIconMap = {};
  let shortcutFaviconPendingCacheEntries: CachedIconMap = {};
  // Shortcut saves still writing, which a storage change waits for.
  let shortcutPersistenceInFlightCount = 0;

  let shortcutsView: ShortcutsViewController | null = null;
  let shortcutStorageReloadTimer: number | null = null;
  // Groups and the migration time of the stored shortcut state; items live
  // in shortcutList.items.
  let shortcutGroups = ShortcutNormalize.getDefaultShortcutState().groups;
  let shortcutMigratedAt = 0;
  let shortcutStateTorn = false;
  // The group a site added from the dialog joins, and the group the
  // dialog renames ('' while it creates one).
  let shortcutAddTargetGroupId = '';
  let shortcutGroupDialogTargetId = '';
  let shortcutTornReloadCount = 0;
  const SHORTCUT_TORN_RELOAD_LIMIT = 3;
  const SHORTCUT_TORN_RELOAD_DELAY_MS = 1500;
  const shortcutFaviconPending = new Map<string, Promise<string>>();
  const shortcutFaviconRequestQueue: FaviconRequestTask[] = [];
  const SHORTCUT_FAVICON_MAX_CONCURRENT_REQUESTS = 3;
  let shortcutFaviconActiveRequestCount = 0;
  let shortcutFaviconCacheWriteTimer: number | null = null;

  function getShortcutFolderId(shortcut: ShortcutItem | VisibleShortcutItem | null | undefined): string {
    if (!shortcut || !isShortcutFolder(shortcut)) return '';
    if (!shortcut.folderRef) return String(shortcut.folderId || '');
    const node = shortcutFolderRuntime.getNode(shortcut, bookmarksRuntime.getNodeMap());
    return node ? String(node.id) : '';
  }

  // Folder shortcut id -> the bookmark folder its tile last showed.
  let lastVisibleFolderIds = new Map<string, string>();

  // A bookmark change empties the bookmark map until it reloads. A render in
  // that moment (the one that shows a site moved in or out of a folder)
  // keeps each folder tile on the folder it last showed, rather than
  // dropping the tile for a render and drawing it again.
  function getVisibleShortcuts(): VisibleShortcutItem[] {
    const snapshot = bookmarksRuntime.getSnapshot();
    if (!snapshot.ready && lastVisibleFolderIds.size) {
      return shortcutList.items.flatMap((item): VisibleShortcutItem[] => {
        if (!isShortcutFolder(item)) return [item];
        const folderId = lastVisibleFolderIds.get(item.id);
        return folderId ? [{ ...item, folderId }] : [];
      });
    }
    const visible = shortcutFolderRuntime.visibleItems(shortcutList.items, snapshot.nodeMap);
    if (snapshot.ready) {
      lastVisibleFolderIds = new Map(visible
        .filter(isShortcutFolder)
        .map((item): [string, string] => [item.id, item.folderId]));
    }
    return visible;
  }

  function refreshShortcutFolderReferences(): Promise<boolean> {
    if (historyLock.busy) return Promise.resolve(false);
    const original = shortcutList.items;
    return Promise.all([shortcutFolderRuntime.ready, bookmarksRuntime.ensureReady(false)]).then(([, ready]) => {
      if (!ready || historyLock.busy || dragSessions.shortcutDragging || shortcutList.items !== original) return false;
      const next = shortcutFolderRuntime.reconcile(original, bookmarksRuntime.getNodeMap());
      return shortcutFolderRuntime.flush().then(() => {
        if (shortcutList.items !== original || historyLock.busy || dragSessions.shortcutDragging) return false;
        if (JSON.stringify(next) !== JSON.stringify(original)) return persistShortcuts(next);
        renderShortcuts();
        return true;
      });
    }).catch((error) => {
      console.warn('[Lumno] Could not update shortcut folder references.', error);
      return false;
    });
  }

  function getShortcutStoreOptions(): ShortcutNormalizeOptions {
    return {
      maxShortcuts: DEFAULT_MAX_SHORTCUTS,
      normalizeHost,
      sanitizeDisplayText
    };
  }

  function isShortcutSyncStorageActive(): boolean {
    return Boolean(
      Boolean(providerStorageRuntime && providerStorageRuntime.getActiveAreaName() === 'sync') &&
      chrome && chrome.storage && chrome.storage.sync
    );
  }

  function getShortcutOverflowStorageArea(): chrome.storage.LocalStorageArea | null {
    return isShortcutSyncStorageActive() && chrome.storage.local
      ? chrome.storage.local
      : null;
  }

  function getShortcutStorageLastError(): chrome.runtime.LastError | null {
    return chrome && chrome.runtime && chrome.runtime.lastError
      ? chrome.runtime.lastError
      : null;
  }

  function getStorageBytesInUse(area: ByteUsageArea | null | undefined, keys: string | string[] | null): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!area || typeof area.getBytesInUse !== 'function') {
        reject(new Error('Storage byte usage is unavailable'));
        return;
      }
      try {
        const maybePromise = area.getBytesInUse(keys, (bytesInUse) => {
          const runtimeError = getShortcutStorageLastError();
          if (runtimeError) {
            reject(new Error(runtimeError.message || 'Could not read sync byte usage'));
            return;
          }
          resolve(Math.max(0, Number(bytesInUse) || 0));
        });
        if (isThenable(maybePromise)) {
          maybePromise.then((bytesInUse) => {
            resolve(Math.max(0, Number(bytesInUse) || 0));
          }, reject);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  // Sync bytes the next save may use, and whether the legacy flat list is
  // still in browser sync. Unknown usage leaves no sync budget, so the save
  // keeps everything in the local overflow record instead of risking the
  // space other settings need.
  function getShortcutSyncBudget(): Promise<ShortcutSyncBudget> {
    if (!isShortcutSyncStorageActive()) {
      return Promise.resolve({ maxTotalBytes: Number.MAX_SAFE_INTEGER, legacyKeysPresent: false });
    }
    const syncArea = chrome.storage.sync;
    return Promise.all([
      getStorageBytesInUse(syncArea, null),
      getStorageBytesInUse(syncArea, ShortcutConstants.SHORTCUTS_SYNC_KEYS.slice()),
      getStorageBytesInUse(syncArea, ShortcutConstants.LEGACY_SHORTCUTS_CHUNK_KEYS.slice())
    ]).then(([totalBytes, shortcutBytes, legacyBytes]) => ({
      maxTotalBytes: ShortcutStoragePlan.getShortcutSyncBudget({
        quotaBytes: Number(syncArea.QUOTA_BYTES) || (100 * 1024),
        reserveBytes: DEFAULT_SHORTCUTS_SYNC_RESERVE_BYTES,
        totalBytes,
        shortcutBytes,
        legacyBytes
      }),
      legacyKeysPresent: legacyBytes > 0
    })).catch(() => ({ maxTotalBytes: 0, legacyKeysPresent: false }));
  }

  function readShortcutOverflowRecord(): Promise<unknown> {
    const overflowArea = getShortcutOverflowStorageArea();
    if (!overflowArea || typeof overflowArea.get !== 'function') {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      try {
        overflowArea.get([newtabShortcutsLocalOverflow.key], (result: StorageItems | undefined) => {
          if (getShortcutStorageLastError()) {
            resolve(null);
            return;
          }
          resolve(result ? result[newtabShortcutsLocalOverflow.key] : null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  // The stored list, read in one go so a torn save shows as one.
  function readShortcutSyncValues(): Promise<StorageItems> {
    return settings.include(NEWTAB_SHORTCUT_LIST_SETTINGS).then(() => {
      const values: StorageItems = {};
      NEWTAB_SHORTCUT_LIST_SETTINGS.forEach((setting) => {
        const stored = settings.getStored(setting);
        if (typeof stored !== 'undefined') values[setting.key] = stored;
      });
      return values;
    }, (): StorageItems => ({}));
  }

  // A new favicon policy drops the icon requests made under the old one and
  // draws the tiles under the new one.
  settings.subscribe([faviconRequestBlacklist, faviconEnhancedFetchEnabled], () => {
    shortcutFaviconPolicyRevision += 1;
    renderShortcuts();
  });

  // Changes other pages store: a new list reloads the grid unless this
  // page is saving its own, new icons, favicons or folder bindings redraw
  // it.
  function followStoredShortcutData(): void {
    settings.subscribe(NEWTAB_SHORTCUT_LIST_SETTINGS, () => {
      if (shortcutPersistenceInFlightCount === 0) {
        scheduleShortcutStorageReload();
      }
    });
    settings.subscribe(newtabShortcutsLocalOverflow, () => {
      if (isShortcutSyncStorageActive() && shortcutPersistenceInFlightCount === 0) {
        scheduleShortcutStorageReload();
      }
    });
    settings.subscribe(newtabShortcutIcons, () => {
      shortcutList.replaceIcons(NEWTAB_SHORTCUT_ICON_STORE.normalizeIconMap(settings.getStored(newtabShortcutIcons)));
      renderShortcuts();
    });
    settings.subscribe(newtabShortcutFaviconCache, () => {
      const storedFavicons = settings.getStored(newtabShortcutFaviconCache);
      newtabShortcutFavicons = ShortcutIconCache.normalizeCacheMap({
        ...(isRecord(storedFavicons) ? storedFavicons : {}),
        ...shortcutFaviconPendingCacheEntries
      });
      renderShortcuts();
    });
    settings.subscribe(shortcutFolderBindings, () => renderShortcuts());
  }

  function scheduleShortcutStorageReload(delayMs?: number): void {
    if (shortcutStorageReloadTimer !== null) {
      window.clearTimeout(shortcutStorageReloadTimer);
    }
    shortcutStorageReloadTimer = window.setTimeout(() => {
      shortcutStorageReloadTimer = null;
      loadShortcuts().then(() => {
        // A torn read can miss shortcuts, so their icons wait for a full one.
        if (shortcutStateTorn) {
          renderShortcuts();
          return;
        }
        pruneShortcutFavicons(shortcutList.items);
        const prunedIcons = getNextShortcutIconMap(shortcutList.items);
        if (!areShortcutIconMapsEqual(shortcutList.icons, prunedIcons)) {
          shortcutList.replaceIcons(prunedIcons);
          shortcutIconStore.writeAll(prunedIcons).catch(() => {});
        }
        renderShortcuts();
      });
    }, delayMs !== undefined && Number.isFinite(delayMs) ? delayMs : 32);
  }

  function getShortcutIconDataUrl(shortcutId: unknown): string {
    const id = String(shortcutId || '').trim();
    return id && shortcutList.icons[id] ? shortcutList.icons[id] : '';
  }

  // The first shortcut whose page is `pageUrl` (normalized).
  function findShortcutByPageUrl(pageUrl: string): ShortcutItem | undefined {
    return shortcutList.items.find((item) => ShortcutIconCache.normalizePageUrl(getShortcutUrl(item)) === pageUrl);
  }

  // A built-in choice only holds while this extension still packages artwork
  // for the URL; otherwise the tile resolves its icon automatically.
  function getShortcutIconSource(shortcut: ShortcutItem | null | undefined): ShortcutIconSource | undefined {
    if (!shortcut || isShortcutFolder(shortcut)) return undefined;
    const source = shortcut.iconSource;
    return source === 'builtin' && !getShortcutDialogBuiltinIconUrl(shortcut.url) ? undefined : source;
  }

  function getShortcutFaviconDataUrl(pageUrl: unknown): string {
    const normalizedPageUrl = ShortcutIconCache.normalizePageUrl(pageUrl);
    const source = getShortcutIconSource(findShortcutByPageUrl(normalizedPageUrl));
    if (source === 'builtin') return '';
    const entry = normalizedPageUrl ? newtabShortcutFavicons[normalizedPageUrl] : undefined;
    if (entry && isCachedIconSource(source)) {
      const savedSource = ShortcutIconCache.getCachedIconSource(entry);
      if (source !== savedSource) return '';
    }
    return ShortcutIconCache.getCachedIconDataUrl(newtabShortcutFavicons, pageUrl);
  }

  function getShortcutFaviconCandidateUrl(pageUrl: string): string {
    // A saved snapshot, including an explicit refresh, takes precedence over bundled defaults.
    if (getShortcutFaviconDataUrl(pageUrl)) {
      return '';
    }
    const normalizedPageUrl = ShortcutIconCache.normalizePageUrl(pageUrl);
    if (normalizedPageUrl && getShortcutIconSource(findShortcutByPageUrl(normalizedPageUrl)) !== 'builtin') return '';
    const resolver = getPageFaviconUrlResolver();
    return resolver ? resolver.getShortcutFaviconCandidateUrl(
      pageUrl, getShortcutDialogBuiltinIconUrl(pageUrl)
    ) : '';
  }

  function saveShortcutFaviconSnapshot(pageUrl: string, dataUrl: unknown, sourceUrl: unknown, replaceExisting?: boolean): string {
    const normalizedDataUrl = ShortcutIconCache.normalizeDataUrl(dataUrl);
    if (!normalizedDataUrl || !findShortcutByPageUrl(pageUrl)) {
      return '';
    }
    const savedDataUrl = getShortcutFaviconDataUrl(pageUrl);
    if (savedDataUrl && replaceExisting !== true) {
      return savedDataUrl;
    }
    newtabShortcutFavicons = ShortcutIconCache.setCachedIcon(
      newtabShortcutFavicons, pageUrl, normalizedDataUrl, sourceUrl
    );
    scheduleShortcutFaviconCacheWrite(pageUrl);
    shortcutIconEvents.emit('snapshotSaved', { pageUrl: ShortcutIconCache.normalizePageUrl(pageUrl) });
    return normalizedDataUrl;
  }

  function areShortcutFaviconEntriesEqual(left: CachedIconMap[string] | undefined, right: CachedIconMap[string] | undefined): boolean {
    return Boolean(left && right &&
      left.dataUrl === right.dataUrl &&
      left.sourceUrl === right.sourceUrl &&
      left.updatedAt === right.updatedAt);
  }

  // Websites inside shortcut folders keep their own icon choice; '' means
  // the automatic favicon.
  function getFolderItemIconUrl(bookmarkId: string, url: string): string {
    const entry = folderItemIconStore.get(bookmarkId);
    if (!entry) return '';
    return entry.iconSource === 'builtin' ? getShortcutDialogBuiltinIconUrl(url) : entry.dataUrl || '';
  }

  function getFolderItemIcon(bookmarkId: string): FolderItemIcon | null {
    return folderItemIconStore.get(bookmarkId);
  }

  // The icon a website shortcut keeps once moved into a folder, with the
  // plate and source the folder cannot show kept for its way back out.
  function getFolderItemIconForShortcut(shortcut: ShortcutLink, iconDataUrl: string | undefined): FolderItemIcon | null {
    const source = getShortcutIconSource(shortcut);
    let icon: FolderItemIcon | null = null;
    if (iconDataUrl) {
      icon = { iconSource: 'custom', dataUrl: iconDataUrl };
    } else if (source === 'builtin') {
      icon = { iconSource: 'builtin' };
    } else {
      const dataUrl = shortcut.url ? getShortcutFaviconDataUrl(shortcut.url) : '';
      icon = dataUrl ? { iconSource: source || 'cache', dataUrl } : null;
    }
    const settings: FolderItemShortcutSettings = {
      ...(!icon && source && source !== 'custom' ? { iconSource: source } : {}),
      ...(shortcut.iconPlate ? { iconPlate: shortcut.iconPlate } : {}),
      ...(shortcut.iconPlateColor ? { iconPlateColor: shortcut.iconPlateColor } : {})
    };
    const hasSettings = Object.keys(settings).length > 0;
    return icon || hasSettings ? { ...(icon || {}), ...(hasSettings ? { shortcut: settings } : {}) } : null;
  }

  function updateFolderItemIcons(changes: Readonly<Record<string, FolderItemIcon | null>>): Promise<FolderItemIconMap> {
    const snapshot = bookmarksRuntime.getSnapshot();
    return folderItemIconStore.update(changes, snapshot.ready ? (id) => snapshot.nodeMap.has(id) : undefined);
  }

  // The icon chosen in the edit dialog; the plate the site had as a
  // shortcut stays for when it becomes one again.
  function getNextFolderItemIcon(bookmarkId: string, url: string, iconState: FolderItemIconChoice): FolderItemIcon | null {
    const current = folderItemIconStore.get(bookmarkId);
    const image = getNextFolderItemImage(bookmarkId, url, iconState);
    const next: FolderItemIcon | null = image && { iconSource: image.iconSource, ...(image.dataUrl ? { dataUrl: image.dataUrl } : {}) };
    const kept = current && current.shortcut ? current.shortcut : null;
    const settings: FolderItemShortcutSettings = {
      ...(kept && kept.iconPlate ? { iconPlate: kept.iconPlate } : {}),
      ...(kept && kept.iconPlateColor ? { iconPlateColor: kept.iconPlateColor } : {})
    };
    const hasSettings = Object.keys(settings).length > 0;
    return next || hasSettings ? { ...(next || {}), ...(hasSettings ? { shortcut: settings } : {}) } : null;
  }

  function getNextFolderItemImage(bookmarkId: string, url: string, iconState: FolderItemIconChoice): FolderItemIcon | null {
    const current = folderItemIconStore.get(bookmarkId);
    const source = iconState.source;
    if (source === 'custom') {
      return iconState.action === 'replace' && iconState.dataUrl
        ? { iconSource: 'custom', dataUrl: iconState.dataUrl }
        : current && current.iconSource === 'custom' ? current : null;
    }
    if (source === 'builtin') return { iconSource: 'builtin' };
    const toPageUrl = (value: unknown): string =>
      ShortcutIconCache.normalizePageUrl(ShortcutNormalize.normalizeShortcutUrl(value));
    const pageUrl = toPageUrl(url);
    const onlineIcon = iconState.onlineIcon;
    if (onlineIcon && onlineIcon.dataUrl && pageUrl && onlineIcon.pageUrl === pageUrl) {
      return { iconSource: source, dataUrl: onlineIcon.dataUrl };
    }
    // An unchanged choice keeps its image until the URL changes.
    const node = bookmarksRuntime.getNode(bookmarkId);
    return current && current.iconSource === source && node && toPageUrl(node.url) === pageUrl ? current : null;
  }

  function getShortcutDialogOnlineIconUrl(url: string): string {
    const pageUrl = ShortcutNormalize.normalizeShortcutUrl(url);
    return pageUrl ? getShortcutFaviconDataUrl(pageUrl) || getShortcutFaviconCandidateUrl(pageUrl) : '';
  }

  function getShortcutDialogBuiltinIconUrl(url: unknown): string {
    const pageUrl = ShortcutNormalize.normalizeShortcutUrl(url);
    const assetPath = BundledIcons.getBundledShortcutIconAssetPath(
      pageUrl, SearchSiteSearchProviders.getDefaultSiteSearchProviders()
    );
    return assetPath ? getExtensionResourceUrl(assetPath) : '';
  }

  function getShortcutDialogOnlineIconSource(url: string): CachedIconSource | 'builtin' {
    const pageUrl = ShortcutIconCache.normalizePageUrl(
      ShortcutNormalize.normalizeShortcutUrl(url)
    );
    const shortcut = findShortcutByPageUrl(pageUrl);
    const iconSource = shortcut && !isShortcutFolder(shortcut) ? shortcut.iconSource : undefined;
    if (iconSource === 'builtin' || isCachedIconSource(iconSource)) {
      return iconSource;
    }
    const entry = pageUrl ? newtabShortcutFavicons[pageUrl] : undefined;
    if (entry && ShortcutIconCache.isCachedIconForPage(entry, pageUrl)) {
      return ShortcutIconCache.getCachedIconSource(entry);
    }
    return 'cache';
  }

  function isShortcutDialogIconSourceAvailable(source: CachedIconSource, url: string): boolean {
    const pageUrl = ShortcutNormalize.normalizeShortcutUrl(url);
    if (!pageUrl) return source === 'cache';
    const normalizedPageUrl = ShortcutIconCache.normalizePageUrl(pageUrl);
    const resolver = getPageFaviconUrlResolver();
    return normalizedPageUrl
      ? Boolean(resolver && resolver.getShortcutFaviconFetchCandidates(normalizedPageUrl, source).length)
      : source === 'cache';
  }

  function refreshShortcutDialogOnlineIcon(url: string, iconSource?: CachedIconSource): Promise<OnlineShortcutIcon | null> {
    const pageUrl = ShortcutNormalize.normalizeShortcutUrl(url);
    const normalizedPageUrl = ShortcutIconCache.normalizePageUrl(pageUrl);
    if (!normalizedPageUrl) {
      if (iconSource === 'service' || iconSource === 'favicon-is') return Promise.resolve(null);
      // Internal browser pages can only use their browser-provided icon.
      const browserIcon = pageUrl ? getShortcutFaviconCandidateUrl(pageUrl) : '';
      return Promise.resolve(browserIcon ? { dataUrl: browserIcon, pageUrl } : null);
    }
    const resolver = getPageFaviconUrlResolver();
    if (!resolver || resolver.getShortcutFaviconFetchCandidates(normalizedPageUrl, iconSource).length === 0) {
      return Promise.resolve(null);
    }
    const policyRevision = shortcutFaviconPolicyRevision;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result: OnlineShortcutIcon | null): void => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      const timeoutId = window.setTimeout(() => finish(null), 8000);
      const sent = sendRuntimeMessage<'getShortcutFaviconData'>({
        action: 'getShortcutFaviconData',
        pageUrl: normalizedPageUrl,
        refresh: true,
        ...(isCachedIconSource(iconSource) ? { iconSource } : {})
      }, (response) => {
        window.clearTimeout(timeoutId);
        const dataUrl = ShortcutIconCache.normalizeDataUrl(response && response.data);
        finish(response && dataUrl && policyRevision === shortcutFaviconPolicyRevision
          ? { dataUrl, pageUrl: normalizedPageUrl, sourceUrl: String(response.sourceUrl || '') }
          : null);
      });
      if (!sent) {
        window.clearTimeout(timeoutId);
        finish(null);
      }
    });
  }

  function scheduleShortcutFaviconCacheWrite(pageUrl: string): void {
    const cacheKey = ShortcutIconCache.normalizePageUrl(pageUrl);
    const cacheEntry = cacheKey ? newtabShortcutFavicons[cacheKey] : undefined;
    if (cacheKey && cacheEntry) {
      shortcutFaviconPendingCacheEntries[cacheKey] = cacheEntry;
    }
    if (shortcutFaviconCacheWriteTimer !== null) {
      window.clearTimeout(shortcutFaviconCacheWriteTimer);
    }
    shortcutFaviconCacheWriteTimer = window.setTimeout(() => {
      shortcutFaviconCacheWriteTimer = null;
      const pendingEntries = { ...shortcutFaviconPendingCacheEntries };
      if (Object.keys(pendingEntries).length === 0) {
        return;
      }
      shortcutFaviconStore.mergeAll(pendingEntries).then((savedEntries) => {
        Object.keys(pendingEntries).forEach((key) => {
          if (areShortcutFaviconEntriesEqual(shortcutFaviconPendingCacheEntries[key], pendingEntries[key])) {
            delete shortcutFaviconPendingCacheEntries[key];
          }
        });
        newtabShortcutFavicons = ShortcutIconCache.normalizeCacheMap({
          ...savedEntries,
          ...shortcutFaviconPendingCacheEntries
        });
      }).catch(() => {});
    }, 120);
  }

  function drainShortcutFaviconRequestQueue(): void {
    while (shortcutFaviconActiveRequestCount < SHORTCUT_FAVICON_MAX_CONCURRENT_REQUESTS) {
      const task = shortcutFaviconRequestQueue.shift();
      if (!task) break;
      shortcutFaviconActiveRequestCount += 1;
      Promise.resolve().then(task.run).then(task.resolve, () => task.resolve('')).finally(() => {
        shortcutFaviconActiveRequestCount = Math.max(0, shortcutFaviconActiveRequestCount - 1);
        drainShortcutFaviconRequestQueue();
      });
    }
  }

  function enqueueShortcutFaviconRequest(run: () => Promise<string>): Promise<string> {
    return new Promise((resolve) => {
      shortcutFaviconRequestQueue.push({ run, resolve });
      drainShortcutFaviconRequestQueue();
    });
  }

  function resolveShortcutFaviconDataUrl(pageUrl: string): Promise<string> {
    const normalizedPageUrl = ShortcutIconCache.normalizePageUrl(pageUrl);
    if (!normalizedPageUrl) {
      return Promise.resolve('');
    }
    const iconSource = getShortcutIconSource(findShortcutByPageUrl(normalizedPageUrl));
    if (iconSource === 'builtin') return Promise.resolve('');
    const cachedDataUrl = getShortcutFaviconDataUrl(normalizedPageUrl);
    if (cachedDataUrl) {
      return Promise.resolve(cachedDataUrl);
    }
    const policyRevision = shortcutFaviconPolicyRevision;
    const requestKey = `${normalizedPageUrl}::${policyRevision}::${iconSource || 'auto'}`;
    const pending = shortcutFaviconPending.get(requestKey);
    if (pending) {
      return pending;
    }
    const promise = enqueueShortcutFaviconRequest(async () => {
      await faviconCacheRuntime.ensureCachesReady();
      if (!findShortcutByPageUrl(normalizedPageUrl) || policyRevision !== shortcutFaviconPolicyRevision) {
        return '';
      }
      const savedDataUrl = getShortcutFaviconDataUrl(normalizedPageUrl);
      if (savedDataUrl) {
        return savedDataUrl;
      }
      const cacheKey = FaviconCanonical.getFaviconPersistCacheKey(normalizedPageUrl);
      const existingEntry = getPersistedFaviconDataEntry(cacheKey);
      // The page favicon cache keeps no source URL.
      if (!iconSource && existingEntry && ShortcutIconCache.isCachedIconForPage(existingEntry, normalizedPageUrl) &&
          ShortcutIconCache.normalizeDataUrl(existingEntry.dataUrl)) {
        return saveShortcutFaviconSnapshot(normalizedPageUrl, existingEntry.dataUrl, '');
      }
      const resolver = getPageFaviconUrlResolver();
      if (!resolver || resolver.getShortcutFaviconFetchCandidates(normalizedPageUrl, iconSource).length === 0) {
        return '';
      }
      return new Promise<string>((resolve) => {
        let settled = false;
        const finish = (dataUrl: string): void => {
          if (settled) {
            return;
          }
          settled = true;
          resolve(dataUrl || '');
        };
        const timeoutId = window.setTimeout(() => finish(''), 8000);
        const sent = sendRuntimeMessage<'getShortcutFaviconData'>({
          action: 'getShortcutFaviconData',
          pageUrl: normalizedPageUrl,
          ...(isCachedIconSource(iconSource) ? { iconSource } : {})
        }, (response) => {
          window.clearTimeout(timeoutId);
          if (settled) {
            return;
          }
          const currentShortcut = findShortcutByPageUrl(normalizedPageUrl);
          if (!currentShortcut || getShortcutIconSource(currentShortcut) !== iconSource ||
              policyRevision !== shortcutFaviconPolicyRevision) {
            finish('');
            return;
          }
          finish(saveShortcutFaviconSnapshot(normalizedPageUrl,
            response && response.data, response && response.sourceUrl));
        });
        if (!sent) {
          window.clearTimeout(timeoutId);
          finish('');
        }
      });
    }).finally(() => {
      shortcutFaviconPending.delete(requestKey);
    });
    shortcutFaviconPending.set(requestKey, promise);
    return promise;
  }

  function getShortcutTitle(shortcut: ShortcutItem | VisibleShortcutItem): string {
    if (isShortcutFolder(shortcut)) {
      const node = bookmarksRuntime.getNode(getShortcutFolderId(shortcut));
      return sanitizeDisplayText((node && node.title) || shortcut.title || '') ||
        t('newtab_shortcuts_open_folder', 'Open folder');
    }
    return sanitizeDisplayText(shortcut.title || '') ||
      sanitizeDisplayText(shortcut.host || '') ||
      sanitizeDisplayText(shortcut.url || '') ||
      t('newtab_shortcuts_add', 'Add shortcut');
  }

  // A shortcut drag moves the rendered tiles by hand until it ends, so a
  // render asked for meanwhile (a favicon that resolved, a storage change)
  // waits and runs once the drag is over.
  let shortcutRenderDeferred = false;

  function renderShortcuts(): void {
    if (!shortcutsView) {
      return;
    }
    if (dragSessions.shortcutDragging) {
      shortcutRenderDeferred = true;
      return;
    }
    shortcutRenderDeferred = false;
    hideShortcutTooltip();
    closeShortcutContextMenu();
    shortcutList.replaceItems(ShortcutNormalize.normalizeShortcuts(shortcutList.items, getShortcutStoreOptions()));
    const items = getVisibleShortcuts();
    const grouped = isShortcutGroupLayoutActive();
    shortcutsView.render(items, {
      grouped,
      groups: shortcutGroups
    });
    if (grouped) {
      adaptiveToneEvents.emit('stale', {});
    }
    shortcutFolderRuntime.flush().catch(() => {});
    syncOpenBookmarkCascadeAnchorVisual();
    pageStructureRuntime.shortcut.section.setAttribute('data-count', String(items.length));
    applyNewtabShortcutsVisibility();
    updateShortcutLanguageStrings();
    updateBookmarkSectionPosition({
      preserveSearchEntryLayout: Boolean(
        document.body && document.body.getAttribute('data-nt-ready') === '1'
      )
    });
  }

  function flushDeferredShortcutRender(): void {
    if (shortcutRenderDeferred && !dragSessions.shortcutDragging) {
      renderShortcuts();
    }
  }

  // A drag moves tiles between groups without rendering; the grid follows
  // its longest row as the tile joins or leaves one.
  function fitShortcutGroupColumns(): boolean {
    return Boolean(shortcutsView && isShortcutGroupLayoutActive() &&
      shortcutsView.fitGroupedColumns(getVisibleShortcuts(), shortcutGroups));
  }

  function applyShortcutState(state: ShortcutState): void {
    shortcutList.replaceItems(state.items);
    shortcutGroups = state.groups;
    shortcutMigratedAt = Number(state.migratedAt) || 0;
  }

  function loadShortcuts(): Promise<ShortcutItem[]> {
    if (!storageArea) {
      applyShortcutState(ShortcutNormalize.getDefaultShortcutState(getShortcutStoreOptions()));
      return Promise.resolve(shortcutList.items);
    }
    return Promise.all([
      readShortcutSyncValues(),
      readShortcutOverflowRecord()
    ]).then(([values, overflowRecord]) => {
      const state = ShortcutStoragePlan.readShortcutState(values, overflowRecord, getShortcutStoreOptions());
      applyShortcutState(state);
      shortcutStateTorn = state.torn === true;
      // Part of another device's save has not arrived yet; read again
      // shortly instead of rewriting anything from a mixed copy.
      if (state.torn) {
        if (shortcutTornReloadCount < SHORTCUT_TORN_RELOAD_LIMIT) {
          shortcutTornReloadCount += 1;
          scheduleShortcutStorageReload(SHORTCUT_TORN_RELOAD_DELAY_MS);
        }
        return shortcutList.items;
      }
      shortcutTornReloadCount = 0;
      if (shortcutList.items.some(isShortcutFolder)) {
        return refreshShortcutFolderReferences().then(() => shortcutList.items);
      }
      return shortcutList.items;
    });
  }

  function loadShortcutIcons(): Promise<ShortcutIconMap> {
    return shortcutIconStore.readAll()
      .then((icons) => {
        shortcutList.replaceIcons(NEWTAB_SHORTCUT_ICON_STORE.normalizeIconMap(icons));
        return shortcutList.icons;
      })
      .catch(() => {
        shortcutList.replaceIcons({});
        return shortcutList.icons;
      });
  }

  function loadShortcutFavicons(): Promise<CachedIconMap> {
    return shortcutFaviconStore.readAll()
      .then((cacheMap) => {
        newtabShortcutFavicons = ShortcutIconCache.normalizeCacheMap(cacheMap);
        return newtabShortcutFavicons;
      })
      .catch(() => {
        newtabShortcutFavicons = {};
        return newtabShortcutFavicons;
      });
  }

  function pruneShortcutFavicons(shortcuts: readonly ShortcutItem[], persist?: boolean): boolean {
    const shortcutUrls = shortcuts.map(getShortcutUrl);
    const nextFavicons = ShortcutIconCache.retainCachedIcons(
      newtabShortcutFavicons,
      shortcutUrls
    );
    const changed = JSON.stringify(newtabShortcutFavicons) !== JSON.stringify(nextFavicons);
    newtabShortcutFavicons = nextFavicons;
    shortcutFaviconPendingCacheEntries = ShortcutIconCache.retainCachedIcons(
      shortcutFaviconPendingCacheEntries,
      shortcutUrls
    );
    if (changed && persist !== false) {
      shortcutFaviconStore.retainAll(shortcutUrls).catch(() => {});
    }
    return changed;
  }

  // Reads the grid settings, filling in the columns of a device that only
  // stored the older width, then follows the add button's.
  function followNewtabShortcutPreferences(): Promise<void> {
    settings.subscribe(newtabShortcutAddVisible, () => renderShortcuts());
    return settings.include(NEWTAB_SHORTCUT_GRID_SETTINGS.concat(newtabShortcutWidth)).then(() => {
      if (settings.getStored(newtabShortcutColumns) === undefined) {
        void settings.set(newtabShortcutColumns, inferNewtabShortcutColumnsFromWidth(settings.getStored(newtabShortcutWidth)));
      }
      applyNewtabShortcutLayoutPreferences();
      applyNewtabShortcutsVisibility();
      applyNewtabShortcutDockMagnification();
    });
  }

  function loadVisibleShortcuts(): Promise<ShortcutItem[]> {
    return Promise.all([loadShortcuts(), loadShortcutIcons(), loadShortcutFavicons(), loadFolderColors()]).then(() => {
      if (shortcutStateTorn) {
        renderShortcuts();
        return shortcutList.items;
      }
      const prunedIcons = getNextShortcutIconMap(shortcutList.items);
      const shouldPrune = !areShortcutIconMapsEqual(shortcutList.icons, prunedIcons);
      const shouldPruneFavicons = pruneShortcutFavicons(shortcutList.items, false);
      shortcutList.replaceIcons(prunedIcons);
      renderShortcuts();
      if (shouldPrune) {
        shortcutIconStore.writeAll(prunedIcons).catch(() => {});
      }
      if (shouldPruneFavicons) {
        const shortcutUrls = shortcutList.items.map(getShortcutUrl);
        shortcutFaviconStore.retainAll(shortcutUrls).catch(() => {});
      }
      return shortcutList.items;
    });
  }

  function getNextShortcutIconMap(
    shortcuts: readonly ShortcutItem[],
    iconChange?: ShortcutIconChange | readonly ShortcutIconChange[]
  ): ShortcutIconMap {
    const validIds = new Set(
      shortcuts
        .map((item) => String(item.id || '').trim())
        .filter(Boolean)
    );
    const nextIcons: ShortcutIconMap = {};
    Object.keys(shortcutList.icons).forEach((shortcutId) => {
      if (validIds.has(shortcutId)) {
        nextIcons[shortcutId] = shortcutList.icons[shortcutId];
      }
    });
    const changes: readonly ShortcutIconChange[] = !iconChange ? []
      : isIconChangeList(iconChange) ? iconChange : [iconChange];
    changes.forEach((change) => {
      const shortcutId = String(change.shortcutId || '').trim();
      if (!shortcutId || !validIds.has(shortcutId)) {
        return;
      }
      if (change.action === 'remove') {
        delete nextIcons[shortcutId];
      } else {
        const dataUrl = NEWTAB_SHORTCUT_ICON_STORE.normalizeIconDataUrl(change.dataUrl);
        if (dataUrl) {
          nextIcons[shortcutId] = dataUrl;
        }
      }
    });
    return NEWTAB_SHORTCUT_ICON_STORE.normalizeIconMap(nextIcons);
  }

  function areShortcutIconMapsEqual(leftValue: unknown, rightValue: unknown): boolean {
    const left = NEWTAB_SHORTCUT_ICON_STORE.normalizeIconMap(leftValue);
    const right = NEWTAB_SHORTCUT_ICON_STORE.normalizeIconMap(rightValue);
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length &&
      leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
  }

  const persistShortcuts: PersistShortcuts = (nextShortcuts, toastMessage, iconChange, persistOptions) => {
    const options = getShortcutStoreOptions();
    const settings: PersistShortcutsOptions = persistOptions || {};
    const nextState = ShortcutNormalize.normalizeShortcutState({
      groups: settings.groups || shortcutGroups,
      items: nextShortcuts,
      migratedAt: shortcutMigratedAt
    }, options);
    const normalized = nextState.items;
    const previousIcons = shortcutList.icons;
    const nextIcons = getNextShortcutIconMap(normalized, iconChange);
    const iconsChanged = !areShortcutIconMapsEqual(previousIcons, nextIcons);
    let didWriteIcons = false;
    let didStartItemPersistence = false;
    const syncBudgetReady = getShortcutSyncBudget();
    const iconsReady = iconsChanged
      ? shortcutIconStore.writeAll(nextIcons).then((savedIcons) => {
        didWriteIcons = true;
        return savedIcons;
      })
      : Promise.resolve(nextIcons);
    const persistItems = (): Promise<SavedShortcutState> => {
      didStartItemPersistence = true;
      shortcutPersistenceInFlightCount += 1;
      const finishTrackedPersistence = (operation: Promise<SavedShortcutState>): Promise<SavedShortcutState> =>
        operation.finally(() => {
          shortcutPersistenceInFlightCount = Math.max(0, shortcutPersistenceInFlightCount - 1);
        });
      if (!storageArea) {
        return finishTrackedPersistence(Promise.resolve({
          state: nextState,
          localOnlyIds: [],
          syncLimited: false
        }));
      }
      // Narrowed here, for the save below.
      const area = storageArea;
      return finishTrackedPersistence(syncBudgetReady.then((budget) => (
        LumnoShortcutStorage.persistShortcutState(area, nextState, {
          ...options,
          overflowArea: getShortcutOverflowStorageArea(),
          maxTotalBytes: budget.maxTotalBytes,
          legacyKeysPresent: budget.legacyKeysPresent,
          getLastError: getShortcutStorageLastError
        })
      )));
    };
    return iconsReady
      .then((savedIcons) => {
        shortcutList.replaceIcons(savedIcons);
        return persistItems();
      })
      .then((result) => {
        // Group changes and added or removed sites can re-center the grid;
        // those renders slide the tiles over instead of jumping.
        const applySavedState = () => {
          applyShortcutState(result.state);
          pruneShortcutFavicons(shortcutList.items);
          if (settings.render !== false) {
            renderShortcuts();
          }
        };
        if (settings.animateLayout && settings.render !== false && animateShortcutLayoutChange) {
          animateShortcutLayoutChange(applySavedState);
        } else {
          applySavedState();
        }
        const overflowShortcutId = String(settings.syncOverflowShortcutId || '');
        const shouldWarnAboutSyncLimit = Boolean(
          result.syncLimited && overflowShortcutId &&
          result.localOnlyIds.includes(overflowShortcutId)
        );
        // With WebDAV on, a shortcut past the browser's sync space still
        // reaches other devices, so there is nothing to warn about.
        return (shouldWarnAboutSyncLimit ? isWebDavSyncEnabled() : Promise.resolve(true)).then((webdav) => {
          if (!webdav) {
            showToast(t(
              'newtab_shortcuts_sync_limit_reached',
              'Shortcuts exceed the browser’s sync space, so new ones stay on this device. Turn on WebDAV in Settings to sync them too.'
            ), false, { duration: 5200 });
          } else if (toastMessage) {
            showToast(toastMessage);
          }
          return true;
        });
      })
      .catch(async (error) => {
        if (didWriteIcons) {
          try {
            await shortcutIconStore.writeAll(previousIcons);
          } catch (rollbackError) {
            console.warn('[Lumno] Failed to roll back shortcut icons', rollbackError);
          }
        }
        shortcutList.replaceIcons(previousIcons);
        renderShortcuts();
        if (didStartItemPersistence) {
          console.warn('[Lumno] Failed to save shortcuts', error);
          showToast(t('toast_error', 'Operation failed. Please try again.'), true);
        } else {
          setShortcutIconError(t(
            'newtab_shortcuts_icon_storage_error',
            'The local icon could not be saved. Try another image.'
          ));
        }
        return false;
      });
  };

  // The stored WebDAV status while sync is on; null while it is off.
  function readWebDavStatus(): Promise<Record<string, unknown> | null> {
    const localArea = chrome && chrome.storage ? chrome.storage.local : null;
    if (!localArea || !webdavStatus.key) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      try {
        localArea.get([webdavStatus.key], (result: StorageItems | undefined) => {
          const status = result ? result[webdavStatus.key] : null;
          resolve(!getShortcutStorageLastError() && isRecord(status) && status.enabled === true ? status : null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  function isWebDavSyncEnabled(): Promise<boolean> {
    return readWebDavStatus().then(Boolean);
  }

  // Whether WebDAV is backing up shortcuts right now. An error, or a
  // first-join choice or conflict waiting on the user, holds every upload.
  function isWebDavBackingUpShortcuts(): Promise<boolean> {
    return readWebDavStatus().then((status) => {
      const state = status ? status.state : '';
      return state === 'ready' || state === 'syncing' || state === 'pending';
    });
  }

  function getShortcutGroups(): ShortcutGroup[] {
    return shortcutGroups;
  }

  // A single group is no grouping: it keeps the plain, centered shortcut
  // rows and shows no title, whatever it is named.
  function isShortcutGroupLayoutActive(): boolean {
    return shortcutGroups.length > 1;
  }

  function getLastShortcutGroupId(): string {
    return shortcutGroups.length ? shortcutGroups[shortcutGroups.length - 1].id : '';
  }

  function getShortcutGroupDisplayTitle(groupId: string): string {
    const group = shortcutGroups.find((item) => item.id === groupId);
    return group && group.title
      ? group.title
      : t('newtab_shortcuts_group_untitled_name', 'Untitled group');
  }

  function openShortcutAddDialog(sourceElement: HTMLElement | null, groupId?: string): void {
    hideShortcutTooltip();
    shortcutAddTargetGroupId = groupId || getLastShortcutGroupId();
    void openShortcutDialog({ sourceElement });
  }

  // Groups are named in the shortcut dialog: an empty groupId creates one.
  function openShortcutGroupDialog(groupId: string, sourceElement: HTMLElement | null): void {
    const group = groupId ? shortcutGroups.find((item) => item.id === groupId) : null;
    if (groupId && !group) {
      return;
    }
    if (!group && shortcutGroups.length >= ShortcutConstants.DEFAULT_MAX_SHORTCUT_GROUPS) {
      showGroupLimitToast();
      return;
    }
    hideShortcutTooltip();
    shortcutGroupDialogTargetId = group ? group.id : '';
    void openShortcutDialog({
      sourceElement,
      itemType: 'group',
      mode: group ? 'edit' : 'add',
      shortcut: group ? { id: group.id, title: group.title } : null
    });
  }

  function saveShortcutGroupFromDialog(title: string): Promise<boolean> {
    return shortcutGroupDialogTargetId
      ? renameShortcutGroup(shortcutGroupDialogTargetId, title)
      : createShortcutGroup(title);
  }

  function showGroupLimitToast(): void {
    showToast(formatMessage(
      'newtab_shortcuts_group_limit_reached',
      'You can create up to {count} groups.',
      { count: ShortcutConstants.DEFAULT_MAX_SHORTCUT_GROUPS }
    ), true);
  }

  function createShortcutGroup(title: string): Promise<boolean> {
    if (historyLock.busy) {
      return Promise.resolve(false);
    }
    if (shortcutGroups.length >= ShortcutConstants.DEFAULT_MAX_SHORTCUT_GROUPS) {
      showGroupLimitToast();
      return Promise.resolve(false);
    }
    const group = ShortcutNormalize.normalizeShortcutGroups([{
      id: ShortcutNormalize.createShortcutGroupId(),
      title: String(title || '')
    }])[0];
    // The first new group turns the existing row into a group of its own,
    // named "Shortcuts" unless it already has a name; it can be renamed or
    // cleared like any title.
    const groups = shortcutGroups.length === 1 && !shortcutGroups[0].title
      ? ShortcutNormalize.normalizeShortcutGroups([{
        id: shortcutGroups[0].id,
        title: t('newtab_shortcuts_group_default_title', 'Shortcuts')
      }])
      : shortcutGroups;
    return persistShortcuts(shortcutList.items, '', undefined, {
      groups: groups.concat(group),
      animateLayout: true
    });
  }

  function renameShortcutGroup(groupId: string, title: string): Promise<boolean> {
    const nextTitle = ShortcutNormalize.normalizeShortcutGroups([{ id: groupId, title }])[0].title;
    const group = shortcutGroups.find((item) => item.id === groupId);
    if (!group || group.title === nextTitle) {
      return Promise.resolve(Boolean(group));
    }
    return persistShortcuts(shortcutList.items, '', undefined, {
      groups: shortcutGroups.map((item) => (item.id === groupId ? { ...item, title: nextTitle } : item))
    });
  }

  function moveShortcutGroup(groupId: string, offset: number): Promise<boolean> {
    const index = shortcutGroups.findIndex((group) => group.id === groupId);
    return moveShortcutGroupToIndex(groupId, index + offset);
  }

  // `targetIndex` is the group's place among the other groups.
  function moveShortcutGroupToIndex(groupId: string, targetIndex: number): Promise<boolean> {
    const index = shortcutGroups.findIndex((group) => group.id === groupId);
    if (index < 0 || !Number.isInteger(targetIndex) || targetIndex < 0 ||
        targetIndex >= shortcutGroups.length || targetIndex === index) {
      return Promise.resolve(false);
    }
    const groups = shortcutGroups.slice();
    const [group] = groups.splice(index, 1);
    groups.splice(targetIndex, 0, group);
    return persistShortcuts(shortcutList.items, '', undefined, { groups, animateLayout: true });
  }

  // The sites of a deleted group join the group above it, or the one below
  // when it was the first group.
  function planShortcutGroupDelete(
    groups: readonly ShortcutGroup[],
    items: readonly ShortcutItem[],
    groupId: string,
    keepSites: boolean,
    preferredTargetId: string
  ): ShortcutGroupDeletePlan | null {
    const index = groups.findIndex((group) => group.id === groupId);
    if (index < 0 || groups.length <= 1) {
      return null;
    }
    const remaining = groups.filter((group) => group.id !== groupId);
    const members = items.filter((item) => item.groupId === groupId);
    if (keepSites) {
      const target = remaining.find((group) => group.id === preferredTargetId) ||
        groups[index - 1] || groups[index + 1];
      return {
        index,
        groups: remaining,
        targetGroupId: target.id,
        members,
        items: items.map((item) => (item.groupId === groupId ? { ...item, groupId: target.id } : item))
      };
    }
    return {
      index,
      groups: remaining,
      targetGroupId: '',
      members,
      items: items.filter((item) => item.groupId !== groupId)
    };
  }

  function deleteShortcutGroup(groupId: string, keepSites: boolean): Promise<boolean> {
    if (historyLock.busy) {
      return Promise.resolve(false);
    }
    const items = shortcutList.items;
    const plan = planShortcutGroupDelete(shortcutGroups, items, groupId, keepSites, '');
    if (!plan) {
      return Promise.resolve(false);
    }
    const group = shortcutGroups[plan.index];
    const record = NEWTAB_BOOKMARK_MOVE_HISTORY.createShortcutGroupDeleteRecord({
      group,
      groupIndex: plan.index,
      targetGroupId: plan.targetGroupId,
      movedIds: keepSites ? plan.members.map((item) => item.id) : [],
      removed: keepSites ? [] : plan.members.map((item) => ({
        snapshot: item,
        index: items.indexOf(item),
        iconDataUrl: shortcutList.icons[item.id]
      }))
    });
    historyLock.hold();
    return persistShortcuts(plan.items, '', undefined, { groups: plan.groups, animateLayout: true }).then((saved) => {
      if (saved && record) {
        bookmarkMoveHistory.push(record);
        showToast(formatMessage(
          'newtab_shortcuts_group_deleted_undo',
          'Group deleted · {shortcut} to undo',
          { shortcut: getBookmarkUndoShortcutLabel() }
        ));
      }
      return saved;
    }).finally(() => { historyLock.release(); });
  }

  // Deleting a group with its sites removes them all at once, so it asks
  // first; keeping the sites is a plain move and does not.
  function confirmDeleteShortcutGroupWithSites(groupId: string, sourceElement: HTMLElement | null): Promise<boolean> {
    const count = shortcutList.items.filter((item) => item.groupId === groupId).length;
    if (!count) {
      return deleteShortcutGroup(groupId, false);
    }
    void openShortcutDialog({
      sourceElement,
      confirmationTitle: formatMessage(
        'newtab_shortcuts_group_delete_confirm_title',
        'Delete “{group}” and its sites?',
        { group: getShortcutGroupDisplayTitle(groupId) }
      ),
      confirmationDescription: formatMessage(
        'newtab_shortcuts_group_delete_confirm_description',
        'The group and its {count} sites will be deleted.',
        { count }
      ),
      confirmLabel: t('newtab_shortcuts_group_delete_confirm_button', 'Delete'),
      onConfirm() {
        return deleteShortcutGroup(groupId, false);
      }
    });
    return Promise.resolve(true);
  }

  // Undo puts the group back where it was, returns its moved sites to it
  // and restores the sites deleted with it; redo deletes it again.
  function applyShortcutGroupDeleteRecord(record: ShortcutGroupDeleteRecord, isUndo: boolean): Promise<boolean> {
    const items = shortcutList.items;
    if (!isUndo) {
      const plan = planShortcutGroupDelete(shortcutGroups, items, record.group.id,
        !record.removed.length, record.targetGroupId);
      return plan
        ? persistShortcuts(plan.items, '', undefined, { groups: plan.groups, animateLayout: true })
        : Promise.resolve(false);
    }
    if (shortcutGroups.some((group) => group.id === record.group.id) ||
        shortcutGroups.length >= ShortcutConstants.DEFAULT_MAX_SHORTCUT_GROUPS ||
        items.length + record.removed.length > DEFAULT_MAX_SHORTCUTS ||
        record.removed.some(({ snapshot }) => items.some((item) => item.id === snapshot.id ||
          (getShortcutUrl(snapshot) && getShortcutUrl(item) === getShortcutUrl(snapshot))))) {
      return Promise.resolve(false);
    }
    const groups = shortcutGroups.slice();
    groups.splice(Math.min(record.groupIndex, groups.length), 0, record.group);
    const moved = new Set(record.movedIds);
    const next = items.map((item) => (moved.has(item.id) && item.groupId === record.targetGroupId
      ? { ...item, groupId: record.group.id } : item));
    record.removed.slice().sort((first, second) => first.index - second.index).forEach((entry) => {
      next.splice(Math.min(entry.index, next.length), 0, entry.snapshot);
    });
    const iconChange = record.removed.filter((entry) => entry.iconDataUrl).map((entry): ShortcutIconChange => ({
      shortcutId: entry.snapshot.id, action: 'replace', dataUrl: entry.iconDataUrl
    }));
    return persistShortcuts(next, '', iconChange, { groups, animateLayout: true });
  }

  // A website record; null when its URL is not one a shortcut can open.
  function createShortcutLinkRecord(fields: Readonly<Record<string, unknown>>): ShortcutLink | null {
    const record = ShortcutNormalize.createShortcutRecord(fields, getShortcutStoreOptions());
    return record && !isShortcutFolder(record) ? record : null;
  }

  // The change the dialog's icon choice makes; none when it kept the icon.
  function getDialogIconChange(shortcutId: string, iconState: DialogIconState): ShortcutIconChange | undefined {
    if (iconState.action === 'replace') {
      return { shortcutId, action: 'replace', dataUrl: iconState.dataUrl || '' };
    }
    return iconState.action === 'remove' ? { shortcutId, action: 'remove' } : undefined;
  }

  function saveNewShortcutFromDialog(title: string, url: string, iconState: DialogIconState): Promise<boolean> {
    const nextShortcut = createShortcutLinkRecord({ title, url,
      iconSource: iconState.source,
      iconPlate: iconState.plate,
      iconPlateColor: iconState.plateColor });
    if (!nextShortcut) {
      setShortcutError(t('newtab_shortcuts_invalid_url', 'Enter a valid http, https, or browser internal URL.'));
      return Promise.resolve(false);
    }
    const withoutDuplicate = shortcutList.items.filter((item) => getShortcutUrl(item) !== nextShortcut.url);
    if (withoutDuplicate.length >= DEFAULT_MAX_SHORTCUTS) {
      setShortcutError(formatMessage(
        'newtab_shortcuts_limit_reached',
        'You can add up to {count} shortcuts.',
        { count: DEFAULT_MAX_SHORTCUTS }
      ));
      return Promise.resolve(false);
    }
    // A site added from the dialog joins the group it was added from.
    const groupId = shortcutGroups.some((group) => group.id === shortcutAddTargetGroupId)
      ? shortcutAddTargetGroupId
      : getLastShortcutGroupId();
    shortcutAddTargetGroupId = '';
    const nextShortcuts = withoutDuplicate.concat(groupId ? { ...nextShortcut, groupId } : nextShortcut);
    return persistShortcuts(
      nextShortcuts,
      t('newtab_shortcuts_added', 'Shortcut added'),
      getDialogIconChange(nextShortcut.id, iconState),
      {
        syncOverflowShortcutId: nextShortcut.id,
        animateLayout: true
      }
    );
  }

  function getShortcutRecordForSite(site: ShortcutSite): ShortcutLink | null {
    return createShortcutLinkRecord({ title: site.title, url: site.url });
  }

  function hasShortcutForSite(site: ShortcutSite): boolean {
    const record = getShortcutRecordForSite(site);
    return Boolean(record && shortcutList.items.some((item) => getShortcutUrl(item) === record.url));
  }

  function addSiteToShortcuts(site: ShortcutSite): Promise<boolean> {
    const nextShortcut = getShortcutRecordForSite(site);
    if (!nextShortcut) {
      showToast(t('newtab_shortcuts_invalid_url', 'Enter a valid http, https, or browser internal URL.'), true);
      return Promise.resolve(false);
    }
    if (shortcutList.items.some((item) => getShortcutUrl(item) === nextShortcut.url)) {
      showToast(t('newtab_shortcuts_already_added', 'Already in shortcuts'));
      return Promise.resolve(false);
    }
    if (shortcutList.items.length >= DEFAULT_MAX_SHORTCUTS) {
      showToast(formatMessage(
        'newtab_shortcuts_limit_reached',
        'You can add up to {count} shortcuts.',
        { count: DEFAULT_MAX_SHORTCUTS }
      ), true);
      return Promise.resolve(false);
    }
    const groupId = getLastShortcutGroupId();
    return persistShortcuts(
      shortcutList.items.concat(groupId ? { ...nextShortcut, groupId } : nextShortcut),
      t('newtab_shortcuts_added', 'Shortcut added'),
      undefined,
      { syncOverflowShortcutId: nextShortcut.id }
    );
  }

  function saveEditedShortcutFromDialog(title: string, url: string, shortcutId: string, iconState: DialogIconState): Promise<boolean> {
    const currentShortcut = getShortcutById(shortcutId);
    // Folders are edited as bookmarks.
    if (!currentShortcut || isShortcutFolder(currentShortcut)) {
      setShortcutError(t('newtab_shortcuts_invalid_url', 'Enter a valid http, https, or browser internal URL.'));
      return Promise.resolve(false);
    }
    const keepsPlate = typeof iconState.plate === 'undefined';
    const nextShortcut = createShortcutLinkRecord({ title, url,
      iconSource: iconState.source || currentShortcut.iconSource,
      iconPlate: keepsPlate ? currentShortcut.iconPlate : iconState.plate,
      iconPlateColor: keepsPlate ? currentShortcut.iconPlateColor : iconState.plateColor,
      fromBookmark: currentShortcut.fromBookmark === true &&
        ShortcutNormalize.normalizeShortcutUrl(url) === currentShortcut.url });
    if (!nextShortcut) {
      setShortcutError(t('newtab_shortcuts_invalid_url', 'Enter a valid http, https, or browser internal URL.'));
      return Promise.resolve(false);
    }
    nextShortcut.id = currentShortcut.id;
    if (currentShortcut.groupId) {
      nextShortcut.groupId = currentShortcut.groupId;
    }
    const nextShortcuts: ShortcutItem[] = [];
    shortcutList.items.forEach((item) => {
      if (item.id === currentShortcut.id) {
        nextShortcuts.push(nextShortcut);
        return;
      }
      if (getShortcutUrl(item) === nextShortcut.url) {
        return;
      }
      nextShortcuts.push(item);
    });
    return persistShortcuts(
      nextShortcuts,
      t('newtab_shortcuts_edited', 'Shortcut updated'),
      getDialogIconChange(nextShortcut.id, iconState)
    );
  }

  function saveShortcutFromDialog(title: string, url: string, dialogState: ShortcutDialogSubmission): Promise<boolean> {
    const iconState: DialogIconState = {
      action: dialogState.iconAction,
      dataUrl: dialogState.iconDataUrl,
      source: dialogState.iconSource,
      plate: dialogState.iconPlate,
      plateColor: dialogState.iconPlateColor
    };
    if (dialogState.mode === 'edit') {
      return saveEditedShortcutFromDialog(title, url, dialogState.shortcutId, iconState);
    }
    return saveNewShortcutFromDialog(title, url, iconState);
  }

  function saveBookmarkFromDialog(title: string, url: string, dialogState: BookmarkDialogSubmission): Promise<boolean> {
    const itemId = String(dialogState.itemId || dialogState.shortcutId || '');
    const isFolder = dialogState.itemType === SHORTCUT_DIALOG_ITEM_FOLDER;
    const nextUrl = String(url || '').trim();
    if (!itemId || (!isFolder && !nextUrl)) {
      setShortcutError(t('bookmarks_invalid_url', 'Enter a valid URL.'));
      return Promise.resolve(false);
    }
    const changes: { title: string; url?: string } = {
      title: String(title || '').trim()
    };
    if (!isFolder) {
      changes.url = nextUrl;
    }
    const iconEntry = !isFolder && dialogState.iconSource
      ? getNextFolderItemIcon(itemId, nextUrl, {
        source: dialogState.iconSource,
        action: dialogState.iconAction,
        dataUrl: dialogState.iconDataUrl,
        onlineIcon: dialogState.onlineIcon
      })
      : undefined;
    const keepCascadeOpen = Boolean(bookmarkParts.cascade && bookmarkParts.cascade.isOpen());
    return bookmarksRuntime.runControlledMutation(() => {
      return bookmarksRuntime.update(itemId, changes);
    }).then(() => {
      return iconEntry === undefined ? null : updateFolderItemIcons({ [itemId]: iconEntry });
    }).then(() => {
      markBookmarkTreeDirty({ preserveCascadeOpen: keepCascadeOpen });
      loadBookmarks({ force: true });
      if (keepCascadeOpen) {
        refreshOpenBookmarkCascadeMenu();
      }
      showToast(t(
        isFolder ? 'bookmarks_folder_updated' : 'bookmarks_updated',
        isFolder ? 'Folder updated' : 'Bookmark updated'
      ));
      return true;
    }).catch((error: unknown) => {
      console.warn('[Lumno] Failed to update bookmark', error);
      setShortcutError(t('bookmarks_update_failed', 'Could not update bookmark.'));
      return false;
    });
  }

  function removeShortcutById(shortcutId: string): Promise<boolean> {
    const id = String(shortcutId || '');
    if (!id || historyLock.busy) {
      return Promise.resolve(false);
    }
    const index = shortcutList.items.findIndex((item) => item.id === id);
    if (index < 0) {
      return Promise.resolve(false);
    }
    const record = NEWTAB_BOOKMARK_MOVE_HISTORY.createShortcutDeleteRecord({
      snapshot: shortcutList.items[index], index,
      iconDataUrl: shortcutList.icons[id]
    });
    historyLock.hold();
    return persistShortcuts(shortcutList.items.filter((item) => item.id !== id), '', undefined,
      { animateLayout: true }).then((saved) => {
      if (saved && record) {
        bookmarkMoveHistory.push(record);
        showToast(formatMessage(
          'newtab_shortcuts_removed_undo',
          'Shortcut removed · {shortcut} to undo',
          { shortcut: getBookmarkUndoShortcutLabel() }
        ));
      }
      return saved;
    }).finally(() => { historyLock.release(); });
  }

  function hideShortcutAddFromContextMenu(sourceElement?: HTMLElement | null): void {
    if (!settings.get(newtabShortcutAddVisible)) {
      return;
    }
    void settings.set(newtabShortcutAddVisible, false);
    const addButton = sourceElement || getAddShortcutButton();
    if (addButton) {
      addButton.hidden = true;
    }
    hideShortcutTooltip();
    resetShortcutDockHover();
    applyNewtabShortcutsVisibility();
    updateBookmarkSectionPosition({ preserveSearchEntryLayout: true });
    adaptiveToneEvents.emit('stale', {});
    showToast(t(
      'newtab_shortcuts_add_hidden',
      '“+” hidden. Re-enable it in Settings → Appearance → Shortcuts → Show “+”.'
    ));
  }

  function createShortcutsSection(): void {
    const section = pageStructureRuntime.shortcut.section;
    section.setAttribute('aria-label', t('newtab_shortcuts_section_label', 'Shortcuts'));

    const grid = pageStructureRuntime.shortcut.grid;
    applyNewtabShortcutDockMagnification();

    const view = createShortcutsView({
      grid,
      tiles: shortcutTiles,
      maxShortcuts: DEFAULT_MAX_SHORTCUTS,
      initFolderIcon: initFolderPathMorph,
      animateFolderIcon: playFolderPathMorph,
      onFolderMenuChange: syncShortcutDockFolderMenu,
      getShortcutTitle,
      getHostFromUrl,
      getShortcutIconDataUrl,
      getShortcutFaviconDataUrl,
      resolveShortcutFaviconDataUrl,
      getShortcutFaviconPolicyRevision: () => shortcutFaviconPolicyRevision,
      getShortcutFaviconCandidateUrl,
      analyzeShortcutIcon: (image) => NEWTAB_SHORTCUT_ICON_PLATE.analyzeImage(image, { documentObj: document }),
      resolveShortcutIconPlate: NEWTAB_SHORTCUT_ICON_PLATE.resolvePlate,
      getImmediateThemeForSuggestion,
      applyShortcutTileTheme,
      queueThemeForTarget,
      getTileThemeOnSiteChange,
      attachFaviconWithFallbacks,
      bindTooltip: bindShortcutTooltip,
      hideTooltip: hideShortcutTooltip,
      formatOpenLabel: (title) => formatMessage('open_prefix', '打开 {title}', { title }),
      isMiddleClick,
      openShortcut: openShortcutUrl,
      isActivationSuppressed: isCardActivationSuppressed,
      moveShortcut: moveShortcutByKeyboard,
      onContextMenu: handleShortcutContextMenu,
      onNativeDragStart: handleShortcutNativeDragStart,
      getAddLabel: () => t('newtab_shortcuts_add', 'Add shortcut'),
      getAddVisible: () => settings.get(newtabShortcutAddVisible) && shortcutList.items.length < DEFAULT_MAX_SHORTCUTS,
      // The add tile asks what to add, or offers to hide itself.
      onAdd: openShortcutAddContextMenu,
      onAddContextMenu: () => {},
      groupHeaders: shortcutGroupHeaders,
      getGroupPlaceholder: () => t('newtab_shortcuts_group_title_placeholder', 'Add a title'),
      getGroupActionsLabel: (title) => formatMessage('newtab_shortcuts_group_actions', '{group} actions', {
        group: title || t('newtab_shortcuts_group_untitled_name', 'Untitled group')
      }),
      onGroupMenu: handleShortcutGroupMenu,
      onGroupRename: openShortcutGroupDialog,
      getGroupEmptyLabel: () => t('newtab_shortcuts_group_add_site', 'Add site'),
      onGroupAdd: (groupId, sourceElement) => openShortcutAddDialog(sourceElement, groupId)
    });
    shortcutsView = view;
    view.render([]);
    grid.addEventListener('pointerdown', handleShortcutDragPointerDown);
    grid.addEventListener('pointerover', handleShortcutDockPointerOver);
    grid.addEventListener('pointermove', handleShortcutDockPointerMove);
    grid.addEventListener('pointerleave', resetShortcutDockHover);
    updateShortcutLanguageStrings();
  }

  // A link opens its site; a folder opens its bookmarks in the folder menu.
  function openShortcutUrl(shortcut: ShortcutItem | VisibleShortcutItem | null | undefined, event?: OpenEvent | null): void {
    if (shortcut && shortcut.type === 'folder') {
      const tile = getShortcutTileById(shortcut.id);
      void bookmarksRuntime.ensureReady(false).then((ready) => {
        const node = ready && bookmarksRuntime.getNode(getShortcutFolderId(shortcut));
        if (!node || node.url) {
          showToast(t('newtab_shortcuts_folder_missing', 'This bookmark folder is no longer available.'), true);
          return;
        }
        openBookmarkCascadeMenu({ ...node, type: 'folder' }, tile);
      });
      return;
    }
    if (!shortcut || !('url' in shortcut) || !shortcut.url) {
      return;
    }
    openUrlFromNewtabCard(shortcut.url, {
      openInBackgroundTab: NAVIGATION_DISPOSITION.isBackgroundOpenEvent(event),
      openInOtherTab: Boolean(event && event.altKey),
      surface: 'shortcuts'
    });
  }

  // The add tile, while the grid shows one.
  function getAddShortcutButton(): HTMLButtonElement | null {
    return shortcutsView ? shortcutsView.getAddButton() : null;
  }

  // The dialog module loads on first use.
  function createShortcutDialogComponent(): Promise<ShortcutDialogController | null> {
    return createShortcutDialog({
      documentObj: document,
      windowObj: window,
      t,
      bindTooltip: bindShortcutDialogTooltip,
      hideTooltip: hideShortcutDialogTooltip,
      prepareIconFile: shortcutIconStore.prepareFile,
      getOnlineIconUrl: getShortcutDialogOnlineIconUrl,
      getOnlineIconSource: getShortcutDialogOnlineIconSource,
      getBuiltinIconUrl: getShortcutDialogBuiltinIconUrl,
      isIconSourceAvailable: isShortcutDialogIconSourceAvailable,
      refreshOnlineIcon: refreshShortcutDialogOnlineIcon,
      analyzeIcon: (image) => NEWTAB_SHORTCUT_ICON_PLATE.analyzeImage(image, { documentObj: document }),
      resolveIconPlate: NEWTAB_SHORTCUT_ICON_PLATE.resolvePlate,
      getIconPlateColorChoices: NEWTAB_SHORTCUT_ICON_PLATE.getPlateColorChoices,
      pickIconPlateColor: pickShortcutIconPlateColor,
      onSubmit(payload) {
        if (payload.itemType === 'group') {
          return saveShortcutGroupFromDialog(payload.title);
        }
        if (payload.itemType === SHORTCUT_DIALOG_ITEM_BOOKMARK ||
            payload.itemType === SHORTCUT_DIALOG_ITEM_FOLDER) {
          return saveBookmarkFromDialog(payload.title, payload.url, {
            itemType: payload.itemType,
            itemId: payload.itemId,
            shortcutId: payload.shortcutId,
            iconSource: payload.iconSource,
            iconAction: payload.iconAction,
            iconDataUrl: payload.iconDataUrl,
            onlineIcon: payload.onlineIcon
          });
        }
        return saveShortcutFromDialog(payload.title, payload.url, {
          mode: payload.mode,
          shortcutId: payload.shortcutId,
          iconAction: payload.iconAction,
          iconDataUrl: payload.iconDataUrl,
          iconSource: payload.iconSource,
          iconPlate: payload.iconPlate,
          iconPlateColor: payload.iconPlateColor
        }).then((saved) => {
          const onlineIcon = payload.onlineIcon;
          const pageUrl = ShortcutIconCache.normalizePageUrl(
            ShortcutNormalize.normalizeShortcutUrl(payload.url)
          );
          if (saved && onlineIcon && pageUrl && pageUrl === onlineIcon.pageUrl) {
            saveShortcutFaviconSnapshot(pageUrl, onlineIcon.dataUrl, onlineIcon.sourceUrl, true);
            renderShortcuts();
          }
          return saved;
        });
      }
    });
  }

  function setShortcutContextMenuMark(mark: ShortcutContextMenuMark | null): void {
    if (shortcutsView) {
      shortcutsView.setContextMenuMark(mark);
    }
  }


  // Folder shortcuts show what their bookmark folders hold.
  bookmarkSectionEvents.on('loaded', () => {
    if (shortcutList.items.some((shortcut) => shortcut.type === 'folder')) {
      renderShortcuts();
    }
  });
  return {
    openShortcutUrl,
    getAddShortcutButton,
    followStoredShortcutData,
    setShortcutContextMenuMark,
    getShortcutFolderId,
    getFolderItemIconUrl,
    getFolderItemIcon,
    getFolderItemIconForShortcut,
    updateFolderItemIcons,
    getVisibleShortcuts,
    refreshShortcutFolderReferences,
    getShortcutStoreOptions,
    isShortcutSyncStorageActive,
    scheduleShortcutStorageReload,
    getShortcutIconDataUrl,
    getShortcutFaviconDataUrl,
    getShortcutFaviconCandidateUrl,
    getShortcutTitle,
    renderShortcuts,
    flushDeferredShortcutRender,
    followNewtabShortcutPreferences,
    loadVisibleShortcuts,
    persistShortcuts,
    removeShortcutById,
    hasShortcutForSite,
    addSiteToShortcuts,
    hideShortcutAddFromContextMenu,
    createShortcutsSection,
    createShortcutDialogComponent,
    getShortcutGroups,
    isWebDavBackingUpShortcuts,
    isShortcutGroupLayoutActive,
    fitShortcutGroupColumns,
    getShortcutGroupDisplayTitle,
    openShortcutAddDialog,
    openShortcutGroupDialog,
    createShortcutGroup,
    renameShortcutGroup,
    moveShortcutGroup,
    moveShortcutGroupToIndex,
    deleteShortcutGroup,
    confirmDeleteShortcutGroupWithSites,
    applyShortcutGroupDeleteRecord
  };
}

type ShortcutsController = ReturnType<typeof createShortcutsController>;

export { createShortcutsController };
export type { ShortcutsController, ShortcutsControllerDeps };
