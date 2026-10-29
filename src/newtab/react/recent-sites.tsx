import { useLayoutEffect, useMemo, useRef, useState, type FocusEvent as ReactFocusEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useExclusiveAsyncAction } from '../../shared/react/use-exclusive-async-action';
import { isElementTextTruncated } from '../../shared/react/text-overflow';
import type { ThemeVariant } from '../../shared/favicon/favicon-theme';
import { FaviconFallback } from '../../shared/react/favicon-fallback';
import { useStore } from '../../shared/react/use-store';
import { createStore } from '../../shared/state/store';
import type { Store } from '../../shared/state/store';
import { RemixIcon } from '../../shared/react/remix-icon';
import type { RecentSite } from '../../domain/recent-sites-store';
import { getPagePortals } from '../app/portals';
import { useCardTheme } from './card-theme';
import { getRecentCards } from '../dom/recent-cards';

type Translate = (key: string, fallback: string) => string;
// A site's theme as the page resolves it; the view passes it through.
type ThemeValue = Partial<ThemeVariant> | null;

export type { RecentSite };

interface OwnExtensionDisplay {
  siteName: string;
  titleText: string;
  urlText: string;
}

interface PinResult {
  pinned?: boolean;
  limitReached?: boolean;
}

interface ThemeSuggestion {
  type: 'history';
  url: string;
  title: string;
}

export interface RecentCardElement extends HTMLDivElement {
  _xTitleText?: string;
  _xDisposeRecentCard?: () => void;
  // Set while a drag of the card ends, so its click does not open the site.
}

// The sites the section draws, as its owner set them; null draws none.
export interface RecentCardsState {
  items: RecentSite[] | null;
}

export interface RecentSitesViewOptions {
  documentObj?: Document;
  windowObj?: Window;
  grid?: HTMLElement | null;
  cards?: RecentCardElement[];
  sites?: Store<RecentCardsState>;
  // The site whose context menu is open, as the section sets it.
  contextMenuSite?: Store<{ url: string | null }>;
  t?: Translate;
  formatMessage?: (
    key: string,
    fallback: string,
    values: Record<string, string>
  ) => string;
  sanitizeDisplayText?: (value: unknown) => string;
  getOwnExtensionPageDisplay?: (
    url: string,
    title?: string
  ) => OwnExtensionDisplay | null;
  getHostFromUrl?: (url: string) => string;
  getCanonicalPageUrlForFavicon?: (url: string) => string;
  getBrowserPageFaviconUrl?: (url: string) => string;
  getSiteDisplayName?: (host: string, title?: string) => string;
  getUrlDisplay?: (url: string) => string;
  attachFaviconWithFallbacks?: (
    image: HTMLImageElement,
    pageUrl: string,
    host: string,
    options: { primaryUrl: string }
  ) => void;
  getImmediateThemeForSuggestion?: (
    suggestion: ThemeSuggestion
  ) => ThemeValue;
  queueThemeForTarget?: (
    target: RecentCardElement,
    suggestion: ThemeSuggestion,
    onTheme: (theme: ThemeValue) => void,
    options: { priority: number }
  ) => void;
  applyCardTheme?: (
    target: RecentCardElement,
    theme: ThemeValue,
    host: string
  ) => void;
  getCurrentRecentCount?: () => number;
  isPinned?: (item: RecentSite) => boolean;
  getPinnedCount?: () => number;
  getMaxPinnedCount?: () => number;
  showToast?: (message: string, isError: boolean) => void;
  showTopActionTooltip?: (
    target: HTMLElement,
    message: string
  ) => void;
  hideTopActionTooltip?: () => void;
  navigateToUrl?: (url: string) => void;
  // Returns where the URL opened; anything but 'currentTab' keeps this page.
  openUrl?: (
    url: string,
    // openInOtherTab is Option/Alt: the other of the current and a new tab.
    options: { openInBackgroundTab: boolean; openInOtherTab: boolean }
  ) => string | void;
  bindCursorTooltip?: (
    target: HTMLElement,
    getText: () => string,
    options: {
      maxWidth: number;
      shouldShow: () => boolean;
    }
  ) => unknown;
  hideCursorTooltip?: () => void;
  togglePinned?: (
    item: RecentSite
  ) => PinResult | null | Promise<PinResult | null>;
  onItemContextMenu?: (payload: {
    event: MouseEvent;
    item: RecentSite;
    element: RecentCardElement;
  }) => void;
  // True while a card context menu is open or has just closed, so presses
  // meant for the menu do not open the card underneath.
  isActivationSuppressed?: () => boolean;
  // A primary press on the card, which may become a drag onto the shortcuts
  // or the bookmarks. The card opens on the click that ends a press.
  onCardPointerDown?: (payload: {
    event: PointerEvent;
    item: RecentSite;
    element: RecentCardElement;
  }) => void;
  // Progress tracking: 'available' on a pinned card that is not tracked,
  // '' where tracking does not apply.
  getProgressState?: (item: RecentSite) => RecentProgressState;
  toggleProgressTracking?: (item: RecentSite) => boolean | Promise<boolean>;
}

export type RecentProgressState = 'tracking' | 'available' | '';

export interface RecentSitesViewController {
  getCards(): RecentCardElement[];
}

interface NormalizedRecentSitesOptions {
  documentObj: Document;
  windowObj: Window;
  grid: HTMLElement;
  cards: RecentCardElement[];
  sites: Store<RecentCardsState>;
  contextMenuSite: Store<{ url: string | null }>;
  t: Translate;
  formatMessage: NonNullable<RecentSitesViewOptions['formatMessage']>;
  sanitizeDisplayText: NonNullable<RecentSitesViewOptions['sanitizeDisplayText']>;
  getOwnExtensionPageDisplay: NonNullable<
    RecentSitesViewOptions['getOwnExtensionPageDisplay']
  >;
  getHostFromUrl: NonNullable<RecentSitesViewOptions['getHostFromUrl']>;
  getCanonicalPageUrlForFavicon: NonNullable<
    RecentSitesViewOptions['getCanonicalPageUrlForFavicon']
  >;
  getBrowserPageFaviconUrl: NonNullable<
    RecentSitesViewOptions['getBrowserPageFaviconUrl']
  >;
  getSiteDisplayName: NonNullable<RecentSitesViewOptions['getSiteDisplayName']>;
  getUrlDisplay: NonNullable<RecentSitesViewOptions['getUrlDisplay']>;
  attachFaviconWithFallbacks: NonNullable<
    RecentSitesViewOptions['attachFaviconWithFallbacks']
  >;
  getImmediateThemeForSuggestion: NonNullable<
    RecentSitesViewOptions['getImmediateThemeForSuggestion']
  >;
  queueThemeForTarget: NonNullable<
    RecentSitesViewOptions['queueThemeForTarget']
  >;
  applyCardTheme: NonNullable<RecentSitesViewOptions['applyCardTheme']>;
  getCurrentRecentCount: NonNullable<
    RecentSitesViewOptions['getCurrentRecentCount']
  >;
  isPinned: NonNullable<RecentSitesViewOptions['isPinned']>;
  getPinnedCount: NonNullable<RecentSitesViewOptions['getPinnedCount']>;
  getMaxPinnedCount: NonNullable<RecentSitesViewOptions['getMaxPinnedCount']>;
  showToast: NonNullable<RecentSitesViewOptions['showToast']>;
  showTopActionTooltip: NonNullable<
    RecentSitesViewOptions['showTopActionTooltip']
  >;
  hideTopActionTooltip: NonNullable<
    RecentSitesViewOptions['hideTopActionTooltip']
  >;
  openUrl: NonNullable<RecentSitesViewOptions['openUrl']>;
  bindCursorTooltip: NonNullable<
    RecentSitesViewOptions['bindCursorTooltip']
  >;
  hideCursorTooltip: NonNullable<
    RecentSitesViewOptions['hideCursorTooltip']
  >;
  togglePinned: NonNullable<RecentSitesViewOptions['togglePinned']>;
  onItemContextMenu: NonNullable<
    RecentSitesViewOptions['onItemContextMenu']
  >;
  isActivationSuppressed: NonNullable<
    RecentSitesViewOptions['isActivationSuppressed']
  >;
  onCardPointerDown: NonNullable<RecentSitesViewOptions['onCardPointerDown']>;
  getProgressState: NonNullable<RecentSitesViewOptions['getProgressState']>;
  toggleProgressTracking: NonNullable<RecentSitesViewOptions['toggleProgressTracking']>;
}

interface RecentSiteCardProps {
  item: RecentSite;
  index: number;
  options: NormalizedRecentSitesOptions;
}

interface ActivationEvent {
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  button?: number;
}

const ROLLBACK_ANIMATION_MS = 220;
const HOVER_REENABLE_DELAY_MS = 1000;
const ROLLBACK_CLASS_NAME = 'x-nt-recent-card--rollback';

function fallbackFormatMessage(
  key: string,
  fallback: string,
  values: Record<string, string>
): string {
  let text = fallback || key || '';
  Object.keys(values || {}).forEach((name) => {
    text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), values[name]);
  });
  return text;
}

function shouldOpenUrlInBackground(event: ActivationEvent | null): boolean {
  return Boolean(
    event &&
    (event.metaKey || event.ctrlKey || Number(event.button) === 1)
  );
}

// On macOS a Control-click is a right-click: it opens the context menu, not
// the card in a background tab.
function isMacContextClick(
  event: { ctrlKey: boolean },
  windowObj: Window
): boolean {
  const navigatorObj = windowObj.navigator;
  return event.ctrlKey && /Mac|iPhone|iPad|iPod/i.test(
    String(navigatorObj?.platform || navigatorObj?.userAgent || '')
  );
}

function isRecentTitleTruncated(
  titleElement: HTMLDivElement | null
): boolean {
  return isElementTextTruncated(titleElement, { vertical: true });
}

function normalizeOptions(
  rawOptions: RecentSitesViewOptions
): NormalizedRecentSitesOptions | null {
  const documentObj = rawOptions.documentObj || globalThis.document;
  const windowObj = rawOptions.windowObj || globalThis.window;
  const grid = rawOptions.grid || null;
  if (!documentObj || !windowObj || !grid) {
    return null;
  }
  const navigateToUrl = typeof rawOptions.navigateToUrl === 'function'
    ? rawOptions.navigateToUrl
    : () => {};
  return {
    documentObj,
    windowObj,
    grid,
    cards: Array.isArray(rawOptions.cards) ? rawOptions.cards : [],
    sites: rawOptions.sites || createStore<RecentCardsState>({ items: null }),
    contextMenuSite: rawOptions.contextMenuSite || createStore<{ url: string | null }>({ url: null }),
    t: typeof rawOptions.t === 'function'
      ? rawOptions.t
      : (_key, fallback) => fallback || '',
    formatMessage: typeof rawOptions.formatMessage === 'function'
      ? rawOptions.formatMessage
      : fallbackFormatMessage,
    sanitizeDisplayText:
      typeof rawOptions.sanitizeDisplayText === 'function'
        ? rawOptions.sanitizeDisplayText
        : (value) => String(value || ''),
    getOwnExtensionPageDisplay:
      typeof rawOptions.getOwnExtensionPageDisplay === 'function'
        ? rawOptions.getOwnExtensionPageDisplay
        : () => null,
    getHostFromUrl:
      typeof rawOptions.getHostFromUrl === 'function'
        ? rawOptions.getHostFromUrl
        : () => '',
    getCanonicalPageUrlForFavicon:
      typeof rawOptions.getCanonicalPageUrlForFavicon === 'function'
        ? rawOptions.getCanonicalPageUrlForFavicon
        : (url) => url || '',
    getBrowserPageFaviconUrl:
      typeof rawOptions.getBrowserPageFaviconUrl === 'function'
        ? rawOptions.getBrowserPageFaviconUrl
        : () => '',
    getSiteDisplayName:
      typeof rawOptions.getSiteDisplayName === 'function'
        ? rawOptions.getSiteDisplayName
        : (host, title) => title || host || '',
    getUrlDisplay:
      typeof rawOptions.getUrlDisplay === 'function'
        ? rawOptions.getUrlDisplay
        : (url) => url || '',
    attachFaviconWithFallbacks:
      typeof rawOptions.attachFaviconWithFallbacks === 'function'
        ? rawOptions.attachFaviconWithFallbacks
        : () => {},
    getImmediateThemeForSuggestion:
      typeof rawOptions.getImmediateThemeForSuggestion === 'function'
        ? rawOptions.getImmediateThemeForSuggestion
        : () => null,
    queueThemeForTarget:
      typeof rawOptions.queueThemeForTarget === 'function'
        ? rawOptions.queueThemeForTarget
        : () => {},
    applyCardTheme:
      typeof rawOptions.applyCardTheme === 'function'
        ? rawOptions.applyCardTheme
        : () => {},
    getCurrentRecentCount:
      typeof rawOptions.getCurrentRecentCount === 'function'
        ? rawOptions.getCurrentRecentCount
        : () => 4,
    isPinned:
      typeof rawOptions.isPinned === 'function'
        ? rawOptions.isPinned
        : () => false,
    getPinnedCount:
      typeof rawOptions.getPinnedCount === 'function'
        ? rawOptions.getPinnedCount
        : () => 0,
    getMaxPinnedCount:
      typeof rawOptions.getMaxPinnedCount === 'function'
        ? rawOptions.getMaxPinnedCount
        : () => 3,
    showToast:
      typeof rawOptions.showToast === 'function'
        ? rawOptions.showToast
        : () => {},
    showTopActionTooltip:
      typeof rawOptions.showTopActionTooltip === 'function'
        ? rawOptions.showTopActionTooltip
        : () => {},
    hideTopActionTooltip:
      typeof rawOptions.hideTopActionTooltip === 'function'
        ? rawOptions.hideTopActionTooltip
        : () => {},
    openUrl: typeof rawOptions.openUrl === 'function'
      ? rawOptions.openUrl
      : (url) => navigateToUrl(url),
    bindCursorTooltip:
      typeof rawOptions.bindCursorTooltip === 'function'
        ? rawOptions.bindCursorTooltip
        : () => null,
    hideCursorTooltip:
      typeof rawOptions.hideCursorTooltip === 'function'
        ? rawOptions.hideCursorTooltip
        : () => {},
    togglePinned:
      typeof rawOptions.togglePinned === 'function'
        ? rawOptions.togglePinned
        : () => Promise.resolve(null),
    onItemContextMenu:
      typeof rawOptions.onItemContextMenu === 'function'
        ? rawOptions.onItemContextMenu
        : () => {},
    isActivationSuppressed:
      typeof rawOptions.isActivationSuppressed === 'function'
        ? rawOptions.isActivationSuppressed
        : () => false,
    onCardPointerDown:
      typeof rawOptions.onCardPointerDown === 'function'
        ? rawOptions.onCardPointerDown
        : () => {},
    getProgressState:
      typeof rawOptions.getProgressState === 'function'
        ? rawOptions.getProgressState
        : () => '',
    toggleProgressTracking:
      typeof rawOptions.toggleProgressTracking === 'function'
        ? rawOptions.toggleProgressTracking
        : () => false
  };
}

function RecentSiteCard({
  item,
  index,
  options
}: RecentSiteCardProps) {
  const cardRef = useRef<RecentCardElement>(null);
  const faviconRef = useRef<HTMLImageElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const pinButtonRef = useRef<HTMLButtonElement>(null);
  const isCardPointerActiveRef = useRef(false);
  const hasNavigateAttemptedRef = useRef(false);
  const tooltipSuppressedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const hoverLockedRef = useRef(false);
  const rollbackTimerRef = useRef(0);
  const hoverUnlockTimerRef = useRef(0);
  const backgroundGuardTimerRef = useRef(0);
  const navigationCleanupRef = useRef<(() => void) | null>(null);

  const itemUrl = String(item.url || '');
  const itemTitle = String(item.title || '');
  const ownExtensionDisplay = options.getOwnExtensionPageDisplay(
    itemUrl,
    itemTitle
  );
  const faviconPageUrl =
    options.getCanonicalPageUrlForFavicon(itemUrl) || itemUrl;
  const browserPageFaviconUrl =
    options.getBrowserPageFaviconUrl(faviconPageUrl);
  const canonicalHost = options.getHostFromUrl(faviconPageUrl);
  const host = ownExtensionDisplay
    ? 'lumno.kubai.design'
    : (
        canonicalHost ||
        String(item.host || '') ||
        options.getHostFromUrl(itemUrl) ||
        ''
      );
  const siteName = ownExtensionDisplay
    ? ownExtensionDisplay.siteName
    : options.getSiteDisplayName(host, itemTitle);
  const titleText = ownExtensionDisplay
    ? ownExtensionDisplay.titleText
    : (itemTitle || siteName || itemUrl);
  const safeTitleText = options.sanitizeDisplayText(titleText);
  const shouldEager = index < options.getCurrentRecentCount();
  const initiallyPinned = options.isPinned(item);
  const contextMenuSite = useStore(options.contextMenuSite).url;
  const contextMenuOpen = contextMenuSite !== null && contextMenuSite === String(item.url || '');
  const progressState = options.getProgressState(item);
  const progressTracked = progressState === 'tracking';
  const progressLabel = progressTracked
    ? options.t('recent_progress_tracking', '正在跟踪观看进度')
    : options.t('recent_progress_track', '跟踪观看进度');
  // What tracking is, when to turn it on and what it does.
  const progressTooltip = progressTracked
    ? options.t(
      'recent_progress_stop_tooltip',
      '正在跟踪观看进度\n────────\n在同一部作品里看到下一集或下一章时，这张卡片会自动更新。\n点击停止跟踪。'
    )
    : options.t(
      'recent_progress_track_tooltip',
      '跟踪观看进度\n────────\n适合追剧、看连载小说时打开。\n打开后，在同一部作品里看到下一集或下一章，这张卡片会自动更新到最新进度。'
    );
  const themeSubject = useMemo<ThemeSuggestion>(
    () => ({ type: 'history', url: faviconPageUrl, title: itemTitle }),
    [faviconPageUrl, itemTitle]
  );
  const immediateTheme = useMemo(() => options.getImmediateThemeForSuggestion(themeSubject), [options, themeSubject]);
  useCardTheme(cardRef, {
    immediateTheme,
    host,
    subject: themeSubject,
    priority: shouldEager ? 0 : 2,
    queue: options.queueThemeForTarget,
    apply: options.applyCardTheme
  });
  const pinAction = useExclusiveAsyncAction(
    () => options.togglePinned(item)
  );
  // A pin attempt's outcome, shown until the list draws the card afresh.
  const [pinOutcome, setPinOutcome] = useState<{
    from: boolean;
    pinned: boolean;
    limitReached: boolean;
  } | null>(null);
  const currentPinOutcome = pinOutcome && pinOutcome.from === initiallyPinned ? pinOutcome : null;
  const pinned = currentPinOutcome ? currentPinOutcome.pinned : initiallyPinned;
  const pinLimitReached = currentPinOutcome
    ? currentPinOutcome.limitReached
    : !initiallyPinned && options.getPinnedCount() >= options.getMaxPinnedCount();
  const pinLabel = pinned
    ? options.t('recent_pin_remove', '取消置顶')
    : (pinLimitReached
      ? options.t('recent_pin_limit', '最多置顶 3 个')
      : options.t('recent_pin_add', '置顶'));
  const trackAction = useExclusiveAsyncAction(
    () => options.toggleProgressTracking(item)
  );

  function clearRollbackTimer(): void {
    if (!rollbackTimerRef.current) {
      return;
    }
    options.windowObj.clearTimeout(rollbackTimerRef.current);
    rollbackTimerRef.current = 0;
  }

  function clearHoverUnlockTimer(): void {
    if (!hoverUnlockTimerRef.current) {
      return;
    }
    options.windowObj.clearTimeout(hoverUnlockTimerRef.current);
    hoverUnlockTimerRef.current = 0;
  }

  function clearNavigationSignals(): void {
    const cleanup = navigationCleanupRef.current;
    navigationCleanupRef.current = null;
    cleanup?.();
  }

  function markNavigationSuccess(): void {
    clearRollbackTimer();
    clearHoverUnlockTimer();
    clearNavigationSignals();
  }

  function lockHoverAfterRollback(): void {
    const card = cardRef.current;
    if (!card) {
      return;
    }
    clearHoverUnlockTimer();
    hoverLockedRef.current = true;
    card.classList.add(ROLLBACK_CLASS_NAME);
    hoverUnlockTimerRef.current = options.windowObj.setTimeout(() => {
      hoverUnlockTimerRef.current = 0;
      hoverLockedRef.current = false;
      card.classList.remove(ROLLBACK_CLASS_NAME);
    }, ROLLBACK_ANIMATION_MS + HOVER_REENABLE_DELAY_MS);
  }

  function bindNavigationSignals(): void {
    clearNavigationSignals();
    let active = true;
    const finishNavigation = () => {
      if (active) {
        markNavigationSuccess();
      }
    };
    const onVisibilityChange = () => {
      if (options.documentObj.visibilityState === 'hidden') {
        finishNavigation();
      }
    };
    navigationCleanupRef.current = () => {
      if (!active) {
        return;
      }
      active = false;
      options.documentObj.removeEventListener(
        'visibilitychange',
        onVisibilityChange
      );
      options.windowObj.removeEventListener('pagehide', finishNavigation);
    };
    options.documentObj.addEventListener(
      'visibilitychange',
      onVisibilityChange
    );
    options.windowObj.addEventListener('pagehide', finishNavigation, {
      once: true
    });
  }

  function scheduleRollbackIfPending(): void {
    clearRollbackTimer();
    rollbackTimerRef.current = options.windowObj.setTimeout(() => {
      rollbackTimerRef.current = 0;
      if (options.documentObj.visibilityState === 'hidden') {
        return;
      }
      lockHoverAfterRollback();
      hasNavigateAttemptedRef.current = false;
      clearNavigationSignals();
    }, 180);
  }

  function resetBackgroundOpenGuard(): void {
    if (backgroundGuardTimerRef.current) {
      options.windowObj.clearTimeout(backgroundGuardTimerRef.current);
    }
    backgroundGuardTimerRef.current = options.windowObj.setTimeout(() => {
      backgroundGuardTimerRef.current = 0;
      hasNavigateAttemptedRef.current = false;
    }, 0);
  }

  function navigateFromCard(event: ActivationEvent): void {
    const card = cardRef.current;
    tooltipSuppressedRef.current = true;
    options.hideTopActionTooltip();
    options.hideCursorTooltip();
    if (!card || hasNavigateAttemptedRef.current) {
      return;
    }
    hasNavigateAttemptedRef.current = true;
    if (!hoverLockedRef.current) {
      card.classList.remove(ROLLBACK_CLASS_NAME);
    }
    const openInBackgroundTab = shouldOpenUrlInBackground(event);
    const disposition = options.openUrl(itemUrl, {
      openInBackgroundTab,
      openInOtherTab: Boolean(event && event.altKey)
    });
    const navigatesAway = disposition
      ? disposition === 'currentTab'
      : !openInBackgroundTab;
    if (navigatesAway) {
      bindNavigationSignals();
      scheduleRollbackIfPending();
    } else {
      resetBackgroundOpenGuard();
    }
  }

  function stopCardActivation(
    event:
      | ReactPointerEvent<HTMLButtonElement>
      | ReactMouseEvent<HTMLButtonElement>
      | ReactKeyboardEvent<HTMLButtonElement>
  ): void {
    event.preventDefault();
    event.stopPropagation();
  }

  function showPinTooltip(): void {
    const button = pinButtonRef.current;
    if (button) {
      options.showTopActionTooltip(button, pinLabel);
    }
  }

  function showTrackTooltip(event: { currentTarget: HTMLElement }): void {
    options.showTopActionTooltip(event.currentTarget, progressTooltip);
  }

  async function handleTrack(): Promise<void> {
    options.hideTopActionTooltip();
    const outcome = await trackAction.run();
    if (outcome.status === 'rejected') {
      options.showToast(options.t('toast_error', '操作失败，请重试。'), true);
    }
  }

  async function handlePin(): Promise<void> {
    const card = cardRef.current;
    if (!card) {
      return;
    }
    if (
      !initiallyPinned &&
      options.getPinnedCount() >= options.getMaxPinnedCount()
    ) {
      options.showToast(
        options.t('recent_pin_limit_toast', '最多只能置顶 3 个卡片。'),
        false
      );
      setPinOutcome({ from: initiallyPinned, pinned: false, limitReached: true });
      return;
    }
    const outcome = await pinAction.run();
    if (outcome.status === 'skipped') {
      return;
    }
    if (outcome.status === 'rejected') {
      options.showToast(
        options.t('toast_error', '操作失败，请重试。'),
        true
      );
      return;
    }
    const result = outcome.value;
    if (!result || !card.isConnected) {
      return;
    }
    if (result.limitReached) {
      options.showToast(
        options.t('recent_pin_limit_toast', '最多只能置顶 3 个卡片。'),
        false
      );
    }
    setPinOutcome({
      from: initiallyPinned,
      pinned: Boolean(result.pinned),
      limitReached: Boolean(!result.pinned && result.limitReached)
    });
  }

  function dispose(): void {
    clearRollbackTimer();
    clearHoverUnlockTimer();
    if (backgroundGuardTimerRef.current) {
      options.windowObj.clearTimeout(backgroundGuardTimerRef.current);
      backgroundGuardTimerRef.current = 0;
    }
    clearNavigationSignals();
  }

  // dispose is new each render; the card and the effect's cleanup call the
  // latest one through this ref, so the effect below need not rerun for it.
  const disposeRef = useRef(dispose);
  useLayoutEffect(() => {
    disposeRef.current = dispose;
  });

  useLayoutEffect(() => {
    const card = cardRef.current;
    const favicon = faviconRef.current;
    const pinButton = pinButtonRef.current;
    if (!card || !favicon || !pinButton) {
      return;
    }
    const disposeCard = () => disposeRef.current();
    card._xTitleText = safeTitleText;
    card._xDisposeRecentCard = disposeCard;

    options.attachFaviconWithFallbacks(favicon, faviconPageUrl, host, {
      primaryUrl: browserPageFaviconUrl
    });
    options.bindCursorTooltip(
      card,
      () => card._xTitleText || safeTitleText,
      {
        maxWidth: 460,
        shouldShow: () =>
          !tooltipSuppressedRef.current &&
          isRecentTitleTruncated(titleRef.current)
      }
    );
    return disposeCard;
  }, [
    browserPageFaviconUrl,
    faviconPageUrl,
    host,
    index,
    initiallyPinned,
    item,
    options,
    safeTitleText
  ]);

  function handlePointerDown(
    event: ReactPointerEvent<RecentCardElement>
  ): void {
    if (event.button !== 0 || isMacContextClick(event, options.windowObj)) {
      return;
    }
    if (options.isActivationSuppressed()) {
      suppressClickRef.current = true;
      return;
    }
    suppressClickRef.current = false;
    isCardPointerActiveRef.current = true;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is an optimization; navigation does not depend on it.
    }
    options.onCardPointerDown({
      event: event.nativeEvent,
      item,
      element: event.currentTarget
    });
  }

  function handlePointerLeave(): void {
    options.hideTopActionTooltip();
    options.hideCursorTooltip();
    tooltipSuppressedRef.current = false;
    const card = cardRef.current;
    if (
      card &&
      !hasNavigateAttemptedRef.current &&
      !hoverLockedRef.current
    ) {
      card.classList.remove(ROLLBACK_CLASS_NAME);
    }
  }

  function handleClick(event: ReactMouseEvent<RecentCardElement>): void {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      event.preventDefault();
      return;
    }
    if (isMacContextClick(event, options.windowObj)) {
      return;
    }
    navigateFromCard(event);
  }

  function handleAuxClick(event: ReactMouseEvent<RecentCardElement>): void {
    if (Number(event.button) !== 1) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (options.isActivationSuppressed()) {
      return;
    }
    navigateFromCard(event);
  }

  function handleKeyDown(
    event: ReactKeyboardEvent<RecentCardElement>
  ): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    navigateFromCard(event);
  }

  function handleBlur(_event: ReactFocusEvent<RecentCardElement>): void {
    tooltipSuppressedRef.current = false;
  }

  return (
    <div
      ref={cardRef}
      className="x-nt-recent-card"
      data-recent-context-menu-open={contextMenuOpen ? 'true' : undefined}
      tabIndex={0}
      role="button"
      aria-label={options.formatMessage('open_prefix', '打开 {title}', {
        title: titleText
      })}
      data-cursor-tooltip={safeTitleText}
      onPointerDown={handlePointerDown}
      onPointerCancel={() => {
        isCardPointerActiveRef.current = false;
        options.hideTopActionTooltip();
      }}
      onPointerUp={(event) => {
        if (event.button === 0 && isCardPointerActiveRef.current) {
          isCardPointerActiveRef.current = false;
        }
      }}
      onPointerLeave={handlePointerLeave}
      onBlur={handleBlur}
      onClick={handleClick}
      onAuxClick={handleAuxClick}
      onContextMenu={(event) => {
        options.onItemContextMenu({
          event: event.nativeEvent,
          item,
          element: event.currentTarget
        });
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="x-nt-recent-card-visual">
        <div className="x-nt-recent-inner">
          <div className="x-nt-recent-header">
            <img
              ref={faviconRef}
              className="x-nt-recent-favicon"
              alt={siteName || options.t('site_icon_alt', '站点')}
              width={25}
              height={25}
              decoding="async"
              loading={shouldEager ? 'eager' : 'lazy'}
              fetchPriority={shouldEager ? 'high' : undefined}
              data-favicon-placeholder={
                browserPageFaviconUrl ? 'true' : undefined
              }
              data-fallback-icon-name={
                browserPageFaviconUrl ? 'ri-link' : undefined
              }
            />
            {/* A browser page shows the link icon until its own icon loads. */}
            <FaviconFallback visible={Boolean(browserPageFaviconUrl)} />
            <div className="x-nt-recent-name" title={siteName}>
              {siteName}
            </div>
          </div>
          <div ref={titleRef} className="x-nt-recent-title">
            {safeTitleText}
          </div>
        </div>
        <div className="x-nt-recent-url" title={itemUrl}>
          <div className="x-nt-recent-action">
            <span>
              {options.t('action_go_current_tab', '前往')}
            </span>
            <span>
              <RemixIcon name="ri-arrow-right-line" size={12} />
            </span>
          </div>
          <span className="x-nt-recent-url-text">
            {ownExtensionDisplay
              ? ownExtensionDisplay.urlText
              : options.getUrlDisplay(itemUrl)}
          </span>
          {progressState ? (
            <button
              aria-busy={trackAction.pending}
              aria-label={progressLabel}
              aria-pressed={progressTracked}
              disabled={trackAction.pending}
              type="button"
              className={`x-nt-recent-track${progressTracked ? ' x-nt-recent-track--active' : ''}`}
              onPointerDown={stopCardActivation}
              onClick={(event) => {
                stopCardActivation(event);
                void handleTrack();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  stopCardActivation(event);
                  event.currentTarget.click();
                }
              }}
              onMouseEnter={showTrackTooltip}
              onPointerLeave={options.hideTopActionTooltip}
              onPointerCancel={options.hideTopActionTooltip}
              onMouseLeave={options.hideTopActionTooltip}
              onFocus={showTrackTooltip}
              onBlur={options.hideTopActionTooltip}
            >
              <RemixIcon name={progressTracked ? 'ri-radar-fill' : 'ri-radar-line'} size={16} />
            </button>
          ) : null}
          <button
            ref={pinButtonRef}
            aria-busy={pinAction.pending}
            aria-label={pinLabel}
            aria-pressed={pinned}
            data-tooltip={pinLabel}
            disabled={pinAction.pending}
            type="button"
            className={`x-nt-recent-pin${pinned ? ' x-nt-recent-pin--active' : ''}${
              pinLimitReached && !pinned ? ' x-nt-recent-pin--limit' : ''
            }`}
            onPointerDown={stopCardActivation}
            onClick={(event) => {
              stopCardActivation(event);
              void handlePin();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                stopCardActivation(event);
                event.currentTarget.click();
              }
            }}
            onMouseEnter={showPinTooltip}
            onPointerLeave={options.hideTopActionTooltip}
            onPointerCancel={options.hideTopActionTooltip}
            onMouseLeave={options.hideTopActionTooltip}
            onFocus={showPinTooltip}
            onBlur={options.hideTopActionTooltip}
          >
            <RemixIcon name={pinned ? 'ri-pushpin-fill' : 'ri-pushpin-line'} size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function RecentSitesList({
  items,
  options
}: {
  items: RecentSite[];
  options: NormalizedRecentSitesOptions;
}) {
  const occurrences = new Map<string, number>();
  return items.map((item, index) => {
    const identity = String(item?.url || item?.host || item?.title || 'recent');
    const occurrence = occurrences.get(identity) || 0;
    occurrences.set(identity, occurrence + 1);
    return (
      <RecentSiteCard
        key={`${identity}::${occurrence}`}
        item={item}
        index={index}
        options={options}
      />
    );
  });
}

// The cards the section's store holds. A new set takes away the tooltips the
// old cards showed and hands the page the new cards.
function RecentCards({ options }: { options: NormalizedRecentSitesOptions }) {
  const { items } = useStore(options.sites);
  useLayoutEffect(() => {
    options.hideTopActionTooltip();
    options.hideCursorTooltip();
    options.cards.length = 0;
    getRecentCards(options.grid).forEach((card) => options.cards.push(card));
  }, [items, options]);
  return items ? <RecentSitesList items={items} options={options} /> : null;
}

function createNoopController(
  rawOptions: RecentSitesViewOptions
): RecentSitesViewController {
  const cards = Array.isArray(rawOptions.cards) ? rawOptions.cards : [];
  return {
    getCards() {
      return cards;
    }
  };
}

export function createRecentSitesView(
  rawOptions: RecentSitesViewOptions = {}
): RecentSitesViewController {
  const normalizedOptions = normalizeOptions(rawOptions);
  if (!normalizedOptions) {
    return createNoopController(rawOptions);
  }
  const options: NormalizedRecentSitesOptions = normalizedOptions;
  options.grid.setAttribute('data-react-island', 'recent-sites');

  getPagePortals().show(options.grid, <RecentCards options={options} />);
  return {
    getCards() {
      return options.cards;
    }
  };
}
