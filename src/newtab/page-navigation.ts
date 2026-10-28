// Opening URLs, bookmarks, shortcuts and searches from the New Tab with the
// right tab disposition.
import type * as NavigationDisposition from '../domain/navigation-disposition';
import type { DefaultTabOpen, Disposition, OpenEvent } from '../domain/navigation-disposition';
import type { NewtabOpenInNewTabSurface } from '../domain/settings';
import * as LumnoMessaging from '../platform/messaging';
import type { BookmarksRuntime } from './bookmarks/bookmarks-runtime';
import type { BookmarkNode } from './bookmarks/bookmarks-store';
import type { ShowToast, Translate } from './newtab-types';
import type { ShortcutItem, VisibleShortcutItem } from '../domain/shortcuts/types';
import type { DefaultSearchEngine } from '../shared/search-panel/default-engine';
import { newtabOpenInNewTab } from '../domain/settings/newtab-page';
import { numberShortcutInstantEnabled } from '../domain/settings/search';
import type { SettingsStore } from '../platform/settings-store';
import type { SearchQuery } from '../shared/search-panel/search-query';

// A shortcut as the page opens it: a site, or a bookmark folder.
type OpenableShortcut = ShortcutItem | VisibleShortcutItem;

// The keys a surface's click or Enter was made with.
type SurfaceOpenKeys = Pick<DefaultTabOpen, 'openInBackgroundTab' | 'openInOtherTab'>;

// A suggestion whose choice counts toward its future ranking.
interface SelectableSuggestion {
  url?: string;
  title?: string;
  type?: string;
  provider?: unknown;
  forceSearch?: boolean;
}

interface PageNavigationState {
  inputParts: { input: HTMLInputElement } | null;
}

interface PageNavigationDeps {
  searchQuery: SearchQuery;
  settings: Pick<SettingsStore, 'get'>;
  NAVIGATION_DISPOSITION: Pick<typeof NavigationDisposition,
    'isMiddleClick' | 'isBackgroundOpenEvent' | 'getDisposition' | 'getDefaultTabDisposition'>;
  getShortcutTileById(id: string): HTMLElement | null;
  bookmarksRuntime: Pick<BookmarksRuntime, 'ensureReady' | 'getNode'>;
  getShortcutFolderId(shortcut: OpenableShortcut): string;
  showToast: ShowToast;
  t: Translate;
  openBookmarkCascadeMenu(folder: BookmarkNode & { type: 'folder' }, anchor: HTMLElement | null): void;
  navigateBookmarkFolder(id: string): void;
  getDirectNavigationUrl(query: string): string;
  searchEngine: Pick<DefaultSearchEngine, 'searchUrl'>;
  pageState: PageNavigationState;
}

function createPageNavigation(deps: PageNavigationDeps) {
  const {
    searchQuery,
    settings,
    NAVIGATION_DISPOSITION,
    getShortcutTileById,
    bookmarksRuntime,
    getShortcutFolderId,
    showToast,
    t,
    openBookmarkCascadeMenu,
    navigateBookmarkFolder,
    getDirectNavigationUrl,
    searchEngine
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  function navigateToUrl(url: string | null | undefined): void {
    if (!url) {
      return;
    }
    if (chrome.tabs && chrome.tabs.getCurrent) {
      chrome.tabs.getCurrent(function(tab) {
        if (chrome.runtime.lastError) {
          window.location.href = url;
          return;
        }
        if (tab && tab.id) {
          chrome.tabs.update(tab.id, { url: url });
        } else {
          window.location.href = url;
        }
      });
    } else {
      window.location.href = url;
    }
  }

  function isMiddleClick(event: OpenEvent | null | undefined): boolean {
    return NAVIGATION_DISPOSITION.isMiddleClick(event);
  }

  function isBackgroundOpenEvent(event: OpenEvent | null | undefined): boolean {
    if (settings.get(numberShortcutInstantEnabled)) {
      return isMiddleClick(event);
    }
    return NAVIGATION_DISPOSITION.isBackgroundOpenEvent(event);
  }

  function getOpenDisposition(event: OpenEvent | Disposition | null | undefined, fallback?: Disposition): Disposition {
    if (typeof event === 'string') {
      return event === 'backgroundTab' ? 'backgroundTab' : (fallback || event || 'newTab');
    }
    return NAVIGATION_DISPOSITION.getDisposition(event, fallback);
  }

  function openExternalNewTabUrl(url: string | null | undefined, eventOrDisposition?: OpenEvent | Disposition | null): boolean {
    if (!url) {
      return false;
    }
    const disposition = typeof eventOrDisposition === 'string'
      ? eventOrDisposition
      : getOpenDisposition(eventOrDisposition, 'newTab');
    if (chrome && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'createTab',
        url,
        disposition
      });
      return true;
    }
    if (chrome && chrome.tabs && typeof chrome.tabs.create === 'function') {
      chrome.tabs.create({ url, active: disposition !== 'backgroundTab' });
      return true;
    }
    window.open(url, '_blank', 'noopener');
    return true;
  }

  // A plain click opens in the current tab unless the surface's "open in a new
  // tab" setting is on; Option/Alt opens in the other one, and a
  // background-open click goes to the background.
  function getSurfaceOpenDisposition(surface: string | undefined, keys: SurfaceOpenKeys): Disposition {
    const prefs = settings.get(newtabOpenInNewTab);
    return NAVIGATION_DISPOSITION.getDefaultTabDisposition({
      ...keys,
      currentTabByDefault: !(prefs && isOpenInNewTabSurface(surface) && prefs[surface] === true)
    });
  }

  function isOpenInNewTabSurface(surface: string | undefined): surface is NewtabOpenInNewTabSurface {
    return surface === 'search' || surface === 'shortcuts' || surface === 'bookmarks' || surface === 'recentSites';
  }

  // Returns where the URL went, so a card can tell whether the New Tab is
  // navigating away or staying behind.
  function openUrlFromNewtabCard(
    url: string | null | undefined,
    options?: (SurfaceOpenKeys & { surface?: string }) | null
  ): Disposition | '' {
    if (!url) {
      return '';
    }
    const config = options && typeof options === 'object' ? options : {};
    const disposition = getSurfaceOpenDisposition(config.surface, config);
    if (disposition !== 'currentTab' &&
        chrome && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'createTab',
        url: url,
        disposition
      });
      return disposition;
    }
    navigateToUrl(url);
    return 'currentTab';
  }

  function openShortcutUrl(shortcut: OpenableShortcut | null | undefined, event?: OpenEvent | null): void {
    if (shortcut && shortcut.type === 'folder') {
      const tile = getShortcutTileById(shortcut.id);
      void bookmarksRuntime.ensureReady(false).then((ready) => {
        const node = ready && bookmarksRuntime.getNode(getShortcutFolderId(shortcut));
        if (!node || node.url) {
          showToast(t('newtab_shortcuts_folder_missing', 'This bookmark folder is no longer available.'), true);
          return;
        }
        openBookmarkCascadeMenu({ ...node, type: 'folder' }, tile);
      });
      return;
    }
    if (!shortcut || !('url' in shortcut) || !shortcut.url) {
      return;
    }
    openUrlFromNewtabCard(shortcut.url, {
      openInBackgroundTab: isBackgroundOpenEvent(event),
      openInOtherTab: Boolean(event && event.altKey),
      surface: 'shortcuts'
    });
  }

  function recordSearchSuggestionSelection(suggestion: SelectableSuggestion | null | undefined, rawQuery?: string): void {
    if (!suggestion || suggestion.forceSearch || suggestion.provider || !suggestion.url ||
        !chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      return;
    }
    const query = String(rawQuery || searchQuery.raw || (pageState.inputParts && pageState.inputParts.input ? pageState.inputParts.input.value : '') || '').trim();
    if (!query) {
      return;
    }
    LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
      action: 'recordSearchSuggestionSelection',
      query,
      url: suggestion.url,
      title: suggestion.title || '',
      type: suggestion.type || 'history',
      source: 'newtab'
    }, () => {
      if (chrome.runtime && chrome.runtime.lastError) {
        // Best-effort ranking signal.
      }
    });
  }

  function openBookmarkFolder(nodeId: unknown): void {
    const id = String(nodeId || '').trim();
    if (!id) {
      return;
    }
    navigateBookmarkFolder(id);
  }

  function markCurrentTabForSearchTracking(): void {
    if (!chrome || !chrome.tabs || !chrome.tabs.getCurrent || !chrome.runtime || !chrome.runtime.sendMessage) {
      return;
    }
    chrome.tabs.getCurrent((tab) => {
      if (tab && typeof tab.id === 'number') {
        LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'trackSearchTab', tabId: tab.id });
      }
    });
  }

  function runBrowserSearch(query: string, disposition: Parameters<typeof chrome.search.query>[0]['disposition'], onFail?: () => void): boolean {
    if (chrome && chrome.search && typeof chrome.search.query === 'function') {
      try {
        chrome.search.query({ text: query, disposition: disposition || 'CURRENT_TAB' }, () => {
          if (chrome.runtime && chrome.runtime.lastError && typeof onFail === 'function') {
            onFail();
          }
        });
        return true;
      } catch {
        if (typeof onFail === 'function') {
          onFail();
        }
        return false;
      }
    }
    return false;
  }

  function navigateToQuery(query: string, forceSearch?: boolean, disposition?: Disposition): void {
    if (disposition && disposition !== 'currentTab' &&
        chrome && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'searchOrNavigate',
        query: query,
        forceSearch: Boolean(forceSearch),
        disposition
      });
      return;
    }
    const directUrl = !forceSearch ? getDirectNavigationUrl(query) : '';
    let targetUrl = query;
    if (directUrl) {
      navigateToUrl(directUrl);
      return;
    }
    markCurrentTabForSearchTracking();
    const attempted = runBrowserSearch(query, 'CURRENT_TAB', () => {
      const fallbackUrl = searchEngine.searchUrl(query);
      navigateToUrl(fallbackUrl);
    });
    if (attempted) {
      return;
    }
    targetUrl = searchEngine.searchUrl(query);
    navigateToUrl(targetUrl);
  }

  return {
    navigateToUrl,
    isMiddleClick,
    isBackgroundOpenEvent,
    getOpenDisposition,
    getSurfaceOpenDisposition,
    openExternalNewTabUrl,
    openUrlFromNewtabCard,
    openShortcutUrl,
    recordSearchSuggestionSelection,
    openBookmarkFolder,
    navigateToQuery
  };
}

type PageNavigation = ReturnType<typeof createPageNavigation>;

export { createPageNavigation };
export type { PageNavigation, PageNavigationDeps, PageNavigationState, SurfaceOpenKeys };
