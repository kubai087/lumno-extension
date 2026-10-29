// What every New Tab feature leans on: the search box's mounted parts, the
// theme mode drawn, the favicon data and caches, the drags and the undo
// lock, the URL and favicon policy, site names, the select menus, tooltips
// and toasts, and Firefox's browser icon index.
import * as LumnoBrowserProfile from '../../platform/browser-profile';
import * as LumnoBrowserIcons from '../../platform/browser-icons';
import * as SITE_DISPLAY_NAME from '../../domain/site-display-name';
import * as NEWTAB_CLIPBOARD_ACTIONS from '../clipboard-actions';
import * as LumnoNewtabDismissStack from '../dismiss-stack';
import * as SearchDirectNavigation from '../../domain/search/utils/direct-navigation';
import * as NEWTAB_TOOLTIP_BINDINGS from '../tooltip-bindings';
import * as NEWTAB_TOOLTIP_CONTROLLERS from '../tooltip-controllers';
import * as NEWTAB_URL_POLICY from '../url-policy';
import { followNewtabVisualViewportInsets } from '../viewport-insets';
import { getNewtabViewportTopPaddingPx } from '../dom/top-inset';
import { createSiteDisplayNameOptions } from '../newtab-config';
import { createToastController } from '../../shared/react/toast';
import { createSelectMenuController } from '../react/select-menu';
import * as FaviconBrowserIconIndex from '../../domain/favicon/browser-icon-index';
import { getPagePortals } from '../app/portals';
import { SearchBoxParts } from '../search/search-box-parts';
import { WebAppearance } from '../search/web-appearance';
import { AppliedThemeMode } from '../theme/applied-theme-mode';
import { DragSessions } from '../drag-sessions';
import { FaviconParts } from '../theme/favicon-parts';
import { createPageFaviconCache } from '../theme/page-favicon-cache';
import { MoveHistoryLock } from '../bookmarks/move-history-lock';
import type { PageContext } from '../app/context';

function createShellFeature(ctx: PageContext) {
  const { preview, settings, t } = ctx;
  const shortcutGrid = ctx.structure.shortcut.grid;

  // The search box's parts, mounted by the search box below.
  const searchBox = new SearchBoxParts();
  // The theme mode the page is drawn in.
  const appliedTheme = new AppliedThemeMode();
  // The page's favicon data and the favicon cache and view, mounted by the page favicons.
  const faviconParts = new FaviconParts();
  // The drags running on the page, and the lock an undoable change holds.
  const dragSessions = new DragSessions();
  const historyLock = new MoveHistoryLock();


  // Firefox: index the browser's own cached icons, which stand in for the
  // missing _favicon endpoint (see createBrowserIconIndex).
  const firefoxBrowserIcons = LumnoBrowserProfile.isFirefoxExtensionRuntime()
    ? FaviconBrowserIconIndex.createBrowserIconIndex()
    : null;
  const firefoxBrowserIconsReady = firefoxBrowserIcons
    ? LumnoBrowserIcons.loadBrowserIcons(firefoxBrowserIcons, chrome).catch(() => {})
    : Promise.resolve();
  followNewtabVisualViewportInsets();

  // Escape closes only the top open layer (menus, popovers, panels, drags).
  // The folder color dialog handles its own Escape.
  const dismissStack = LumnoNewtabDismissStack.getDismissStack();

  // Firefox's website appearance setting, and the slash commands typed in the search box.
  const webAppearance = new WebAppearance();
  const {
    getPageFaviconUrlResolver,
    logFaviconDecision,
    getUrlDisplay,
    isBrowserPageRecentUrl,
    isOwnExtensionUrl,
    getOwnExtensionPageDisplay,
    getExtensionFaviconUrl,
    getGstaticFaviconUrl,
    getChromeFaviconUrl,
    getBrowserPageFaviconUrl,
    getPageFaviconCandidateUrl,
    getPageFaviconRenderCandidates,
    isLocalNetworkHost,
    shouldBlockFaviconForHost,
    shouldAvoidDirectFaviconForHost,
    isUrlBlockedByFaviconRequestBlacklist,
    getNewtabStrictFaviconReason,
    isNewtabEnhancedFaviconFetchEnabled,
    filterBlacklistedSuggestions,
    limitSuggestionsForDisplay,
    shouldExcludeFromRecentSites
  } = NEWTAB_URL_POLICY.createUrlPolicy({
    settings,
    t,
    getBrowserIconUrl: firefoxBrowserIcons ? firefoxBrowserIcons.get : undefined
  });

  // The persisted favicon, icon data and site theme caches.
  const {
    faviconCacheRuntime,
    isBlockedLocalFaviconUrl,
    areFaviconRenderCachesReady,
    waitForFaviconRenderCaches,
    isHostFaviconVisitDirty,
    setPersistedFaviconUrl,
    getPersistedFaviconEntry,
    getPersistedFaviconDataEntry,
    setPersistedFaviconData,
    getPersistedSiteThemeEntry
  } = createPageFaviconCache({ isUrlBlockedByFaviconRequestBlacklist });
  const sanitizeDisplayText = SearchDirectNavigation.sanitizeDisplayText;

  const SITE_DISPLAY_NAME_OPTIONS = createSiteDisplayNameOptions(t);
  function getSiteDisplayName(hostname: string, title?: string): string {
    return SITE_DISPLAY_NAME.getSiteDisplayName(
      hostname,
      title,
      SITE_DISPLAY_NAME_OPTIONS
    );
  }
  // The select menus the shortcut, bookmark and recent site context menus open in.
  const shortcutContextMenuSelectController = createSelectMenuController({
    documentObj: document,
    windowObj: window,
    getViewportTopInset: getNewtabViewportTopPaddingPx
  });
  const bookmarkContextMenuSelectController = createSelectMenuController({
    documentObj: document,
    windowObj: window,
    getViewportTopInset: getNewtabViewportTopPaddingPx
  });
  const recentContextMenuSelectController = createSelectMenuController({
    documentObj: document,
    windowObj: window,
    getViewportTopInset: getNewtabViewportTopPaddingPx
  });

  const {
    topActionTooltipController,
    shortcutTooltipController,
    shortcutDialogTooltipController,
    bookmarkCascadeCopyTooltipController,
    bookmarkCursorTooltipController,
    searchInputCursorTooltipController
  } = NEWTAB_TOOLTIP_CONTROLLERS.createTooltipControllers();

  const {
    showTopActionTooltip,
    hideTopActionTooltip,
    bindSearchInputCursorTooltip,
    hideSearchInputCursorTooltip,
    bindShortcutTooltip,
    hideShortcutTooltip,
    bindShortcutDialogTooltip,
    hideShortcutDialogTooltip,
    bindCursorTooltip,
    hideCursorTooltip
  } = NEWTAB_TOOLTIP_BINDINGS.createTooltipBindings({
    shortcutContextMenuSelectController,
    bookmarkContextMenuSelectController,
    recentContextMenuSelectController,
    dragSessions,
    shortcutGrid,
    searchBox,
    preview,
    topActionTooltipController,
    searchInputCursorTooltipController,
    shortcutTooltipController,
    t,
    shortcutDialogTooltipController,
    bookmarkCursorTooltipController
  });

  const {
    hideToast,
    showToast,
    beginToast,
    copyBookmarkUrl,
    copySearchResultUrl
  } = NEWTAB_CLIPBOARD_ACTIONS.createClipboardActions({
    t,
    toastController: createToastController(document.getElementById('_x_extension_toast_2024_unique_'), getPagePortals(), { windowObj: window })
  });

  return {
    appliedTheme,
    areFaviconRenderCachesReady,
    beginToast,
    bindCursorTooltip,
    bindSearchInputCursorTooltip,
    bindShortcutDialogTooltip,
    bindShortcutTooltip,
    bookmarkCascadeCopyTooltipController,
    bookmarkContextMenuSelectController,
    bookmarkCursorTooltipController,
    copyBookmarkUrl,
    copySearchResultUrl,
    dismissStack,
    dragSessions,
    faviconCacheRuntime,
    faviconParts,
    filterBlacklistedSuggestions,
    firefoxBrowserIcons,
    firefoxBrowserIconsReady,
    getBrowserPageFaviconUrl,
    getChromeFaviconUrl,
    getExtensionFaviconUrl,
    getGstaticFaviconUrl,
    getNewtabStrictFaviconReason,
    getOwnExtensionPageDisplay,
    getPageFaviconCandidateUrl,
    getPageFaviconRenderCandidates,
    getPageFaviconUrlResolver,
    getPersistedFaviconDataEntry,
    getPersistedFaviconEntry,
    getPersistedSiteThemeEntry,
    getSiteDisplayName,
    getUrlDisplay,
    hideCursorTooltip,
    hideSearchInputCursorTooltip,
    hideShortcutDialogTooltip,
    hideShortcutTooltip,
    hideToast,
    hideTopActionTooltip,
    historyLock,
    isBlockedLocalFaviconUrl,
    isBrowserPageRecentUrl,
    isHostFaviconVisitDirty,
    isLocalNetworkHost,
    isNewtabEnhancedFaviconFetchEnabled,
    isOwnExtensionUrl,
    limitSuggestionsForDisplay,
    logFaviconDecision,
    recentContextMenuSelectController,
    sanitizeDisplayText,
    searchBox,
    setPersistedFaviconData,
    setPersistedFaviconUrl,
    shortcutContextMenuSelectController,
    shouldAvoidDirectFaviconForHost,
    shouldBlockFaviconForHost,
    shouldExcludeFromRecentSites,
    showToast,
    showTopActionTooltip,
    topActionTooltipController,
    waitForFaviconRenderCaches,
    webAppearance
  };
}

type ShellFeature = ReturnType<typeof createShellFeature>;

export { createShellFeature };
export type { ShellFeature };
