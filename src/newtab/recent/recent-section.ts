// Builds the recent section: its pointer tracking, heading and mode
// switch, grid and the recent sites view.
import type { BindCursorTooltip, FormatMessage, ShowToast, Translate } from '../newtab-types';
import type { PageStructureRuntime } from '../react/page-structure';
import type { RecentSitesViewController, RecentSitesViewOptions } from '../react/recent-sites';
import { createRecentSitesView } from '../react/recent-sites';
import type { SettingsStore } from '../../platform/settings-store';
import { recentMode } from '../../domain/settings/recent-sites';
import type { RecentSitesController } from './recent-sites-controller';
import { MAX_PINNED_RECENT_SITES } from '../newtab-config';
import type { RecentPointer } from './recent-pointer';

// An option the recent sites view is handed as it is.
type ViewOption<K extends keyof RecentSitesViewOptions> = NonNullable<RecentSitesViewOptions[K]>;

interface RecentSectionState {
  recentHeader: HTMLElement | null;
  // Draws the heading and its mode switch again.
  recentModeMenu: { update(): void } | null;
  recentGrid: HTMLElement | null;
  recentSitesView: RecentSitesViewController | null;
  // Starts a drag when a press on a card moves far enough.
  recentCardDragRuntime: { handleRecentCardPointerDown: ViewOption<'onCardPointerDown'> } | null;
  // The items the grid shows, to skip renders that change nothing.
  recentRenderSignature: string;
  recentLoadedOnce: boolean;
}

interface RecentSectionDeps {
  getPinnedRecentSites: RecentSitesController['getPinnedRecentSites'];
  settings: Pick<SettingsStore, 'get'>;
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
}

function createRecentSection(deps: RecentSectionDeps): void {
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
    recentPointer
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
  pageState.recentHeader = pageStructureRuntime.recent.header;
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
  pageState.recentModeMenu = { update: renderRecentHeader };
  renderRecentHeader();
  pageState.recentGrid = pageStructureRuntime.recent.grid;
  applyRecentGridColumns();
  pageState.recentSitesView = createRecentSitesView({
    documentObj: document,
    windowObj: window,
    grid: pageState.recentGrid,
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
  pageState.recentRenderSignature = '';
  pageState.recentLoadedOnce = false;
}

export { createRecentSection };
export type { RecentSectionDeps, RecentSectionState };
