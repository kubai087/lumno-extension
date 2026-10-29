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
import type { RecentSitesShown } from './recent-sites-shown';
import { createViewStore } from '../../shared/react/view-store';
import type { SurfaceLocale } from '../../shared/i18n/surface-locale';

// An option the recent sites view is handed as it is.
type ViewOption<K extends keyof RecentSitesViewOptions> = NonNullable<RecentSitesViewOptions[K]>;


interface RecentSectionDeps {
  getPinnedRecentSites: RecentSitesController['getPinnedRecentSites'];
  settings: Pick<SettingsStore, 'get' | 'set' | 'subscribe'>;
  setContentSectionVisible(section: HTMLElement | null, visible: boolean): void;
  hideTopActionTooltip(): void;
  pageStructureRuntime: { recent: Pick<PageStructureRuntime['recent'], 'section' | 'header' | 'grid' | 'headerStore'> };
  t: Translate;
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
  recentShown: Pick<RecentSitesShown, 'cards'>;
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
    recentShown,
    locale
  } = deps;


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
    pageStructureRuntime.recent.headerStore.setState({
      heading: settings.get(recentMode) === 'most' ? most : latest,
      modeSwitch: {
        title: t('display_mode_title', 'Display mode'),
        value: settings.get(recentMode),
        options: [{ value: 'latest', label: latest }, { value: 'most', label: most }],
        onChange: (nextMode) => void settings.set(recentMode, recentMode.parse(nextMode)).catch(() => {})
      }
    });
  }
  renderRecentHeader();
  // The heading follows the language and the mode, whoever changed it.
  locale.store.subscribe(renderRecentHeader);
  settings.subscribe(recentMode, renderRecentHeader);
  applyRecentGridColumns();
  // The card a context menu is open on shows as its target.
  const contextMenuSite = createViewStore<{ url: string | null }>({ url: null });
  recentEvents.on('contextMenuSite', (url) => contextMenuSite.setState({ url }));
  createRecentSitesView({
    documentObj: document,
    windowObj: window,
    grid: pageStructureRuntime.recent.grid,
    cards: recentCards,
    sites: recentShown.cards,
    contextMenuSite,
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
    onCardPointerDown: (payload) => recentEvents.emit('cardPointerDown', payload),
    getProgressState: getRecentProgressState,
    toggleProgressTracking: toggleRecentProgressTracking
  });
}

export { createRecentSection };
export type { RecentSectionDeps };
