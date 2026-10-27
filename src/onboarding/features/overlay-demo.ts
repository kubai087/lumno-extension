// The demo overlay: the overlay the worker injects into web pages, opened on
// this page the same way. The page imports it and sends it the same toggle,
// with this tab's zoom and the browser's open tabs; the browser's own search
// command reaches the page through the worker.
import type { OkReply, OverlayTab } from '../../domain/messages';
import type { BackgroundRequest } from '../../domain/messages';
import { INJECTED_APP_PATHS } from '../../domain/injected-commands';
import type { OverlayToggleCommand } from '../../domain/injected-commands';
import * as LumnoMessaging from '../../platform/messaging';

// The message the worker forwards when the search command fires here.
const ONBOARDING_SEARCH_OVERLAY_COMMAND_ACTION = 'triggerOnboardingSearchOverlayFromCommand';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function getCurrentOnboardingTab(done: (tab: chrome.tabs.Tab | null) => void): void {
  const chromeApi = typeof chrome !== 'undefined' ? chrome : null;
  if (!chromeApi || !chromeApi.tabs || typeof chromeApi.tabs.getCurrent !== 'function') {
    done(null);
    return;
  }
  try {
    chromeApi.tabs.getCurrent((tab) => {
      if (chromeApi.runtime && chromeApi.runtime.lastError) {
        done(null);
        return;
      }
      done(tab || null);
    });
  } catch (error) {
    done(null);
  }
}

function getOnboardingTabZoomFactor(tabId: number | null, done: (zoomFactor: number) => void): void {
  const chromeApi = typeof chrome !== 'undefined' ? chrome : null;
  if (!chromeApi || !chromeApi.tabs || typeof chromeApi.tabs.getZoom !== 'function' || typeof tabId !== 'number') {
    done(1);
    return;
  }
  try {
    chromeApi.tabs.getZoom(tabId, (zoomFactor) => {
      if (chromeApi.runtime && chromeApi.runtime.lastError) {
        done(1);
        return;
      }
      const zoom = Number(zoomFactor);
      done(Number.isFinite(zoom) && zoom > 0 ? zoom : 1);
    });
  } catch (error) {
    done(1);
  }
}

function getOnboardingOverlayTabs(
  currentTabId: number | null,
  done: (tabs: readonly OverlayTab[], currentTabId: number | null) => void
): void {
  const chromeApi = typeof chrome !== 'undefined' ? chrome : null;
  if (!chromeApi || !chromeApi.runtime || typeof chromeApi.runtime.sendMessage !== 'function') {
    done([], currentTabId);
    return;
  }
  const request: BackgroundRequest<'getTabsForOverlay'> = { action: 'getTabsForOverlay' };
  if (typeof currentTabId === 'number') {
    request.currentTabId = currentTabId;
  }
  try {
    LumnoMessaging.sendBackgroundMessage(chromeApi.runtime, request, (response) => {
      if (chromeApi.runtime && chromeApi.runtime.lastError) {
        done([], currentTabId);
        return;
      }
      const tabs = response && Array.isArray(response.tabs) ? response.tabs : [];
      const responseCurrentTabId = response && typeof response.currentTabId === 'number'
        ? response.currentTabId
        : currentTabId;
      done(tabs, responseCurrentTabId);
    });
  } catch (error) {
    done([], currentTabId);
  }
}

// The demo overlay is the overlay the worker injects into web pages: the
// page imports it the same way and sends it the same toggle.
function openDemoOverlay(): void {
  const chromeApi = typeof chrome !== 'undefined' ? chrome : null;
  const runtime = chromeApi && chromeApi.runtime;
  if (!runtime || typeof runtime.getURL !== 'function') {
    return;
  }
  const overlayUrl = runtime.getURL(INJECTED_APP_PATHS.overlay);
  getCurrentOnboardingTab((tab) => {
    const currentTabId = tab && typeof tab.id === 'number' ? tab.id : null;
    getOnboardingTabZoomFactor(currentTabId, (tabZoomFactor) => {
      getOnboardingOverlayTabs(currentTabId, (tabs, responseCurrentTabId) => {
        const command: OverlayToggleCommand = {
          type: 'toggle',
          tabs,
          context: {
            tabZoomFactor,
            currentTabId: typeof responseCurrentTabId === 'number' ? responseCurrentTabId : currentTabId,
            currentTabUrl: window.location && window.location.href ? window.location.href : ''
          }
        };
        import(overlayUrl).then((overlay: unknown) => {
          const run: unknown = overlay && typeof overlay === 'object' ? Reflect.get(overlay, 'run') : null;
          if (typeof run === 'function') {
            Reflect.apply(run, overlay, [command]);
          }
        }).catch((error: unknown) => {
          console.warn('[Lumno] The demo overlay could not load.', error);
        });
      });
    });
  });
}

function handleOnboardingCommandMessage(
  request: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (reply: OkReply) => void
): boolean {
  if (!isRecord(request) || request.action !== ONBOARDING_SEARCH_OVERLAY_COMMAND_ACTION) {
    return false;
  }
  const requestedTabId = Number.isFinite(Number(request.tabId)) ? Number(request.tabId) : null;
  getCurrentOnboardingTab((tab) => {
    const currentTabId = tab && typeof tab.id === 'number' ? tab.id : null;
    if (typeof requestedTabId === 'number' && typeof currentTabId === 'number' && currentTabId !== requestedTabId) {
      if (typeof sendResponse === 'function') {
        sendResponse({ ok: false, reason: 'tab-mismatch' });
      }
      return;
    }
    openDemoOverlay();
    if (typeof sendResponse === 'function') {
      sendResponse({ ok: true });
    }
  });
  return true;
}

// Answers the worker's forwarded search command.
function followSearchCommand(): void {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage &&
      typeof chrome.runtime.onMessage.addListener === 'function') {
    chrome.runtime.onMessage.addListener(handleOnboardingCommandMessage);
  }
}

export { followSearchCommand, openDemoOverlay };
