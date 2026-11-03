// Preview sessions per tab: preparing, opening and closing them, with the
// header rules and redirects that follow each one.
import type { LinkPreviewOrigin, OkReply } from '../../domain/messages';
import { canSplitBeside } from '../../domain/split-view';
import { callback, captureTab, getDnr, injectSurface, sendToSurface } from './chrome-calls';
import { PREPARED_TTL_MS } from './constants';
import { isPreviewableUrl, isSameAddress, readUrlDomain, sessionDomains } from './frame-rules';
import type { FrameRedirect, PrepareOptions, PreviewSession } from './types';
import { createSession } from './preview-state';
import type { LinkPreview } from './preview-state';

// Brings the tab's rules, and the workers' rule, in line with the tab's
// preview as it stands when the update runs.
function syncRules(preview: LinkPreview, tabId: number): Promise<boolean> {
  preview.redirects.update(preview.sessions.size > 0);
  const dnr = getDnr(preview);
  if (!dnr) {
    return Promise.resolve(false);
  }
  return preview.rules.sync(dnr, tabId).then((applied) => {
    preview.sessions.persist();
    return applied;
  });
}

function stopExpiry(preview: LinkPreview, session: PreviewSession): void {
  if (session.expiryTimer !== null) {
    preview.ports.clearTimer(session.expiryTimer);
    session.expiryTimer = null;
  }
}

function scheduleExpiry(preview: LinkPreview, tabId: number, session: PreviewSession): void {
  stopExpiry(preview, session);
  session.expiryTimer = preview.ports.setTimer(() => {
    if (preview.sessions.get(tabId) === session && session.state === 'prepared') {
      void discard(preview, tabId, session.token);
    }
  }, PREPARED_TTL_MS);
}

// A press prepares with the screenshot; Shift held over the link prepares
// without it (capture: false).
function prepare(
  preview: LinkPreview,
  tab: chrome.tabs.Tab | null | undefined,
  url: unknown,
  prepareOptions?: PrepareOptions
): PreviewSession | null {
  const tabId = tab && tab.id;
  if (!tab || typeof tabId !== 'number' || !isPreviewableUrl(url)) {
    return null;
  }
  const capture = !prepareOptions || prepareOptions.capture !== false;
  const existing = preview.sessions.get(tabId);
  if (existing && existing.url === url && existing.state === 'prepared') {
    if (capture && !existing.capture) {
      existing.capture = captureTab(preview, tab);
      deliverScreenshot(preview, tabId, existing);
    }
    scheduleExpiry(preview, tabId, existing);
    return existing;
  }
  if (existing) {
    stopExpiry(preview, existing);
  }
  const token = preview.sessions.nextToken(preview.ports.now());
  const session = createSession(token, url);
  preview.sessions.set(tabId, session);
  // The screenshot goes first: the surface's hidden frame stays out of it
  // either way, but the capture is the slowest step.
  if (capture) {
    session.capture = captureTab(preview, tab);
  }
  session.ready = Promise.all([syncRules(preview, tabId), injectSurface(preview, tabId)])
    .then(([, injected]) => {
      if (!injected) {
        return false;
      }
      return sendToSurface<'lumnoLinkPreviewPrewarm'>(preview, tabId, {
        action: 'lumnoLinkPreviewPrewarm',
        token,
        url,
        frameSecret: session.frameSecret,
        splitView: canSplitBeside(getTabsApi(preview), tab)
      }).then(Boolean);
    });
  if (session.capture) {
    deliverScreenshot(preview, tabId, session);
  }
  scheduleExpiry(preview, tabId, session);
  return session;
}

// The surface gets the screenshot as soon as both are ready, to decode it
// while the button is still down; "show" then carries none.
function deliverScreenshot(preview: LinkPreview, tabId: number, session: PreviewSession): void {
  const token = session.token;
  session.screenshotDelivered = Promise.all([session.ready, session.capture]).then(([surfaceReady, screenshot]) => (
    surfaceReady && screenshot && preview.sessions.get(tabId) === session
      ? sendToSurface<'lumnoLinkPreviewScreenshot'>(preview, tabId, { action: 'lumnoLinkPreviewScreenshot', token, screenshot })
        .then(Boolean)
      : false
  ));
}

async function open(
  preview: LinkPreview,
  tab: chrome.tabs.Tab | null | undefined,
  url: unknown,
  origin: LinkPreviewOrigin | null
): Promise<OkReply> {
  const session = prepare(preview, tab, url);
  const tabId = tab && tab.id;
  if (!session || typeof tabId !== 'number') {
    return { ok: false, reason: 'not-previewable' };
  }
  session.state = 'opening';
  stopExpiry(preview, session);
  const [ready, screenshot, screenshotDelivered] = await Promise.all([
    session.ready,
    session.capture,
    session.screenshotDelivered
  ]);
  if (preview.sessions.get(tabId) !== session) {
    return { ok: false, reason: 'superseded' };
  }
  if (!ready) {
    // Nothing reached the page (the page refuses scripts, or it went
    // away): the link can still open in a tab.
    void discard(preview, tabId, session.token);
    return { ok: false, reason: 'surface-unavailable' };
  }
  const shown = await sendToSurface<'lumnoLinkPreviewShow'>(preview, tabId, {
    action: 'lumnoLinkPreviewShow',
    token: session.token,
    url: session.url,
    frameSecret: session.frameSecret,
    screenshot: screenshotDelivered ? '' : (screenshot || ''),
    origin: origin || null,
    splitView: canSplitBeside(getTabsApi(preview), tab)
  });
  if (!shown) {
    // The surface was asked to show and may be on screen; it moves the
    // link to a tab itself when it cannot show it, so nothing opens here.
    void discard(preview, tabId, session.token);
    return { ok: false, reason: 'show-failed' };
  }
  if (preview.sessions.get(tabId) === session) {
    session.state = 'open';
    preview.sessions.persist();
  }
  return { ok: true };
}

// Drops the tab's preview. A token that no longer names the tab's
// preview is a late close from one already replaced; it is ignored. With
// no session known (the worker slept while the preview was open), the
// rule is removed anyway.
function discard(preview: LinkPreview, tabId: number, token: string): Promise<boolean> {
  const session = preview.sessions.get(tabId);
  if (session && token && session.token !== token) {
    return Promise.resolve(false);
  }
  if (session) {
    stopExpiry(preview, session);
    preview.sessions.delete(tabId);
  }
  return syncRules(preview, tabId);
}

// A press released away from the link: the click that would open the
// preview never comes, so its rule and hidden window go now.
function cancel(preview: LinkPreview, tabId: number): Promise<boolean> {
  const session = preview.sessions.get(tabId);
  if (!session || session.state !== 'prepared') {
    return Promise.resolve(false);
  }
  void sendToSurface<'lumnoLinkPreviewDiscard'>(preview, tabId, { action: 'lumnoLinkPreviewDiscard', token: session.token });
  return discard(preview, tabId, session.token);
}

function getTabsApi(preview: LinkPreview): typeof chrome.tabs | null {
  return (preview.ports.chromeApi && preview.ports.chromeApi.tabs) || null;
}

// Opens the previewed page in a tab next to the page, or with `split` in a
// split view beside it; a split the browser refuses opens as a tab.
function openInTab(
  preview: LinkPreview,
  tab: chrome.tabs.Tab | null | undefined,
  url: unknown,
  options?: { split?: boolean }
): Promise<boolean> {
  const tabs = getTabsApi(preview);
  if (!tabs || typeof tabs.create !== 'function' || !isPreviewableUrl(url)) {
    return Promise.resolve(false);
  }
  if (options && options.split && canSplitBeside(tabs, tab)) {
    const splitProperties: chrome.tabs.CreateProperties = { url, windowId: tab.windowId, splitWithTabId: tab.id, active: true };
    return callback<chrome.tabs.Tab>(preview, (done) => tabs.create(splitProperties, done))
      .then((created) => (created ? true : openInTab(preview, tab, url)));
  }
  const properties: chrome.tabs.CreateProperties = { url, active: true };
  if (tab && typeof tab.index === 'number') {
    properties.index = tab.index + 1;
  }
  if (tab && typeof tab.id === 'number') {
    properties.openerTabId = tab.id;
  }
  if (tab && typeof tab.windowId === 'number') {
    properties.windowId = tab.windowId;
  }
  return callback<chrome.tabs.Tab>(preview, (done) => tabs.create(properties, done)).then(Boolean);
}


// The preview frame's loading page is redirected: the domain it goes to is
// allowed at once, while the browser asks for the next address, so a link
// that passes through another site (a search engine's result, a short
// link) loads in one go instead of being refused and tried again. The
// request is the preview frame's once it is bound; before that, the first
// load is the one that asked for the preview's own address, followed
// through its redirects.
function handleFrameRedirect(preview: LinkPreview, details: FrameRedirect | null | undefined): Promise<boolean> {
  if (!details || details.type !== 'sub_frame' || !Number.isInteger(details.frameId) || details.frameId <= 0) {
    return Promise.resolve(false);
  }
  const tabId = details.tabId;
  const session = preview.sessions.get(tabId);
  if (!session) {
    return Promise.resolve(false);
  }
  const ownFrame = session.frameId !== null
    ? details.frameId === session.frameId
    : (Boolean(session.redirectRequestId) && details.requestId === session.redirectRequestId) ||
      isSameAddress(details.url, session.lastFrameUrl || session.frameUrl);
  if (!ownFrame) {
    return Promise.resolve(false);
  }
  session.redirectRequestId = String(details.requestId || '');
  const domain = readUrlDomain(details.redirectUrl);
  if (!domain || sessionDomains(session).includes(domain)) {
    return Promise.resolve(false);
  }
  session.redirectDomains = session.redirectDomains.concat(domain);
  return syncRules(preview, tabId);
}

export {
  cancel,
  deliverScreenshot,
  discard,
  handleFrameRedirect,
  open,
  openInTab,
  prepare,
  scheduleExpiry,
  stopExpiry,
  syncRules
};
