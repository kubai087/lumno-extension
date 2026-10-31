// The recent-tab stack and its thumbnails: kept in the worker, restored on
// wake and saved after a short debounce.
import { getTabSwitcherHeadSignature, getThumbnailPersistSignature, readTabSwitcherThumbnailStatus } from '../../domain/tab-switcher-model';
import { tabSwitcherThumbnail, tabSwitcherThumbnails } from '../../domain/settings/features';
import { getResolvedTabUrl, isBrowserInternalUrl } from '../browser-urls-service';
import { warnBackgroundFailure, workerSettings } from '../worker-context';
import { isFirefoxPrivilegedPageUrl } from './appearance';
import { TAB_SWITCHER_LIMIT, isRecord } from './types';
import type { SwitcherTab } from './types';
import * as RecentTabTracker from '../recent-tabs/tracker';
import type { ThumbnailState, TrackerState } from '../recent-tabs/types';

function shouldTrackSwitcherTab(tab: SwitcherTab | null | undefined): boolean {
  if (!tab || typeof tab.id !== 'number' || typeof tab.windowId !== 'number' || tab.incognito === true) {
    return false;
  }
  const url = getResolvedTabUrl(tab);
  if (!url) {
    return false;
  }
  if (isBrowserInternalUrl(url)) {
    return true;
  }
  try {
    const parsed = new URL(url);
    const protocol = String(parsed.protocol || '').toLowerCase();
    return Boolean(protocol) && protocol !== 'javascript:';
  } catch (_error) {
    return false;
  }
}

const TAB_SWITCHER_THUMBNAIL_LIMIT = 12;

const TAB_SWITCHER_THUMBNAIL_TTL_MS = 1000 * 60 * 60 * 2;

const TAB_SWITCHER_THUMBNAIL_PERSIST_DEBOUNCE_MS = 350;

// Recent-tab switcher state: hydrated from storage on wake, written after a
// short debounce. That timer is what saves the state: Chrome does not reliably
// dispatch runtime.onSuspend to MV3 service workers (an idle worker lives far
// longer than the debounce anyway), while Firefox's event pages do get it, so
// the onSuspend flush only covers an event page unloaded with a write pending.
let tabSwitcherStateLoaded = false;

let tabSwitcherStateLoadPromise: Promise<boolean> | null = null;

let tabSwitcherStatePersistTimer: ReturnType<typeof setTimeout> | null = null;

let tabSwitcherStateDirtyBeforeLoad = false;

const recentTabTracker = RecentTabTracker.createRecentTabTracker({
  limit: TAB_SWITCHER_LIMIT,
  thumbnailLimit: TAB_SWITCHER_THUMBNAIL_LIMIT,
  thumbnailTtlMs: TAB_SWITCHER_THUMBNAIL_TTL_MS,
  shouldIncludeTab: shouldTrackSwitcherTab
});


// The switcher state is saved as one small record (the recent-tab stack and
// which tabs have thumbnails) plus one key per thumbnail, and a save writes
// only the keys that changed. Saving every thumbnail on each tab switch
// rewrote ~150 KB, and storage.onChanged delivered the old and new copies to
// every open extension page.
let persistedTabSwitcherHeadSignature = '';
const persistedThumbnailSignatureByTabId = new Map<number, string>();


// The stored state as saved; the tracker checks it as it hydrates.
async function getTabSwitcherStateFromStorage(): Promise<Record<string, unknown> | null> {
  await workerSettings.ready;
  const head = workerSettings.getStored(tabSwitcherThumbnails);
  if (!isRecord(head)) {
    return null;
  }
  // A state saved before the split keeps its thumbnails inline.
  if (Array.isArray(head.thumbnails)) {
    return head;
  }
  const storedTabIds: unknown[] = Array.isArray(head.thumbnailTabIds) ? head.thumbnailTabIds : [];
  const thumbnailTabIds = storedTabIds.filter((tabId) => Number.isInteger(tabId));
  const thumbnailResult = await workerSettings.readMembers(tabSwitcherThumbnail, thumbnailTabIds.map(String))
    .catch(() => new Map<string, unknown>());
  const thumbnails = thumbnailTabIds
    .map((tabId) => thumbnailResult.get(String(tabId)))
    .filter(isRecord);
  persistedTabSwitcherHeadSignature = getTabSwitcherHeadSignature(head);
  persistedThumbnailSignatureByTabId.clear();
  thumbnails.forEach((entry) => {
    if (typeof entry.tabId === 'number') {
      persistedThumbnailSignatureByTabId.set(entry.tabId, getThumbnailPersistSignature(entry));
    }
  });
  return { ...head, thumbnails };
}

function setTabSwitcherStateToStorage(state: TrackerState): Promise<boolean> {
  if (!state) {
    return Promise.resolve(false);
  }
  const thumbnails = Array.isArray(state.thumbnails) ? state.thumbnails : [];
  const head = {
    version: state.version,
    savedAt: state.savedAt,
    stack: state.stack,
    thumbnailTabIds: thumbnails.map((entry) => entry.tabId)
  };
  const headSignature = getTabSwitcherHeadSignature(head);
  const thumbnailWrites = new Map<string, unknown>();
  const nextSignatures = new Map<number, string>();
  thumbnails.forEach((entry) => {
    const signature = getThumbnailPersistSignature(entry);
    nextSignatures.set(entry.tabId, signature);
    if (persistedThumbnailSignatureByTabId.get(entry.tabId) !== signature) {
      thumbnailWrites.set(String(entry.tabId), entry);
    }
  });
  const headChanged = headSignature !== persistedTabSwitcherHeadSignature;
  const removals = Array.from(persistedThumbnailSignatureByTabId.keys())
    .filter((tabId) => !nextSignatures.has(tabId));
  if (!thumbnailWrites.size && !headChanged && !removals.length) {
    return Promise.resolve(true);
  }
  return Promise.all([
    workerSettings.writeMembers(tabSwitcherThumbnail, thumbnailWrites),
    headChanged ? workerSettings.set(tabSwitcherThumbnails, head) : Promise.resolve()
  ]).then(() => {
    persistedTabSwitcherHeadSignature = headSignature;
    persistedThumbnailSignatureByTabId.clear();
    nextSignatures.forEach((signature, tabId) => {
      persistedThumbnailSignatureByTabId.set(tabId, signature);
    });
    return workerSettings.removeMembers(tabSwitcherThumbnail, removals).then(() => true, () => false);
  }, () => false);
}

function ensureTabSwitcherStateLoaded(): Promise<boolean> {
  if (tabSwitcherStateLoaded) {
    return Promise.resolve(true);
  }
  if (tabSwitcherStateLoadPromise) {
    return tabSwitcherStateLoadPromise;
  }
  tabSwitcherStateLoadPromise = getTabSwitcherStateFromStorage()
    .then((state) => {
      if (state) {
        recentTabTracker.hydrateState(state, {
          merge: tabSwitcherStateDirtyBeforeLoad === true
        });
      }
      tabSwitcherStateLoaded = true;
      if (tabSwitcherStateDirtyBeforeLoad) {
        schedulePersistTabSwitcherState();
      }
      return true;
    })
    .catch(() => {
      tabSwitcherStateLoaded = true;
      return false;
    })
    .finally(() => {
      tabSwitcherStateLoadPromise = null;
      tabSwitcherStateDirtyBeforeLoad = false;
    });
  return tabSwitcherStateLoadPromise;
}

// Saves run one at a time, each writing the state as it is when it starts.
// A save works out what to remove from what the save before it wrote, so a
// second save started meanwhile could leave a dropped thumbnail stored.
let tabSwitcherStatePersistQueue: Promise<unknown> = Promise.resolve();

function persistTabSwitcherState(): Promise<boolean> {
  tabSwitcherStatePersistTimer = null;
  if (!tabSwitcherStateLoaded) {
    // Writing now would replace the stored state with only this wake's
    // changes; the load merges them and schedules the write itself.
    return Promise.resolve(false);
  }
  const save = tabSwitcherStatePersistQueue.then(() => setTabSwitcherStateToStorage(recentTabTracker.exportState()));
  tabSwitcherStatePersistQueue = save.catch(() => {});
  return save;
}

function schedulePersistTabSwitcherState(): void {
  if (!tabSwitcherStateLoaded) {
    tabSwitcherStateDirtyBeforeLoad = true;
  }
  if (tabSwitcherStatePersistTimer !== null) {
    clearTimeout(tabSwitcherStatePersistTimer);
  }
  tabSwitcherStatePersistTimer = setTimeout(() => {
    persistTabSwitcherState().catch(warnBackgroundFailure('Failed to save the recent-tab switcher state.'));
  }, TAB_SWITCHER_THUMBNAIL_PERSIST_DEBOUNCE_MS);
}

function flushPendingTabSwitcherState(): Promise<boolean> {
  if (tabSwitcherStatePersistTimer === null || !tabSwitcherStateLoaded) {
    return Promise.resolve(false);
  }
  clearTimeout(tabSwitcherStatePersistTimer);
  tabSwitcherStatePersistTimer = null;
  return persistTabSwitcherState().catch((error: unknown) => {
    warnBackgroundFailure('Failed to save the recent-tab switcher state.')(error);
    return false;
  });
}

function recordRecentSwitcherTab(tab: chrome.tabs.Tab | null | undefined, at?: number): ReturnType<typeof recentTabTracker.recordTab> {
  const snapshot = recentTabTracker.recordTab(tab, at);
  if (snapshot) {
    schedulePersistTabSwitcherState();
  }
  return snapshot;
}

function updateRecentSwitcherTab(tab: chrome.tabs.Tab | null | undefined, at?: number): ReturnType<typeof recentTabTracker.updateTab> {
  const snapshot = recentTabTracker.updateTab(tab, at);
  if (snapshot) {
    schedulePersistTabSwitcherState();
  }
  return snapshot;
}


function getSwitcherThumbnailStateForPayload(tab: SwitcherTab & { id: number }, url: string): ThumbnailState {
  // Also drops blurred captures saved before such pages were skipped.
  if (isFirefoxPrivilegedPageUrl(url)) {
    return { status: 'restricted', reason: 'restricted-browser-page', dataUrl: '', capturedAt: 0, updatedAt: 0 };
  }
  const status = readTabSwitcherThumbnailStatus(tab._xSwitcherThumbnailStatus);
  if (status) {
    return {
      status,
      reason: typeof tab._xSwitcherThumbnailReason === 'string' ? tab._xSwitcherThumbnailReason : '',
      dataUrl: typeof tab._xSwitcherThumbnail === 'string' ? tab._xSwitcherThumbnail : '',
      capturedAt: 0,
      updatedAt: 0
    };
  }
  return recentTabTracker.getThumbnailState(tab.id, url);
}

function markSwitcherThumbnailStatus(tab: SwitcherTab | null | undefined, status: string, requestReason: string, failureReason: string): boolean {
  if (!tab || typeof tab.id !== 'number') {
    return false;
  }
  const didSet = recentTabTracker.setThumbnailStatus(tab.id, status, Date.now(), {
    url: getResolvedTabUrl(tab),
    reason: failureReason || requestReason || ''
  });
  if (didSet) {
    schedulePersistTabSwitcherState();
  }
  return didSet;
}

// Saves now whatever is pending, dropping a scheduled save.
function persistTabSwitcherStateNow(): Promise<boolean> {
  if (tabSwitcherStatePersistTimer !== null) {
    clearTimeout(tabSwitcherStatePersistTimer);
  }
  return persistTabSwitcherState();
}

export {
  ensureTabSwitcherStateLoaded,
  flushPendingTabSwitcherState,
  getSwitcherThumbnailStateForPayload,
  markSwitcherThumbnailStatus,
  persistTabSwitcherStateNow,
  recentTabTracker,
  recordRecentSwitcherTab,
  schedulePersistTabSwitcherState,
  shouldTrackSwitcherTab,
  updateRecentSwitcherTab
};
