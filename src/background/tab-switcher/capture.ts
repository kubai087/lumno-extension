// Thumbnails of the recent tabs: captured once a tab settles as the active
// tab of a focused window, with the open switcher hidden from the shot, a few
// at a time within Chrome's capture rate limit.
import { isSwitcherThumbnailRefreshNeeded, getSwitcherThumbnailStatusForFailureReason } from '../../domain/tab-switcher-model';
import { tabSwitcherEnabled } from '../../domain/settings/features';
import { getResolvedTabUrl } from '../browser-urls-service';
import { areBackgroundSettingsLoaded, logHotkeyDebug, warnBackgroundFailure, whenBackgroundSettingsReady, workerSettings } from '../worker-context';
import { canCaptureSwitcherThumbnail, getSwitcherThumbnailCaptureFailureReason } from './capture-rules';
import { getOpenTabSwitcherState, postTabSwitcherThumbnailUpdate, setTabSwitcherCaptureVisibility } from './host';
import { isTabSwitcherOpening } from './opening';
import {
  ensureTabSwitcherStateLoaded,
  getSwitcherThumbnailStateForPayload,
  markSwitcherThumbnailStatus,
  persistTabSwitcherStateNow,
  recentTabTracker,
  schedulePersistTabSwitcherState
} from './state-store';
import { prepareSwitcherThumbnailDataUrl } from './thumbnail-image';
import {
  clearAllSwitcherThumbnailPriorities,
  clearSwitcherThumbnailPriority,
  consumeSwitcherThumbnailPriority
} from './thumbnail-priority';
import { getErrorMessage } from './types';
import type { CaptureRequest, CaptureResult, SwitcherTab } from './types';

function waitForTabSwitcherCapturePaint(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, TAB_SWITCHER_CAPTURE_HIDE_PAINT_WAIT_MS);
  });
}

function withTabSwitcherHiddenForCapture<T>(tab: SwitcherTab, capture: () => Promise<T>): Promise<T> {
  const runCapture = capture;
  return setTabSwitcherCaptureVisibility(tab, true)
    .catch(() => false)
    .then(() => waitForTabSwitcherCapturePaint())
    .then(() => runCapture())
    .finally(() => setTabSwitcherCaptureVisibility(tab, false));
}

// Background captures (tab activation, window focus, load complete) wait for
// the tab to stay active this long, so cycling through tabs with Ctrl+Tab or a
// held Alt+Q captures only the tab the user stops on.
const TAB_SWITCHER_CAPTURE_SETTLE_MS = 800;

// An activation or window focus does not re-capture a tab whose thumbnail of
// the same URL is younger than this; a finished load always re-captures.
const TAB_SWITCHER_THUMBNAIL_FRESH_MS = 60 * 1000;

const TAB_SWITCHER_CAPTURE_REASON_LOAD_COMPLETE = 'updated-complete';

// Opening the switcher waits at most this long for a fresh shot of the
// current tab; a slower capture is patched into the open switcher.
const TAB_SWITCHER_OPEN_CAPTURE_BUDGET_MS = 120;

const TAB_SWITCHER_CAPTURE_HIDE_PAINT_WAIT_MS = 48;

const TAB_SWITCHER_CAPTURE_MIN_INTERVAL_MS = 650;

const TAB_SWITCHER_CAPTURE_JPEG_QUALITY = 42;

const TAB_SWITCHER_CAPTURE_REASON_COMMAND_IMMEDIATE = 'command-immediate';

// Thumbnail capture scheduling; pending captures are simply retried on the
// next activation.
const tabSwitcherThumbnailTimersByTabId = new Map<number, ReturnType<typeof setTimeout>>();

let tabSwitcherThumbnailCaptureChain: Promise<boolean> = Promise.resolve(false);

let tabSwitcherLastCaptureAt = 0;

// Opening the switcher takes a fresh shot of the current tab, unless the page
// is still loading or Chrome's two-captures-per-second limit would refuse it.
function shouldPreCaptureActiveSwitcherThumbnailBeforePayload(tab: chrome.tabs.Tab): boolean {
  const isActive = tab && tab.active === true;
  if (!isActive || tab.status === 'loading' || !canCaptureSwitcherThumbnail(tab) || typeof tab.id !== 'number') {
    return false;
  }
  const state = getSwitcherThumbnailStateForPayload({ ...tab, id: tab.id }, getResolvedTabUrl(tab));
  if (state && state.status === 'restricted') {
    return false;
  }
  return (Date.now() - tabSwitcherLastCaptureAt) >= TAB_SWITCHER_CAPTURE_MIN_INTERVAL_MS ||
    isSwitcherThumbnailRefreshNeeded(state);
}

function waitForSwitcherOpenCapture(captureReady: Promise<boolean>): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, TAB_SWITCHER_OPEN_CAPTURE_BUDGET_MS);
    Promise.resolve(captureReady).catch(() => false).then(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function logSwitcherThumbnailCaptureFailure(tab: SwitcherTab | null | undefined, failureReason: string, requestReason: string): void {
  markSwitcherThumbnailStatus(tab, getSwitcherThumbnailStatusForFailureReason(failureReason), requestReason, failureReason);
  logHotkeyDebug('tab-switcher-thumbnail-failed', {
    tabId: tab && typeof tab.id === 'number' ? tab.id : null,
    windowId: tab && typeof tab.windowId === 'number' ? tab.windowId : null,
    url: getResolvedTabUrl(tab),
    reason: failureReason || 'unknown',
    requestReason: requestReason || ''
  });
}

function logSwitcherThumbnailCaptureSuccess(tab: SwitcherTab, requestReason: string): void {
  logHotkeyDebug('tab-switcher-thumbnail-captured', {
    tabId: tab && typeof tab.id === 'number' ? tab.id : null,
    windowId: tab && typeof tab.windowId === 'number' ? tab.windowId : null,
    url: getResolvedTabUrl(tab),
    requestReason: requestReason || ''
  });
}

function waitForSwitcherThumbnailCaptureSlot(): Promise<void> {
  const sinceLast = Date.now() - tabSwitcherLastCaptureAt;
  const waitMs = Math.max(0, TAB_SWITCHER_CAPTURE_MIN_INTERVAL_MS - sinceLast);
  if (waitMs <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, waitMs);
  });
}

function clearScheduledSwitcherThumbnailCapture(tabId: unknown): void {
  if (typeof tabId !== 'number') {
    return;
  }
  const timer = tabSwitcherThumbnailTimersByTabId.get(tabId);
  if (timer !== undefined) {
    clearTimeout(timer);
    tabSwitcherThumbnailTimersByTabId.delete(tabId);
  }
}

function enqueueSwitcherThumbnailCapture(tab: chrome.tabs.Tab, reason: string): Promise<boolean> {
  markSwitcherThumbnailStatus(tab, 'pending', reason, '');
  const runCapture = () => waitForSwitcherThumbnailCaptureSlot()
    .then(() => captureSwitcherThumbnailForTab(tab, reason));
  const queued = tabSwitcherThumbnailCaptureChain
    .catch(() => false)
    .then(runCapture);
  tabSwitcherThumbnailCaptureChain = queued.catch(() => false);
  return queued;
}

function isSwitcherCommandCaptureReason(reason: unknown): boolean {
  const requestReason = String(reason || '');
  return requestReason === TAB_SWITCHER_CAPTURE_REASON_COMMAND_IMMEDIATE;
}

function shouldSkipSwitcherThumbnailCaptureForOpenSwitcher(tab: SwitcherTab, reason: string): Promise<boolean> {
  if (isSwitcherCommandCaptureReason(reason)) {
    return Promise.resolve(false);
  }
  if (isTabSwitcherOpening(tab)) {
    return Promise.resolve(true);
  }
  return getOpenTabSwitcherState(tab)
    .then((state) => Boolean(state && state.open === true))
    .catch(() => false);
}

// A shot of the window's visible tab.
function captureVisibleTabImage(windowId: number): Promise<CaptureResult> {
  return new Promise<CaptureResult>((resolve) => {
    try {
      chrome.tabs.captureVisibleTab(windowId, {
        format: 'jpeg',
        quality: TAB_SWITCHER_CAPTURE_JPEG_QUALITY
      }, (dataUrl) => {
        const lastError = chrome.runtime && chrome.runtime.lastError;
        if (lastError) {
          resolve({ ok: false, reason: lastError.message || 'capture-visible-tab-failed' });
          return;
        }
        resolve({ ok: true, dataUrl });
      });
    } catch (error) {
      resolve({ ok: false, reason: getErrorMessage(error, 'capture-visible-tab-threw') });
    }
  });
}

// Keeps a captured shot as the tab's thumbnail; an open switcher that asked
// for it is updated at once. Resolves to whether it was kept.
function storeCapturedThumbnail(resolvedTab: chrome.tabs.Tab, tabId: number, dataUrl: string, reason: string): Promise<boolean> {
  return prepareSwitcherThumbnailDataUrl(dataUrl).then((thumbnailDataUrl) => {
    if (!thumbnailDataUrl) {
      logSwitcherThumbnailCaptureFailure(resolvedTab, 'empty-thumbnail-data', reason);
      return false;
    }
    // Turning the switcher off while this shot was taken has dropped the
    // thumbnails already; this one must not come back after them.
    if (!workerSettings.get(tabSwitcherEnabled)) {
      logSwitcherThumbnailCaptureFailure(resolvedTab, 'switcher-disabled', reason);
      return false;
    }
    const resolvedTabId = typeof resolvedTab.id === 'number' ? resolvedTab.id : tabId;
    const didSet = recentTabTracker.setThumbnail(resolvedTabId, thumbnailDataUrl, Date.now(), {
      url: getResolvedTabUrl(resolvedTab)
    });
    if (!didSet) {
      logSwitcherThumbnailCaptureFailure(resolvedTab, 'thumbnail-cache-rejected', reason);
      return false;
    }
    schedulePersistTabSwitcherState();
    if (isSwitcherCommandCaptureReason(reason)) {
      // The switcher may have closed or its tab navigated meanwhile.
      postTabSwitcherThumbnailUpdate(resolvedTab, {
        tabId: resolvedTabId,
        url: getResolvedTabUrl(resolvedTab),
        thumbnail: thumbnailDataUrl,
        thumbnailStatus: 'ok',
        thumbnailReason: ''
      }).catch(() => {});
    }
    logSwitcherThumbnailCaptureSuccess(resolvedTab, reason);
    return true;
  }, () => {
    logSwitcherThumbnailCaptureFailure(resolvedTab, 'prepare-thumbnail-failed', reason);
    return false;
  });
}

function captureSwitcherThumbnailForTab(tab: chrome.tabs.Tab, reason: string): Promise<boolean> {
  const tabId = tab && typeof tab.id === 'number' ? tab.id : null;
  const windowId = tab && typeof tab.windowId === 'number' ? tab.windowId : null;
  clearScheduledSwitcherThumbnailCapture(tabId);
  if (typeof tabId !== 'number' || typeof windowId !== 'number') {
    logSwitcherThumbnailCaptureFailure(tab, 'invalid-tab', reason);
    return Promise.resolve(false);
  }
  if (!chrome || !chrome.tabs || typeof chrome.tabs.captureVisibleTab !== 'function') {
    logSwitcherThumbnailCaptureFailure(tab, 'capture-api-unavailable', reason);
    return Promise.resolve(false);
  }
  const captureResolvedTab = (resolvedTab: chrome.tabs.Tab): Promise<boolean> => new Promise((resolve) => {
    const failureReason = getSwitcherThumbnailCaptureFailureReason(resolvedTab);
    if (failureReason) {
      logSwitcherThumbnailCaptureFailure(resolvedTab || tab, failureReason, reason);
      resolve(false);
      return;
    }
    if (!resolvedTab || resolvedTab.active !== true) {
      logSwitcherThumbnailCaptureFailure(resolvedTab || tab, 'inactive-tab', reason);
      resolve(false);
      return;
    }
    shouldSkipSwitcherThumbnailCaptureForOpenSwitcher(resolvedTab, reason).then((shouldSkip) => {
      if (shouldSkip) {
        logSwitcherThumbnailCaptureFailure(resolvedTab, 'tab-switcher-open', reason);
        resolve(false);
        return;
      }
      tabSwitcherLastCaptureAt = Date.now();
      withTabSwitcherHiddenForCapture(resolvedTab, () => captureVisibleTabImage(windowId)).then((captureResult) => {
        if (!captureResult || !('dataUrl' in captureResult)) {
          logSwitcherThumbnailCaptureFailure(
            resolvedTab,
            captureResult && 'reason' in captureResult && captureResult.reason ? captureResult.reason : 'capture-visible-tab-failed',
            reason
          );
          resolve(false);
          return;
        }
        storeCapturedThumbnail(resolvedTab, tabId, captureResult.dataUrl, reason).then(resolve);
      }).catch(() => {
        logSwitcherThumbnailCaptureFailure(resolvedTab, 'capture-visible-tab-failed', reason);
        resolve(false);
      });
    }).catch(() => {
      logSwitcherThumbnailCaptureFailure(resolvedTab, 'tab-switcher-open-state-failed', reason);
      resolve(false);
    });
  });
  if (typeof chrome.tabs.get !== 'function') {
    return captureResolvedTab(tab);
  }
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (freshTab) => {
      const lastError = chrome.runtime && chrome.runtime.lastError;
      if (lastError) {
        logSwitcherThumbnailCaptureFailure(tab, lastError.message || 'tabs-get-failed', reason);
        resolve(false);
        return;
      }
      captureResolvedTab(freshTab || tab).then(resolve).catch(() => {
        resolve(false);
      });
    });
  });
}

function hasFreshSwitcherThumbnail(tab: SwitcherTab, now: number): boolean {
  if (typeof tab.id !== 'number') {
    return false;
  }
  const state = recentTabTracker.getThumbnailState(tab.id, getResolvedTabUrl(tab));
  const capturedAt = Number(state && state.capturedAt) || 0;
  // getThumbnailState drops the image when the tab's URL changed since.
  return Boolean(state && state.dataUrl) &&
    capturedAt > 0 &&
    (now - capturedAt) < TAB_SWITCHER_THUMBNAIL_FRESH_MS;
}

function isSwitcherThumbnailCaptureWanted(tab: SwitcherTab, reason: string, now: number): boolean {
  return reason === TAB_SWITCHER_CAPTURE_REASON_LOAD_COMPLETE ||
    !hasFreshSwitcherThumbnail(tab, now);
}

function isSwitcherWindowFocused(windowId: number): Promise<boolean> {
  if (!chrome.windows || typeof chrome.windows.get !== 'function') {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    try {
      chrome.windows.get(windowId, (win) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          resolve(false);
          return;
        }
        resolve(Boolean(win && win.focused !== false));
      });
    } catch (_error) {
      resolve(false);
    }
  });
}

// Re-checked when the settle timer fires: the tab must still be the active tab
// of a focused window, on a URL whose thumbnail is still wanted.
function getSettledSwitcherCaptureTab(request: CaptureRequest): Promise<chrome.tabs.Tab | null> {
  if (!workerSettings.get(tabSwitcherEnabled) || typeof chrome.tabs.get !== 'function') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    chrome.tabs.get(request.tabId, (freshTab) => {
      if ((chrome.runtime && chrome.runtime.lastError) ||
          !freshTab ||
          freshTab.active !== true ||
          freshTab.windowId !== request.windowId ||
          !canCaptureSwitcherThumbnail(freshTab) ||
          !isSwitcherThumbnailCaptureWanted(freshTab, request.reason, Date.now())) {
        resolve(null);
        return;
      }
      isSwitcherWindowFocused(freshTab.windowId).then((focused) => {
        resolve(focused ? freshTab : null);
      });
    });
  });
}

function scheduleSwitcherThumbnailCapture(tab: chrome.tabs.Tab, reason: string): void {
  if (!areBackgroundSettingsLoaded()) {
    whenBackgroundSettingsReady(() => {
      scheduleSwitcherThumbnailCapture(tab, reason);
    });
    return;
  }
  // Thumbnails exist only for the switcher's previews.
  if (!workerSettings.get(tabSwitcherEnabled)) {
    return;
  }
  if (!canCaptureSwitcherThumbnail(tab)) {
    logSwitcherThumbnailCaptureFailure(tab, getSwitcherThumbnailCaptureFailureReason(tab), reason);
    return;
  }
  if (!chrome || !chrome.tabs || typeof chrome.tabs.captureVisibleTab !== 'function') {
    logSwitcherThumbnailCaptureFailure(tab, 'capture-api-unavailable', reason);
    return;
  }
  const requestReason = String(reason || '');
  const now = Date.now();
  if (!isSwitcherThumbnailCaptureWanted(tab, requestReason, now)) {
    return;
  }
  const tabId = tab.id;
  if (typeof tabId !== 'number') {
    return;
  }
  const hasPriority = consumeSwitcherThumbnailPriority(tab, requestReason);
  clearScheduledSwitcherThumbnailCapture(tabId);
  const request: CaptureRequest = {
    tabId,
    windowId: tab.windowId,
    reason: requestReason,
    captureReason: hasPriority ? `priority-${requestReason || 'visible'}` : requestReason,
    requestedAt: now
  };
  const timer = setTimeout(() => {
    tabSwitcherThumbnailTimersByTabId.delete(request.tabId);
    getSettledSwitcherCaptureTab(request).then((settledTab) => {
      if (!settledTab) {
        return;
      }
      // Capture failures are already logged by captureSwitcherThumbnailForTab.
      enqueueSwitcherThumbnailCapture(settledTab, request.captureReason).catch(() => {});
    }).catch(() => {});
  }, TAB_SWITCHER_CAPTURE_SETTLE_MS);
  tabSwitcherThumbnailTimersByTabId.set(tabId, timer);
}

function clearSwitcherThumbnailsForDisabledSwitcher(): Promise<boolean | void> {
  tabSwitcherThumbnailTimersByTabId.forEach((timer) => clearTimeout(timer));
  tabSwitcherThumbnailTimersByTabId.clear();
  clearAllSwitcherThumbnailPriorities();
  return ensureTabSwitcherStateLoaded().catch(() => false).then(() => {
    if (!recentTabTracker.clearThumbnails()) {
      return false;
    }
    return persistTabSwitcherStateNow();
  }).catch(warnBackgroundFailure('Failed to clear the recent-tab switcher thumbnails.'));
}

// Turning the switcher off drops the thumbnails it kept.
workerSettings.subscribe(tabSwitcherEnabled, () => {
  if (!workerSettings.get(tabSwitcherEnabled)) {
    void clearSwitcherThumbnailsForDisabledSwitcher();
  }
});

function removeRecentSwitcherTab(tabId: number): void {
  clearSwitcherThumbnailPriority(tabId);
  if (recentTabTracker.removeTab(tabId)) {
    schedulePersistTabSwitcherState();
  }
}

export {
  TAB_SWITCHER_CAPTURE_REASON_COMMAND_IMMEDIATE,
  captureSwitcherThumbnailForTab,
  clearScheduledSwitcherThumbnailCapture,
  removeRecentSwitcherTab,
  scheduleSwitcherThumbnailCapture,
  shouldPreCaptureActiveSwitcherThumbnailBeforePayload,
  waitForSwitcherOpenCapture
};
