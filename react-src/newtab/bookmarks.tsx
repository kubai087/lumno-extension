import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { isElementTextTruncated } from '../shared/text-overflow';

type ThemeValue = unknown;
type VisualOptions = Record<string, unknown> | undefined;
type ActivationEvent = {
  metaKey?: boolean;
  ctrlKey?: boolean;
  button?: number;
};

export interface BookmarkItem {
  id?: string;
  parentId?: string;
  index?: number;
  type?: string;
  title?: string;
  url?: string;
  themeUrl?: string;
  host?: string;
  previewUrls?: string[];
  [key: string]: unknown;
}

export interface BookmarkCardElement extends HTMLDivElement {
  _xBookmarkItem?: BookmarkItem;
  _xBookmarkPageIndex?: number;
  _xBookmarkSuppressClick?: boolean;
  _xBookmarkSuppressClickTimer?: number;
  _xTitleText?: string;
  _xNoThemeTint?: boolean;
  _xTheme?: ThemeValue;
  _xHost?: string;
  _xDeactivateBookmarkHoverVisual?: () => void;
  _xSyncBookmarkFolderExpandedState?: (
    options?: VisualOptions
  ) => void;
  _xResetBookmarkInteractionState?: () => void;
  _xSetBookmarkMenuVisualActive?: (
    active: boolean,
    options?: VisualOptions
  ) => void;
  _xDisposeBookmarkCard?: () => void;
  _xSyncBookmarkShortcutState?: () => void;
}

interface ThemeSuggestion {
  type: 'bookmark';
  url: string;
  title: string;
}

interface CursorTooltipOptions {
  maxWidth?: number;
  shouldShow?: (
    target: BookmarkCardElement,
    event?: Event
  ) => boolean;
}

interface OpenUrlOptions {
  openInBackgroundTab: boolean;
}

export interface BookmarksViewOptions {
  documentObj?: Document;
  windowObj?: Window;
  grid?: HTMLElement | null;
  cards?: BookmarkCardElement[];
  cardElementCache?: Map<string, BookmarkCardElement>;
  folderIconsVisible?: boolean;
  t?: (key: string, fallback: string) => string;
  formatMessage?: (
    key: string,
    fallback: string,
    values: Record<string, string>
  ) => string;
  sanitizeDisplayText?: (value: unknown) => string;
  getHostFromUrl?: (url: string) => string;
  getSiteDisplayName?: (host: string, title?: string) => string;
  getUrlDisplay?: (url: string) => string;
  getRiSvg?: (id: string, sizeClass?: string) => string;
  getFigmaFolderSvg?: (id: string, folderId?: string) => string;
  initFolderPathMorph?: (element: HTMLElement) => void;
  playFolderPathMorph?: (
    element: HTMLElement,
    active: boolean,
    options?: VisualOptions
  ) => void;
  stableHashCode?: (value: string) => number;
  normalizeHost?: (host: string) => string;
  attachFaviconWithFallbacks?: (
    image: HTMLImageElement,
    url: string,
    host: string,
    candidates?: {
      primaryUrl?: string;
      browserUrl?: string;
    }
  ) => void;
  isLocalNetworkHost?: (host: string) => boolean;
  getChromeFaviconUrl?: (url: string) => string;
  getBrowserPageFaviconUrl?: (url: string) => string;
  getImmediateThemeForSuggestion?: (
    suggestion: ThemeSuggestion
  ) => ThemeValue;
  queueThemeForTarget?: (
    card: BookmarkCardElement,
    suggestion: ThemeSuggestion,
    apply: (theme: ThemeValue) => void,
    options?: { priority?: number }
  ) => void;
  applyCardTheme?: (
    card: BookmarkCardElement,
    theme: ThemeValue,
    host: string
  ) => void;
  shouldDelayHoverFromRecent?: (pointerType: string) => boolean;
  hoverDelayFromRecentMs?: number;
  shouldSuppressHover?: (
    card: BookmarkCardElement,
    event?: Event
  ) => boolean;
  bindCursorTooltip?: (
    card: BookmarkCardElement,
    getText: () => string,
    options?: CursorTooltipOptions
  ) => unknown;
  hideCursorTooltip?: () => void;
  openFolder?: (folderId?: string) => void;
  openFolderMenu?: (
    item: BookmarkItem,
    card: BookmarkCardElement
  ) => void;
  copyUrl?: (url?: string) => boolean | Promise<boolean>;
  addShortcut?: (item: BookmarkItem) => boolean | Promise<boolean>;
  hasShortcut?: (item: BookmarkItem) => boolean;
  navigateToUrl?: (url?: string) => void;
  openUrl?: (url?: string, options?: OpenUrlOptions) => void;
  onItemContextMenu?: (payload: {
    event: MouseEvent;
    item: BookmarkItem;
    element: BookmarkCardElement;
    sourceKind: 'card';
  }) => void;
  // True right after a press on an open context menu, so it does not open
  // the card underneath.
  isActivationSuppressed?: () => boolean;
}

interface NormalizedBookmarksOptions {
  documentObj: Document;
  windowObj: Window;
  grid: HTMLElement;
  cards: BookmarkCardElement[];
  cardElementCache: Map<string, BookmarkCardElement>;
  folderIconsVisible: { current: boolean };
  t: NonNullable<BookmarksViewOptions['t']>;
  formatMessage: NonNullable<BookmarksViewOptions['formatMessage']>;
  sanitizeDisplayText: NonNullable<
    BookmarksViewOptions['sanitizeDisplayText']
  >;
  getHostFromUrl: NonNullable<BookmarksViewOptions['getHostFromUrl']>;
  getSiteDisplayName: NonNullable<
    BookmarksViewOptions['getSiteDisplayName']
  >;
  getUrlDisplay: NonNullable<BookmarksViewOptions['getUrlDisplay']>;
  getRiSvg: NonNullable<BookmarksViewOptions['getRiSvg']>;
  getFigmaFolderSvg: NonNullable<
    BookmarksViewOptions['getFigmaFolderSvg']
  >;
  initFolderPathMorph: NonNullable<
    BookmarksViewOptions['initFolderPathMorph']
  >;
  playFolderPathMorph: NonNullable<
    BookmarksViewOptions['playFolderPathMorph']
  >;
  stableHashCode: NonNullable<BookmarksViewOptions['stableHashCode']>;
  normalizeHost: NonNullable<BookmarksViewOptions['normalizeHost']>;
  attachFaviconWithFallbacks: NonNullable<
    BookmarksViewOptions['attachFaviconWithFallbacks']
  >;
  isLocalNetworkHost: NonNullable<
    BookmarksViewOptions['isLocalNetworkHost']
  >;
  getChromeFaviconUrl: NonNullable<
    BookmarksViewOptions['getChromeFaviconUrl']
  >;
  getBrowserPageFaviconUrl: NonNullable<
    BookmarksViewOptions['getBrowserPageFaviconUrl']
  >;
  getImmediateThemeForSuggestion: NonNullable<
    BookmarksViewOptions['getImmediateThemeForSuggestion']
  >;
  queueThemeForTarget: NonNullable<
    BookmarksViewOptions['queueThemeForTarget']
  >;
  applyCardTheme: NonNullable<BookmarksViewOptions['applyCardTheme']>;
  shouldDelayHoverFromRecent: NonNullable<
    BookmarksViewOptions['shouldDelayHoverFromRecent']
  >;
  hoverDelayFromRecentMs: number;
  shouldSuppressHover: NonNullable<
    BookmarksViewOptions['shouldSuppressHover']
  >;
  bindCursorTooltip: NonNullable<
    BookmarksViewOptions['bindCursorTooltip']
  >;
  hideCursorTooltip: NonNullable<
    BookmarksViewOptions['hideCursorTooltip']
  >;
  openFolder: NonNullable<BookmarksViewOptions['openFolder']>;
  openFolderMenu: NonNullable<BookmarksViewOptions['openFolderMenu']>;
  copyUrl: NonNullable<BookmarksViewOptions['copyUrl']>;
  addShortcut: BookmarksViewOptions['addShortcut'];
  hasShortcut: NonNullable<BookmarksViewOptions['hasShortcut']>;
  openUrl: NonNullable<BookmarksViewOptions['openUrl']>;
  onItemContextMenu: NonNullable<
    BookmarksViewOptions['onItemContextMenu']
  >;
  isActivationSuppressed: NonNullable<
    BookmarksViewOptions['isActivationSuppressed']
  >;
}

export interface BookmarksRenderState {
  signature?: string;
  folderId?: string;
  rootFolderId?: string;
  viewMode?: string;
  menuMode?: boolean;
}

export interface BookmarksRenderResult {
  changed: boolean;
  count: number;
  isAtRoot: boolean;
  signature: string;
}

export interface BookmarksViewController {
  appendEmptyFolderState(): void;
  clear(): void;
  render(
    items: BookmarkItem[],
    state?: BookmarksRenderState
  ): BookmarksRenderResult;
  getSignature(items: BookmarkItem[]): string;
  getCacheKey(item: BookmarkItem): string;
  setFolderIconsVisible(value: boolean): boolean;
  getCards(): BookmarkCardElement[];
  refreshShortcutStates(): void;
}

function fallbackFormatMessage(
  key: string,
  fallback: string,
  values: Record<string, string>
): string {
  let text = fallback || key || '';
  Object.keys(values || {}).forEach((name) => {
    text = text.replace(
      new RegExp(`\\{${name}\\}`, 'g'),
      values[name]
    );
  });
  return text;
}

function fallbackStableHashCode(value: string): number {
  const text = String(value || '');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

export function getBookmarksSignature(items: BookmarkItem[]): string {
  if (!Array.isArray(items) || items.length === 0) {
    return '';
  }
  return items.map((item, index) => {
    const id = item?.id ? String(item.id) : '';
    const type = item?.type ? String(item.type) : '';
    const title = item?.title ? String(item.title) : '';
    const url = item?.url ? String(item.url) : '';
    const themeUrl = item?.themeUrl ? String(item.themeUrl) : '';
    return `${index}::${id}::${type}::${title}::${url}::${themeUrl}`;
  }).join('\n');
}

export function getBookmarkCacheKey(item: BookmarkItem): string {
  if (!item) {
    return '';
  }
  const id = item.id ? String(item.id) : '';
  const type = item.type ? String(item.type) : '';
  const title = item.title ? String(item.title) : '';
  const url = item.url ? String(item.url) : '';
  const themeUrl = item.themeUrl ? String(item.themeUrl) : '';
  return `${id}::${type}::${title}::${url}::${themeUrl}`;
}

function normalizeOptions(
  rawOptions: BookmarksViewOptions
): NormalizedBookmarksOptions | null {
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
    cardElementCache:
      rawOptions.cardElementCache instanceof Map
        ? rawOptions.cardElementCache
        : new Map(),
    folderIconsVisible: {
      current: rawOptions.folderIconsVisible !== false
    },
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
    getHostFromUrl:
      typeof rawOptions.getHostFromUrl === 'function'
        ? rawOptions.getHostFromUrl
        : () => '',
    getSiteDisplayName:
      typeof rawOptions.getSiteDisplayName === 'function'
        ? rawOptions.getSiteDisplayName
        : (host, title) => title || host || '',
    getUrlDisplay:
      typeof rawOptions.getUrlDisplay === 'function'
        ? rawOptions.getUrlDisplay
        : (url) => url || '',
    getRiSvg:
      typeof rawOptions.getRiSvg === 'function'
        ? rawOptions.getRiSvg
        : () => '',
    getFigmaFolderSvg:
      typeof rawOptions.getFigmaFolderSvg === 'function'
        ? rawOptions.getFigmaFolderSvg
        : () => '',
    initFolderPathMorph:
      typeof rawOptions.initFolderPathMorph === 'function'
        ? rawOptions.initFolderPathMorph
        : () => {},
    playFolderPathMorph:
      typeof rawOptions.playFolderPathMorph === 'function'
        ? rawOptions.playFolderPathMorph
        : () => {},
    stableHashCode:
      typeof rawOptions.stableHashCode === 'function'
        ? rawOptions.stableHashCode
        : fallbackStableHashCode,
    normalizeHost:
      typeof rawOptions.normalizeHost === 'function'
        ? rawOptions.normalizeHost
        : (host) => host || '',
    attachFaviconWithFallbacks:
      typeof rawOptions.attachFaviconWithFallbacks === 'function'
        ? rawOptions.attachFaviconWithFallbacks
        : () => {},
    isLocalNetworkHost:
      typeof rawOptions.isLocalNetworkHost === 'function'
        ? rawOptions.isLocalNetworkHost
        : () => false,
    getChromeFaviconUrl:
      typeof rawOptions.getChromeFaviconUrl === 'function'
        ? rawOptions.getChromeFaviconUrl
        : () => '',
    getBrowserPageFaviconUrl:
      typeof rawOptions.getBrowserPageFaviconUrl === 'function'
        ? rawOptions.getBrowserPageFaviconUrl
        : () => '',
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
    shouldDelayHoverFromRecent:
      typeof rawOptions.shouldDelayHoverFromRecent === 'function'
        ? rawOptions.shouldDelayHoverFromRecent
        : () => false,
    hoverDelayFromRecentMs:
      Number.isFinite(rawOptions.hoverDelayFromRecentMs)
        ? Number(rawOptions.hoverDelayFromRecentMs)
        : 180,
    shouldSuppressHover:
      typeof rawOptions.shouldSuppressHover === 'function'
        ? rawOptions.shouldSuppressHover
        : () => false,
    bindCursorTooltip:
      typeof rawOptions.bindCursorTooltip === 'function'
        ? rawOptions.bindCursorTooltip
        : () => null,
    hideCursorTooltip:
      typeof rawOptions.hideCursorTooltip === 'function'
        ? rawOptions.hideCursorTooltip
        : () => {},
    openFolder:
      typeof rawOptions.openFolder === 'function'
        ? rawOptions.openFolder
        : () => {},
    openFolderMenu:
      typeof rawOptions.openFolderMenu === 'function'
        ? rawOptions.openFolderMenu
        : () => {},
    copyUrl:
      typeof rawOptions.copyUrl === 'function'
        ? rawOptions.copyUrl
        : () => Promise.resolve(false),
    addShortcut: typeof rawOptions.addShortcut === 'function' ? rawOptions.addShortcut : undefined,
    hasShortcut: typeof rawOptions.hasShortcut === 'function' ? rawOptions.hasShortcut : () => false,
    openUrl:
      typeof rawOptions.openUrl === 'function'
        ? rawOptions.openUrl
        : (url) => navigateToUrl(url),
    onItemContextMenu:
      typeof rawOptions.onItemContextMenu === 'function'
        ? rawOptions.onItemContextMenu
        : () => {},
    isActivationSuppressed:
      typeof rawOptions.isActivationSuppressed === 'function'
        ? rawOptions.isActivationSuppressed
        : () => false
  };
}

function shouldOpenUrlInBackground(
  event: ActivationEvent | null
): boolean {
  return Boolean(
    event &&
    (event.metaKey || event.ctrlKey || Number(event.button) === 1)
  );
}

function isBookmarkTitleTruncated(
  titleElement: HTMLSpanElement | null
): boolean {
  return isElementTextTruncated(titleElement);
}

function getBrowserFaviconCandidate(
  options: NormalizedBookmarksOptions,
  url: string,
  host: string
): string {
  const pageUrl = String(url || '').trim();
  if (!pageUrl) {
    return '';
  }
  if (!/^https?:\/\//i.test(pageUrl)) {
    return /^[a-z][a-z0-9+.-]*:/i.test(pageUrl)
      ? options.getChromeFaviconUrl(pageUrl)
      : '';
  }
  return host && options.isLocalNetworkHost(host)
    ? options.getChromeFaviconUrl(pageUrl)
    : '';
}

function applyBookmarkCardMetadata(
  card: BookmarkCardElement,
  item: BookmarkItem,
  index: number
): void {
  const bookmarkId = item.id ? String(item.id) : '';
  const parentId = item.parentId ? String(item.parentId) : '';
  const itemIndex = Number(item.index);
  card.draggable = false;
  card._xBookmarkItem = item;
  card._xBookmarkPageIndex = Number.isFinite(index) ? index : 0;
  card.setAttribute('data-bookmark-id', bookmarkId);
  card.setAttribute(
    'data-bookmark-type',
    item.type ? String(item.type) : ''
  );
  card.setAttribute('data-bookmark-parent-id', parentId);
  card.setAttribute(
    'data-bookmark-index',
    Number.isFinite(itemIndex) ? String(itemIndex) : ''
  );
  card.setAttribute(
    'data-bookmark-draggable',
    bookmarkId && parentId && Number.isFinite(itemIndex)
      ? 'true'
      : 'false'
  );
}

function BookmarkCard({
  item,
  index,
  viewMode,
  menuMode,
  options
}: {
  item: BookmarkItem;
  index: number;
  viewMode: 'folder' | 'list' | 'top';
  menuMode: boolean;
  options: NormalizedBookmarksOptions;
}) {
  const cardRef = useRef<BookmarkCardElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const iconRef = useRef<HTMLElement>(null);
  const faviconRef = useRef<HTMLImageElement>(null);
  const previewFaviconRefs = useRef<Array<HTMLImageElement | null>>([]);
  const hoverIntentTimerRef = useRef(0);
  const hoverVisualActiveRef = useRef(false);
  const menuVisualLockedRef = useRef(false);
  const folderExpandedRef = useRef(false);
  const copyActionFocusedRef = useRef(false);
  const [shortcutAdded, setShortcutAdded] = useState(() => options.hasShortcut(item));
  const [pinBusy, setPinBusy] = useState(false);
  const [pinFailed, setPinFailed] = useState(false);
  const pinBusyRef = useRef(false);
  const pinRequestRef = useRef(0);

  const isTopbarMode = viewMode === 'top';
  const isFolder = item.type === 'folder';
  const hasPinAction = !isFolder && Boolean(options.addShortcut);
  const pinLabel = shortcutAdded
    ? options.t('newtab_shortcuts_already_added', 'Already in shortcuts')
    : pinFailed ? options.t('bookmarks_add_shortcut_failed', 'Could not add shortcut. Try again.')
    : options.t('bookmarks_add_shortcut', 'Add to shortcuts');

  useLayoutEffect(() => {
    pinRequestRef.current += 1;
    pinBusyRef.current = false;
    setPinBusy(false);
    setPinFailed(false);
    setShortcutAdded(options.hasShortcut(item));
    return () => { pinRequestRef.current += 1; };
  }, [item.url, item.id, item.type, options]);

  async function pinBookmark(): Promise<void> {
    if (pinBusyRef.current || options.hasShortcut(item) || !options.addShortcut) return;
    pinBusyRef.current = true;
    const request = pinRequestRef.current;
    setPinBusy(true);
    setPinFailed(false);
    try {
      const saved = await options.addShortcut(item);
      if (request !== pinRequestRef.current) return;
      setShortcutAdded(options.hasShortcut(item));
      setPinFailed(!saved && !options.hasShortcut(item));
    } catch {
      if (request === pinRequestRef.current) setPinFailed(true);
    } finally {
      if (request === pinRequestRef.current) { pinBusyRef.current = false; setPinBusy(false); }
    }
  }
  const folderIconId = String(item.id || `folder-${index}`);
  const folderIconHtml = useMemo(() => ({
    __html: isFolder ? options.getFigmaFolderSvg(`bookmark-${folderIconId}`, item.id) : ''
  }), [isFolder, folderIconId, item.id, options]);
  const themeUrl = String(item.themeUrl || item.url || '');
  const host = String(item.host || options.getHostFromUrl(themeUrl) || '');
  const siteName = options.getSiteDisplayName(
    host,
    item.title ? String(item.title) : undefined
  );
  const titleText = String(
    item.title ||
    siteName ||
    (item.url
      ? options.getUrlDisplay(String(item.url))
      : options.t('bookmarks_heading', '书签'))
  );
  const safeTitleText = options.sanitizeDisplayText(titleText);
  const themeSuggestion: ThemeSuggestion = {
    type: 'bookmark',
    url: themeUrl,
    title: titleText
  };
  const immediateTheme = isTopbarMode
    ? null
    : options.getImmediateThemeForSuggestion(themeSuggestion);
  const previewItems = isFolder && !isTopbarMode
    ? (Array.isArray(item.previewUrls) ? item.previewUrls : [])
        .slice(0, 4)
        .map((url, previewIndex) => {
          let previewHost = '';
          try {
            previewHost = options.normalizeHost(
              new URL(String(url)).hostname
            );
          } catch {
            previewHost = '';
          }
          const rotationSeed = options.stableHashCode(
            `${url}|${previewIndex}|${item.id || ''}`
          );
          const rotationDeg = ((rotationSeed % 13) - 6) * 0.5;
          return {
            url: String(url || ''),
            host: previewHost,
            rotation: `${rotationDeg.toFixed(2)}deg`
          };
        })
        .filter((entry) => entry.url)
    : [];

  function clearHoverIntentTimer(): void {
    if (!hoverIntentTimerRef.current) {
      return;
    }
    options.windowObj.clearTimeout(hoverIntentTimerRef.current);
    hoverIntentTimerRef.current = 0;
  }

  function shouldKeepMenuVisualActive(): boolean {
    const card = cardRef.current;
    return Boolean(
      isFolder &&
      menuMode &&
      (
        menuVisualLockedRef.current ||
        card?.getAttribute('aria-expanded') === 'true'
      )
    );
  }

  function setFolderExpanded(
    active: boolean,
    visualOptions?: VisualOptions
  ): void {
    const card = cardRef.current;
    const folderIcon = iconRef.current;
    const nextActive = Boolean(active);
    if (
      !card ||
      !folderIcon ||
      folderExpandedRef.current === nextActive
    ) {
      return;
    }
    folderExpandedRef.current = nextActive;
    card.classList.toggle(
      'x-nt-bookmark-card--folder-expanded',
      nextActive
    );
    options.playFolderPathMorph(
      folderIcon,
      nextActive,
      visualOptions
    );
  }

  function syncFolderExpandedState(
    visualOptions?: VisualOptions
  ): void {
    setFolderExpanded(
      shouldKeepMenuVisualActive() ||
        (
          options.folderIconsVisible.current &&
          hoverVisualActiveRef.current
        ),
      visualOptions
    );
  }

  function setHoverVisualActive(
    active: boolean,
    visualOptions?: VisualOptions
  ): void {
    const card = cardRef.current;
    if (!card) {
      return;
    }
    const nextActive = Boolean(active);
    if (hoverVisualActiveRef.current === nextActive) {
      syncFolderExpandedState(visualOptions);
      return;
    }
    hoverVisualActiveRef.current = nextActive;
    card.classList.toggle('x-nt-bookmark-card--hover', nextActive);
    syncFolderExpandedState(visualOptions);
  }

  function setMenuVisualLocked(
    active: boolean,
    visualOptions?: VisualOptions
  ): void {
    const nextActive = Boolean(active);
    if (menuVisualLockedRef.current === nextActive) {
      if (nextActive) {
        setHoverVisualActive(true, visualOptions);
        setFolderExpanded(true, visualOptions);
      }
      return;
    }
    menuVisualLockedRef.current = nextActive;
    clearHoverIntentTimer();
    setHoverVisualActive(nextActive, visualOptions);
    if (nextActive) {
      setFolderExpanded(true, visualOptions);
    }
  }

  function deactivateBookmarkHoverVisual(): void {
    clearHoverIntentTimer();
    if (shouldKeepMenuVisualActive()) {
      setHoverVisualActive(true);
      return;
    }
    setHoverVisualActive(false);
  }

  function resetInteractionState(): void {
    const card = cardRef.current;
    if (!card) {
      return;
    }
    clearHoverIntentTimer();
    menuVisualLockedRef.current = Boolean(isFolder && menuMode && card.getAttribute('aria-expanded') === 'true');
    hoverVisualActiveRef.current = menuVisualLockedRef.current;
    copyActionFocusedRef.current = false;
    card.classList.toggle('x-nt-bookmark-card--hover', menuVisualLockedRef.current);
    card.removeAttribute('data-bookmark-copy-action-visible');
    syncFolderExpandedState();
  }

  function clearDragClickSuppression(): void {
    const card = cardRef.current;
    if (
      card?._xBookmarkSuppressClickTimer &&
      typeof options.windowObj.clearTimeout === 'function'
    ) {
      options.windowObj.clearTimeout(card._xBookmarkSuppressClickTimer);
      card._xBookmarkSuppressClickTimer = 0;
    }
    if (card) {
      card._xBookmarkSuppressClick = false;
    }
  }

  function consumeDragClickSuppression(): boolean {
    const card = cardRef.current;
    if (!card?._xBookmarkSuppressClick) {
      return false;
    }
    clearDragClickSuppression();
    return true;
  }

  function dispose(): void {
    clearHoverIntentTimer();
    clearDragClickSuppression();
  }

  function setCopyActionVisible(visible: boolean): void {
    const card = cardRef.current;
    if (!card) {
      return;
    }
    if (visible) {
      card.setAttribute('data-bookmark-copy-action-visible', 'true');
    } else {
      card.removeAttribute('data-bookmark-copy-action-visible');
    }
  }

  function activateBookmarkHoverVisual(
    event: ReactPointerEvent<BookmarkCardElement>
  ): void {
    const card = cardRef.current;
    if (!card) {
      return;
    }
    if (options.shouldSuppressHover(card, event.nativeEvent)) {
      clearHoverIntentTimer();
      if (!shouldKeepMenuVisualActive()) {
        setHoverVisualActive(false);
      }
      return;
    }
    const pointerType = String(event.pointerType || '');
    if (!options.shouldDelayHoverFromRecent(pointerType)) {
      clearHoverIntentTimer();
      setHoverVisualActive(true);
      return;
    }
    clearHoverIntentTimer();
    hoverIntentTimerRef.current = options.windowObj.setTimeout(() => {
      hoverIntentTimerRef.current = 0;
      setHoverVisualActive(true);
    }, options.hoverDelayFromRecentMs);
  }

  function openBookmarkUrl(event: ActivationEvent): void {
    options.openUrl(item.url ? String(item.url) : '', {
      openInBackgroundTab: shouldOpenUrlInBackground(event)
    });
  }

  function activateCard(
    event:
      | ReactMouseEvent<BookmarkCardElement>
      | ReactKeyboardEvent<BookmarkCardElement>
  ): void {
    const card = cardRef.current;
    if (!card) {
      return;
    }
    if (event.type === 'click' && consumeDragClickSuppression()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.type === 'click' && options.isActivationSuppressed()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    options.hideCursorTooltip();
    if (isFolder) {
      if (menuMode) {
        setMenuVisualLocked(true);
        options.openFolderMenu(item, card);
        return;
      }
      setFolderExpanded(true);
      options.openFolder(item.id);
      return;
    }
    openBookmarkUrl(event);
  }

  useLayoutEffect(() => {
    const card = cardRef.current;
    const icon = iconRef.current;
    const favicon = faviconRef.current;
    if (!card) {
      return;
    }
    applyBookmarkCardMetadata(card, item, index);
    card._xTitleText = titleText;
    card._xNoThemeTint = isFolder;
    card._xTheme = immediateTheme;
    card._xHost = host;
    card._xDeactivateBookmarkHoverVisual =
      deactivateBookmarkHoverVisual;
    card._xSyncBookmarkFolderExpandedState =
      syncFolderExpandedState;
    card._xResetBookmarkInteractionState = resetInteractionState;
    card._xSetBookmarkMenuVisualActive =
      isFolder && menuMode ? setMenuVisualLocked : undefined;
    card._xDisposeBookmarkCard = dispose;
    card._xSyncBookmarkShortcutState = () => setShortcutAdded(options.hasShortcut(item));

    if (!isTopbarMode) {
      options.applyCardTheme(card, immediateTheme, host);
    }
    if (isFolder && icon) {
      options.initFolderPathMorph(icon);
    }
    if (!isFolder && favicon) {
      const itemUrl = item.url ? String(item.url) : '';
      options.attachFaviconWithFallbacks(favicon, itemUrl, host, {
        primaryUrl: options.getBrowserPageFaviconUrl(itemUrl),
        browserUrl: getBrowserFaviconCandidate(
          options,
          itemUrl,
          host
        )
      });
    }
    previewItems.forEach((preview, previewIndex) => {
      const image = previewFaviconRefs.current[previewIndex];
      if (!image) {
        return;
      }
      options.attachFaviconWithFallbacks(
        image,
        preview.url,
        preview.host,
        {
          primaryUrl: options.getBrowserPageFaviconUrl(preview.url),
          browserUrl: getBrowserFaviconCandidate(
            options,
            preview.url,
            preview.host
          )
        }
      );
    });
    options.bindCursorTooltip(
      card,
      () => card._xTitleText || titleText,
      {
        maxWidth: 460,
        shouldShow: (_target, event) => {
          const eventTarget = event?.target;
          if (
            eventTarget instanceof Element &&
            eventTarget.closest('.x-nt-bookmark-copy-action, .x-nt-bookmark-pin-action')
          ) {
            return false;
          }
          return isBookmarkTitleTruncated(titleRef.current);
        }
      }
    );
    if (!isTopbarMode && themeUrl) {
      options.queueThemeForTarget(
        card,
        themeSuggestion,
        (theme) => {
          if (!card.isConnected) {
            return;
          }
          card._xTheme = theme || card._xTheme;
          options.applyCardTheme(card, card._xTheme, host);
        },
        { priority: index < 4 ? 0 : 2 }
      );
    }
    return dispose;
  }, [
    host,
    immediateTheme,
    index,
    isFolder,
    isTopbarMode,
    item,
    menuMode,
    options,
    previewItems,
    themeSuggestion,
    themeUrl,
    titleText
  ]);

  const bookmarkId = item.id ? String(item.id) : '';
  const parentId = item.parentId ? String(item.parentId) : '';
  const bookmarkIndex = Number(item.index);
  const draggable = Boolean(
    bookmarkId && parentId && Number.isFinite(bookmarkIndex)
  );

  return (
    <div
      ref={cardRef}
      className={
        `x-nt-bookmark-card${
          isFolder ? ' x-nt-bookmark-card--folder' : ''
        }`
      }
      tabIndex={0}
      role="button"
      draggable={false}
      title={titleText}
      aria-label={options.formatMessage(
        'open_prefix',
        '打开 {title}',
        { title: titleText }
      )}
      aria-haspopup={isFolder && menuMode ? 'menu' : undefined}
      aria-expanded={isFolder && menuMode ? false : undefined}
      data-cursor-tooltip={titleText}
      data-bookmark-id={bookmarkId}
      data-bookmark-type={item.type ? String(item.type) : ''}
      data-bookmark-view-mode={isTopbarMode ? 'top' : 'grid'}
      data-bookmark-parent-id={parentId}
      data-bookmark-index={
        Number.isFinite(bookmarkIndex) ? String(bookmarkIndex) : ''
      }
      data-bookmark-draggable={draggable ? 'true' : 'false'}
      data-has-shortcut-action={hasPinAction ? 'true' : undefined}
      onPointerEnter={activateBookmarkHoverVisual}
      onPointerLeave={deactivateBookmarkHoverVisual}
      onPointerCancel={deactivateBookmarkHoverVisual}
      onFocus={(event: ReactFocusEvent<BookmarkCardElement>) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        clearHoverIntentTimer();
        setHoverVisualActive(true);
      }}
      onBlur={(event: ReactFocusEvent<BookmarkCardElement>) => {
        if (event.target === event.currentTarget) {
          deactivateBookmarkHoverVisual();
        }
      }}
      onPointerDown={(event) => {
        clearDragClickSuppression();
        clearHoverIntentTimer();
        if (
          cardRef.current &&
          options.shouldSuppressHover(
            cardRef.current,
            event.nativeEvent
          ) &&
          !shouldKeepMenuVisualActive()
        ) {
          setHoverVisualActive(false);
        }
      }}
      onDragStart={(event) => event.preventDefault()}
      onContextMenu={(event) => {
        const card = cardRef.current;
        if (!card) {
          return;
        }
        options.onItemContextMenu({
          event: event.nativeEvent,
          item,
          element: card,
          sourceKind: 'card'
        });
      }}
      onClick={activateCard}
      onAuxClick={(event) => {
        if (isFolder || Number(event.button) !== 1) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (options.isActivationSuppressed()) {
          return;
        }
        options.hideCursorTooltip();
        openBookmarkUrl(event);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }
        event.preventDefault();
        activateCard(event);
      }}
    >
      {isFolder ? (
        <span
          ref={iconRef}
          className="x-nt-bookmark-icon x-nt-bookmark-icon--figma"
          aria-hidden="true"
          dangerouslySetInnerHTML={folderIconHtml}
        />
      ) : (
        <img
          ref={faviconRef}
          className="x-nt-bookmark-icon"
          alt={siteName || options.t('site_icon_alt', '站点')}
          width={22}
          height={22}
          decoding="async"
          loading={index < 4 ? 'eager' : 'lazy'}
          fetchPriority={index < 4 ? 'high' : undefined}
          draggable={false}
        />
      )}
      <span ref={titleRef} className="x-nt-bookmark-title">
        {safeTitleText}
      </span>
      {hasPinAction ? <button type="button" className="x-nt-bookmark-pin-action"
        title={pinLabel} aria-label={`${pinLabel}: ${safeTitleText}`}
        aria-disabled={pinBusy || shortcutAdded} aria-busy={pinBusy}
        data-added={shortcutAdded ? 'true' : 'false'}
        dangerouslySetInnerHTML={{ __html: options.getRiSvg(
          pinBusy ? 'ri-loader-4-line' : shortcutAdded ? 'ri-pushpin-fill' : 'ri-pushpin-line', 'ri-size-16') }}
        onPointerEnter={() => options.hideCursorTooltip()}
        onFocus={() => options.hideCursorTooltip()}
        onPointerDown={event => event.stopPropagation()}
        onKeyDown={event => event.stopPropagation()}
        onAuxClick={event => { event.preventDefault(); event.stopPropagation(); }}
        onContextMenu={event => event.stopPropagation()}
        onClick={event => {
          event.preventDefault(); event.stopPropagation(); options.hideCursorTooltip();
          if (options.isActivationSuppressed()) return;
          void pinBookmark();
        }} /> : null}
      {!isFolder && !isTopbarMode ? (
        <button
          type="button"
          className="x-nt-bookmark-copy-action"
          aria-label={options.t('bookmarks_copy_url', 'Copy link')}
          dangerouslySetInnerHTML={{
            __html: options.getRiSvg(
              'ri-file-copy-line',
              'ri-size-16'
            )
          }}
          onPointerEnter={() => {
            options.hideCursorTooltip();
            setCopyActionVisible(true);
          }}
          onPointerLeave={() => {
            if (!copyActionFocusedRef.current) {
              setCopyActionVisible(false);
            }
          }}
          onFocus={() => {
            copyActionFocusedRef.current = true;
            options.hideCursorTooltip();
            setCopyActionVisible(true);
          }}
          onBlur={() => {
            copyActionFocusedRef.current = false;
            setCopyActionVisible(false);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            options.hideCursorTooltip();
            void Promise.resolve()
              .then(() => options.copyUrl(item.url))
              .catch(() => {});
          }}
          onKeyDown={(event) => event.stopPropagation()}
        />
      ) : null}
      {previewItems.length > 0 ? (
        <span className="x-nt-folder-preview">
          {previewItems.map((preview, previewIndex) => (
            <img
              key={`${previewIndex}::${preview.url}`}
              ref={(image) => {
                previewFaviconRefs.current[previewIndex] = image;
              }}
              className="x-nt-folder-preview-favicon"
              width={24}
              height={24}
              style={{
                '--x-nt-folder-favicon-rot': preview.rotation,
                zIndex: 10 + previewIndex
              } as React.CSSProperties}
              alt=""
              loading="eager"
              decoding="async"
              aria-hidden="true"
              draggable={false}
            />
          ))}
        </span>
      ) : null}
    </div>
  );
}

function BookmarksList({
  items,
  viewMode,
  menuMode,
  options
}: {
  items: BookmarkItem[];
  viewMode: 'folder' | 'list' | 'top';
  menuMode: boolean;
  options: NormalizedBookmarksOptions;
}) {
  return items.map((item, index) => (
    <BookmarkCard
      key={`${viewMode}::${item.id ? `${item.id}::${item.type || ''}` : getBookmarkCacheKey(item)}`}
      item={item}
      index={index}
      viewMode={viewMode}
      menuMode={menuMode}
      options={options}
    />
  ));
}

function EmptyFolderState({
  options
}: {
  options: NormalizedBookmarksOptions;
}) {
  return (
    <div
      className="x-nt-bookmark-empty"
      dangerouslySetInnerHTML={{
        __html:
          `${options.getRiSvg(
            'ri-file-3-line',
            'ri-size-16'
          )}<span>${
            options.t('bookmarks_empty_folder', '暂无内容')
          }</span>`
      }}
    />
  );
}

function createNoopController(
  rawOptions: BookmarksViewOptions
): BookmarksViewController {
  const cards = Array.isArray(rawOptions.cards) ? rawOptions.cards : [];
  return {
    refreshShortcutStates() {},
    appendEmptyFolderState() {},
    clear() {
      cards.length = 0;
    },
    render(items, state = {}) {
      const normalizedItems = Array.isArray(items) ? items : [];
      const folderId = state.folderId ? String(state.folderId) : '';
      const rootFolderId = state.rootFolderId
        ? String(state.rootFolderId)
        : '1';
      const viewMode =
        state.viewMode === 'list' || state.viewMode === 'top'
          ? state.viewMode
          : 'folder';
      return {
        changed: false,
        count: normalizedItems.length,
        isAtRoot: folderId === rootFolderId,
        signature: `${folderId}##${viewMode}##${getBookmarksSignature(
          normalizedItems
        )}`
      };
    },
    getSignature: getBookmarksSignature,
    getCacheKey: getBookmarkCacheKey,
    setFolderIconsVisible(value) {
      return value !== false;
    },
    getCards() {
      return cards;
    }
  };
}

export function createBookmarksView(
  rawOptions: BookmarksViewOptions = {}
): BookmarksViewController {
  const normalizedOptions = normalizeOptions(rawOptions);
  if (!normalizedOptions) {
    return createNoopController(rawOptions);
  }
  const options: NormalizedBookmarksOptions = normalizedOptions;
  const reactRoot: Root = createRoot(options.grid);
  options.grid.setAttribute('data-react-island', 'bookmarks');

  function syncCards(resetInteraction = false): void {
    options.cards.length = 0;
    options.grid
      .querySelectorAll<BookmarkCardElement>('.x-nt-bookmark-card')
      .forEach((card) => {
        options.cards.push(card);
        if (
          resetInteraction &&
          typeof card._xResetBookmarkInteractionState === 'function'
        ) {
          card._xResetBookmarkInteractionState();
        }
      });
  }

  function clear(): void {
    options.hideCursorTooltip();
    flushSync(() => {
      reactRoot.render(null);
    });
    options.cards.length = 0;
  }

  function appendEmptyFolderState(): void {
    options.hideCursorTooltip();
    flushSync(() => {
      reactRoot.render(<EmptyFolderState options={options} />);
    });
    options.cards.length = 0;
  }

  function render(
    items: BookmarkItem[],
    state: BookmarksRenderState = {}
  ): BookmarksRenderResult {
    const normalizedItems = Array.isArray(items) ? items : [];
    const previousSignature =
      typeof state.signature === 'string' ? state.signature : '';
    const folderId = state.folderId ? String(state.folderId) : '';
    const rootFolderId = state.rootFolderId
      ? String(state.rootFolderId)
      : '1';
    const viewMode =
      state.viewMode === 'list' || state.viewMode === 'top'
        ? state.viewMode
        : 'folder';
    const menuMode = Boolean(state.menuMode);
    const isAtRoot = folderId === rootFolderId;
    const nextSignature =
      `${folderId}##${viewMode}##${getBookmarksSignature(
        normalizedItems
      )}`;

    if (nextSignature === previousSignature) {
      if (normalizedItems.length === 0 && !isAtRoot) {
        appendEmptyFolderState();
      }
      return {
        changed: false,
        count: normalizedItems.length,
        isAtRoot,
        signature: nextSignature
      };
    }

    options.hideCursorTooltip();
    flushSync(() => {
      reactRoot.render(
        normalizedItems.length > 0 ? (
          <BookmarksList
            items={normalizedItems}
            viewMode={viewMode}
            menuMode={menuMode}
            options={options}
          />
        ) : (
          isAtRoot ? null : <EmptyFolderState options={options} />
        )
      );
    });
    syncCards(true);
    return {
      changed: true,
      count: normalizedItems.length,
      isAtRoot,
      signature: nextSignature
    };
  }

  return {
    appendEmptyFolderState,
    refreshShortcutStates() {
      options.cards.forEach(card => card._xSyncBookmarkShortcutState?.());
    },
    clear,
    render,
    getSignature: getBookmarksSignature,
    getCacheKey: getBookmarkCacheKey,
    setFolderIconsVisible(value) {
      options.folderIconsVisible.current = value !== false;
      options.cards.forEach((card) => {
        card._xSyncBookmarkFolderExpandedState?.();
      });
      return options.folderIconsVisible.current;
    },
    getCards() {
      return options.cards;
    }
  };
}

export function createBookmarksViewApi() {
  return Object.freeze({
    implementation: 'react',
    createBookmarksView(options?: BookmarksViewOptions) {
      return createBookmarksView(options);
    },
    getBookmarkCacheKey,
    getBookmarksSignature
  });
}
