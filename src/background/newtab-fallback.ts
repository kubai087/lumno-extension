// Lumno's New Tab as the place a search or shortcut lands when the page it
// was asked from cannot take it, and the Firefox focus swap for a New Tab.
import * as LumnoBrowserProfile from '../platform/browser-profile';
import * as LumnoExtensionRoutes from '../domain/extension-routes';
import * as LumnoBackgroundTabGroups from './tab-groups';
import type { CreatedTabCallback, TabLike } from './tab-groups';
import type { OkReply } from '../domain/messages';

interface FallbackOptions {
  // The tab the request came from; the new tab joins its group.
  sourceTab?: TabLike | null;
  // Show the notice that file URLs need the extension's file access.
  notice?: 'file-access' | null;
  followBrowserNewtab?: boolean;
}

type SwapReply = OkReply & { removed?: boolean };

function getChromeApi(): typeof chrome | null {
  return typeof chrome !== 'undefined' ? chrome : null;
}

function createTab(
  options: { sourceTab?: TabLike | null; createProperties: chrome.tabs.CreateProperties },
  callback?: CreatedTabCallback
): void {
  const chromeApi = getChromeApi();
  const done: CreatedTabCallback = typeof callback === 'function' ? callback : () => {};
  if (!chromeApi || !chromeApi.tabs || typeof chromeApi.tabs.create !== 'function') {
    done(null, { ok: false, reason: 'tabs-api-unavailable', grouped: false });
    return;
  }
  LumnoBackgroundTabGroups.createTabInSourceGroup(chromeApi, options.createProperties, options.sourceTab || null, done);
}

// File URLs, and pages that are likely files (PDF, saved HTML), need the
// extension's file access to open from a script.
// A local file or a document type the browser opens in a viewer, by its URL.
function isLocalFileLikeUrl(url: URL): boolean {
  const pathname = String(url.pathname || '').toLowerCase();
  return String(url.protocol || '').toLowerCase() === 'file:' ||
    pathname.endsWith('.pdf') || pathname.endsWith('.htm') || pathname.endsWith('.html');
}

// The same check on a string that does not parse as a URL.
function looksLocalFileLike(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.startsWith('file://') || lower.includes('.pdf') || lower.includes('.htm') || lower.includes('.html');
}

function isLocalFileLikeTargetUrl(url: unknown): boolean {
  if (!url) {
    return false;
  }
  let parsed: URL;
  try {
    parsed = new URL(String(url));
  } catch (_error) {
    return looksLocalFileLike(String(url));
  }
  if (isLocalFileLikeUrl(parsed)) {
    return true;
  }
  // A viewer page names the file it shows in its src parameter.
  const srcParam = parsed.searchParams ? parsed.searchParams.get('src') : '';
  if (!srcParam) {
    return false;
  }
  try {
    return isLocalFileLikeUrl(new URL(srcParam));
  } catch (_error) {
    return looksLocalFileLike(String(srcParam));
  }
}

function isFirefoxRuntime(chromeApi: typeof chrome): boolean {
  return LumnoBrowserProfile.isFirefoxExtensionRuntime(chromeApi);
}

// Resolves whether the extension may open file URLs; null where the browser
// has no such setting.
function checkFileSchemeAccess(callback?: (isAllowed: boolean | null) => void): void {
  const chromeApi = getChromeApi();
  const done = typeof callback === 'function' ? callback : () => {};
  if (!chromeApi || !chromeApi.extension || typeof chromeApi.extension.isAllowedFileSchemeAccess !== 'function') {
    done(null);
    return;
  }
  // Firefox answers false but offers users no file-URL access setting, so
  // report it as unsupported rather than prompting for a missing toggle.
  if (isFirefoxRuntime(chromeApi)) {
    done(null);
    return;
  }
  try {
    chromeApi.extension.isAllowedFileSchemeAccess((isAllowed) => {
      if (chromeApi.runtime && chromeApi.runtime.lastError) {
        done(null);
        return;
      }
      done(Boolean(isAllowed));
    });
  } catch (_error) {
    done(null);
  }
}

function buildNewtabFallbackUrl(options?: FallbackOptions | null): string {
  return LumnoExtensionRoutes.buildLumnoNewtabUrl(getChromeApi(), {
    focus: true,
    notice: options && options.notice === 'file-access' ? 'file-access' : null,
    [LumnoExtensionRoutes.SEARCH_FALLBACK_PARAM]: true
  });
}

function openNewtabFallback(options?: FallbackOptions | null): void {
  const openOptions = options && typeof options === 'object' ? options : {};
  const newtabUrl = buildNewtabFallbackUrl(options);
  createTab({
    sourceTab: openOptions.sourceTab || null,
    createProperties: { url: newtabUrl }
  });
}

function openBrowserNewtabFallback(options?: FallbackOptions | null): void {
  const openOptions = options && typeof options === 'object' ? options : {};
  createTab({
    sourceTab: openOptions.sourceTab || null,
    createProperties: {}
  });
}

// followBrowserNewtab opens the browser's own New Tab instead of Lumno's,
// except when the file-access notice still needs Lumno's page to explain it.
function openNewtabFallbackForUrl(url: unknown, options?: FallbackOptions | null): void {
  const openOptions = options && typeof options === 'object' ? options : {};
  const openFallback = openOptions.followBrowserNewtab === true
    ? openBrowserNewtabFallback
    : openNewtabFallback;
  if (!isLocalFileLikeTargetUrl(url)) {
    openFallback(openOptions);
    return;
  }
  checkFileSchemeAccess((isAllowed) => {
    if (isAllowed === false) {
      openNewtabFallback({
        ...openOptions,
        notice: 'file-access'
      });
      return;
    }
    openFallback(openOptions);
  });
}

function isLumnoNewtabPageUrl(chromeApi: typeof chrome | null, url: unknown): boolean {
  if (!chromeApi || !chromeApi.runtime || typeof chromeApi.runtime.getURL !== 'function') {
    return false;
  }
  try {
    const parsed = new URL(String(url || ''));
    const newtabUrl = new URL(chromeApi.runtime.getURL('newtab.html'));
    return parsed.origin === newtabUrl.origin && parsed.pathname === newtabUrl.pathname;
  } catch (_error) {
    return false;
  }
}

// Session stores may record the close slightly later (Zen does), so retry;
// lastModified keeps an older, user-closed New Tab from being forgotten.
// Firefox's sessions.forgetClosedTab, which chrome.sessions lacks.
function getForgetClosedTab(sessions: typeof chrome.sessions): ((windowId: number, sessionId: string) => unknown) | null {
  const forget: unknown = 'forgetClosedTab' in sessions ? sessions.forgetClosedTab : null;
  return typeof forget === 'function'
    ? (windowId, sessionId) => forget.call(sessions, windowId, sessionId)
    : null;
}

function forgetClosedNewtab(chromeApi: typeof chrome, closedUrl: string, closedAfter: number, attemptsLeft?: number): void {
  const sessions = chromeApi && chromeApi.sessions;
  const forgetClosedTab = sessions ? getForgetClosedTab(sessions) : null;
  if (!sessions || typeof sessions.getRecentlyClosed !== 'function' || !forgetClosedTab) {
    return;
  }
  const remaining = typeof attemptsLeft === 'number' ? attemptsLeft : 3;
  sessions.getRecentlyClosed({ maxResults: 5 }, (entries) => {
    if (chromeApi.runtime && chromeApi.runtime.lastError) {
      return;
    }
    const entry = (Array.isArray(entries) ? entries : []).find((item) => (
      item && item.tab && item.tab.url === closedUrl && item.tab.sessionId &&
      Number(item.lastModified) >= closedAfter
    ));
    const closedTab = entry && entry.tab;
    if (!closedTab || !closedTab.sessionId) {
      if (remaining > 1) {
        setTimeout(() => forgetClosedNewtab(chromeApi, closedUrl, closedAfter, remaining - 1), 150);
      }
      return;
    }
    // Firefox-only API; its schema takes no callback and returns a promise.
    try {
      const forgetting = forgetClosedTab(closedTab.windowId, closedTab.sessionId);
      if (forgetting instanceof Promise) {
        forgetting.catch(() => {});
      }
    } catch (_error) {
      // Keeping the closed entry is harmless.
    }
  });
}

// Firefox keeps URL-bar focus on a New Tab page through same-tab navigation
// (its initial-page check ignores the query), so focus only reaches a
// freshly created tab. Replace the sender tab with one marked #focus: a
// query would leave the URL bar showing the extension URL once cleared,
// because Firefox compares it with the page principal.
function swapNewtabForFocus(
  sourceTab: chrome.tabs.Tab | null | undefined,
  senderUrl: unknown,
  callback?: (reply: SwapReply) => void
): void {
  const chromeApi = getChromeApi();
  const done = typeof callback === 'function' ? callback : () => {};
  const sourceTabId = sourceTab && sourceTab.id;
  if (!chromeApi || !sourceTab || typeof sourceTabId !== 'number' || !isLumnoNewtabPageUrl(chromeApi, senderUrl)) {
    done({ ok: false, reason: 'invalid-sender' });
    return;
  }
  // Recreating a container tab needs the cookies permission; leave it as is.
  // Firefox's tab.cookieStoreId names the container.
  const cookieStoreId: unknown = 'cookieStoreId' in sourceTab ? sourceTab.cookieStoreId : '';
  if (/^firefox-container-/.test(String(cookieStoreId || ''))) {
    done({ ok: false, reason: 'container-tab' });
    return;
  }
  const focusUrl = new URL(String(senderUrl));
  focusUrl.hash = 'focus';
  const createProperties: chrome.tabs.CreateProperties = {
    url: focusUrl.toString(),
    index: sourceTab.index,
    windowId: sourceTab.windowId,
    active: true
  };
  if (typeof sourceTab.openerTabId === 'number') {
    createProperties.openerTabId = sourceTab.openerTabId;
  }
  createTab({ sourceTab, createProperties }, (tab, result) => {
    if (!tab) {
      done({ ok: false, reason: (result && result.reason) || 'tab-create-failed' });
      return;
    }
    const removeStartedAt = Date.now();
    chromeApi.tabs.remove(sourceTabId, () => {
      if (chromeApi.runtime && chromeApi.runtime.lastError) {
        done({ ok: true, removed: false });
        return;
      }
      forgetClosedNewtab(chromeApi, String(senderUrl), removeStartedAt);
      done({ ok: true, removed: true });
    });
  });
}

export {
  buildNewtabFallbackUrl,
  checkFileSchemeAccess,
  isLocalFileLikeTargetUrl,
  openBrowserNewtabFallback,
  openNewtabFallback,
  openNewtabFallbackForUrl,
  swapNewtabForFocus
};
