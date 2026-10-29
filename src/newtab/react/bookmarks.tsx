import {
  Fragment,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react';
import { flushSync } from 'react-dom';
import { isElementTextTruncated } from '../../shared/react/text-overflow';
import { followEmptyStateArtTheme } from '../../shared/ui/empty-state-art';
import type { CursorTooltipOptions } from '../../shared/ui/cursor-tooltip-model';
import type { ThemeVariant } from '../../shared/favicon/favicon-theme';
import { queryHtmlTags } from '../../shared/dom-lookup';
import { EmptyStateArt } from '../../shared/react/empty-state-art';
import { FaviconFallback, FolderPreviewFaviconFallback } from '../../shared/react/favicon-fallback';
import { createRenderStore, type RenderStore } from '../../shared/react/render-store';
import { RemixIcon } from '../../shared/react/remix-icon';
import { FolderIcon } from './folder-icon';
import { getPagePortals } from '../app/portals';

// A site's theme as the page resolves it; the view passes it through.
type ThemeValue = Partial<ThemeVariant> | null;
// `instant` jumps to the end of a folder morph.
type VisualOptions = { instant?: boolean } | undefined;
type ActivationEvent = {
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
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
}

export interface BookmarkCardElement extends HTMLDivElement {
  _xBookmarkItem?: BookmarkItem;
  _xBookmarkPageIndex?: number;
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
}

interface ThemeSuggestion {
  type: 'bookmark';
  url: string;
  title: string;
}

interface OpenUrlOptions {
  openInBackgroundTab: boolean;
  // Option/Alt: the other of the current and a new tab.
  openInOtherTab: boolean;
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
  contextMenuBookmark: RenderStore<string | null>;
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
  // Marks the card of the bookmark whose context menu is open, or none.
  setContextMenuBookmark(id: string | null): void;
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
    contextMenuBookmark: createRenderStore<string | null>(null),
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

// The drag controllers read the bookmark and its place in the page from the card.
function applyBookmarkCardMetadata(
  card: BookmarkCardElement,
  item: BookmarkItem,
  index: number
): void {
  card._xBookmarkItem = item;
  card._xBookmarkPageIndex = Number.isFinite(index) ? index : 0;
}

// How a card looks: pointed at or focused, its folder icon open, its copy
// button showing, its folder menu open.
interface CardVisual {
  hover: boolean;
  expanded: boolean;
  copyVisible: boolean;
  menuOpen: boolean;
}

const CARD_VISUAL_AT_REST: CardVisual = { hover: false, expanded: false, copyVisible: false, menuOpen: false };

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
  const copyActionVisibleRef = useRef(false);
  // The refs hold the visual state the handlers decide on; this draws it.
  const [visual, setVisual] = useState<CardVisual>(CARD_VISUAL_AT_REST);

  function commitVisual(): void {
    const next: CardVisual = {
      hover: hoverVisualActiveRef.current,
      expanded: folderExpandedRef.current,
      copyVisible: copyActionVisibleRef.current,
      menuOpen: menuVisualLockedRef.current
    };
    setVisual((current) => (
      current.hover === next.hover &&
      current.expanded === next.expanded &&
      current.copyVisible === next.copyVisible &&
      current.menuOpen === next.menuOpen
        ? current
        : next
    ));
  }

  const isTopbarMode = viewMode === 'top';
  const isFolder = item.type === 'folder';
  const contextMenuBookmark = useSyncExternalStore(
    options.contextMenuBookmark.subscribe,
    options.contextMenuBookmark.getSnapshot
  );
  const contextMenuOpen = contextMenuBookmark !== null && contextMenuBookmark === String(item.id || '');
  const folderIconId = String(item.id || `folder-${index}`);
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
  // Built once per value, so the card effect below reruns when the bookmark
  // changes rather than on every render.
  const themeSuggestion = useMemo<ThemeSuggestion>(() => ({
    type: 'bookmark',
    url: themeUrl,
    title: titleText
  }), [themeUrl, titleText]);
  const immediateTheme = isTopbarMode
    ? null
    : options.getImmediateThemeForSuggestion(themeSuggestion);
  const previewUrls = item.previewUrls;
  const previewItems = useMemo(() => (isFolder && !isTopbarMode
    ? (Array.isArray(previewUrls) ? previewUrls : [])
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
    : []), [isFolder, isTopbarMode, item.id, options, previewUrls]);

  function clearHoverIntentTimer(): void {
    if (!hoverIntentTimerRef.current) {
      return;
    }
    options.windowObj.clearTimeout(hoverIntentTimerRef.current);
    hoverIntentTimerRef.current = 0;
  }

  function shouldKeepMenuVisualActive(): boolean {
    return Boolean(isFolder && menuMode && menuVisualLockedRef.current);
  }

  function setFolderExpanded(
    active: boolean,
    visualOptions?: VisualOptions
  ): void {
    const folderIcon = iconRef.current;
    const nextActive = Boolean(active);
    if (!folderIcon || folderExpandedRef.current === nextActive) {
      return;
    }
    folderExpandedRef.current = nextActive;
    commitVisual();
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
    const nextActive = Boolean(active);
    if (hoverVisualActiveRef.current === nextActive) {
      syncFolderExpandedState(visualOptions);
      return;
    }
    hoverVisualActiveRef.current = nextActive;
    commitVisual();
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
    commitVisual();
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

  // Back to rest, except that a card whose folder menu is open stays lit.
  function resetInteractionState(): void {
    clearHoverIntentTimer();
    menuVisualLockedRef.current = shouldKeepMenuVisualActive();
    hoverVisualActiveRef.current = menuVisualLockedRef.current;
    copyActionFocusedRef.current = false;
    copyActionVisibleRef.current = false;
    commitVisual();
    syncFolderExpandedState();
  }

  function dispose(): void {
    clearHoverIntentTimer();
  }

  function setCopyActionVisible(visible: boolean): void {
    copyActionVisibleRef.current = visible;
    commitVisual();
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
      openInBackgroundTab: shouldOpenUrlInBackground(event),
      openInOtherTab: Boolean(event && event.altKey)
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

  // The card hands these helpers to the adapter modules in src/. Each render
  // makes new ones, so the card gets forwarders that call the latest render's
  // helpers, and the effect below need not rerun whenever they change.
  const cardHelpersRef = useRef({
    deactivateBookmarkHoverVisual,
    syncFolderExpandedState,
    resetInteractionState,
    setMenuVisualLocked,
    dispose
  });
  useLayoutEffect(() => {
    cardHelpersRef.current = {
      deactivateBookmarkHoverVisual,
      syncFolderExpandedState,
      resetInteractionState,
      setMenuVisualLocked,
      dispose
    };
  });

  useLayoutEffect(() => {
    const card = cardRef.current;
    const icon = iconRef.current;
    const favicon = faviconRef.current;
    if (!card) {
      return;
    }
    const disposeCard = () => cardHelpersRef.current.dispose();
    applyBookmarkCardMetadata(card, item, index);
    card._xTitleText = titleText;
    card._xNoThemeTint = isFolder;
    card._xTheme = immediateTheme;
    card._xHost = host;
    // Called from outside React (drag controllers, the folder menu), so each
    // draws its change before returning; they read the card right after.
    card._xDeactivateBookmarkHoverVisual = () =>
      flushSync(() => cardHelpersRef.current.deactivateBookmarkHoverVisual());
    card._xSyncBookmarkFolderExpandedState = (visualOptions) =>
      flushSync(() => cardHelpersRef.current.syncFolderExpandedState(visualOptions));
    card._xResetBookmarkInteractionState = () =>
      flushSync(() => cardHelpersRef.current.resetInteractionState());
    card._xSetBookmarkMenuVisualActive = isFolder && menuMode
      ? (active, visualOptions) =>
        flushSync(() => cardHelpersRef.current.setMenuVisualLocked(active, visualOptions))
      : undefined;
    card._xDisposeBookmarkCard = disposeCard;

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
            eventTarget.closest('.x-nt-bookmark-copy-action')
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
          const nextTheme = theme || card._xTheme || null;
          card._xTheme = nextTheme;
          options.applyCardTheme(card, nextTheme, host);
        },
        { priority: index < 4 ? 0 : 2 }
      );
    }
    return disposeCard;
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
        }${visual.hover ? ' x-nt-bookmark-card--hover' : ''}${
          visual.expanded ? ' x-nt-bookmark-card--folder-expanded' : ''
        }`
      }
      data-bookmark-context-menu-open={contextMenuOpen ? 'true' : undefined}
      data-bookmark-copy-action-visible={visual.copyVisible ? 'true' : undefined}
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
      aria-expanded={isFolder && menuMode ? visual.menuOpen : undefined}
      data-cursor-tooltip={titleText}
      data-bookmark-id={bookmarkId}
      data-bookmark-type={item.type ? String(item.type) : ''}
      data-bookmark-view-mode={isTopbarMode ? 'top' : 'grid'}
      data-bookmark-parent-id={parentId}
      data-bookmark-index={
        Number.isFinite(bookmarkIndex) ? String(bookmarkIndex) : ''
      }
      data-bookmark-draggable={draggable ? 'true' : 'false'}
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
        >
          <FolderIcon idSuffix={`bookmark-${folderIconId}`} folderId={item.id === undefined ? undefined : String(item.id)} />
        </span>
      ) : (
        <>
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
          <FaviconFallback tone="bookmark" />
        </>
      )}
      <span ref={titleRef} className="x-nt-bookmark-title">
        {safeTitleText}
      </span>
      {!isFolder && !isTopbarMode ? (
        <button
          type="button"
          className="x-nt-bookmark-copy-action"
          aria-label={options.t('bookmarks_copy_url', 'Copy link')}
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
          onKeyDown={(event) => event.stopPropagation()}>
          <RemixIcon name="ri-file-copy-line" size={16} />
        </button>
      ) : null}
      {previewItems.length > 0 ? (
        <span className="x-nt-folder-preview">
          {previewItems.map((preview, previewIndex) => (
            <Fragment key={`${previewIndex}::${preview.url}`}>
              <FolderPreviewFaviconFallback />
              <img
                ref={(image) => {
                  previewFaviconRefs.current[previewIndex] = image;
                }}
                className="x-nt-folder-preview-favicon"
                width={24}
                height={24}
                style={{
                  '--x-nt-folder-favicon-rot': preview.rotation,
                  zIndex: 10 + previewIndex
                }}
                alt=""
                loading="eager"
                decoding="async"
                aria-hidden="true"
                draggable={false}
              />
            </Fragment>
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
  // EmptyStateArt keeps the art across re-renders of the same empty folder,
  // so it is not redrawn (and replayed) each time; its theme follows the
  // wallpaper ink.
  const artRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const svg = artRef.current?.querySelector('svg');
    return svg ? followEmptyStateArtTheme(svg) : undefined;
  }, []);
  return (
    <div className="x-nt-bookmark-empty">
      <span
        ref={artRef}
        className="x-nt-bookmark-empty__art"
      >
        <EmptyStateArt name="emptyFolder" size={112} />
      </span>
      <span>{options.t('bookmarks_empty_folder', '暂无内容')}</span>
    </div>
  );
}

function createNoopController(
  rawOptions: BookmarksViewOptions
): BookmarksViewController {
  const cards = Array.isArray(rawOptions.cards) ? rawOptions.cards : [];
  return {
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
    },
    setContextMenuBookmark() {}
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
  options.grid.setAttribute('data-react-island', 'bookmarks');

  function syncCards(resetInteraction = false): void {
    options.cards.length = 0;
    queryHtmlTags(options.grid, '.x-nt-bookmark-card', 'div')
      .forEach((element) => {
        const card: BookmarkCardElement = element;
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
    getPagePortals().show(options.grid, null);
    options.cards.length = 0;
  }

  function appendEmptyFolderState(): void {
    options.hideCursorTooltip();
    getPagePortals().show(options.grid, <EmptyFolderState options={options} />);
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
    getPagePortals().show(options.grid, (
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
    ));
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
    },
    setContextMenuBookmark(id) {
      options.contextMenuBookmark.render(id);
    }
  };
}
