// Builds the recent section: its pointer tracking, heading and mode
// switch, grid and the recent sites view.
import type { BindCursorTooltip, FormatMessage, ShowToast, Translate } from '../newtab-types';
import type { PageStructureRuntime } from '../react/page-structure';
import type { RecentSitesViewOptions } from '../react/recent-sites';
import { createRecentSitesView } from '../react/recent-sites';
import type { SettingsStore } from '../../platform/settings-store';
import { recentMode } from '../../domain/settings/recent-sites';
import type { RecentSitesController } from './recent-sites-controller';
import { MAX_PINNED_RECENT_SITES } from '../newtab-config';
import type { RecentPointer } from './recent-pointer';
import { recentEvents } from './recent-events';
import type { SurfaceLocale } from '../../shared/i18n/surface-locale';

// An option the recent sites view is handed as it is.
type ViewOption<K extends keyof RecentSitesViewOptions> = NonNullable<RecentSitesViewOptions[K]>;

interface RecentSectionState {
  // Starts a drag when a press on a card moves far enough.
  recentCardDragRuntime: { handleRecentCardPointerDown: ViewOption<'onCardPointerDown'> } | null;
}

interface RecentSectionDeps {
  getPinnedRecentSites: RecentSitesController['getPinnedRecentSites'];
  settings: Pick<SettingsStore, 'get' | 'subscribe'>;
  setContentSectionVisible(section: HTMLElement | null, visible: boolean): void;
  hideTopActionTooltip(): void;
  pageStructureRuntime: { recent: Pick<PageStructureRuntime['recent'], 'section' | 'header' | 'grid' | 'renderHeader'> };
  t: Translate;
  setRecentMode(mode: string): void;
  applyRecentGridColumns(): void;
  recentCards: ViewOption<'cards'>;
  formatMessage: FormatMessage;
  sanitizeDisplayText: ViewOption<'sanitizeDisplayText'>;
  getOwnExtensionPageDisplay: ViewOption<'getOwnExtensionPageDisplay'>;
  getHostFromUrl: ViewOption<'getHostFromUrl'>;
  getCanonicalPageUrlForFavicon: ViewOption<'getCanonicalPageUrlForFavicon'>;
  getSiteDisplayName: ViewOption<'getSiteDisplayName'>;
  getUrlDisplay: ViewOption<'getUrlDisplay'>;
  attachFaviconWithFallbacks: ViewOption<'attachFaviconWithFallbacks'>;
  getBrowserPageFaviconUrl: ViewOption<'getBrowserPageFaviconUrl'>;
  getImmediateThemeForSuggestion: ViewOption<'getImmediateThemeForSuggestion'>;
  queueThemeForTarget: ViewOption<'queueThemeForTarget'>;
  applyRecentCardTheme: ViewOption<'applyCardTheme'>;
  getRecentLimit(): number;
  isRecentSitePinned: ViewOption<'isPinned'>;
  showToast: ShowToast;
  showTopActionTooltip: ViewOption<'showTopActionTooltip'>;
  navigateToUrl: ViewOption<'navigateToUrl'>;
  bindCursorTooltip: BindCursorTooltip;
  hideCursorTooltip(): void;
  // Returns where the URL opened; anything but 'currentTab' keeps this page.
  openUrlFromNewtabCard(url: string, options: { openInBackgroundTab: boolean; openInOtherTab: boolean; surface: string }): string | void;
  togglePinnedRecentSite: ViewOption<'togglePinned'>;
  handleRecentCardContextMenu: ViewOption<'onItemContextMenu'>;
  isCardActivationSuppressed(): boolean;
  getRecentProgressState: ViewOption<'getProgressState'>;
  toggleRecentProgressTracking: ViewOption<'toggleProgressTracking'>;
  recentPointer: RecentPointer;
  pageState: RecentSectionState;
  locale: Pick<SurfaceLocale, 'store'>;
}

function createRecentSection(deps: RecentSectionDeps) {
  const {
    getPinnedRecentSites,
    settings,
    setContentSectionVisible,
    hideTopActionTooltip,
    pageStructureRuntime,
    t,
    setRecentMode,
    applyRecentGridColumns,
    recentCards,
    formatMessage,
    sanitizeDisplayText,
    getOwnExtensionPageDisplay,
    getHostFromUrl,
    getCanonicalPageUrlForFavicon,
    getSiteDisplayName,
    getUrlDisplay,
    attachFaviconWithFallbacks,
    getBrowserPageFaviconUrl,
    getImmediateThemeForSuggestion,
    queueThemeForTarget,
    applyRecentCardTheme,
    getRecentLimit,
    isRecentSitePinned,
    showToast,
    showTopActionTooltip,
    navigateToUrl,
    bindCursorTooltip,
    hideCursorTooltip,
    openUrlFromNewtabCard,
    togglePinnedRecentSite,
    handleRecentCardContextMenu,
    isCardActivationSuppressed,
    getRecentProgressState,
    toggleRecentProgressTracking,
    recentPointer,
    locale
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  const section = pageStructureRuntime.recent.section;

  setContentSectionVisible(section, false);
  section.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse') {
      return;
    }
    recentPointer.enter();
  });
  section.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'mouse') {
      return;
    }
    recentPointer.leave();
    hideTopActionTooltip();
  });
  section.addEventListener('pointercancel', () => {
    recentPointer.cancel();
    hideTopActionTooltip();
  });
  // The mode switch shows the current mode's name, so it stands in for the plain heading.
  function renderRecentHeader(): void {
    const latest = t('recent_heading_latest', 'Recent visits');
    const most = t('recent_heading_most', 'Most visited');
    pageStructureRuntime.recent.renderHeader({
      heading: settings.get(recentMode) === 'most' ? most : latest,
      modeSwitch: {
        title: t('display_mode_title', 'Display mode'),
        value: settings.get(recentMode),
        options: [{ value: 'latest', label: latest }, { value: 'most', label: most }],
        onChange: (nextMode) => setRecentMode(nextMode)
      }
    });
  }
  renderRecentHeader();
  // The heading follows the language and the mode, whoever changed it.
  locale.store.subscribe(renderRecentHeader);
  settings.subscribe(recentMode, renderRecentHeader);
  applyRecentGridColumns();
  const recentSitesView = createRecentSitesView({
    documentObj: document,
    windowObj: window,
    grid: pageStructureRuntime.recent.grid,
    cards: recentCards,
    t,
    formatMessage,
    sanitizeDisplayText,
    getOwnExtensionPageDisplay,
    getHostFromUrl,
    getCanonicalPageUrlForFavicon,
    getSiteDisplayName,
    getUrlDisplay,
    attachFaviconWithFallbacks,
    getBrowserPageFaviconUrl,
    getImmediateThemeForSuggestion,
    queueThemeForTarget,
    applyCardTheme: applyRecentCardTheme,
    getCurrentRecentCount: () => getRecentLimit(),
    isPinned: isRecentSitePinned,
    getPinnedCount: () => getPinnedRecentSites().length,
    getMaxPinnedCount: () => MAX_PINNED_RECENT_SITES,
    showToast,
    showTopActionTooltip,
    hideTopActionTooltip,
    navigateToUrl,
    bindCursorTooltip,
    hideCursorTooltip,
    openUrl: (url, options) => openUrlFromNewtabCard(url, { ...options, surface: 'recentSites' }),
    togglePinned: togglePinnedRecentSite,
    onItemContextMenu: handleRecentCardContextMenu,
    isActivationSuppressed: isCardActivationSuppressed,
    onCardPointerDown: (payload) => {
      if (pageState.recentCardDragRuntime) pageState.recentCardDragRuntime.handleRecentCardPointerDown(payload);
    },
    getProgressState: getRecentProgressState,
    toggleProgressTracking: toggleRecentProgressTracking
  });
  // The card a context menu is open on shows as its target.
  recentEvents.on('contextMenuSite', (url) => recentSitesView.setContextMenuSite(url));
  return { recentSitesView };
}

export { createRecentSection };
export type { RecentSectionDeps, RecentSectionState };
