// What the popup learns about the page it opened on, once, as it opens: the
// tab and how to show it, the shortcuts that act on it, its video, and
// whether it is among the New Tab's pinned recent sites.
import * as LumnoBrowserProfile from '../platform/browser-profile';
import * as LumnoShortcutDisplay from '../domain/shortcut-display';
import * as LumnoUrlGuards from '../platform/url-guards';
import { executeInTab, queryActiveTab, readCommands, sendMessage } from './browser';
import { describePage, isWebUrl } from './model';
import type { PageDescription, PopupRecentPin, PopupState, PopupTab } from './model';

type PopupPageFacts = Pick<PopupState, 'tab' | 'restricted' | 'documentPipSupported' | 'shortcuts' | 'version'> & {
  recentPin: PopupRecentPin | null;
  pip: { supported: boolean; hasVideo: boolean; active: boolean };
};

const COMMAND_SHOW_SEARCH = 'show-search';
const COMMAND_COPY_URL = 'show-search-prefill-v';
const VIDEO_PROBE_TIMEOUT_MS = 250;

// A web page's favicon, from the browser's cache where it offers one.
function getFaviconUrl(chromeApi: typeof chrome, tab: PopupTab, page: PageDescription): string {
  if (page.kind !== 'web') return '';
  const url = String(tab.url || '');
  const manifest = chromeApi.runtime.getManifest();
  if (isWebUrl(url) && Array.isArray(manifest.permissions) && manifest.permissions.includes('favicon')) {
    return chromeApi.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`);
  }
  return String(tab.favIconUrl || '');
}

function readTab(chromeApi: typeof chrome, activeTab: chrome.tabs.Tab | null): PopupTab | null {
  if (!activeTab || typeof activeTab.id !== 'number') {
    return null;
  }
  const url = String(activeTab.url || activeTab.pendingUrl || '');
  const tab: PopupTab = { id: activeTab.id, url, title: String(activeTab.title || ''), favIconUrl: activeTab.favIconUrl };
  const page = describePage(url, {
    ownBase: chromeApi.runtime.getURL(''),
    browserName: LumnoBrowserProfile.getBrowserInternalProfile(globalThis.navigator).name,
    isBrowserInternalUrl: LumnoUrlGuards.isBrowserInternalUrl
  });
  tab.iconUrl = page.iconPath ? chromeApi.runtime.getURL(page.iconPath) : getFaviconUrl(chromeApi, tab, page);
  tab.iconName = page.iconName;
  tab.host = page.host;
  return tab;
}

function readShortcuts(chromeApi: typeof chrome): Promise<PopupState['shortcuts']> {
  return readCommands(chromeApi).then((list) => {
    const find = (name: string): string => {
      const command = list.find((item) => item.name === name);
      return command && command.shortcut
        ? LumnoShortcutDisplay.formatShortcutChord(command.shortcut, { navigatorLike: globalThis.navigator })
        : '';
    };
    return { search: find(COMMAND_SHOW_SEARCH), copy: find(COMMAND_COPY_URL) };
  });
}

// Whether the page has a video picture-in-picture can show, and whether
// one already floats. A page that does not answer in time counts as none.
function probeVideo(chromeApi: typeof chrome, tabId: number): Promise<Record<string, unknown> | null> {
  const probe = executeInTab(chromeApi, tabId, {
    func: () => ({
      hasVideo: Array.from(document.querySelectorAll('video')).some((video) => video.readyState >= 1),
      active: Boolean(document.pictureInPictureElement)
    })
  });
  const timeout = new Promise<null>((resolve) => globalThis.setTimeout(() => resolve(null), VIDEO_PROBE_TIMEOUT_MS));
  return Promise.race([probe, timeout]);
}

async function loadPageFacts(chromeApi: typeof chrome): Promise<PopupPageFacts> {
  // Firefox pages have no requestPictureInPicture.
  const pipSupported = typeof globalThis.HTMLVideoElement === 'function' &&
    typeof globalThis.HTMLVideoElement.prototype.requestPictureInPicture === 'function';
  const [activeTab, shortcuts] = await Promise.all([queryActiveTab(chromeApi), readShortcuts(chromeApi)]);
  const tab = readTab(chromeApi, activeTab);
  const restricted = tab ? LumnoUrlGuards.isRestrictedUrl(tab.url) : true;
  const [video, recentPin] = await Promise.all([
    tab && !restricted && pipSupported ? probeVideo(chromeApi, tab.id) : Promise.resolve(null),
    tab ? sendMessage(chromeApi, { action: 'popupGetRecentPin', tabId: tab.id }) : Promise.resolve(null)
  ]);
  return {
    tab,
    restricted,
    documentPipSupported: 'documentPictureInPicture' in globalThis,
    shortcuts,
    version: chromeApi.runtime.getManifest().version || '',
    recentPin: recentPin ? { pinned: recentPin.pinned === true, full: recentPin.full === true } : null,
    pip: {
      supported: pipSupported,
      hasVideo: Boolean(video && video.hasVideo === true),
      active: Boolean(video && video.active === true)
    }
  };
}

export { loadPageFacts };
export type { PopupPageFacts };
