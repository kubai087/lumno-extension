// Shift+click on a link opens it in a small window over the page instead of
// a new browser window. The page's content script reports the press here;
// this service captures the visible tab for the receding background, lets
// the preview embed the site it shows even where the site refuses framing,
// and injects the preview surface into the top frame.
//
// A press arrives twice: on mousedown ("prepare") and on click ("open").
// Preparing starts the screenshot, the header rule and the injection while
// the button is still down, and asks the surface to start loading the page
// in a hidden frame, so the window opens on click with the page underway. A
// press released anywhere but the link ("cancel") drops all of that.
//
// Shift held over a link prepares it earlier still, without the screenshot:
// the page may change before the press, and Chrome takes only two captures
// a second. The press that follows reuses the preparation and adds the
// screenshot.
import type { HandlersFor, MessageSender } from '../message-router';
import type { LinkPreviewOrigin } from '../../domain/messages';
import { callback, getDnr, readRules, sendToSurface } from './chrome-calls';
import { WORKER_RULE_ID } from './constants';
import { isRecord } from './frame-rules';
import { bindFrame, getSenderTabId, noteFrameCommitted, noteFrameNavigation, retryRefusedFrame } from './frames';
import { cancel, discard, handleFrameRedirect, open, openInTab, prepare, stopExpiry, syncRules } from './sessions';
import type {
  FrameRedirect,
  LinkPreviewAction,
  LinkPreviewService,
  LinkPreviewServiceOptions,
  PrepareOptions,
  TimerHandle
} from './types';
import { FrameHeaderRules, PreviewSessions, RedirectWatch } from './preview-state';
import type { LinkPreview, LinkPreviewPorts } from './preview-state';

// The surface lives in the tab's top document, so a navigation of the tab
// may have taken it away without a close. Asking it settles that: no
// answer (no surface) or another preview's token drops the rule.
function verifyOpenPreview(preview: LinkPreview, tabId: number): Promise<boolean> {
  return sendToSurface<'lumnoLinkPreviewPing'>(preview, tabId, { action: 'lumnoLinkPreviewPing' }).then((response) => {
    const surfaceToken = response && typeof response.token === 'string' ? response.token : '';
    const session = preview.sessions.get(tabId);
    if (!surfaceToken || (session && session.token !== surfaceToken)) {
      return discard(preview, tabId, '');
    }
    return false;
  });
}

function handleTabRemoved(preview: LinkPreview, tabId: number): Promise<boolean> {
  const session = preview.sessions.get(tabId);
  if (session) {
    stopExpiry(preview, session);
    preview.sessions.delete(tabId);
  }
  return syncRules(preview, tabId);
}

// A navigation starts ("loading") while the old document still answers,
// so the check runs again when it finishes ("complete"). Only an open
// preview is checked: the preview's own frame loading can report the tab
// as loading while the press is still on its way to the surface.
function handleTabUpdated(preview: LinkPreview, tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo | null | undefined): Promise<boolean> {
  if (!changeInfo || (changeInfo.status !== 'loading' && changeInfo.status !== 'complete')) {
    return Promise.resolve(false);
  }
  const session = preview.sessions.get(tabId);
  if (!session || session.state !== 'open') {
    return Promise.resolve(false);
  }
  return verifyOpenPreview(preview, tabId);
}

// Rules left by a worker that stopped while previews were open: keep the
// ones whose preview is still on screen.
async function reconcileRules(preview: LinkPreview): Promise<void> {
  await preview.sessions.restored;
  const dnr = getDnr(preview);
  if (!dnr || typeof dnr.getSessionRules !== 'function') {
    return;
  }
  const rules = await readRules(preview, dnr);
  if (!rules) {
    return;
  }
  const tabIds = new Set<number>();
  rules.forEach((rule) => {
    const ruleTabIds = rule && rule.id !== WORKER_RULE_ID && rule.condition ? rule.condition.tabIds : undefined;
    if (Array.isArray(ruleTabIds) && typeof ruleTabIds[0] === 'number') {
      tabIds.add(ruleTabIds[0]);
    }
  });
  preview.sessions.forEach((_session, tabId) => tabIds.add(tabId));
  await Promise.all(Array.from(tabIds, (tabId) => verifyOpenPreview(preview, tabId)));
  // The workers' rule outlives no preview.
  const left = await readRules(preview, dnr);
  if (left && left.length === 1 && left[0].id === WORKER_RULE_ID) {
    await callback<void>(preview, (done) => dnr.updateSessionRules({ removeRuleIds: [WORKER_RULE_ID] }, done));
  }
}

function attach(preview: LinkPreview): void {
  const tabs = preview.ports.chromeApi && preview.ports.chromeApi.tabs;
  if (tabs && tabs.onRemoved && typeof tabs.onRemoved.addListener === 'function') {
    tabs.onRemoved.addListener((tabId) => {
      if (preview.sessions.has(tabId)) {
        void handleTabRemoved(preview, tabId);
      }
    });
  }
  if (tabs && tabs.onUpdated && typeof tabs.onUpdated.addListener === 'function') {
    tabs.onUpdated.addListener((tabId, changeInfo) => {
      void handleTabUpdated(preview, tabId, changeInfo);
    });
  }
  preview.sessions.restored = preview.sessions.restore().catch(() => {})
    .then(() => preview.redirects.update(preview.sessions.size > 0));
  preview.rules.waitFor(preview.sessions.restored);
  void reconcileRules(preview);
}

function readOrigin(origin: unknown, sender: MessageSender): LinkPreviewOrigin | null {
  // Click coordinates only mean something in the top frame's viewport.
  if (!sender || sender.frameId !== 0 || !isRecord(origin)) {
    return null;
  }
  const x = Number(origin.x);
  const y = Number(origin.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function createMessageHandlers(preview: LinkPreview): HandlersFor<LinkPreviewAction> {
  return Object.freeze({
    linkPreviewPrepare(request, sender, sendResponse) {
      prepare(preview, sender && sender.tab, request.url, { capture: request.hover !== true });
      sendResponse({ ok: true });
      return false;
    },
    linkPreviewOpen(request, sender, sendResponse) {
      const tab = sender && sender.tab;
      void open(preview, tab, request.url, readOrigin(request.origin, sender)).then((result) => {
        if (result.reason === 'surface-unavailable') {
          // The page has no preview to show it in: open the link in a tab,
          // as the click would have without the preview.
          void openInTab(preview, tab, request.url);
        }
        sendResponse(result);
      });
      return true;
    },
    linkPreviewCancel(_request, sender, sendResponse) {
      const tabId = getSenderTabId(sender);
      if (tabId !== null) {
        void cancel(preview, tabId);
      }
      sendResponse({ ok: true });
      return false;
    },
    linkPreviewClose(request, sender, sendResponse) {
      const tabId = getSenderTabId(sender);
      if (tabId !== null) {
        void preview.sessions.restored.then(() => discard(preview, tabId, String(request.token || '')));
      }
      sendResponse({ ok: true });
      return false;
    },
    linkPreviewOpenInTab(request, sender, sendResponse) {
      void openInTab(preview, sender && sender.tab, request.url, { split: request.split === true }).then((opened) => {
        sendResponse({ ok: opened });
      });
      return true;
    },
    linkPreviewFrameBind(request, sender, sendResponse) {
      void bindFrame(preview, sender, request.secret).then((bound) => sendResponse({ ok: bound }));
      return true;
    },
    linkPreviewFrameNavigating(request, sender, sendResponse) {
      void noteFrameNavigation(preview, sender, request.url).then((noted) => sendResponse({ ok: noted }));
      return true;
    },
    linkPreviewFrameCommitted(_request, sender, sendResponse) {
      void noteFrameCommitted(preview, sender).then(() => sendResponse({ ok: true }));
      return true;
    },
    linkPreviewFrameRefused(request, sender, sendResponse) {
      const tabId = getSenderTabId(sender);
      if (tabId === null || !sender || sender.frameId !== 0) {
        sendResponse({ retry: false });
        return false;
      }
      void retryRefusedFrame(preview, tabId, String(request.token || '')).then(sendResponse);
      return true;
    }
  });
}

function readPorts(config: LinkPreviewServiceOptions): LinkPreviewPorts {
  return {
    chromeApi: config.chromeApi || null,
    settingsStore: config.settingsStore || null,
    now: typeof config.now === 'function' ? config.now : () => Date.now(),
    setTimer: config.setTimeout || ((callback: () => void, delayMs: number): TimerHandle => setTimeout(callback, delayMs)),
    clearTimer: config.clearTimeout || ((timer: TimerHandle): void => {
      if (typeof timer === 'number') {
        clearTimeout(timer);
      }
    }),
    fetchUrl: typeof config.fetch === 'function' ? config.fetch : (typeof fetch === 'function' ? fetch : null)
  };
}

function createLinkPreviewService(options?: LinkPreviewServiceOptions | null): Readonly<LinkPreviewService> {
  const ports = readPorts(options || {});
  const sessions = new PreviewSessions(ports.settingsStore);
  const preview: LinkPreview = {
    ports,
    sessions,
    rules: new FrameHeaderRules(sessions, (fn) => callback({ ports }, fn)),
    redirects: new RedirectWatch(ports.chromeApi, (details) => {
      void handleFrameRedirect(preview, details);
    })
  };

  return Object.freeze({
    prepare: (tab: chrome.tabs.Tab | null | undefined, url: unknown, prepareOptions?: PrepareOptions) => prepare(preview, tab, url, prepareOptions),
    open: (tab: chrome.tabs.Tab | null | undefined, url: unknown, origin: LinkPreviewOrigin | null) => open(preview, tab, url, origin),
    cancel: (tabId: number) => cancel(preview, tabId),
    discard: (tabId: number, token: string) => discard(preview, tabId, token),
    openInTab: (tab: chrome.tabs.Tab | null | undefined, url: unknown) => openInTab(preview, tab, url),
    bindFrame: (sender: MessageSender | null | undefined, secret: unknown) => bindFrame(preview, sender, secret),
    noteFrameNavigation: (sender: MessageSender | null | undefined, url: unknown) => noteFrameNavigation(preview, sender, url),
    noteFrameCommitted: (sender: MessageSender | null | undefined) => noteFrameCommitted(preview, sender),
    retryRefusedFrame: (tabId: number, token: string) => retryRefusedFrame(preview, tabId, token),
    handleFrameRedirect: (details: FrameRedirect | null | undefined) => handleFrameRedirect(preview, details),
    handleTabRemoved: (tabId: number) => handleTabRemoved(preview, tabId),
    handleTabUpdated: (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo | null | undefined) => handleTabUpdated(preview, tabId, changeInfo),
    reconcileRules: () => reconcileRules(preview),
    attach: () => attach(preview),
    messageHandlers: createMessageHandlers(preview)
  });
}

export {
  attach,
  createLinkPreviewService,
  createMessageHandlers,
  handleTabRemoved,
  handleTabUpdated,
  readOrigin,
  reconcileRules,
  verifyOpenPreview
};
