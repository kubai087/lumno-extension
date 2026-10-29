// The shortcuts and their groups: read from storage and kept in step with
// other pages, saved within the browser's sync space, and the changes the
// page makes to them, which tell the tiles through `shortcutEvents`.
import { getUndoShortcutLabels } from '../bookmarks/bookmark-drag-rules';
import * as LumnoShortcutStorage from '../../platform/shortcut-storage';
import { isRecord, isThenable } from '../../platform/storage-call';
import * as ShortcutConstants from '../../domain/shortcuts/constants';
import * as ShortcutNormalize from '../../domain/shortcuts/normalize';
import * as ShortcutStoragePlan from '../../domain/shortcuts/storage-plan';
import { getShortcutUrl, isShortcutFolder } from '../../domain/shortcuts/normalize';
import { DEFAULT_MAX_SHORTCUTS, DEFAULT_SHORTCUTS_SYNC_RESERVE_BYTES } from '../../domain/shortcuts/constants';
import { NEWTAB_SHORTCUT_LIST_SETTINGS, newtabShortcutIcons, newtabShortcutsLocalOverflow, shortcutFolderBindings } from '../../domain/settings/newtab-shortcuts';
import { webdavStatus } from '../../domain/settings/sync-state';
import * as NEWTAB_SHORTCUT_ICON_STORE from './shortcut-icon-store';
import * as NEWTAB_BOOKMARK_MOVE_HISTORY from '../bookmarks/bookmark-move-history';
import type { StorageAreaLike, StorageItems } from '../../domain/storage-port';
import type { ShortcutGroup, ShortcutItem, ShortcutLink, ShortcutNormalizeOptions, ShortcutState, VisibleShortcutItem } from '../../domain/shortcuts/types';
import type { FolderBindingRuntime } from '../../platform/bookmark-folder-bindings';
import type { ProviderStorageRuntime } from '../../platform/settings-storage';
import type { SettingsStore } from '../../platform/settings-store';
import type { BookmarkMoveHistory, ShortcutGroupDeleteRecord } from '../bookmarks/bookmark-move-history';
import type { BookmarksRuntime } from '../bookmarks/bookmarks-runtime';
import type { MoveHistoryLock } from '../bookmarks/move-history-lock';
import type { DragSessions } from '../drag-sessions';
import type { FormatMessage, ShowToast, Translate } from '../newtab-types';
import type { ShortcutFavicons } from './shortcut-favicons';
import type { ShortcutIconMap, ShortcutIconStore } from './shortcut-icon-store';
import type { ShortcutList } from './shortcut-list';
import type { PersistShortcuts, PersistShortcutsOptions, ShortcutIconChange, ShortcutSite } from './shortcut-types';
import { shortcutEvents } from './shortcut-events';

interface ShortcutDataDeps {
  settings: Pick<SettingsStore, 'get' | 'getStored' | 'include' | 'subscribe'>;
  storageArea: StorageAreaLike | null;
  providerStorageRuntime: Pick<ProviderStorageRuntime, 'getActiveAreaName'> | null;
  shortcutList: Pick<ShortcutList, 'icons' | 'items' | 'replaceIcons' | 'replaceItems'>;
  shortcutIconStore: Pick<ShortcutIconStore, 'readAll' | 'writeAll'>;
  shortcutFavicons: Pick<ShortcutFavicons, 'loadShortcutFavicons' | 'pruneShortcutFavicons'>;
  shortcutFolderRuntime: Pick<FolderBindingRuntime, 'ready' | 'flush' | 'getNode' | 'reconcile' | 'visibleItems'>;
  bookmarksRuntime: Pick<BookmarksRuntime, 'getNode' | 'getNodeMap' | 'getSnapshot' | 'ensureReady'>;
  bookmarkMoveHistory: Pick<BookmarkMoveHistory, 'push'>;
  historyLock: Pick<MoveHistoryLock, 'busy' | 'hold' | 'release'>;
  dragSessions: Pick<DragSessions, 'shortcutDragging'>;
  normalizeHost: NonNullable<ShortcutNormalizeOptions['normalizeHost']>;
  sanitizeDisplayText(text: unknown): string;
  t: Translate;
  formatMessage: FormatMessage;
  showToast: ShowToast;
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


function isIconChangeList(
  value: ShortcutIconChange | readonly ShortcutIconChange[]
): value is readonly ShortcutIconChange[] {
  return Array.isArray(value);
}

function createShortcutData(deps: ShortcutDataDeps) {
  const {
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
  } = deps;
  const { loadShortcutFavicons, pruneShortcutFavicons } = shortcutFavicons;

  // Shortcut saves still writing, which a storage change waits for.
  let shortcutPersistenceInFlightCount = 0;

  let shortcutStorageReloadTimer: number | null = null;
  // Groups and the migration time of the stored shortcut state; items live
  // in shortcutList.items.
  let shortcutGroups = ShortcutNormalize.getDefaultShortcutState().groups;
  let shortcutMigratedAt = 0;
  let shortcutStateTorn = false;

  let shortcutTornReloadCount = 0;
  const SHORTCUT_TORN_RELOAD_LIMIT = 3;
  const SHORTCUT_TORN_RELOAD_DELAY_MS = 1500;

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
        shortcutEvents.emit('stale', null);
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
      shortcutEvents.emit('stale', null);
    });
    settings.subscribe(shortcutFolderBindings, () => shortcutEvents.emit('stale', null));
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
          shortcutEvents.emit('changed', { animateLayout: false });
          return;
        }
        pruneShortcutFavicons(shortcutList.items);
        const prunedIcons = getNextShortcutIconMap(shortcutList.items);
        if (!areShortcutIconMapsEqual(shortcutList.icons, prunedIcons)) {
          shortcutList.replaceIcons(prunedIcons);
          shortcutIconStore.writeAll(prunedIcons).catch(() => {});
        }
        shortcutEvents.emit('changed', { animateLayout: false });
      });
    }, delayMs !== undefined && Number.isFinite(delayMs) ? delayMs : 32);
  }

  function getShortcutIconDataUrl(shortcutId: unknown): string {
    const id = String(shortcutId || '').trim();
    return id && shortcutList.icons[id] ? shortcutList.icons[id] : '';
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



  function loadVisibleShortcuts(): Promise<ShortcutItem[]> {
    return Promise.all([loadShortcuts(), loadShortcutIcons(), loadShortcutFavicons()]).then(() => {
      if (shortcutStateTorn) {
        shortcutEvents.emit('changed', { animateLayout: false });
        return shortcutList.items;
      }
      const prunedIcons = getNextShortcutIconMap(shortcutList.items);
      const shouldPrune = !areShortcutIconMapsEqual(shortcutList.icons, prunedIcons);
      pruneShortcutFavicons(shortcutList.items);
      shortcutList.replaceIcons(prunedIcons);
      shortcutEvents.emit('changed', { animateLayout: false });
      if (shouldPrune) {
        shortcutIconStore.writeAll(prunedIcons).catch(() => {});
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
        applyShortcutState(result.state);
        pruneShortcutFavicons(shortcutList.items);
        // Group changes and added or removed sites can re-center the grid;
        // those renders slide the tiles over instead of jumping.
        if (settings.render !== false) {
          shortcutEvents.emit('changed', { animateLayout: Boolean(settings.animateLayout) });
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
        shortcutEvents.emit('stale', null);
        if (didStartItemPersistence) {
          console.warn('[Lumno] Failed to save shortcuts', error);
          showToast(t('toast_error', 'Operation failed. Please try again.'), true);
        } else {
          shortcutEvents.emit('iconSaveFailed', null);
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
          { shortcut: getUndoShortcutLabels(navigator).undo }
        ));
      }
      return saved;
    }).finally(() => { historyLock.release(); });
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
          { shortcut: getUndoShortcutLabels(navigator).undo }
        ));
      }
      return saved;
    }).finally(() => { historyLock.release(); });
  }

  function getShortcutById(shortcutId: unknown): ShortcutItem | null {
    const id = String(shortcutId || '');
    return id ? shortcutList.items.find((item) => item && item.id === id) || null : null;
  }

  return {
    getShortcutById,
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
    isShortcutGroupLayoutActive,
    getLastShortcutGroupId,
    getShortcutGroupDisplayTitle,
    showGroupLimitToast,
    createShortcutLinkRecord,
    createShortcutGroup,
    renameShortcutGroup,
    moveShortcutGroup,
    moveShortcutGroupToIndex,
    deleteShortcutGroup,
    applyShortcutGroupDeleteRecord,
    hasShortcutForSite,
    addSiteToShortcuts,
    removeShortcutById
  };
}

type ShortcutData = ReturnType<typeof createShortcutData>;

export { createShortcutData };
export type { ShortcutData, ShortcutDataDeps };
