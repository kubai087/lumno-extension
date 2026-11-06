// Opening the search overlay on a tab: the per-tab opening guard, injecting the
// overlay runtime and its stylesheets, handing it the tab list and settings,
// and the fallbacks for pages the overlay cannot run on.

import * as OVERLAY_LOADING_LIFECYCLE from './overlay-loading-lifecycle';
import { createInjectedAppRun } from '../platform/injection';
import { OVERLAY_HOST_ID } from '../domain/injected-commands';
import type { OverlayToggleCommand } from '../domain/injected-commands';
import { openBrowserNewtabFallback, openNewtabFallback, openNewtabFallbackForUrl } from './newtab-fallback';
import {
  getRestrictedAction,
  ignoreExpectedChromeError,
  isDocumentPipEnabled,
  logHotkeyDebug,
  whenBackgroundSettingsReady
} from './worker-context';
import * as LumnoMessaging from '../platform/messaging';
import { loadSiteSearchProviders, siteSearchCache } from './search/site-search-providers';
import {
  canOpenOverlayOnUrl,
  getResolvedTabUrl,
  isBrowserNewtabUrl,
  isLumnoNewtabUrl
} from './browser-urls-service';
import {
  getOverlayPrefillQueryForSource,
  isSearchCommandSource,
  recoverOverlayTargetFromCommandNewtab,
  requestFocusVisibleNewtabInput,
  shouldIgnoreDuplicateHotkey,
  shouldTriggerOnboardingOverlayFromCommand,
  triggerOnboardingOverlayFromCommand
} from './command-context';
import type { OverlayOpenContext } from '../domain/messages';
import type { OpenOverlayOptions, TargetTab, TrackedLoadingRecord } from './overlay-types';
import {
  getPendingOverlayNavigationUrl,
  overlayLoadingRecordsByTabId,
  rememberOverlayLoadingRecord,
  rememberOverlayPendingNavigationIntent,
  shouldDeferRestrictedOverlayNavigation
} from './overlay-loading-records';
import {
  finishOverlayLoadingOpenAttempt,
  scheduleOverlayLoadingPreCompleteRetry,
  setOverlayReopener,
  updateOverlayLoadingRecordFromInvocation
} from './overlay-loading-service';
import { scheduleSiteSearchProviderIconWarmup } from './favicon/site-search-icons';

// The overlay being opened on a tab; a second open meanwhile is ignored.
interface OverlayOpening {
  tabId: number;
  source: string;
  startedAt: number;
  timer: ReturnType<typeof setTimeout> | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

const OVERLAY_OPENING_GUARD_MS = 5000;
export { OVERLAY_HOST_ID };
export const overlayOpeningByTabId = new Map<number, OverlayOpening>();
let tabOverlayFetchSeq = 0;

// Numbers each tab list handed to an overlay, so it can drop stale ones.
export function nextTabOverlayFetchSeq(): number {
  tabOverlayFetchSeq += 1;
  return tabOverlayFetchSeq;
}

export function finishOverlayOpening(opening: OverlayOpening | null | undefined): void {
  if (!opening || typeof opening.tabId !== 'number') {
    return;
  }
  if (opening.timer) {
    clearTimeout(opening.timer);
    opening.timer = null;
  }
  if (overlayOpeningByTabId.get(opening.tabId) === opening) {
    overlayOpeningByTabId.delete(opening.tabId);
  }
}

function beginOverlayOpening(tab: TargetTab, source: string): OverlayOpening | null {
  if (!tab || typeof tab.id !== 'number') {
    return null;
  }
  const existing = overlayOpeningByTabId.get(tab.id);
  if (existing) {
    logHotkeyDebug('overlay-opening-guarded', {
      tabId: tab.id,
      source: source || '',
      age: Date.now() - existing.startedAt
    });
    return null;
  }
  const opening: OverlayOpening = {
    tabId: tab.id,
    source: source || '',
    startedAt: Date.now(),
    timer: null
  };
  opening.timer = setTimeout(() => {
    finishOverlayOpening(opening);
  }, OVERLAY_OPENING_GUARD_MS);
  overlayOpeningByTabId.set(tab.id, opening);
  return opening;
}

function openRestrictedOverlayFallback(activeTab: TargetTab, activeUrl: string, source: string): void {
  const action = getRestrictedAction();
  logHotkeyDebug('restricted-url', {
    action: action,
    url: activeUrl,
    source: source || ''
  });
  if (action === 'none') {
    logHotkeyDebug('fallback-open-browser-newtab', { reason: 'restricted_url', source: source || '' });
    openBrowserNewtabFallback({ sourceTab: activeTab });
    return;
  }
  if (action === 'default') {
    logHotkeyDebug('fallback-open-create-newtab', { reason: 'restricted_url', source: source || '' });
    openNewtabFallbackForUrl(activeUrl, { sourceTab: activeTab });
    return;
  }
  logHotkeyDebug('fallback-open-lumno-newtab', { reason: 'restricted_url', source: source || '' });
  openNewtabFallbackForUrl(activeUrl, { sourceTab: activeTab });
}

// Some pages pass the URL check yet refuse the overlay, such as Firefox's PDF
// viewer, so a failed injection follows the restricted page rule too.
function openOverlayInjectionFallback(activeTab: TargetTab, activeUrl: string, source: string): void {
  whenBackgroundSettingsReady(() => {
    const followBrowserNewtab = getRestrictedAction() === 'none';
    logHotkeyDebug('fallback-open-after-inject-failed', {
      followBrowserNewtab: followBrowserNewtab,
      source: source || ''
    });
    openNewtabFallbackForUrl(activeUrl, {
      sourceTab: activeTab,
      followBrowserNewtab: followBrowserNewtab
    });
  });
}

// One request to open the overlay, and how it ends.
interface OverlayOpenAttempt {
  activeTab: TargetTab | null | undefined;
  tabs: readonly TargetTab[];
  source: string;
  options: OpenOverlayOptions;
  // When the user asked; the entry motion budget measures from here. The
  // overlay restarts it once its modules have loaded in a tab for the first
  // time (overlay-app.ts).
  startedAt: number;
  opening: OverlayOpening | null;
  finished: boolean;
  // A failure before the page completed is retried once it has.
  retryPreCompleteFailure: boolean;
  // Whether the page was asked to hold the keys typed meanwhile.
  typeAheadArmed: boolean;
}

// Asks the tab's top frame to hold the keys typed while the overlay opens,
// or to drop them when it does not open (src/content/overlay-type-ahead.ts).
// A page without the shortcut observer simply does not answer.
function sendOverlayTypeAhead(tabId: number, action: 'armOverlayTypeAhead' | 'cancelOverlayTypeAhead'): void {
  if (!chrome.tabs || typeof chrome.tabs.sendMessage !== 'function') {
    return;
  }
  try {
    LumnoMessaging.sendTabMessage(chrome.tabs, tabId, { action }, ignoreExpectedChromeError, { frameId: 0 });
  } catch (_error) {
    // The tab closed or cannot take messages.
  }
}

function finishOpenAttempt(attempt: OverlayOpenAttempt, ok: boolean): void {
  if (attempt.finished) {
    return;
  }
  attempt.finished = true;
  const { activeTab, options } = attempt;
  if (typeof options.onComplete === 'function') {
    options.onComplete(ok === true);
  }
  if (attempt.opening) {
    finishOverlayOpening(attempt.opening);
    attempt.opening = null;
  }
  if (!activeTab || typeof activeTab.id !== 'number') {
    return;
  }
  if (ok !== true && attempt.typeAheadArmed) {
    sendOverlayTypeAhead(activeTab.id, 'cancelOverlayTypeAhead');
  }
  if (ok !== true && options.loadingRecovery !== true && attempt.retryPreCompleteFailure) {
    const trackedRecord = overlayLoadingRecordsByTabId.get(activeTab.id) || null;
    if (trackedRecord) {
      scheduleOverlayLoadingPreCompleteRetry(activeTab, trackedRecord);
    }
  }
  if (options.loadingRecovery === true || attempt.retryPreCompleteFailure) {
    finishOverlayLoadingOpenAttempt(activeTab.id);
  }
}

// The overlay cannot open on this page: focus New Tab's own search box,
// start onboarding, retarget a command from New Tab, or fall back.
function openOnRestrictedPage(attempt: OverlayOpenAttempt, activeTab: TargetTab & { id: number }, activeUrl: string): void {
  const { source, tabs } = attempt;
  finishOpenAttempt(attempt, false);
  if (isSearchCommandSource(source) && (isLumnoNewtabUrl(activeUrl) || isBrowserNewtabUrl(activeUrl))) {
    requestFocusVisibleNewtabInput(source, activeTab.id);
    return;
  }
  if (shouldTriggerOnboardingOverlayFromCommand(source, activeUrl)) {
    triggerOnboardingOverlayFromCommand(activeTab, source);
    logHotkeyDebug('suppressed', { reason: 'restricted_onboarding_command', source: source || '' });
    return;
  }
  if (recoverOverlayTargetFromCommandNewtab(activeTab, tabs, source, openOverlayOnTab)) {
    return;
  }
  whenBackgroundSettingsReady(() => {
    openRestrictedOverlayFallback(activeTab, activeUrl, source);
  });
}

// Whether the request ends before the overlay is injected.
function isOpenAttemptStopped(attempt: OverlayOpenAttempt, activeTab: TargetTab & { id: number }): boolean {
  const { options, source } = attempt;
  if (options.skipDuplicateGuard !== true && shouldIgnoreDuplicateHotkey(activeTab.id)) {
    logHotkeyDebug('duplicate-ignored', { tabId: activeTab.id, source: source || '' });
    return true;
  }
  const pendingNavigationUrl = getPendingOverlayNavigationUrl(activeTab);
  return options.loadingRecovery !== true &&
    shouldDeferRestrictedOverlayNavigation(activeTab) &&
    Boolean(rememberOverlayPendingNavigationIntent(activeTab, source, pendingNavigationUrl));
}

function buildOverlayContext(
  attempt: OverlayOpenAttempt,
  activeTab: TargetTab & { id: number },
  tabZoomFactor: number,
  loadingRecord: TrackedLoadingRecord | null
): OverlayOpenContext {
  const { source, options } = attempt;
  return {
    tabZoomFactor,
    prefillQuery: getOverlayPrefillQueryForSource(activeTab, source),
    prioritizeCurrentPageMatch: source === 'page-hotkey-prefill',
    currentTabId: activeTab.id,
    currentTabUrl: getResolvedTabUrl(activeTab),
    currentTabPinned: activeTab.pinned === true,
    openedAt: attempt.startedAt,
    documentPipEnabled: isDocumentPipEnabled(),
    siteSearchProviders: Array.isArray(siteSearchCache) ? siteSearchCache : [],
    ensureOpen: options.ensureOpen === true,
    loadingSessionTracked: Boolean(loadingRecord),
    loadingSession: loadingRecord && loadingRecord.session ? loadingRecord.session : null
  };
}

// The injection failed or the overlay refused: open the fallback unless a
// loading retry will try again.
function failOverlayInjection(
  attempt: OverlayOpenAttempt,
  activeTab: TargetTab & { id: number },
  activeUrl: string,
  error: string
): void {
  const { options, source } = attempt;
  logHotkeyDebug('inject-failed', { step: 'overlay', tabId: activeTab.id, error, source: source || '' });
  if (options.loadingRecovery !== true && !overlayLoadingRecordsByTabId.has(activeTab.id)) {
    openOverlayInjectionFallback(activeTab, activeUrl, source);
  }
  finishOpenAttempt(attempt, false);
}

function injectOverlay(
  attempt: OverlayOpenAttempt,
  activeTab: TargetTab & { id: number },
  activeUrl: string,
  tabZoomFactor: number,
  loadingRecord: TrackedLoadingRecord | null
): void {
  const { tabs, source } = attempt;
  const tabId = activeTab.id;
  const overlayContext = buildOverlayContext(attempt, activeTab, tabZoomFactor, loadingRecord);
  // Icon warmup is best effort; the overlay falls back to bundled icons.
  loadSiteSearchProviders()
    .then((providers) => {
      scheduleSiteSearchProviderIconWarmup(providers, '');
    })
    .catch(() => {});
  const overlayCommand: OverlayToggleCommand = { type: 'toggle', tabs, context: overlayContext };
  // The icon font preload loads alongside the overlay, so the font starts
  // loading before the overlay's larger modules have parsed.
  chrome.scripting.executeScript(createInjectedAppRun(
    chrome.runtime,
    { tabId },
    ['icon-font-preload', 'overlay'],
    overlayCommand,
    { injectImmediately: true }
  ), function(results) {
    const lastError = chrome.runtime.lastError;
    if (lastError) {
      failOverlayInjection(attempt, activeTab, activeUrl, lastError.message || 'unknown');
      return;
    }
    const mainResult = OVERLAY_LOADING_LIFECYCLE.getMainFrameResult(results);
    const result = mainResult && isRecord(mainResult.result) ? mainResult.result : null;
    if (result && result.ok === false) {
      failOverlayInjection(attempt, activeTab, activeUrl, String(result.reason || '') || 'unknown');
      return;
    }
    updateOverlayLoadingRecordFromInvocation(activeTab, results);
    logHotkeyDebug('overlay-opened', {
      tabId,
      tabCount: Array.isArray(tabs) ? tabs.length : 0,
      source: source || '',
      tabZoomFactor,
      siteSearchProviderCount: overlayContext.siteSearchProviders.length
    });
    finishOpenAttempt(attempt, Boolean(result && result.overlayOpen === true));
  });
}

function withTabZoom(tabId: number, run: (zoomFactor: number) => void): void {
  if (!chrome.tabs || typeof chrome.tabs.getZoom !== 'function') {
    run(1);
    return;
  }
  chrome.tabs.getZoom(tabId, (zoomFactor) => {
    run(Number.isFinite(Number(zoomFactor)) && Number(zoomFactor) > 0 ? Number(zoomFactor) : 1);
  });
}

export function openOverlayOnTab(
  activeTab: TargetTab | null | undefined,
  tabs: readonly TargetTab[],
  source: string,
  options?: OpenOverlayOptions | null
): void {
  const attempt: OverlayOpenAttempt = {
    activeTab,
    tabs,
    source,
    options: options && typeof options === 'object' ? options : {},
    startedAt: Date.now(),
    opening: null,
    finished: false,
    retryPreCompleteFailure: false,
    typeAheadArmed: false
  };
  if (!activeTab || typeof activeTab.id !== 'number') {
    logHotkeyDebug('no-active-tab', { source: source || '' });
    openNewtabFallback();
    finishOpenAttempt(attempt, false);
    return;
  }
  const targetTab = { ...activeTab, id: activeTab.id };
  if (isOpenAttemptStopped(attempt, targetTab)) {
    finishOpenAttempt(attempt, false);
    return;
  }
  const activeUrl = getResolvedTabUrl(activeTab);
  const restricted = !canOpenOverlayOnUrl(activeUrl);
  logHotkeyDebug('active-tab', {
    tabId: activeTab.id,
    resolvedUrl: activeUrl,
    tabUrl: typeof activeTab.url === 'string' ? activeTab.url : '',
    pendingUrl: typeof activeTab.pendingUrl === 'string' ? activeTab.pendingUrl : '',
    url: activeUrl,
    restricted,
    source: source || ''
  });
  if (restricted) {
    openOnRestrictedPage(attempt, targetTab, activeUrl);
    return;
  }
  attempt.opening = beginOverlayOpening(activeTab, source);
  if (!attempt.opening) {
    finishOpenAttempt(attempt, false);
    return;
  }
  // A reopen after a navigation is not something the user just typed for.
  if (attempt.options.loadingRecovery !== true) {
    attempt.typeAheadArmed = true;
    sendOverlayTypeAhead(targetTab.id, 'armOverlayTypeAhead');
  }
  const loadingRecord = rememberOverlayLoadingRecord(targetTab, source, attempt.options);
  attempt.retryPreCompleteFailure = Boolean(loadingRecord);
  withTabZoom(targetTab.id, (zoomFactor) => injectOverlay(attempt, targetTab, activeUrl, zoomFactor, loadingRecord));
}

// The loading retries reopen the overlay through this module.
setOverlayReopener(openOverlayOnTab);

export type { OverlayOpening };
