// What a slide's buttons do: step through the slides, open Lumno's pages
// and links, and send the worker the actions that open browser pages. The
// click decides whether a page opens here, in a new tab or behind.
import * as LumnoExtensionRoutes from '../../domain/extension-routes';
import * as NAVIGATION_DISPOSITION from '../../domain/navigation-disposition';
import type { Disposition } from '../../domain/navigation-disposition';
import * as COMMUNITY_LINKS from '../../platform/community-links';
import * as LumnoMessaging from '../../platform/messaging';
import type { OnboardingFlow } from './flow';

// The background messages the slide actions send.
type ActionMessage =
  | 'openExtensionShortcutsPage'
  | 'openExtensionDetailsPage'
  | 'openNewTab'
  | 'openOptionsPage'
  | 'openSiteSearchOptionsPage';

const SITE_SEARCH_OPTIONS_PAGE_PATH = 'src/options/options.html#shortcuts';
const FOCUSED_NEWTAB_RELATIVE_PAGE_PATH = '../newtab/lumno-newtab.html?focus=1';
const ACTION_MESSAGE_BY_ID: ReadonlyMap<string, ActionMessage> = new Map<string, ActionMessage>([
  ['openShortcuts', 'openExtensionShortcutsPage'],
  ['openExtensionDetails', 'openExtensionDetailsPage'],
  ['openNewtab', 'openNewTab'],
  ['openOptions', 'openOptionsPage'],
  ['openSiteSearchOptions', 'openSiteSearchOptionsPage']
]);

function buildRuntimePageUrl(path: string): string {
  const value = path.trim();
  if (!value) {
    return '';
  }
  const chromeApi = typeof chrome !== 'undefined' ? chrome : null;
  const hashIndex = value.indexOf('#');
  const pagePath = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
  const hash = hashIndex >= 0 ? value.slice(hashIndex + 1) : '';
  const baseUrl = chromeApi &&
      chromeApi.runtime &&
      typeof chromeApi.runtime.getURL === 'function'
    ? chromeApi.runtime.getURL(pagePath)
    : pagePath;
  return hash ? `${baseUrl}#${hash}` : baseUrl;
}

function navigateOnboardingToNewtab(): boolean {
  const chromeApi = typeof chrome !== 'undefined' ? chrome : null;
  const routes = LumnoExtensionRoutes;
  let url = '';
  url = routes.buildLumnoNewtabUrl(chromeApi, { focus: true });
  if (!url && chromeApi && chromeApi.runtime && typeof chromeApi.runtime.getURL === 'function') {
    url = chromeApi.runtime.getURL('src/newtab/lumno-newtab.html?focus=1');
  }
  if (!url && typeof window !== 'undefined' && window.location) {
    try {
      url = new URL(FOCUSED_NEWTAB_RELATIVE_PAGE_PATH, window.location.href).toString();
    } catch (error) {
      url = FOCUSED_NEWTAB_RELATIVE_PAGE_PATH;
    }
  }
  if (!url || typeof window === 'undefined' || !window.location) {
    return false;
  }
  try {
    if (typeof window.location.assign === 'function') {
      window.location.assign(url);
      return true;
    }
    window.location.href = url;
    return true;
  } catch (error) {
    return false;
  }
}

function openExtensionPageTab(path: string, disposition: Disposition): boolean {
  const url = buildRuntimePageUrl(path);
  if (!url) {
    return false;
  }
  const chromeApi = typeof chrome !== 'undefined' ? chrome : null;
  if (chromeApi && chromeApi.tabs && typeof chromeApi.tabs.create === 'function') {
    try {
      chromeApi.tabs.create({ url, active: disposition !== 'backgroundTab' });
      return true;
    } catch (error) {
      // Fall through to window.open when the tabs API is unavailable.
    }
  }
  if (typeof window.open === 'function') {
    window.open(url, '_blank', 'noopener');
    return true;
  }
  return false;
}

function openSiteSearchOptionsFallback(disposition: Disposition): boolean {
  return openExtensionPageTab(SITE_SEARCH_OPTIONS_PAGE_PATH, disposition);
}

function openExternalTab(url: string, disposition: Disposition): boolean {
  const targetUrl = url.trim();
  if (!targetUrl) {
    return false;
  }
  const chromeApi = typeof chrome !== 'undefined' ? chrome : null;
  if (chromeApi && chromeApi.runtime && typeof chromeApi.runtime.sendMessage === 'function') {
    try {
      LumnoMessaging.sendBackgroundMessage(chromeApi.runtime, { action: 'createTab', url: targetUrl, disposition }, (response) => {
        const lastError = chromeApi.runtime && chromeApi.runtime.lastError;
        if (!lastError && response && response.ok !== false) {
          return;
        }
        if (typeof window.open === 'function') {
          window.open(targetUrl, '_blank', 'noopener');
        }
      });
      return true;
    } catch (error) {
      // Fall through to window.open when extension messaging is unavailable.
    }
  }
  if (typeof window.open === 'function') {
    window.open(targetUrl, '_blank', 'noopener');
    return true;
  }
  return false;
}

// Runs a slide action by its id; the click decides where a page opens.
function runSlideAction(flow: Pick<OnboardingFlow, 'dispatch' | 'store'>, id: string, event?: MouseEvent): void {
  if (!id) {
    return;
  }
  const disposition = NAVIGATION_DISPOSITION.getDisposition(event, 'newTab');
  if (id === 'next') {
    flow.dispatch({ type: 'NEXT' });
    return;
  }
  if (id === 'prev') {
    flow.dispatch({ type: 'PREV' });
    return;
  }
  if (id === 'openChromeWebStore') {
    openExternalTab(COMMUNITY_LINKS.getStoreListing().url, disposition);
    return;
  }
  if (id === 'openHelpCenter') {
    const { blueprint } = flow.store.getSnapshot();
    openExternalTab(COMMUNITY_LINKS.getHelpUrl(blueprint && blueprint.htmlLang), disposition);
    return;
  }
  if (id === 'openNewtab') {
    if (disposition !== 'backgroundTab') {
      if (navigateOnboardingToNewtab()) {
        return;
      }
    }
  }

  const chromeApi = typeof chrome !== 'undefined' ? chrome : null;
  const messageAction = ACTION_MESSAGE_BY_ID.get(id);
  if (!messageAction || !chromeApi || !chromeApi.runtime || typeof chromeApi.runtime.sendMessage !== 'function') {
    if (id === 'openSiteSearchOptions') {
      openSiteSearchOptionsFallback(disposition);
    }
    return;
  }
  try {
    LumnoMessaging.sendBackgroundMessage(chromeApi.runtime, {
      action: messageAction,
      disposition
    }, (response) => {
      const lastError = chromeApi.runtime && chromeApi.runtime.lastError;
      if (id === 'openSiteSearchOptions' && (lastError || !response || response.ok === false)) {
        openSiteSearchOptionsFallback(disposition);
      }
    });
  } catch (error) {
    if (id === 'openSiteSearchOptions') {
      openSiteSearchOptionsFallback(disposition);
    }
  }
}

export { runSlideAction };
