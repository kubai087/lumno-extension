// URL classification for the tabs commands act on: restricted and browser-
// internal pages, Lumno's own pages and New Tab, other extensions, and which
// browser New Tab provider a fresh tab belongs to. Also opens search-result
// tabs next to the tab they came from, in its tab group.
//
// A module of the service worker; background.ts imports it before its own code
// runs.

import * as LumnoUrlGuards from '../platform/url-guards';
import * as BACKGROUND_TAB_GROUPS from './tab-groups';
import * as EXTENSION_ROUTES from '../domain/extension-routes';
import * as SEARCH_RESULT_TABS from './search-result-tabs';
import * as SETTINGS from '../domain/settings';
import {
  areBackgroundSettingsLoaded,
  isRestrictedActionAutoBrowserSettingDone,
  logHotkeyDebug,
  markRestrictedActionAutoSelected,
  whenBackgroundSettingsReady,
  workerSettings
} from './worker-context';
import type { CreatedTabCallback, TabGroupContext, TabLike } from './tab-groups';
import type { TabPlacement } from './search-result-tabs';

// Which page a browser's fresh tab shows: Lumno's New Tab, another
// extension's, or the browser's own.
type BrowserNewtabProviderType = 'lumno' | 'other-extension' | 'browser' | '';

// The fields of a tab the URL helpers read.
export type UrlTabLike = Partial<Pick<chrome.tabs.Tab, 'id' | 'url' | 'pendingUrl' | 'status'>>;

function isBrowserExtensionProtocol(protocol: unknown): boolean {
  return LumnoUrlGuards.isBrowserExtensionProtocol(protocol);
}

export function isBrowserInternalUrl(url: unknown): boolean {
  return LumnoUrlGuards.isBrowserInternalUrl(url);
}

export function isRestrictedUrl(url: unknown): boolean {
  return LumnoUrlGuards.isRestrictedUrl(url);
}

export function canOpenOverlayOnUrl(url: unknown): boolean {
  return LumnoUrlGuards.canOpenOverlayOnUrl(url);
}

export function canFetchPageForFavicon(url: unknown): boolean {
  return LumnoUrlGuards.canFetchPageForFavicon(url);
}

// Firefox hosts extension pages on a per-install UUID, not runtime.id. Compare
// protocol and host: URL.origin is "null" for these schemes outside browsers.
function getExtensionUrlKey(url: unknown): string {
  try {
    const parsed = new URL(String(url));
    return parsed.hostname ? `${parsed.protocol}//${parsed.hostname}` : '';
  } catch (_error) {
    return '';
  }
}

function getOwnExtensionOrigin(): string {
  return getExtensionUrlKey(chrome.runtime.getURL(''));
}

export function isOwnExtensionPageUrl(url: unknown): boolean {
  if (!url || !chrome || !chrome.runtime || !chrome.runtime.id) {
    return false;
  }
  try {
    const origin = getOwnExtensionOrigin();
    return Boolean(origin) && getExtensionUrlKey(url) === origin;
  } catch (_error) {
    return false;
  }
}

// The tab's URL, or the one it is loading when it has none yet.
export function getResolvedTabUrl(tab: UrlTabLike | null | undefined): string {
  if (!tab || typeof tab !== 'object') {
    return '';
  }
  const directUrl = typeof tab.url === 'string' ? String(tab.url).trim() : '';
  if (directUrl) {
    return directUrl;
  }
  const pendingUrl = typeof tab.pendingUrl === 'string' ? String(tab.pendingUrl).trim() : '';
  return pendingUrl;
}

export function getSourceTabGroupContext(tab: TabLike | null | undefined): TabGroupContext | null {
  return BACKGROUND_TAB_GROUPS.getSourceTabGroupContext(tab, chrome);
}

export function createTabWithSourceGroup(
  createProperties: chrome.tabs.CreateProperties,
  sourceTab: TabLike | null | undefined,
  callback?: CreatedTabCallback | null
): void {
  const done: CreatedTabCallback = typeof callback === 'function' ? callback : () => {};
  BACKGROUND_TAB_GROUPS.createTabInSourceGroup(chrome, createProperties, sourceTab, done);
}

export function resolveSearchResultTabPlacement(sourceTab: chrome.tabs.Tab | null | undefined): Promise<TabPlacement> {
  return workerSettings.ready.then(() => SEARCH_RESULT_TABS.resolvePlacement(
    chrome,
    sourceTab,
    workerSettings.get(SETTINGS.searchResultTabPosition)
  ));
}

// Opens a result tab where the person chose (next to the source tab or at
// the end), in the source tab's group.
export function createSearchResultTab(
  createProperties: chrome.tabs.CreateProperties,
  sourceTab: chrome.tabs.Tab | null | undefined,
  callback?: CreatedTabCallback | null,
  resolvedPlacement?: TabPlacement | null
): void {
  const placementTask = resolvedPlacement
    ? Promise.resolve(resolvedPlacement)
    : resolveSearchResultTabPlacement(sourceTab);
  placementTask.then((placement) => {
    const props: chrome.tabs.CreateProperties = { ...createProperties };
    if (typeof placement.index === 'number') {
      props.index = placement.index;
      props.windowId = placement.windowId;
    }
    createTabWithSourceGroup(props, placement.sourceTab, callback);
  });
}

export function moveTabToSourceGroupContext(
  tab: TabLike | null | undefined,
  sourceContext: unknown,
  callback?: ((grouped: boolean, reason: string) => void) | null,
  createProperties?: { pinned?: boolean } | null
): void {
  BACKGROUND_TAB_GROUPS.moveTabToSourceGroupContext(chrome, tab, sourceContext, callback, createProperties);
}

export function isLumnoNewtabUrl(url: unknown): boolean {
  const value = String(url || '');
  if (!value || !chrome || !chrome.runtime || typeof chrome.runtime.getURL !== 'function') {
    return false;
  }
  const routeType = EXTENSION_ROUTES.classifyExtensionUrl(value);
  if (routeType === 'newtab' && isOwnExtensionUrl(value)) {
    return true;
  }
  const prefixes = [EXTENSION_ROUTES.buildNewtabUrl(chrome), EXTENSION_ROUTES.buildLumnoNewtabUrl(chrome)];
  return prefixes.some((prefix) => value === prefix || value.startsWith(`${prefix}?`));
}

// The search-only page stays marked after its redirect and focus cleanup.
export function isLumnoSearchFallbackUrl(url: string): boolean {
  if (!url.includes(EXTENSION_ROUTES.SEARCH_FALLBACK_PARAM)) {
    return false;
  }
  const base = url.split(/[?#]/, 1)[0];
  const paths = EXTENSION_ROUTES.ROUTE_PATHS;
  return (base === chrome.runtime.getURL(paths.newtab) || base === chrome.runtime.getURL(paths.lumnoNewtab)) &&
    new URL(url).searchParams.get(EXTENSION_ROUTES.SEARCH_FALLBACK_PARAM) === '1';
}

export function isBrowserNewtabUrl(url: unknown): boolean {
  const lower = String(url || '').toLowerCase();
  return lower === 'chrome://newtab/' ||
    lower === 'chrome://new-tab-page/' ||
    lower === 'edge://newtab/' ||
    lower === 'brave://newtab/' ||
    lower === 'opera://startpage/' ||
    lower === 'about:newtab' ||
    lower === 'about:home';
}

export function isOwnExtensionUrl(url: unknown): boolean {
  if (!url || !chrome || !chrome.runtime || !chrome.runtime.id) {
    return false;
  }
  try {
    const parsed = new URL(String(url));
    const protocol = String(parsed.protocol || '').toLowerCase();
    const origin = getOwnExtensionOrigin();
    return isBrowserExtensionProtocol(protocol) && Boolean(origin) && getExtensionUrlKey(url) === origin;
  } catch (_error) {
    return false;
  }
}

function isLumnoBrowserOverrideNewtabUrl(url: unknown): boolean {
  const value = String(url || '');
  if (!value || !isOwnExtensionUrl(value) || !chrome || !chrome.runtime || typeof chrome.runtime.getURL !== 'function') {
    return false;
  }
  const newtabPrefix = EXTENSION_ROUTES.buildNewtabUrl(chrome);
  return value === newtabPrefix || value.startsWith(`${newtabPrefix}?`);
}

function isOtherExtensionUrl(url: unknown): boolean {
  if (!url || !chrome || !chrome.runtime || !chrome.runtime.id) {
    return false;
  }
  try {
    const parsed = new URL(String(url));
    return isBrowserExtensionProtocol(parsed.protocol) &&
      String(parsed.hostname || '') !== String(chrome.runtime.id);
  } catch (_error) {
    return false;
  }
}

// How long a fresh tab may take to show which New Tab provider it belongs to.
const BROWSER_NEWTAB_PROVIDER_DETECTION_MS = 6000;
// Fresh tabs that may turn out to be the browser's New Tab, by creation time.
// A suspension drops them, which only skips detection for those tabs.
const browserNewtabProviderCandidateTabIds = new Map<number, number>();

function pruneBrowserNewtabProviderCandidates(now?: number): void {
  const currentTime = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  browserNewtabProviderCandidateTabIds.forEach((createdAt, tabId) => {
    if (currentTime - Number(createdAt || 0) > BROWSER_NEWTAB_PROVIDER_DETECTION_MS) {
      browserNewtabProviderCandidateTabIds.delete(tabId);
    }
  });
}

function isPotentialBrowserNewtabProviderCandidate(tab: UrlTabLike | null | undefined): tab is UrlTabLike & { id: number } {
  if (!tab || typeof tab.id !== 'number') {
    return false;
  }
  const directUrl = typeof tab.url === 'string' ? tab.url : '';
  const pendingUrl = typeof tab.pendingUrl === 'string' ? tab.pendingUrl : '';
  const resolvedUrl = getResolvedTabUrl(tab);
  return isBrowserNewtabUrl(directUrl) ||
    isBrowserNewtabUrl(pendingUrl) ||
    isBrowserNewtabUrl(resolvedUrl) ||
    (!directUrl && !pendingUrl && tab.status === 'loading');
}

export function rememberBrowserNewtabProviderCandidate(tab: UrlTabLike | null | undefined): void {
  pruneBrowserNewtabProviderCandidates();
  if (!isPotentialBrowserNewtabProviderCandidate(tab)) {
    return;
  }
  browserNewtabProviderCandidateTabIds.set(tab.id, Date.now());
}

function isRecentBrowserNewtabProviderCandidate(tab: UrlTabLike | null | undefined): boolean {
  if (!tab || typeof tab.id !== 'number') {
    return false;
  }
  pruneBrowserNewtabProviderCandidates();
  return browserNewtabProviderCandidateTabIds.has(tab.id);
}

function getBrowserNewtabProviderType(tab: UrlTabLike | null | undefined): BrowserNewtabProviderType {
  const url = getResolvedTabUrl(tab);
  if (!url) {
    return '';
  }
  if (isLumnoBrowserOverrideNewtabUrl(url)) {
    return 'lumno';
  }
  if (isOtherExtensionUrl(url)) {
    return 'other-extension';
  }
  if (isBrowserNewtabUrl(url) && tab && tab.status === 'complete') {
    return 'browser';
  }
  return '';
}

// Another extension's New Tab replaces the browser's: commands on it then
// do nothing instead of opening Lumno's fallback, once, unless the person
// chose otherwise.
function setRestrictedActionFromBrowserNewtabProvider(
  providerType: BrowserNewtabProviderType,
  tab: UrlTabLike | null | undefined,
  stage: unknown
): void {
  if (providerType !== 'other-extension') {
    return;
  }
  if (!areBackgroundSettingsLoaded()) {
    // The one-time auto choice must not overwrite a later manual choice just
    // because the done flag has not been read yet on this wake.
    whenBackgroundSettingsReady(() => {
      setRestrictedActionFromBrowserNewtabProvider(providerType, tab, stage);
    });
    return;
  }
  if (isRestrictedActionAutoBrowserSettingDone()) {
    return;
  }
  const url = getResolvedTabUrl(tab);
  void markRestrictedActionAutoSelected();
  logHotkeyDebug('restricted-action-auto-browser-setting', {
    providerType,
    stage: stage || '',
    url: String(url || '')
  });
}

export function maybeAutoSelectRestrictedBrowserSetting(tab: UrlTabLike | null | undefined, stage?: string): void {
  if (!tab || typeof tab.id !== 'number') {
    return;
  }
  if (isRestrictedActionAutoBrowserSettingDone()) {
    return;
  }
  const isCandidate = isRecentBrowserNewtabProviderCandidate(tab) ||
    isPotentialBrowserNewtabProviderCandidate(tab);
  if (!isCandidate) {
    return;
  }
  const providerType = getBrowserNewtabProviderType(tab);
  if (!providerType) {
    return;
  }
  if (providerType === 'lumno') {
    browserNewtabProviderCandidateTabIds.delete(tab.id);
    return;
  }
  if (providerType === 'other-extension') {
    setRestrictedActionFromBrowserNewtabProvider(providerType, tab, stage);
    browserNewtabProviderCandidateTabIds.delete(tab.id);
    return;
  }
}

export function isLumnoOnboardingUrl(url: unknown): boolean {
  return EXTENSION_ROUTES.isOnboardingUrl(url) &&
    isOwnExtensionUrl(url);
}

export function getOwnExtensionFaviconUrl(): string {
  if (!chrome || !chrome.runtime || typeof chrome.runtime.getURL !== 'function') {
    return '';
  }
  return chrome.runtime.getURL('assets/images/lumno.png');
}
