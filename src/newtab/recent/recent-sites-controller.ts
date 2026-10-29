// Pinned and hidden recent sites, and the recent-site context menu.
import type { Disposition } from '../../domain/navigation-disposition';
import type * as ProgressHistory from '../../domain/progress-history';
import type { ProgressHistoryMap, ProgressVersion } from '../../domain/progress-history';
import type * as ProgressMatch from '../../domain/progress-match';
import * as LumnoMessaging from '../../platform/messaging';
import { isElementNode } from '../../shared/dom-guards';
import type { SelectMenuOption } from '../../shared/react/select-menu/menu-options';
import * as LumnoNewtabDismissStack from '../dismiss-stack';
import type { ContextMenuParts, SelectMenuController, ShowToast, Translate } from '../newtab-types';
import type { RecentHistoryItem } from '../react/recent-history-dialog';
import type { RecentProgressState, RecentSitesViewController, RecentSitesViewOptions } from '../react/recent-sites';
import type { SelectMenuInstance } from '../react/select-menu';
import type { ShortcutSite } from '../shortcuts/shortcut-types';
import type { RecentContextTarget } from './recent-types';
import * as RecentSiteSettings from '../../domain/settings/recent-sites';
import type { HiddenRecentSite, RecentSite, RecentSiteOptions } from '../../domain/recent-sites-store';
import * as RecentSitesMerge from '../../domain/recent-sites-merge';
import * as RecentSitesStore from '../../domain/recent-sites-store';
import type { SettingsStore } from '../../platform/settings-store';
import { progressTrackingEnabled } from '../../domain/settings/recent-sites';
import { NEWTAB_CONTEXT_MENU_OPEN_VALUE } from '../menu-values';
import { MAX_PINNED_RECENT_SITES } from '../newtab-config';
import type { SurfaceLocale } from '../../shared/i18n/surface-locale';

interface RecentSitesControllerState {
  recentSitesView: Pick<RecentSitesViewController, 'setContextMenuSite'> | null;
  // The items the grid shows, to skip renders that change nothing.
  recentRenderSignature: string;
  recentSourceItems: RecentSite[];
}

interface RecentSitesControllerDeps {
  settings: Pick<SettingsStore, 'get' | 'include' | 'set' | 'subscribe'>;
  t: Translate;
  showToast: ShowToast;
  openExternalNewTabUrl(url: string, disposition: Disposition): unknown;
  hasShortcutForSite(site: ShortcutSite): boolean;
  addSiteToShortcuts(site: ShortcutSite): unknown;
  closeShortcutContextMenu(): void;
  closeBookmarkContextMenu(): void;
  canDismissRecentCard(): boolean;
  hideCursorTooltip(): void;
  hideTopActionTooltip(): void;
  normalizeHost: NonNullable<RecentSiteOptions['normalizeHost']>;
  getCanonicalPageUrlForFavicon: NonNullable<RecentSiteOptions['getCanonicalPageUrlForFavicon']>;
  sanitizeDisplayText: NonNullable<RecentSiteOptions['sanitizeDisplayText']>;
  getSiteDisplayName: NonNullable<RecentSiteOptions['getSiteDisplayName']>;
  shouldExcludeFromRecentSites(url: string): boolean;
  isBrowserPageRecentUrl(url: string): boolean;
  renderRecentSites(items: RecentSite[]): unknown;
  progressMatch: Pick<typeof ProgressMatch, 'looksLikeSeriesPage' | 'compareProgressPages' | 'getProgressSiteKey'>;
  progressHistory: Pick<typeof ProgressHistory, 'createProgressId' | 'getHistoryId' | 'normalizeHistoryMap' | 'restoreVersion'>;
  openProgressHistory?(item: RecentHistoryItem): unknown;
  recentContextMenuSelectController: SelectMenuController;
  pageState: RecentSitesControllerState;
  locale: Pick<SurfaceLocale, 'store'>;
}

// Whether pinning took, or the pin limit stopped it; and the pinned cards.
interface PinToggleResult {
  pinned: boolean;
  limitReached: boolean;
  items?: RecentSite[];
}

// Whether the site was hidden, and whether it was a pinned card.
interface HideResult {
  hidden: boolean;
  wasPinned: boolean;
}

// A pinned card to save; saving derives a site name left out.
type PinnedSiteDraft = Omit<RecentSite, 'siteName'> & Partial<Pick<RecentSite, 'siteName'>>;

type CardContextMenuPayload = Parameters<NonNullable<RecentSitesViewOptions['onItemContextMenu']>>[0];

function createRecentSitesController(deps: RecentSitesControllerDeps) {
  const {
    recentContextMenuSelectController,
    settings,
    t,
    showToast,
    openExternalNewTabUrl,
    hasShortcutForSite,
    addSiteToShortcuts,
    closeShortcutContextMenu,
    closeBookmarkContextMenu,
    canDismissRecentCard,
    hideCursorTooltip,
    hideTopActionTooltip,
    normalizeHost,
    getCanonicalPageUrlForFavicon,
    sanitizeDisplayText,
    getSiteDisplayName,
    shouldExcludeFromRecentSites,
    isBrowserPageRecentUrl,
    renderRecentSites,
    progressMatch,
    progressHistory,
    openProgressHistory,
    locale
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;
  // What the open menu acts on.
  let recentContextMenuTarget: RecentContextTarget | null = null;
  // The menu, made the first time it opens.
  let recentContextMenu: ContextMenuParts | null = null;

  const MAX_HIDDEN_RECENT_SITES = 60;

  // The stored pinned and hidden sites and the tracked works' history, in
  // this page's normal form, kept in step with storage by followStoredSites().
  let pinnedSites: RecentSite[] = [];
  let hiddenSites: HiddenRecentSite[] = [];
  let historyMap: ProgressHistoryMap = {};

  function readStoredSiteLists(): void {
    pinnedSites = normalizePinnedRecentSites(settings.get(RecentSiteSettings.pinnedRecentSites));
    hiddenSites = normalizeHiddenRecentSites(settings.get(RecentSiteSettings.hiddenRecentSites));
  }

  function redrawRecentSites(): void {
    pageState.recentRenderSignature = '';
    renderRecentSites(pageState.recentSourceItems);
  }

  // Follows the stored lists, redrawing the cards when the sites change;
  // settles once they are read.
  function followStoredSites(): Promise<void> {
    const sites = [RecentSiteSettings.pinnedRecentSites, RecentSiteSettings.hiddenRecentSites];
    settings.subscribe(sites, () => {
      readStoredSiteLists();
      redrawRecentSites();
    });
    settings.subscribe(RecentSiteSettings.progressHistory, () => {
      historyMap = progressHistory.normalizeHistoryMap(settings.get(RecentSiteSettings.progressHistory));
    });
    return settings.include([...sites, RecentSiteSettings.progressHistory]).then(() => {
      readStoredSiteLists();
      historyMap = progressHistory.normalizeHistoryMap(settings.get(RecentSiteSettings.progressHistory));
      if (pageState.recentSourceItems.length > 0) {
        redrawRecentSites();
      }
    });
  }

  function getPinnedRecentSites(): readonly RecentSite[] {
    return pinnedSites;
  }

  function getHiddenRecentSites(): readonly HiddenRecentSite[] {
    return hiddenSites;
  }
  const RECENT_CONTEXT_MENU_ADD_SHORTCUT_VALUE = 'add-shortcut';
  const RECENT_CONTEXT_MENU_REMOVE_VALUE = 'remove';
  const RECENT_CONTEXT_MENU_TRACK_PROGRESS_VALUE = 'track-progress';
  const RECENT_CONTEXT_MENU_STOP_PROGRESS_VALUE = 'stop-progress';
  const RECENT_CONTEXT_MENU_PROGRESS_HISTORY_VALUE = 'progress-history';
  const RECENT_CONTEXT_MENU_MIN_WIDTH_PX = 124;
  const PIN_PROBE_TIMEOUT_MS = 900;
  const RECENT_CONTEXT_MENU_MAX_WIDTH_PX = 200;
  const RECENT_CONTEXT_MENU_PORTAL_Z_INDEX = 10050;
  const RECENT_CONTEXT_MENU_PORTAL_OFFSET_PX = -6;

  function getRecentShortcutSite(item: RecentSite): ShortcutSite {
    const normalizedItem = normalizeRecentSiteRecord(item) || item;
    return {
      title: normalizedItem.siteName || normalizedItem.title || '',
      url: normalizedItem.url
    };
  }

  function getRecentContextMenuOptions(target?: RecentContextTarget | null): SelectMenuOption[] {
    const isShortcut = Boolean(target && target.item &&
      hasShortcutForSite(getRecentShortcutSite(target.item)));
    return [
      {
        action: NEWTAB_CONTEXT_MENU_OPEN_VALUE,
        value: NEWTAB_CONTEXT_MENU_OPEN_VALUE,
        label: t('newtab_open_in_new_tab', 'Open in new tab')
      },
      {
        action: RECENT_CONTEXT_MENU_ADD_SHORTCUT_VALUE,
        value: RECENT_CONTEXT_MENU_ADD_SHORTCUT_VALUE,
        label: isShortcut
          ? t('newtab_shortcuts_already_added', 'Already in shortcuts')
          : t('recent_add_to_shortcuts', 'Add to shortcuts'),
        disabled: isShortcut
      },
      ...getProgressContextMenuOptions(target && target.item),
      {
        action: RECENT_CONTEXT_MENU_REMOVE_VALUE,
        value: RECENT_CONTEXT_MENU_REMOVE_VALUE,
        label: target && target.item
          ? getRecentDismissTooltip(target.item)
          : t('recent_dismiss_tooltip', 'Remove'),
        dividerBefore: true
      }
    ];
  }

  function isRecentContextMenuOpen(): boolean {
    return Boolean(
      recentContextMenu &&
      recentContextMenuSelectController &&
      recentContextMenuSelectController.isOpen(recentContextMenu.control)
    );
  }

  function isRecentContextMenuNode(node: EventTarget | null): boolean {
    if (!isElementNode(node) || !recentContextMenu) {
      return false;
    }
    const { control, menu } = recentContextMenu;
    return control.contains(node) || menu.contains(node);
  }

  function setRecentContextMenuSite(url: string | null): void {
    if (pageState.recentSitesView) {
      pageState.recentSitesView.setContextMenuSite(url);
    }
  }

  function closeRecentContextMenu(): void {
    setRecentContextMenuSite(null);
    if (recentContextMenu && recentContextMenuSelectController) {
      recentContextMenuSelectController.setOpen(recentContextMenu.control, false);
    }
    recentContextMenuTarget = null;
  }

  function getRecentContextMenuPoint(target: RecentContextTarget, event: MouseEvent | null | undefined): { x: number; y: number } {
    const clientX = Number(event && event.clientX);
    const clientY = Number(event && event.clientY);
    if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
      return { x: clientX, y: clientY };
    }
    const rect = target.element.getBoundingClientRect();
    return {
      x: rect.left + (rect.width / 2),
      y: rect.bottom
    };
  }

  function setRecentContextMenuPosition(target: RecentContextTarget, event: MouseEvent | null | undefined): void {
    if (!recentContextMenu) {
      return;
    }
    const point = getRecentContextMenuPoint(target, event);
    recentContextMenu.control.style.left = `${Math.round(point.x)}px`;
    recentContextMenu.control.style.top = `${Math.round(point.y)}px`;
  }

  function removeRecentSiteFromContextMenu(item: RecentSite): Promise<void> {
    return hideRecentSiteTemporarily(item).then((result) => {
      if (!result.hidden) {
        return;
      }
      showToast(
        result.wasPinned
          ? t(
            'recent_dismiss_pinned_toast',
            '已取消置顶并从最近访问移除，再次访问后会重新出现'
          )
          : t(
            'recent_dismiss_toast',
            '已从最近访问移除，再次访问后会重新出现'
          ),
        false
      );
    }).catch(() => {
      showToast(t('toast_error', '操作失败，请重试。'), true);
    });
  }

  function handleRecentContextMenuAction(actionValue: unknown): void {
    const action = String(actionValue || '');
    const target = recentContextMenuTarget;
    closeRecentContextMenu();
    if (!target || !target.item || !action) {
      return;
    }
    if (action === NEWTAB_CONTEXT_MENU_OPEN_VALUE) {
      openExternalNewTabUrl(target.item.url, 'newTab');
      return;
    }
    if (action === RECENT_CONTEXT_MENU_ADD_SHORTCUT_VALUE) {
      addSiteToShortcuts(getRecentShortcutSite(target.item));
      return;
    }
    if (action === RECENT_CONTEXT_MENU_TRACK_PROGRESS_VALUE ||
        action === RECENT_CONTEXT_MENU_STOP_PROGRESS_VALUE) {
      void setProgressTracking(target.item, action === RECENT_CONTEXT_MENU_TRACK_PROGRESS_VALUE);
      return;
    }
    if (action === RECENT_CONTEXT_MENU_PROGRESS_HISTORY_VALUE) {
      openProgressHistoryFor(target.item);
      return;
    }
    if (action !== RECENT_CONTEXT_MENU_REMOVE_VALUE) {
      return;
    }
    void removeRecentSiteFromContextMenu(target.item);
  }

  function handleRecentContextMenuActionClick(event: MouseEvent): void {
    const target = event.target;
    const option = isElementNode(target)
      ? target.closest('._x_extension_select_option_2024_unique_')
      : null;
    if (!option || !recentContextMenu ||
        !recentContextMenu.menu.contains(option)) {
      return;
    }
    event.stopPropagation();
    if (option.getAttribute('aria-disabled') === 'true') {
      return;
    }
    handleRecentContextMenuAction(option.getAttribute('data-value'));
  }

  // Escape closes the menu through the page's dismiss stack.
  LumnoNewtabDismissStack.getDismissStack().register('recent-context-menu', {
    isOpen: () => Boolean(recentContextMenuTarget || isRecentContextMenuOpen()),
    close: () => closeRecentContextMenu()
  });

  function handleRecentContextMenuDocumentPointerDown(event: PointerEvent): void {
    if (!recentContextMenuTarget || isRecentContextMenuNode(event.target)) {
      return;
    }
    closeRecentContextMenu();
  }

  function createRecentContextMenu(): ContextMenuParts | null {
    if (!recentContextMenuSelectController) {
      return null;
    }
    const created: SelectMenuInstance | null = recentContextMenuSelectController.createSelect({
      id: '_x_extension_newtab_recent_context_menu_2026_unique_',
      selectId: '_x_extension_newtab_recent_context_menu_select_2026_unique_',
      className: 'x-nt-shortcut-context-menu x-nt-recent-context-menu',
      iconOnly: true,
      triggerIconName: 'ri-more-line',
      menuClassName: 'x-nt-shortcut-context-menu-portal x-nt-recent-context-menu-portal',
      menuAlign: 'middle',
      menuWidth: 'content',
      menuMinWidth: RECENT_CONTEXT_MENU_MIN_WIDTH_PX,
      menuMaxWidth: RECENT_CONTEXT_MENU_MAX_WIDTH_PX,
      menuPortal: true,
      menuPortalZIndex: RECENT_CONTEXT_MENU_PORTAL_Z_INDEX,
      menuPortalOffset: RECENT_CONTEXT_MENU_PORTAL_OFFSET_PX,
      value: NEWTAB_CONTEXT_MENU_OPEN_VALUE,
      ariaLabel: t('recent_context_menu_label', 'Recent site actions'),
      options: getRecentContextMenuOptions(),
      onAction(payload) {
        handleRecentContextMenuAction(payload && payload.action);
      }
    });
    if (!created) {
      return null;
    }
    const control = created.wrapper;
    const select = created.select;
    const trigger = created.trigger;
    const menu = created.menu;
    trigger.tabIndex = -1;
    const stopContextMenuEvent = (event: Event): void => {
      event.stopPropagation();
    };
    [control, trigger, menu].forEach((element) => {
      element.addEventListener('pointerdown', stopContextMenuEvent);
      element.addEventListener('click', stopContextMenuEvent);
      element.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    });
    menu.addEventListener('click', handleRecentContextMenuActionClick);
    document.addEventListener('pointerdown', handleRecentContextMenuDocumentPointerDown, true);
    (document.body || document.documentElement).appendChild(control);
    return { control, select, trigger, menu };
  }

  function openRecentContextMenu(target: RecentContextTarget, event: MouseEvent): void {
    if (!recentContextMenu) {
      recentContextMenu = createRecentContextMenu();
    }
    if (!recentContextMenu || !recentContextMenuSelectController) {
      return;
    }
    closeShortcutContextMenu();
    closeBookmarkContextMenu();
    closeRecentContextMenu();
    recentContextMenuTarget = target;
    setRecentContextMenuSite(String(target.item.url || ''));
    setRecentContextMenuPosition(target, event);
    recentContextMenuSelectController.setOptions(
      recentContextMenu.control,
      getRecentContextMenuOptions(target),
      NEWTAB_CONTEXT_MENU_OPEN_VALUE
    );
    recentContextMenuSelectController.setOpen(recentContextMenu.control, true);
  }

  function handleRecentCardContextMenu(payload: CardContextMenuPayload): void {
    const { event, item, element } = payload;
    if (!canDismissRecentCard()) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    hideCursorTooltip();
    hideTopActionTooltip();
    openRecentContextMenu({ item, element }, event);
  }

  function getRecentStoreOptions(extraOptions?: RecentSiteOptions): RecentSiteOptions {
    return {
      normalizeHost,
      getCanonicalPageUrlForFavicon,
      sanitizeDisplayText,
      getSiteDisplayName,
      shouldExcludeUrl: shouldExcludeFromRecentSites,
      shouldPrioritizeTabUrl: isBrowserPageRecentUrl,
      maxPinned: MAX_PINNED_RECENT_SITES,
      maxHidden: MAX_HIDDEN_RECENT_SITES,
      belongsToTrackedWork,
      ...(extraOptions || {})
    };
  }

  function getRecentSiteUrlKey(item: unknown): string {
    return RecentSitesStore.getRecentSiteUrlKey(item);
  }

  function normalizeHiddenRecentSiteEntry(item: unknown): HiddenRecentSite | null {
    return RecentSitesStore.normalizeHiddenRecentSiteEntry(item);
  }

  function normalizeHiddenRecentSites(items: unknown): HiddenRecentSite[] {
    return RecentSitesStore.normalizeHiddenRecentSites(items, getRecentStoreOptions());
  }

  function writeHiddenRecentSites(items: readonly (HiddenRecentSite | null)[]): Promise<HiddenRecentSite[]> {
    const normalized = normalizeHiddenRecentSites(items);
    return settings.set(RecentSiteSettings.hiddenRecentSites, normalized).then(() => normalized);
  }

  function isRecentSiteHidden(item: unknown): boolean {
    return RecentSitesStore.isRecentSiteHidden(item, hiddenSites);
  }

  function hideRecentSiteTemporarily(item: RecentSite): Promise<HideResult> {
    const normalizedItem = normalizeRecentSiteRecord(item);
    const key = getRecentSiteUrlKey(normalizedItem);
    if (!normalizedItem || !key) {
      return Promise.resolve({ hidden: false, wasPinned: false });
    }
    const hiddenEntry = normalizeHiddenRecentSiteEntry({
      url: key,
      lastVisitTime: Number(normalizedItem.lastVisitTime) || 0,
      hiddenAt: Date.now()
    });
    const wasPinned = isRecentSitePinned(normalizedItem);
    const nextPinnedItems = wasPinned
      ? pinnedSites.filter((pinnedItem) => !isSamePinnedSite(pinnedItem, normalizedItem))
      : pinnedSites.slice();
    const nextHiddenItems = [hiddenEntry].concat(
      hiddenSites.filter((entry) => entry && entry.url !== key)
    );
    const persistPinned = wasPinned
      ? writePinnedRecentSites(nextPinnedItems)
      : Promise.resolve(pinnedSites.slice());
    return persistPinned.then(() => writeHiddenRecentSites(nextHiddenItems)).then(() => {
      pageState.recentRenderSignature = '';
      renderRecentSites(pageState.recentSourceItems);
      return { hidden: true, wasPinned };
    });
  }

  function getRecentDismissTooltip(item: RecentSite): string {
    const normalizedItem = normalizeRecentSiteRecord(item);
    if (normalizedItem && isRecentSitePinned(normalizedItem)) {
      return t(
        'recent_dismiss_pinned_tooltip',
        '取消置顶并从最近访问移除，再次访问后会重新出现'
      );
    }
    return t(
      'recent_dismiss_tooltip',
      '从最近访问移除，再次访问后会重新出现'
    );
  }

  function normalizeRecentSiteRecord(item: unknown, options?: RecentSiteOptions): RecentSite | null {
    return RecentSitesStore.normalizeRecentSiteItem(item, getRecentStoreOptions(options));
  }

  // Pinned cards are one per site, tracked cards one per work.
  function isSamePinnedSite(a: unknown, b: unknown): boolean {
    return RecentSitesStore.isSamePinnedRecentSite(a, b, getRecentStoreOptions());
  }

  function normalizePinnedRecentSites(items: unknown): RecentSite[] {
    return RecentSitesStore.normalizePinnedRecentSites(items, getRecentStoreOptions());
  }

  function writePinnedRecentSites(items: readonly PinnedSiteDraft[]): Promise<RecentSite[]> {
    const normalized = normalizePinnedRecentSites(items);
    return settings.set(RecentSiteSettings.pinnedRecentSites, normalized).then(() => normalized);
  }

  function isRecentSitePinned(item: unknown): boolean {
    return pinnedSites.some((pinnedItem) => isSamePinnedSite(pinnedItem, item));
  }

  function mergeRecentSitesWithPinned(items: unknown, limit: number): RecentSite[] {
    return RecentSitesMerge.mergeRecentSitesWithPinned(
      items,
      pinnedSites,
      hiddenSites,
      limit,
      getRecentStoreOptions()
    );
  }

  function togglePinnedRecentSite(item: RecentSite): Promise<PinToggleResult> {
    const normalizedItem = normalizeRecentSiteRecord(item, { ignoreBlacklist: true });
    if (!normalizedItem) {
      return Promise.resolve({ pinned: false, limitReached: false });
    }
    // Unpinning the card itself needs no decision about tracking.
    const urlKey = getRecentSiteUrlKey(normalizedItem);
    const pinnedSelf = pinnedSites.find((pinnedItem) =>
      getRecentSiteUrlKey(pinnedItem) === urlKey
    );
    if (pinnedSelf) {
      return pinOrUnpinRecentSite(normalizedItem, pinnedSelf.progressTracking === true);
    }
    return shouldAutoTrackOnPin(normalizedItem).then((autoTrack) =>
      pinOrUnpinRecentSite(normalizedItem, autoTrack)
    );
  }

  // Pinning an episode or chapter tracks it from the start (progress
  // tracking), which also makes it a card for the work, not the site. The
  // title and URL usually tell; otherwise an open tab with the page is read
  // for episode navigation or metadata, briefly.
  function shouldAutoTrackOnPin(item: RecentSite): Promise<boolean> {
    if (!settings.get(progressTrackingEnabled)) return Promise.resolve(false);
    if (progressMatch.looksLikeSeriesPage(item)) return Promise.resolve(true);
    if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), PIN_PROBE_TIMEOUT_MS);
      try {
        LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'probeProgressSeries', url: item.url }, (response) => {
          clearTimeout(timer);
          resolve(!chrome.runtime.lastError && Boolean(response && response.series === true));
        });
      } catch {
        clearTimeout(timer);
        resolve(false);
      }
    });
  }

  function pinOrUnpinRecentSite(normalizedItem: RecentSite, autoTrack: boolean): Promise<PinToggleResult> {
    const candidate: RecentSite = autoTrack ? { ...normalizedItem, progressTracking: true } : normalizedItem;
    const existingIndex = pinnedSites.findIndex((pinnedItem) => isSamePinnedSite(pinnedItem, candidate));
    if (existingIndex >= 0) {
      const nextItems = pinnedSites.filter((_, index) => index !== existingIndex);
      return writePinnedRecentSites(nextItems).then((savedItems) => {
        pageState.recentRenderSignature = '';
        renderRecentSites(pageState.recentSourceItems);
        return {
          pinned: false,
          limitReached: false,
          items: savedItems
        };
      });
    }
    if (pinnedSites.length >= MAX_PINNED_RECENT_SITES) {
      return Promise.resolve({ pinned: false, limitReached: true, items: pinnedSites.slice() });
    }
    const pinned: RecentSite = {
      ...normalizedItem,
      pinnedAt: Date.now(),
      ...(autoTrack ? {
        progressTracking: true,
        progressId: progressHistory.createProgressId(Date.now())
      } : {})
    };
    const nextItems = [pinned].concat(pinnedSites);
    return writePinnedRecentSites(nextItems).then((savedItems) => {
      pageState.recentRenderSignature = '';
      renderRecentSites(pageState.recentSourceItems);
      if (autoTrack) {
        showToast(t('recent_progress_auto_toast', '已置顶，并开始跟踪进度。点击卡片上的雷达图标可停止。'), false);
      }
      return {
        pinned: true,
        limitReached: false,
        items: savedItems
      };
    });
  }

  // Progress tracking (Labs). A tracked pinned card follows the episode or
  // chapter the person is on; the background moves it (background/progress/)
  // and keeps the versions it leaves in local storage.
  function findPinnedIndex(item: unknown): number {
    return pinnedSites.findIndex((pinnedItem) => isSamePinnedSite(pinnedItem, item));
  }

  function getTrackedPinnedItem(item: RecentSite | null | undefined): RecentSite | null {
    if (!settings.get(progressTrackingEnabled) || !item) return null;
    const index = findPinnedIndex(item);
    const pinnedItem = index >= 0 ? pinnedSites[index] : null;
    return pinnedItem && pinnedItem.progressTracking === true ? pinnedItem : null;
  }

  function getProgressHistoryId(item: RecentSite): string {
    return progressHistory.getHistoryId(item);
  }

  function getProgressVersions(item: RecentSite): ProgressVersion[] {
    const historyId = getProgressHistoryId(item);
    const map = historyMap;
    return historyId && Object.hasOwn(map, historyId) ? map[historyId] : [];
  }

  // 'tracking' or 'available' for pinned cards, so the card can offer the
  // switch; '' where tracking does not apply.
  function getRecentProgressState(item: RecentSite | null | undefined): RecentProgressState {
    if (!settings.get(progressTrackingEnabled) || !item) return '';
    const index = findPinnedIndex(item);
    if (index < 0) return '';
    return pinnedSites[index].progressTracking === true ? 'tracking' : 'available';
  }

  function toggleRecentProgressTracking(item: RecentSite): Promise<boolean> {
    const state = getRecentProgressState(item);
    if (!state) return Promise.resolve(false);
    return setProgressTracking(item, state !== 'tracking');
  }

  // Recent pages of a tracked work fold into its card instead of filling
  // the list with earlier or later episodes.
  function belongsToTrackedWork(item: RecentSite): boolean {
    if (!settings.get(progressTrackingEnabled) || !item) return false;
    return pinnedSites.some((pinnedItem) => (
      pinnedItem && pinnedItem.progressTracking === true &&
      progressMatch.compareProgressPages(
        { url: pinnedItem.url, title: pinnedItem.title },
        { url: item.url, title: item.title }
      ).match
    ));
  }

  function getProgressContextMenuOptions(item: RecentSite | null | undefined): SelectMenuOption[] {
    if (!settings.get(progressTrackingEnabled) || !item) return [];
    const tracked = Boolean(getTrackedPinnedItem(item));
    const options: SelectMenuOption[] = [{
      action: tracked ? RECENT_CONTEXT_MENU_STOP_PROGRESS_VALUE : RECENT_CONTEXT_MENU_TRACK_PROGRESS_VALUE,
      value: tracked ? RECENT_CONTEXT_MENU_STOP_PROGRESS_VALUE : RECENT_CONTEXT_MENU_TRACK_PROGRESS_VALUE,
      label: tracked
        ? t('recent_progress_stop', '停止跟踪进度')
        : t('recent_progress_track', '跟踪观看进度'),
      dividerBefore: true
    }];
    if (tracked && getProgressVersions(item).length) {
      options.push({
        action: RECENT_CONTEXT_MENU_PROGRESS_HISTORY_VALUE,
        value: RECENT_CONTEXT_MENU_PROGRESS_HISTORY_VALUE,
        label: t('recent_history_menu', '查看最近变更历史')
      });
    }
    return options;
  }

  // Turning tracking on for an unpinned card pins it, since only pinned
  // cards stay put long enough to follow a work.
  function setProgressTracking(item: RecentSite, enabled: boolean): Promise<boolean> {
    const normalizedItem = normalizeRecentSiteRecord(item, { ignoreBlacklist: true });
    if (!normalizedItem) return Promise.resolve(false);
    const index = findPinnedIndex(normalizedItem);
    let nextItems: RecentSite[];
    if (index >= 0) {
      nextItems = pinnedSites.map((pinnedItem, position): RecentSite => {
        if (position !== index) return pinnedItem;
        if (!enabled) {
          const { progressTracking: _tracking, progressId: _progressId, ...rest } = pinnedItem;
          return rest;
        }
        return {
          ...pinnedItem,
          progressTracking: true,
          progressId: progressHistory.createProgressId(Date.now())
        };
      });
    } else if (!enabled) {
      return Promise.resolve(false);
    } else if (pinnedSites.length >= MAX_PINNED_RECENT_SITES) {
      showToast(t('recent_pin_limit_toast', '最多只能置顶 3 个卡片。'), true);
      return Promise.resolve(false);
    } else {
      const tracked: RecentSite = {
        ...normalizedItem,
        pinnedAt: Date.now(),
        progressTracking: true,
        progressId: progressHistory.createProgressId(Date.now())
      };
      nextItems = [tracked].concat(pinnedSites);
    }
    return writePinnedRecentSites(nextItems).then(() => {
      pageState.recentRenderSignature = '';
      renderRecentSites(pageState.recentSourceItems);
      showToast(enabled
        ? t('recent_progress_track_toast', '已开始跟踪，看下一集或下一章时卡片会自动更新')
        : t('recent_progress_stop_toast', '已停止跟踪进度'), false);
      return true;
    }).catch(() => {
      showToast(t('toast_error', '操作失败，请重试。'), true);
      return false;
    });
  }

  function openProgressHistoryFor(item: RecentSite): void {
    const pinnedItem = getTrackedPinnedItem(item);
    const versions = pinnedItem ? getProgressVersions(pinnedItem) : [];
    if (!pinnedItem || !versions.length || !openProgressHistory) return;
    openProgressHistory({
      cardId: getProgressHistoryId(pinnedItem),
      title: pinnedItem.title,
      url: pinnedItem.url,
      updateHistory: versions
    });
  }

  function writeProgressHistory(map: ProgressHistoryMap): Promise<ProgressHistoryMap> {
    return settings.set(RecentSiteSettings.progressHistory, map).then(() => map);
  }

  // Makes a retained version current; the version the card leaves takes its
  // place in the history, so a restore can itself be restored.
  function restoreProgressVersion(historyItem: RecentHistoryItem, _version: unknown, historyIndex: number): Promise<boolean> {
    const index = pinnedSites.findIndex((pinnedItem) =>
      pinnedItem && pinnedItem.progressTracking === true &&
      getProgressHistoryId(pinnedItem) === historyItem.cardId
    );
    if (index < 0) return Promise.resolve(false);
    const current = pinnedSites[index];
    const timestamp = Date.now();
    const restored = progressHistory.restoreVersion(
      historyMap,
      historyItem.cardId,
      historyIndex,
      { url: current.url, title: current.title, updatedAt: timestamp }
    );
    // Narrowed here, for the cards below.
    const version = restored.version;
    if (!version) return Promise.resolve(false);
    const nextItems = pinnedSites.map((entry, position) => {
      if (position !== index) return entry;
      // The site name can come from the old title, so it is derived again.
      const { siteName: _staleSiteName, ...card } = entry;
      return { ...card, url: version.url, title: version.title || entry.title };
    });
    return writeProgressHistory(restored.map).then(() => {
      return writePinnedRecentSites(nextItems);
    }).then(() => {
      pageState.recentRenderSignature = '';
      renderRecentSites(pageState.recentSourceItems);
      return true;
    }).catch(() => {
      showToast(t('recent_history_restore_failed', '无法恢复此版本'), true);
      return false;
    });
  }


  function updateRecentContextMenuLanguageStrings(): void {
    if (!recentContextMenu || !recentContextMenuSelectController) {
      return;
    }
    if (recentContextMenu.trigger) {
      recentContextMenu.trigger.setAttribute(
        'aria-label',
        t('recent_context_menu_label', 'Recent site actions')
      );
    }
    recentContextMenuSelectController.setOptions(
      recentContextMenu.control,
      getRecentContextMenuOptions(recentContextMenuTarget),
      NEWTAB_CONTEXT_MENU_OPEN_VALUE
    );
  }
  // The menu draws its labels in the page's language.
  locale.store.subscribe(updateRecentContextMenuLanguageStrings);

  return {
    followStoredSites,
    getPinnedRecentSites,
    getHiddenRecentSites,
    getRecentContextMenuOptions,
    closeRecentContextMenu,
    handleRecentCardContextMenu,
    getRecentStoreOptions,
    getRecentSiteUrlKey,
    normalizeHiddenRecentSites,
    writeHiddenRecentSites,
    isRecentSiteHidden,
    normalizeRecentSiteRecord,
    normalizePinnedRecentSites,
    isRecentSitePinned,
    mergeRecentSitesWithPinned,
    togglePinnedRecentSite,
    getRecentProgressState,
    toggleRecentProgressTracking,
    setProgressTracking,
    restoreProgressVersion
  };
}

type RecentSitesController = ReturnType<typeof createRecentSitesController>;

export { createRecentSitesController };
export type { RecentSitesController, RecentSitesControllerDeps, RecentSitesControllerState };
